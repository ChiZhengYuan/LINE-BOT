import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { datetimeInput, parseBody, parseQuery } from "../lib/validation.js";
import { ensureMember, logOperation, rebuildRankingsForGroup } from "../services/activity.js";

export const missionsRouter = express.Router();

const listSchema = z.object({
  groupId: z.string().optional(),
  isActive: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const bodySchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  missionType: z.enum(["CHECKIN", "MESSAGE_COUNT", "KEYWORD"]),
  targetCount: z.coerce.number().int().min(1),
  keyword: z.string().optional().nullable(),
  pointsReward: z.coerce.number().int().min(0).default(0),
  startAt: datetimeInput(),
  dueAt: datetimeInput(),
  isActive: z.boolean().optional()
});

missionsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.isActive === "true") where.isActive = true;
  if (query.isActive === "false") where.isActive = false;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
      { keyword: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total] = await Promise.all([
    prisma.mission.findMany({
      where,
      include: { group: true, progress: { include: { member: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.mission.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

missionsRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = parseBody(bodySchema, req, res);
  if (!data) return;

  const item = await prisma.mission.create({
    data: {
      groupId: data.groupId,
      title: data.title,
      description: data.description ?? null,
      missionType: data.missionType,
      targetCount: data.targetCount,
      keyword: data.keyword ?? null,
      pointsReward: data.pointsReward,
      startAt: data.startAt ? new Date(data.startAt) : null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      isActive: data.isActive ?? true
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: data.groupId,
    eventType: "MISSION_CREATED",
    title: "建立任務",
    detail: data.title
  });

  res.status(201).json({ item });
});

missionsRouter.patch("/:missionId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  const item = await prisma.mission.update({
    where: { id: req.params.missionId },
    data: {
      title: typeof payload.title === "string" ? payload.title : undefined,
      description: typeof payload.description === "string" ? payload.description : undefined,
      missionType: payload.missionType || undefined,
      targetCount: payload.targetCount ? Number(payload.targetCount) : undefined,
      keyword: typeof payload.keyword === "string" ? payload.keyword : undefined,
      pointsReward: payload.pointsReward ? Number(payload.pointsReward) : undefined,
      startAt: payload.startAt ? new Date(payload.startAt) : undefined,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
      isActive: typeof payload.isActive === "boolean" ? payload.isActive : undefined
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "MISSION_UPDATED",
    title: "更新任務",
    detail: item.title
  });

  res.json({ item });
});

missionsRouter.delete("/:missionId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const item = await prisma.mission.delete({ where: { id: req.params.missionId } });
  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "MISSION_UPDATED",
    title: "刪除任務",
    detail: item.title
  });
  res.json({ ok: true });
});

missionsRouter.post("/:missionId/progress", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  const mission = await prisma.mission.findUnique({ where: { id: req.params.missionId } });
  if (!mission) return res.status(404).json({ message: "Mission not found" });

  const member = await ensureMember({
    group: await prisma.group.findFirst({ where: { id: mission.groupId } }),
    lineUserId: payload.lineUserId,
    displayName: payload.displayName
  });

  const current = await prisma.missionProgress.upsert({
    where: {
      missionId_memberId: {
        missionId: mission.id,
        memberId: member.id
      }
    },
    update: {
      currentCount: { increment: 1 },
      lastProgressAt: new Date(),
      progressMeta: payload.meta || null
    },
    create: {
      missionId: mission.id,
      memberId: member.id,
      currentCount: 1,
      targetCount: mission.targetCount,
      progressMeta: payload.meta || null
    }
  });

  if (current.currentCount >= mission.targetCount) {
    await prisma.missionProgress.update({
      where: { missionId_memberId: { missionId: mission.id, memberId: member.id } },
      data: {
        isCompleted: true,
        completedAt: new Date()
      }
    });

    await prisma.member.update({
      where: { id: member.id },
      data: {
        missionCompletedCount: { increment: 1 },
        activeScore: { increment: mission.pointsReward }
      }
    });
    await rebuildRankingsForGroup(mission.groupId).catch(() => {});
  }

  await logOperation({
    adminUserId: req.user.sub,
    groupId: mission.groupId,
    memberId: member.id,
    eventType: "MISSION_UPDATED",
    title: "推進任務",
    detail: `${mission.title}：${member.userId}`
  });

  res.json({ item: current });
});
