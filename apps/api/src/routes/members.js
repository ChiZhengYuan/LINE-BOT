import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { getTenantOwnerId } from "../middleware/tenant.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { logOperation, rebuildRankingsForGroup } from "../services/activity.js";

export const membersRouter = express.Router();

const listSchema = z.object({
  groupId: z.string().optional(),
  q: z.string().optional(),
  isBlacklisted: z.string().optional(),
  isWhitelisted: z.string().optional(),
  sortBy: z.enum(["joinedAt", "messageCount", "violationCount", "riskScore", "activeScore"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const memberSchema = z.object({
  groupId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  isBlacklisted: z.boolean().optional(),
  isWhitelisted: z.boolean().optional()
});

membersRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const ownerAdminId = getTenantOwnerId(req);
  const page = query.page || 1;
  const limit = query.limit || 20;
  const where = ownerAdminId ? { ownerAdminId } : {};

  if (query.groupId) where.groupId = query.groupId;
  if (query.isBlacklisted === "true") where.isBlacklisted = true;
  if (query.isBlacklisted === "false") where.isBlacklisted = false;
  if (query.isWhitelisted === "true") where.isWhitelisted = true;
  if (query.isWhitelisted === "false") where.isWhitelisted = false;
  if (query.q) {
    where.OR = [
      { userId: { contains: query.q, mode: "insensitive" } },
      { displayName: { contains: query.q, mode: "insensitive" } },
      { note: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const sortBy = query.sortBy || "updatedAt";
  const sortDir = query.sortDir || "desc";
  const [items, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { group: true, stats: true, missionProgress: true, lotteryEntries: true, rankings: true },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.member.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

membersRouter.get("/:memberId", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const item = await prisma.member.findFirst({
    where: {
      id: req.params.memberId,
      ...(ownerAdminId ? { ownerAdminId } : {})
    },
    include: {
      group: true,
      stats: true,
      missionProgress: { include: { mission: true } },
      checkins: true,
      lotteryEntries: { include: { lottery: true } },
      lotteryWins: { include: { lottery: true } },
      rankings: true,
      notifications: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });

  if (!item) {
    return res.status(404).json({ message: "Member not found" });
  }

  res.json({ item });
});

membersRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = parseBody(memberSchema, req, res);
  if (!data) return;

  const ownerAdminId = getTenantOwnerId(req);
  const group = await prisma.group.findFirst({
    where: {
      id: data.groupId,
      ...(ownerAdminId ? { ownerAdminId } : {})
    }
  });
  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const item = await prisma.member.upsert({
    where: {
      groupId_userId: {
        groupId: data.groupId,
        userId: data.userId
      }
    },
    update: {
      displayName: data.displayName ?? undefined,
      note: data.note ?? undefined,
      isBlacklisted: data.isBlacklisted ?? undefined,
      isWhitelisted: data.isWhitelisted ?? undefined
    },
    create: {
      groupId: data.groupId,
      ownerAdminId,
      userId: data.userId,
      displayName: data.displayName ?? null,
      note: data.note ?? null,
      isBlacklisted: data.isBlacklisted ?? false,
      isWhitelisted: data.isWhitelisted ?? false
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    ownerAdminId: ownerAdminId || null,
    groupId: data.groupId,
    memberId: item.id,
    eventType: "MEMBER_UPDATED",
    title: "更新成員",
    detail: `更新會員 ${data.userId}`
  }).catch(() => {});

  await rebuildRankingsForGroup(data.groupId).catch(() => {});

  res.status(201).json({ item });
});

membersRouter.patch("/:memberId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const current = await prisma.member.findFirst({
    where: {
      id: req.params.memberId,
      ...(ownerAdminId ? { ownerAdminId } : {})
    }
  });
  if (!current) {
    return res.status(404).json({ message: "Member not found" });
  }

  const payload = req.body || {};
  const data = {
    displayName: typeof payload.displayName === "string" ? payload.displayName : undefined,
    note: typeof payload.note === "string" ? payload.note : undefined,
    isBlacklisted: typeof payload.isBlacklisted === "boolean" ? payload.isBlacklisted : undefined,
    isWhitelisted: typeof payload.isWhitelisted === "boolean" ? payload.isWhitelisted : undefined
  };

  const item = await prisma.member.update({
    where: { id: current.id },
    data
  });

  await logOperation({
    adminUserId: req.user.sub,
    ownerAdminId: ownerAdminId || null,
    groupId: item.groupId,
    memberId: item.id,
    eventType: "MEMBER_UPDATED",
    title: "更新成員",
    detail: `更新會員 ${item.userId}`
  }).catch(() => {});

  await rebuildRankingsForGroup(item.groupId).catch(() => {});

  res.json({ item });
});
