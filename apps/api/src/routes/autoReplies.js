import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { logOperation } from "../services/activity.js";

export const autoRepliesRouter = express.Router();

const listSchema = z.object({
  groupId: z.string().optional(),
  q: z.string().optional(),
  isActive: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const bodySchema = z.object({
  groupId: z.string().min(1),
  keyword: z.string().min(1),
  matchType: z.enum(["EXACT", "CONTAINS", "REGEX"]).default("CONTAINS"),
  responseType: z.enum(["TEXT", "FLEX"]).default("TEXT"),
  responseText: z.string().min(1),
  responseFlex: z.any().optional().nullable(),
  cooldownSeconds: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().optional()
});

autoRepliesRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.isActive === "true") where.isActive = true;
  if (query.isActive === "false") where.isActive = false;
  if (query.q) {
    where.OR = [
      { keyword: { contains: query.q, mode: "insensitive" } },
      { responseText: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total] = await Promise.all([
    prisma.autoReplyRule.findMany({
      where,
      include: { group: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.autoReplyRule.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

autoRepliesRouter.get("/groups/:groupId", requireAuth, async (req, res) => {
  const items = await prisma.autoReplyRule.findMany({
    where: { groupId: req.params.groupId },
    orderBy: { updatedAt: "desc" }
  });
  res.json({ items });
});

autoRepliesRouter.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const data = parseBody(bodySchema, req, res);
  if (!data) return;

  const item = await prisma.autoReplyRule.create({
    data: {
      groupId: data.groupId,
      keyword: data.keyword,
      matchType: data.matchType,
      responseType: data.responseType,
      responseText: data.responseText,
      responseFlex: data.responseFlex ?? null,
      cooldownSeconds: data.cooldownSeconds,
      isActive: data.isActive ?? true
    }
  });

  await prisma.groupSetting.upsert({
    where: { groupId: data.groupId },
    update: {
      keywordAutoReplyEnabled: true,
      updatedAt: new Date()
    },
    create: {
      groupId: data.groupId,
      createdAt: new Date(),
      updatedAt: new Date(),
      keywordAutoReplyEnabled: true
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: data.groupId,
    eventType: "AUTO_REPLY_CREATED",
    title: "建立自動回覆",
    detail: data.keyword
  });

  res.status(201).json({ item });
});

autoRepliesRouter.post("/groups/:groupId/enable", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const groupId = String(req.params.groupId || "").trim();
  if (!groupId) {
    return res.status(400).json({ message: "必須輸入群組 ID" });
  }

  const settings = await prisma.groupSetting.upsert({
    where: { groupId },
    update: {
      keywordAutoReplyEnabled: true,
      updatedAt: new Date()
    },
    create: {
      groupId,
      createdAt: new Date(),
      updatedAt: new Date(),
      keywordAutoReplyEnabled: true
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId,
    eventType: "GROUP_SETTING_CHANGED",
    title: "關鍵字自動回覆已啟用",
    detail: groupId
  });

  res.json({ ok: true, item: settings });
});

autoRepliesRouter.delete("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const query = parseQuery(listSchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.isActive === "true") where.isActive = true;
  if (query.isActive === "false") where.isActive = false;
  if (query.q) {
    where.OR = [
      { keyword: { contains: query.q, mode: "insensitive" } },
      { responseText: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const result = await prisma.autoReplyRule.deleteMany({ where });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: query.groupId || null,
    eventType: "AUTO_REPLY_DELETED",
    title: "刪除關鍵字回覆",
    detail: `共刪除 ${result.count} 筆`
  });

  res.json({ ok: true, deletedCount: result.count });
});

autoRepliesRouter.patch("/:ruleId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = req.body || {};
  const item = await prisma.autoReplyRule.update({
    where: { id: req.params.ruleId },
    data: {
      keyword: typeof payload.keyword === "string" ? payload.keyword : undefined,
      matchType: payload.matchType || undefined,
      responseType: payload.responseType || undefined,
      responseText: typeof payload.responseText === "string" ? payload.responseText : undefined,
      responseFlex: payload.responseFlex ?? undefined,
      cooldownSeconds: typeof payload.cooldownSeconds === "number" ? payload.cooldownSeconds : undefined,
      isActive: typeof payload.isActive === "boolean" ? payload.isActive : undefined
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "AUTO_REPLY_UPDATED",
    title: "更新自動回覆",
    detail: item.keyword
  });

  res.json({ item });
});

autoRepliesRouter.delete("/:ruleId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const item = await prisma.autoReplyRule.findUnique({
    where: { id: req.params.ruleId }
  });

  if (!item) {
    return res.status(404).json({ message: "找不到關鍵字回覆規則" });
  }

  await prisma.autoReplyRule.delete({
    where: { id: item.id }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "AUTO_REPLY_UPDATED",
    title: "刪除自動回覆",
    detail: item.keyword
  });

  res.json({ ok: true });
});
