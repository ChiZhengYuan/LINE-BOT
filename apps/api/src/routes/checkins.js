import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { createNotification, ensureMember, logOperation, rebuildRankingsForGroup } from "../services/activity.js";

export const checkinsRouter = express.Router();

const listSchema = z.object({
  groupId: z.string().optional(),
  memberId: z.string().optional(),
  lineUserId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const bodySchema = z.object({
  groupId: z.string().min(1),
  lineUserId: z.string().min(1),
  displayName: z.string().optional().nullable(),
  pointsEarned: z.coerce.number().int().min(0).default(5)
});

checkinsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.memberId) where.memberId = query.memberId;
  if (query.lineUserId) where.lineUserId = query.lineUserId;
  if (query.from || query.to) {
    where.checkinDate = {};
    if (query.from) where.checkinDate.gte = new Date(query.from);
    if (query.to) where.checkinDate.lte = new Date(query.to);
  }

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total] = await Promise.all([
    prisma.checkin.findMany({
      where,
      include: { group: true, member: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.checkin.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

checkinsRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = parseBody(bodySchema, req, res);
  if (!data) return;

  const group = await prisma.group.findFirst({ where: { id: data.groupId } });
  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const member = await ensureMember({ group, lineUserId: data.lineUserId, displayName: data.displayName || undefined });
  const checkinDate = new Date();
  checkinDate.setHours(0, 0, 0, 0);

  const lastCheckin = await prisma.checkin.findFirst({
    where: {
      groupId: group.id,
      lineUserId: data.lineUserId,
      checkinDate
    }
  });

  if (lastCheckin) {
    return res.status(409).json({ message: "今天已簽到過了" });
  }

  const previous = await prisma.checkin.findFirst({
    where: {
      groupId: group.id,
      lineUserId: data.lineUserId,
      checkinDate: {
        lt: checkinDate
      }
    },
    orderBy: { checkinDate: "desc" }
  });

  const streakDays = previous ? previous.streakDays + 1 : 1;
  const item = await prisma.checkin.create({
    data: {
      groupId: group.id,
      memberId: member.id,
      lineUserId: data.lineUserId,
      checkinDate,
      streakDays,
      pointsEarned: data.pointsEarned
    }
  });

  await prisma.member.update({
    where: { id: member.id },
    data: {
      checkinCount: { increment: 1 },
      activeScore: { increment: data.pointsEarned },
      lastCheckinAt: new Date()
    }
  });

  await prisma.memberStats.upsert({
    where: { memberId: member.id },
    update: {
      currentStreak: streakDays,
      totalActiveScore: { increment: data.pointsEarned },
      totalCheckins: { increment: 1 }
    },
    create: {
      groupId: group.id,
      memberId: member.id,
      currentStreak: streakDays,
      totalActiveScore: data.pointsEarned,
      totalCheckins: 1
    }
  });

  await createNotification({
    groupId: group.id,
    memberId: member.id,
    type: "NEW_MEMBER",
    title: "每日簽到",
    content: `${data.displayName || data.lineUserId} 已完成簽到，獲得 ${data.pointsEarned} 分。`,
    meta: { streakDays }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: group.id,
    memberId: member.id,
    eventType: "CHECKIN_CREATED",
    title: "建立簽到",
    detail: `${data.lineUserId} 簽到成功`
  });

  await rebuildRankingsForGroup(group.id).catch(() => {});

  res.status(201).json({ item });
});

