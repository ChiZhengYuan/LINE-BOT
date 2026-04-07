import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { createNotification, ensureMember, logOperation, rebuildRankingsForGroup } from "../services/activity.js";
import { pushText } from "../services/line.js";

export const lotteriesRouter = express.Router();

const listSchema = z.object({
  groupId: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const bodySchema = z.object({
  groupId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  quota: z.coerce.number().int().min(0).default(0),
  maxWinners: z.coerce.number().int().min(1).default(1),
  autoDrawAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ENDED", "DRAWN", "CANCELLED"]).optional()
});

lotteriesRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total] = await Promise.all([
    prisma.lottery.findMany({
      where,
      include: {
        group: true,
        entries: { include: { member: true } },
        winners: { include: { member: true } }
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.lottery.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

lotteriesRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = parseBody(bodySchema, req, res);
  if (!data) return;

  const item = await prisma.lottery.create({
    data: {
      groupId: data.groupId,
      title: data.title,
      description: data.description ?? null,
      startAt: data.startAt ? new Date(data.startAt) : null,
      endAt: data.endAt ? new Date(data.endAt) : null,
      quota: data.quota,
      maxWinners: data.maxWinners,
      autoDrawAt: data.autoDrawAt ? new Date(data.autoDrawAt) : null,
      isActive: data.isActive ?? true,
      status: data.status || "DRAFT"
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: data.groupId,
    eventType: "LOTTERY_CREATED",
    title: "建立抽獎",
    detail: data.title
  });

  res.status(201).json({ item });
});

lotteriesRouter.patch("/:lotteryId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  const item = await prisma.lottery.update({
    where: { id: req.params.lotteryId },
    data: {
      title: typeof payload.title === "string" ? payload.title : undefined,
      description: typeof payload.description === "string" ? payload.description : undefined,
      startAt: payload.startAt ? new Date(payload.startAt) : undefined,
      endAt: payload.endAt ? new Date(payload.endAt) : undefined,
      quota: payload.quota ? Number(payload.quota) : undefined,
      maxWinners: payload.maxWinners ? Number(payload.maxWinners) : undefined,
      autoDrawAt: payload.autoDrawAt ? new Date(payload.autoDrawAt) : undefined,
      isActive: typeof payload.isActive === "boolean" ? payload.isActive : undefined,
      status: payload.status || undefined
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "LOTTERY_UPDATED",
    title: "更新抽獎",
    detail: item.title
  });

  res.json({ item });
});

lotteriesRouter.delete("/:lotteryId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const item = await prisma.lottery.delete({ where: { id: req.params.lotteryId } });
  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "LOTTERY_UPDATED",
    title: "刪除抽獎",
    detail: item.title
  });
  res.json({ ok: true });
});

lotteriesRouter.post("/:lotteryId/enter", requireAuth, async (req, res) => {
  const payload = req.body || {};
  const lottery = await prisma.lottery.findUnique({ where: { id: req.params.lotteryId } });
  if (!lottery) return res.status(404).json({ message: "Lottery not found" });

  const group = await prisma.group.findFirst({ where: { id: lottery.groupId } });
  const member = await ensureMember({ group, lineUserId: payload.lineUserId, displayName: payload.displayName });

  const item = await prisma.lotteryEntry.upsert({
    where: {
      lotteryId_memberId: {
        lotteryId: lottery.id,
        memberId: member.id
      }
    },
    update: {
      ticketCount: payload.ticketCount ? Number(payload.ticketCount) : 1
    },
    create: {
      lotteryId: lottery.id,
      memberId: member.id,
      lineUserId: payload.lineUserId,
      ticketCount: payload.ticketCount ? Number(payload.ticketCount) : 1
    }
  });

  await prisma.member.update({
    where: { id: member.id },
    data: {
      activeScore: { increment: 1 }
    }
  }).catch(() => {});

  await rebuildRankingsForGroup(lottery.groupId).catch(() => {});

  res.status(201).json({ item });
});

lotteriesRouter.post("/:lotteryId/draw", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const lottery = await prisma.lottery.findUnique({
    where: { id: req.params.lotteryId },
    include: { entries: { include: { member: true } }, group: true, winners: true }
  });
  if (!lottery) return res.status(404).json({ message: "Lottery not found" });

  const existingWinners = new Set(lottery.winners.map((winner) => winner.memberId));
  const available = lottery.entries.filter((entry) => !existingWinners.has(entry.memberId));
  const winners = available.sort(() => Math.random() - 0.5).slice(0, lottery.maxWinners);

  const createdWinners = [];
  for (let index = 0; index < winners.length; index += 1) {
    const winner = winners[index];
    const created = await prisma.lotteryWinner.create({
      data: {
        lotteryId: lottery.id,
        memberId: winner.memberId,
        lineUserId: winner.lineUserId,
        rank: index + 1
      }
    });
    createdWinners.push(created);
    await createNotification({
      groupId: lottery.groupId,
      memberId: winner.memberId,
      type: "LOTTERY_DRAWN",
      title: `抽獎中獎：${lottery.title}`,
      content: `${winner.member?.displayName || winner.lineUserId} 已中獎`
    });
    await pushText(lottery.group.lineGroupId, `🎉 ${lottery.title}\n中獎者：${winner.member?.displayName || winner.lineUserId}`);
  }

  await prisma.lottery.update({
    where: { id: lottery.id },
    data: {
      status: "DRAWN",
      drawnAt: new Date(),
      isActive: false
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: lottery.groupId,
    eventType: "LOTTERY_DRAWN",
    title: "抽獎完成",
    detail: lottery.title
  });

  res.json({ winners: createdWinners });
});
