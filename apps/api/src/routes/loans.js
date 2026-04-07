import express from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { applyTenantWhere } from "../middleware/tenant.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import {
  createOrUpdateManualLoanCase,
  ensureDailyCaseReport,
  formatLoanCaseSummary,
  getLoanReportsOverview,
  listDailyCaseReports,
  listLoanCases,
  listLoanReminders,
  sendDailyCaseReport,
  syncLoanCaseRemindersForGroup,
  updateLoanCaseById
} from "../services/loanAutomation.js";
import { pushText } from "../services/line.js";
import { logOperation } from "../services/activity.js";

export const loansRouter = express.Router();

const loanCaseSchema = z.object({
  groupId: z.string().min(1),
  customerName: z.string().min(1),
  phone: z.string().optional().nullable(),
  lineDisplayName: z.string().optional().nullable(),
  caseType: z.string().optional().nullable(),
  amount: z.coerce.number().optional().nullable(),
  status: z
    .enum([
      "SUBMITTING",
      "SUBMITTED",
      "REVIEWING",
      "APPROVED",
      "SIGNED",
      "DISBURSED",
      "NEED_SUPPLEMENT",
      "POSTPONED",
      "REJECTED"
    ])
    .optional(),
  ownerStaff: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  sourceMessageId: z.string().optional().nullable()
});

const loanCaseUpdateSchema = loanCaseSchema.partial().extend({
  statusNote: z.string().optional().nullable()
});

const listQuerySchema = z.object({
  groupId: z.string().optional(),
  q: z.string().optional(),
  status: z.string().optional(),
  ownerStaff: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["updatedAt", "createdAt", "status", "amount", "customerName"]).default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc")
});

const reportListQuerySchema = z.object({
  groupId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const reminderListQuerySchema = z.object({
  groupId: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const reportGenerateSchema = z.object({
  groupId: z.string().optional(),
  date: z.string().optional()
});

loansRouter.get("/cases", requireAuth, async (req, res) => {
  const query = parseQuery(listQuerySchema, req, res);
  if (!query) return;

  const result = await listLoanCases(query);
  res.json(result);
});

loansRouter.post("/cases", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = parseBody(loanCaseSchema, req, res);
  if (!payload) return;

  const group = await prisma.group.findUnique({
    where: { id: payload.groupId }
  });
  if (!group) {
    return res.status(404).json({ message: "找不到群組" });
  }

  const result = await createOrUpdateManualLoanCase({
    group,
    payload,
    adminUserId: req.user.sub
  });

  if (!result) {
    return res.status(400).json({ message: "必須輸入客戶姓名" });
  }

  res.status(result.created ? 201 : 200).json(result);
});

loansRouter.get("/cases/:caseId", requireAuth, async (req, res) => {
  const item = await prisma.loanCase.findFirst({
    where: applyTenantWhere(req, { id: req.params.caseId }),
    include: {
      group: true,
      statusLogs: {
        orderBy: { createdAt: "desc" }
      },
      reminders: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!item) {
    return res.status(404).json({ message: "找不到案件" });
  }

  res.json({ item });
});

loansRouter.delete("/cases/:caseId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const item = await prisma.loanCase.findFirst({
    where: applyTenantWhere(req, { id: req.params.caseId }),
    select: { id: true, groupId: true }
  });

  if (!item) {
    return res.status(404).json({ message: "找不到案件" });
  }

  await prisma.loanCase.delete({ where: { id: item.id } });
  await logOperation({
    adminUserId: req.user.sub,
    groupId: item.groupId,
    eventType: "LOAN_CASE_UPDATED",
    title: "刪除貸款案件",
    detail: item.id
  }).catch(() => {});

  res.json({ ok: true });
});

loansRouter.delete("/cases", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const query = parseQuery(listQuerySchema, req, res);
  if (!query) return;

  const where = applyTenantWhere(req, {});
  if (query.groupId) where.groupId = query.groupId;
  if (query.status) where.status = query.status;
  if (query.ownerStaff) where.ownerStaff = { contains: query.ownerStaff, mode: "insensitive" };
  if (query.q) {
    where.OR = [
      { customerName: { contains: query.q, mode: "insensitive" } },
      { phone: { contains: query.q, mode: "insensitive" } },
      { caseType: { contains: query.q, mode: "insensitive" } },
      { note: { contains: query.q, mode: "insensitive" } },
      { lineDisplayName: { contains: query.q, mode: "insensitive" } }
    ];
  }

  const result = await prisma.loanCase.deleteMany({ where });
  res.json({ deletedCount: result.count });
});

loansRouter.patch("/cases/:caseId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = parseBody(loanCaseUpdateSchema, req, res);
  if (!payload) return;

  const updated = await updateLoanCaseById({
    loanCaseId: req.params.caseId,
    groupId: payload.groupId,
    payload,
    adminUserId: req.user.sub
  });

  if (!updated) {
    return res.status(404).json({ message: "找不到案件" });
  }

  res.json({ item: updated });
});

loansRouter.get("/daily-reports", requireAuth, async (req, res) => {
  const query = parseQuery(reportListQuerySchema, req, res);
  if (!query) return;

  const result = await listDailyCaseReports(query);
  res.json(result);
});

loansRouter.delete("/daily-reports/:reportId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const report = await prisma.dailyCaseReport.findFirst({
    where: applyTenantWhere(req, { id: req.params.reportId }),
    select: { id: true, groupId: true }
  });

  if (!report) {
    return res.status(404).json({ message: "找不到匯報" });
  }

  await prisma.dailyCaseReport.delete({ where: { id: report.id } });
  await logOperation({
    adminUserId: req.user.sub,
    groupId: report.groupId,
    eventType: "DAILY_CASE_REPORT_CREATED",
    title: "刪除每日匯報",
    detail: report.id
  }).catch(() => {});

  res.json({ ok: true });
});

loansRouter.delete("/daily-reports", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const query = parseQuery(reportListQuerySchema, req, res);
  if (!query) return;

  const where = applyTenantWhere(req, {});
  if (query.groupId) where.groupId = query.groupId;
  if (query.from || query.to) {
    where.reportDate = {};
    if (query.from) where.reportDate.gte = new Date(query.from);
    if (query.to) where.reportDate.lte = new Date(query.to);
  }

  const result = await prisma.dailyCaseReport.deleteMany({ where });
  res.json({ deletedCount: result.count });
});

loansRouter.post("/daily-reports/generate", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const payload = parseBody(reportGenerateSchema, req, res) || {};
  const date = payload.date ? new Date(payload.date) : new Date();

  const groups = payload.groupId
    ? [{ id: payload.groupId }]
    : await prisma.group.findMany({
        where: {
          loanCases: {
            some: {}
          }
        },
        select: { id: true }
      });

  const reports = [];
  for (const group of groups) {
    const report = await ensureDailyCaseReport({ groupId: group.id, reportDate: date, force: true });
    if (report) {
      reports.push(report);
    }
  }

  res.status(201).json({ reports });
});

loansRouter.post("/daily-reports/:reportId/send", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const report = await sendDailyCaseReport(req.params.reportId);
  if (!report) {
    return res.status(404).json({ message: "找不到匯報" });
  }

  res.json({ report });
});

loansRouter.get("/reports", requireAuth, async (req, res) => {
  const overview = await getLoanReportsOverview();
  res.json({ overview });
});

loansRouter.get("/reminders", requireAuth, async (req, res) => {
  const query = parseQuery(reminderListQuerySchema, req, res);
  if (!query) return;

  const result = await listLoanReminders(query);
  res.json(result);
});

loansRouter.post("/reminders/:reminderId/send", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const reminder = await prisma.loanCaseReminder.findUnique({
    where: { id: req.params.reminderId },
    include: {
      group: true,
      loanCase: true
    }
  });

  if (!reminder) {
    return res.status(404).json({ message: "找不到提醒" });
  }

  await pushText(
    reminder.group.lineGroupId,
    [`🔔 貸款提醒`, `案件：${reminder.loanCase.customerName}`, `內容：${reminder.message}`].join("\n")
  );

  const updated = await prisma.loanCaseReminder.update({
    where: { id: reminder.id },
    data: {
      status: "SENT",
      sentAt: new Date()
    }
  });

  await logOperation({
    adminUserId: req.user.sub,
    groupId: reminder.groupId,
    eventType: "LOAN_REMINDER_SENT",
    title: "發送貸款提醒",
    detail: `${reminder.loanCase.customerName} / ${reminder.message}`
  }).catch(() => {});

  res.json({ reminder: updated });
});

loansRouter.post("/reminders/sync", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const groups = await prisma.group.findMany({
    where: {
      loanCases: {
        some: {}
      }
    },
    select: { id: true }
  });

  let total = 0;
  for (const group of groups) {
    total += await syncLoanCaseRemindersForGroup(group.id);
  }

  res.json({ total });
});

loansRouter.get("/reminders/:reminderId", requireAuth, async (req, res) => {
  const reminder = await prisma.loanCaseReminder.findFirst({
    where: applyTenantWhere(req, { id: req.params.reminderId }),
    include: {
      group: true,
      loanCase: true
    }
  });

  if (!reminder) {
    return res.status(404).json({ message: "找不到提醒" });
  }

  res.json({ reminder });
});

loansRouter.delete("/reminders/:reminderId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const reminder = await prisma.loanCaseReminder.findFirst({
    where: applyTenantWhere(req, { id: req.params.reminderId }),
    select: { id: true, groupId: true }
  });

  if (!reminder) {
    return res.status(404).json({ message: "找不到提醒" });
  }

  await prisma.loanCaseReminder.delete({ where: { id: reminder.id } });
  res.json({ ok: true });
});

loansRouter.get("/cases/:caseId/summary", requireAuth, async (req, res) => {
  const item = await prisma.loanCase.findUnique({
    where: { id: req.params.caseId }
  });
  if (!item) {
    return res.status(404).json({ message: "找不到案件" });
  }

  res.json({ summary: formatLoanCaseSummary(item) });
});
