import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { parseQuery } from "../lib/validation.js";

export const rankingsRouter = express.Router();

const querySchema = z.object({
  groupId: z.string().optional(),
  period: z.enum(["DAY", "WEEK", "MONTH", "TOTAL"]).optional(),
  periodKey: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

rankingsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseQuery(querySchema, req, res);
  if (!query) return;

  const where = {};
  if (query.groupId) where.groupId = query.groupId;
  if (query.period) where.period = query.period;
  if (query.periodKey) where.periodKey = query.periodKey;

  const page = query.page || 1;
  const limit = query.limit || 20;

  const [items, total] = await Promise.all([
    prisma.ranking.findMany({
      where,
      include: { group: true, member: true },
      orderBy: [{ rankPosition: "asc" }, { activeScore: "desc" }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.ranking.count({ where })
  ]);

  res.json({ items, total, page, limit });
});

