import express from "express";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getTenantOwnerId } from "../middleware/tenant.js";

export const dashboardRouter = express.Router();

dashboardRouter.get("/summary", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const groupWhere = ownerAdminId ? { ownerAdminId } : {};
  const [
    groups,
    violations,
    pendingActions,
    assessments,
    members,
    notifications,
    announcements,
    missions,
    lotteries,
    checkins,
    loanCases,
    loanReports,
    loanReminders
  ] = await Promise.all([
    prisma.group.count({ where: groupWhere }),
    prisma.violation.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.pendingAction.count({ where: ownerAdminId ? { ownerAdminId, status: "PENDING" } : { status: "PENDING" } }),
    prisma.aiAssessment.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.member.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.notification.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.announcement.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.mission.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.lottery.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.checkin.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.loanCase.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.dailyCaseReport.count({ where: ownerAdminId ? { ownerAdminId } : {} }),
    prisma.loanCaseReminder.count({ where: ownerAdminId ? { ownerAdminId, status: "PENDING" } : { status: "PENDING" } })
  ]);

  res.json({
    groups,
    violations,
    pendingActions,
    assessments,
    members,
    notifications,
    announcements,
    missions,
    lotteries,
    checkins,
    loanCases,
    loanReports,
    loanReminders
  });
});

dashboardRouter.get("/groups", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const groups = await prisma.group.findMany({
    where: ownerAdminId ? { ownerAdminId } : {},
    orderBy: { updatedAt: "desc" },
    include: {
      ruleSetting: true,
      groupSetting: true,
      pendingActions: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      _count: {
        select: {
          violations: true,
          messages: true,
          pendingActions: true,
          members: true,
          notifications: true,
          loanCases: true
        }
      }
    }
  });

  res.json({ groups });
});

dashboardRouter.get("/overview", requireAuth, async (req, res) => {
  const ownerAdminId = getTenantOwnerId(req);
  const groupFilter = ownerAdminId ? { ownerAdminId } : {};
  const recordFilter = ownerAdminId ? { ownerAdminId } : {};
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return { date, next, key: date.toISOString().slice(0, 10) };
  });

  const [violations, messages, members, notifications, logs, groups, rankings, loanCases, loanReports, loanStatusStats] = await Promise.all([
    prisma.violation.findMany({
      where: { createdAt: { gte: days[0].date }, ...recordFilter },
      select: { createdAt: true, groupId: true }
    }),
    prisma.messageLog.findMany({
      where: { createdAt: { gte: days[0].date }, ...recordFilter },
      select: { createdAt: true, groupId: true }
    }),
    prisma.member.findMany({
      where: { createdAt: { gte: days[0].date }, ...recordFilter },
      select: { createdAt: true, groupId: true }
    }),
    prisma.notification.findMany({
      where: ownerAdminId ? { ownerAdminId } : {},
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { group: true, member: true }
    }),
    prisma.operationLog.findMany({
      where: ownerAdminId ? { ownerAdminId } : {},
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { adminUser: true, group: true }
    }),
    prisma.group.findMany({
      where: groupFilter,
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        _count: {
          select: {
            members: true,
            violations: true,
            announcements: true,
            missions: true,
            lotteries: true,
            loanCases: true
          }
        }
      }
    }),
    prisma.ranking.findMany({
      where: ownerAdminId ? { ownerAdminId, period: "TOTAL" } : { period: "TOTAL" },
      orderBy: [{ activeScore: "desc" }, { rankPosition: "asc" }],
      take: 10,
      include: { group: true, member: true }
    }),
    prisma.loanCase.findMany({
      where: { updatedAt: { gte: days[0].date }, ...recordFilter },
      select: { createdAt: true, updatedAt: true, groupId: true, status: true }
    }),
    prisma.dailyCaseReport.findMany({
      where: ownerAdminId ? { ownerAdminId } : {},
      orderBy: { reportDate: "desc" },
      take: 5,
      include: { group: true }
    }),
    prisma.loanCase.groupBy({
      by: ["status"],
      where: ownerAdminId ? { ownerAdminId } : {},
      _count: { status: true }
    })
  ]);

  const trend = days.map(({ date, next, key }) => {
    const dayViolations = violations.filter((item) => item.createdAt >= date && item.createdAt < next).length;
    const dayMessages = messages.filter((item) => item.createdAt >= date && item.createdAt < next).length;
    const dayMembers = members.filter((item) => item.createdAt >= date && item.createdAt < next).length;
    const dayLoanCases = loanCases.filter((item) => item.createdAt >= date && item.createdAt < next).length;

    return {
      date: key,
      violations: dayViolations,
      messages: dayMessages,
      members: dayMembers,
      loanCases: dayLoanCases
    };
  });

  res.json({
    trend,
    recentNotifications: notifications,
    recentLogs: logs,
    highRiskMembers: rankings,
    recentLoanReports: loanReports,
    loanStatusStats: loanStatusStats.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {}),
    groupStats: groups.map((group) => ({
      id: group.id,
      name: group.name,
      lineGroupId: group.lineGroupId,
      members: group._count.members,
      violations: group._count.violations,
      announcements: group._count.announcements,
      missions: group._count.missions,
      lotteries: group._count.lotteries,
      loanCases: group._count.loanCases || 0
    }))
  });
});
