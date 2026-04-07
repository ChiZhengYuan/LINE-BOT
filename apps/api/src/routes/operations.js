import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { parseQuery } from "../lib/validation.js";

export const operationsRouter = express.Router();

const querySchema = z.object({
  adminUserId: z.string().optional(),
  groupId: z.string().optional(),
  eventType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

operationsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(querySchema, req, res);
  if (!query) return;

  const page = query.page || 1;
  const limit = query.limit || 20;
  const where = {};

  if (query.adminUserId) where.adminUserId = query.adminUserId;
  if (query.groupId) where.groupId = query.groupId;
  if (query.eventType) where.eventType = query.eventType;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { detail: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const [items, total] = await Promise.all([
    prisma.operationLog.findMany({
      where,
      include: { adminUser: true, group: true, member: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.operationLog.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

