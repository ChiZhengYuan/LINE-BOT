import express from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = express.Router();

dashboardRouter.get("/summary", requireAuth, async (req, res) => {
  const [groups, violations, pendingActions, assessments] = await Promise.all([
    prisma.group.count(),
    prisma.violation.count(),
    prisma.pendingAction.count({ where: { status: "PENDING" } }),
    prisma.aiAssessment.count()
  ]);

  res.json({
    groups,
    violations,
    pendingActions,
    assessments
  });
});

dashboardRouter.get("/groups", requireAuth, async (req, res) => {
  const groups = await prisma.group.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      ruleSetting: true,
      pendingActions: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      _count: {
        select: {
          violations: true,
          messages: true,
          pendingActions: true
        }
      }
    }
  });

  res.json({ groups });
});
