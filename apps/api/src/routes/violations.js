import express from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getTenantOwnerId } from "../middleware/tenant.js";

export const violationsRouter = express.Router();

violationsRouter.get("/", requireAuth, async (req, res) => {
  const where = buildWhere(req);
  const violations = await prisma.violation.findMany({
    where,
    include: {
      group: true,
      messageLog: true
    },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 200)
  });

  res.json({ violations });
});

violationsRouter.get("/export", requireAuth, async (req, res) => {
  const where = buildWhere(req);
  const violations = await prisma.violation.findMany({
    where,
    include: {
      group: true,
      messageLog: true
    },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 1000)
  });

  const rows = [
    [
      "createdAt",
      "groupId",
      "lineGroupId",
      "lineUserId",
      "ruleType",
      "category",
      "reason",
      "riskScore",
      "confidence",
      "points",
      "actionTaken",
      "status",
      "message"
    ].join(",")
  ];

  for (const item of violations) {
    rows.push([
      csv(item.createdAt),
      csv(item.group?.name || item.group?.lineGroupId || ""),
      csv(item.lineGroupId),
      csv(item.lineUserId),
      csv(item.ruleType),
      csv(item.category),
      csv(item.reason),
      csv(item.riskScore),
      csv(item.confidence),
      csv(item.points),
      csv(item.actionTaken),
      csv(item.status),
      csv(item.messageLog?.content || "")
    ].join(","));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="violations.csv"');
  res.send(rows.join("\n"));
});

violationsRouter.get("/ai", requireAuth, async (req, res) => {
  const where = buildAiWhere(req);
  const assessments = await prisma.aiAssessment.findMany({
    where,
    include: { group: true, messageLog: true },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 200)
  });

  res.json({ assessments });
});

violationsRouter.get("/messages", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const where = ownerAdminId ? { ownerAdminId } : {};
  if (req.query.groupId) {
    where.groupId = String(req.query.groupId);
  }

  const messages = await prisma.messageLog.findMany({
    where,
    include: { group: true },
    orderBy: { createdAt: "desc" },
    take: Number(req.query.limit || 200)
  });

  res.json({ messages });
});

function buildWhere(req) {
  const query = req.query;
  const ownerAdminId = getTenantOwnerId(req);
  const where = ownerAdminId ? { ownerAdminId } : {};

  if (query.groupId) {
    where.groupId = String(query.groupId);
  }

  if (query.lineGroupId) {
    where.lineGroupId = String(query.lineGroupId);
  }

  if (query.lineUserId) {
    where.lineUserId = String(query.lineUserId);
  }

  if (query.ruleType) {
    where.ruleType = String(query.ruleType);
  }

  if (query.status) {
    where.status = String(query.status);
  }

  if (query.actionTaken) {
    where.actionTaken = String(query.actionTaken);
  }

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = new Date(String(query.from));
    }
    if (query.to) {
      where.createdAt.lte = new Date(String(query.to));
    }
  }

  if (query.q) {
    where.OR = [
      { reason: { contains: String(query.q), mode: "insensitive" } },
      { category: { contains: String(query.q), mode: "insensitive" } },
      { lineUserId: { contains: String(query.q), mode: "insensitive" } }
    ];
  }

  return where;
}

function buildAiWhere(req) {
  const query = req.query;
  const ownerAdminId = getTenantOwnerId(req);
  const where = ownerAdminId ? { ownerAdminId } : {};

  if (query.groupId) {
    where.groupId = String(query.groupId);
  }

  if (query.lineUserId) {
    where.lineUserId = String(query.lineUserId);
  }

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = new Date(String(query.from));
    }
    if (query.to) {
      where.createdAt.lte = new Date(String(query.to));
    }
  }

  if (query.q) {
    where.OR = [
      { reason: { contains: String(query.q), mode: "insensitive" } },
      { category: { contains: String(query.q), mode: "insensitive" } },
      { lineUserId: { contains: String(query.q), mode: "insensitive" } }
    ];
  }

  return where;
}

function csv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
