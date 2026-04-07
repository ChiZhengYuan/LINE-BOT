import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { datetimeInput, parseBody, parseQuery } from "../lib/validation.js";
import { createNotification, logOperation } from "../services/activity.js";
import { pushText } from "../services/line.js";

export const announcementsRouter = express.Router();

const listSchema = z.object({
  groupId: z.string().optional(),
  q: z.string().optional(),
  isActive: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const bodySchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  scheduleType: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]).default("ONCE"),
  targetGroupIds: z.array(z.string()).optional().default([]),
  startAt: datetimeInput(),
  endAt: datetimeInput(),
  nextRunAt: datetimeInput(),
  isActive: z.boolean().optional(),
  flexMessage: z.any().optional().nullable()
});

announcementsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.isActive === "true") where.isActive = true;
  if (query.isActive === "false") where.isActive = false;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { content: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: { group: true, jobs: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.announcement.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

announcementsRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = parseBody(bodySchema, req, res);
  if (!data) return;

  const item = await prisma.announcement.create({
    data: {
      groupId: data.groupId,
      title: data.title,
      content: data.content,
      scheduleType: data.scheduleType,
      targetGroupIds: data.targetGroupIds || [],
      startAt: data.startAt ? new Date(data.startAt) : null,
      endAt: data.endAt ? new Date(data.endAt) : null,
      nextRunAt: data.nextRunAt ? new Date(data.nextRunAt) : null,
      isActive: data.isActive ?? true,
      flexMessage: data.flexMessage ?? null
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: data.groupId,
    eventType: "ANNOUNCEMENT_CREATED",
    title: "建立公告",
    detail: data.title
  });

  res.status(201).json({ item });
});

announcementsRouter.get("/:announcementId", requireAuth, async (req, res) => {
  const item = await prisma.announcement.findUnique({
    where: { id: req.params.announcementId },
    include: { group: true, jobs: { orderBy: { createdAt: "desc" } } }
  });

  if (!item) return res.status(404).json({ message: "找不到公告" });
  res.json({ item });
});

announcementsRouter.patch("/:announcementId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  const item = await prisma.announcement.update({
    where: { id: req.params.announcementId },
    data: {
      title: typeof payload.title === "string" ? payload.title : undefined,
      content: typeof payload.content === "string" ? payload.content : undefined,
      scheduleType: payload.scheduleType || undefined,
      targetGroupIds: Array.isArray(payload.targetGroupIds) ? payload.targetGroupIds : undefined,
      startAt: payload.startAt ? new Date(payload.startAt) : undefined,
      endAt: payload.endAt ? new Date(payload.endAt) : undefined,
      nextRunAt: payload.nextRunAt ? new Date(payload.nextRunAt) : undefined,
      isActive: typeof payload.isActive === "boolean" ? payload.isActive : undefined,
      flexMessage: payload.flexMessage ?? undefined
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "ANNOUNCEMENT_UPDATED",
    title: "更新公告",
    detail: item.title
  });

  res.json({ item });
});

announcementsRouter.delete("/:announcementId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const item = await prisma.announcement.delete({ where: { id: req.params.announcementId } });
  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "ANNOUNCEMENT_UPDATED",
    title: "刪除公告",
    detail: item.title
  });
  res.json({ ok: true });
});

announcementsRouter.post("/:announcementId/send", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const item = await prisma.announcement.findUnique({
      where: { id: req.params.announcementId },
      include: { group: true }
    });

    if (!item) return res.status(404).json({ message: "找不到公告" });

    const targets = item.targetGroupIds?.length ? item.targetGroupIds : [item.group.lineGroupId];
    const message = buildAnnouncementMessage(item);

    for (const target of targets) {
      await pushText(target, message);
      await createNotification({
        groupId: item.groupId,
        type: "ANNOUNCEMENT_SENT",
        title: `公告已送出：${item.title}`,
        content: `已送出到 ${target}`,
        meta: { target }
      });
    }

    await prisma.announcement.update({
      where: { id: item.id },
      data: {
        lastSentAt: new Date(),
        sendCount: { increment: 1 },
        nextRunAt: item.scheduleType === "ONCE" ? null : item.nextRunAt
      }
    });

    await prisma.announcementJob.create({
      data: {
        announcementId: item.id,
        runAt: new Date(),
        sentAt: new Date(),
        status: "SENT",
        result: { targets }
      }
    });

    await logOperation({
      adminUserId: req.user.sub,
      groupId: item.groupId,
      eventType: "ANNOUNCEMENT_SENT",
      title: "立即發送公告",
      detail: item.title
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function buildAnnouncementMessage(item) {
  return `📢 ${item.title}\n\n${item.content}`;
}
