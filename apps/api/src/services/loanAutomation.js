import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { createNotification, logOperation } from "./activity.js";
import { pushText } from "./line.js";

const FINAL_STATUSES = new Set(["DISBURSED", "REJECTED"]);

export const loanStatusLabels = {
  SUBMITTING: "送件中",
  SUBMITTED: "已送件",
  REVIEWING: "審核中",
  APPROVED: "已核准",
  SIGNED: "已簽約",
  DISBURSED: "已撥款",
  NEED_SUPPLEMENT: "待補件",
  POSTPONED: "暫緩",
  REJECTED: "退件"
};

export const loanReminderLabels = {
  NEW_CASE: "今日新進件",
  STALE_UPDATE: "超過1天未更新",
  SUPPLEMENT_OVERDUE: "待補件超過2天",
  APPROVED_WAIT_SIGN: "已核准未簽約",
  SIGNED_WAIT_DISBURSE: "已簽約未撥款"
};

export function normalizePhone(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const digits = text.replace(/[^\d+]/g, "");
  return digits || null;
}

export function parseAmount(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return null;
  if (normalized.includes("萬")) return amount * 10000;
  if (normalized.includes("千")) return amount * 1000;
  return amount;
}

export function formatAmount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  const amount = Number(value);
  if (amount >= 10000 && amount % 10000 === 0) {
    return `${amount / 10000}萬`;
  }
  return String(amount);
}

export function parseLoanCaseMessage(content, lineDisplayName = "") {
  const text = String(content || "").trim();
  if (!text) return null;

  const name = extractField(text, ["姓名", "客戶", "名字", "客戶姓名", "申請人"]);
  const phone = normalizePhone(extractField(text, ["電話", "手機", "聯絡方式", "聯絡電話", "手機號碼"]));
  const caseType = extractField(text, ["車種", "方案", "類型", "產品", "案件類型", "貸款類型"]);
  const amount = parseAmount(extractField(text, ["金額", "額度", "貸款額度", "貸款金額", "核貸額度"]));
  const status = parseStatus(extractField(text, ["狀態", "進度", "案件狀態", "目前狀態"]) || text);
  const ownerStaff = extractField(text, ["業務", "負責人", "承辦", "案件負責人"]) || lineDisplayName || null;
  const note = extractField(text, ["備註", "說明", "補充"]);

  const guessedName = name || guessNameFromText(text);
  if (!guessedName) {
    return null;
  }

  return {
    customerName: guessedName,
    phone,
    caseType,
    amount,
    status,
    ownerStaff,
    note,
    lineDisplayName: lineDisplayName || null
  };
}

export async function upsertLoanCaseFromMessage({
  group,
  sourceGroupId,
  sourceMessageId,
  content,
  lineDisplayName,
  adminUserId = null,
  lineUserId = null
}) {
  const parsed = parseLoanCaseMessage(content, lineDisplayName);
  if (!parsed) {
    return null;
  }

  const existingByMessage = await prisma.loanCase.findUnique({
    where: {
      sourceGroupId_sourceMessageId: {
        sourceGroupId,
        sourceMessageId
      }
    },
    include: {
      group: true,
      statusLogs: true,
      reminders: true
    }
  }).catch(() => null);

  let existingByIdentity = null;
  if (!existingByMessage) {
    if (parsed.customerName) {
      existingByIdentity = await prisma.loanCase.findFirst({
        where: {
          groupId: group.id,
          customerName: parsed.customerName
        },
        include: {
          group: true,
          statusLogs: true,
          reminders: true
        }
      });
    }

    if (!existingByIdentity && parsed.phone) {
      existingByIdentity = await prisma.loanCase.findFirst({
        where: {
          groupId: group.id,
          phone: parsed.phone
        },
        include: {
          group: true,
          statusLogs: true,
          reminders: true
        }
      });
    }
  }

  const data = {
    groupId: group.id,
    customerName: parsed.customerName,
    phone: parsed.phone || undefined,
    lineDisplayName: parsed.lineDisplayName || undefined,
    caseType: parsed.caseType || undefined,
    amount: parsed.amount ?? undefined,
    status: parsed.status || undefined,
    ownerStaff: parsed.ownerStaff || undefined,
    sourceGroupId,
    sourceMessageId,
    note: parsed.note || undefined
  };

  if (existingByMessage) {
    const updated = await prisma.loanCase.update({
      where: { id: existingByMessage.id },
      data: mergeLoanCaseData(existingByMessage, data),
      include: loanCaseInclude()
    });

    await maybeLogLoanCaseStatus(existingByMessage, updated, adminUserId);
    await syncLoanCaseRemindersForCase(updated);

    await createNotification({
      groupId: group.id,
      type: "LOAN_CASE",
      title: "案件已更新",
      content: `${updated.customerName} - ${formatLoanCaseSummary(updated)}`,
      meta: { loanCaseId: updated.id, source: "webhook" }
    });

    await logOperation({
      adminUserId,
      groupId: group.id,
      memberId: null,
      eventType: "LOAN_CASE_UPDATED",
      title: "案件更新",
      detail: `${updated.customerName} / ${formatLoanCaseSummary(updated)}`
    });

    return { item: updated, created: false };
  }

  if (existingByIdentity) {
    const updated = await prisma.loanCase.update({
      where: { id: existingByIdentity.id },
      data: mergeLoanCaseData(existingByIdentity, data),
      include: loanCaseInclude()
    });

    await maybeLogLoanCaseStatus(existingByIdentity, updated, adminUserId);
    await syncLoanCaseRemindersForCase(updated);

    await createNotification({
      groupId: group.id,
      type: "LOAN_CASE",
      title: "案件已更新",
      content: `${updated.customerName} - ${formatLoanCaseSummary(updated)}`,
      meta: { loanCaseId: updated.id, source: "webhook" }
    });

    await logOperation({
      adminUserId,
      groupId: group.id,
      memberId: null,
      eventType: "LOAN_CASE_UPDATED",
      title: "案件更新",
      detail: `${updated.customerName} / ${formatLoanCaseSummary(updated)}`
    });

    return { item: updated, created: false };
  }

  const created = await prisma.loanCase.create({
    data: {
      ...data,
      status: parsed.status || "SUBMITTING"
    },
    include: loanCaseInclude()
  });

  await prisma.loanCaseStatusLog.create({
    data: {
      groupId: group.id,
      loanCaseId: created.id,
      fromStatus: null,
      toStatus: created.status,
      note: "自動建案"
    }
  });

  await syncLoanCaseRemindersForCase(created);

  await createNotification({
    groupId: group.id,
    type: "LOAN_CASE",
    title: "新增案件",
    content: `${created.customerName} - ${formatLoanCaseSummary(created)}`,
    meta: { loanCaseId: created.id, source: "webhook" }
  });

  await logOperation({
    adminUserId,
    groupId: group.id,
    memberId: null,
    eventType: "LOAN_CASE_CREATED",
    title: "新增案件",
    detail: `${created.customerName} / ${formatLoanCaseSummary(created)}`
  });

  return { item: created, created: true };
}

export async function updateLoanCaseById({ loanCaseId, groupId, payload, adminUserId = null }) {
  const current = await prisma.loanCase.findUnique({
    where: { id: loanCaseId },
    include: loanCaseInclude()
  });
  if (!current) {
    return null;
  }

  const nextData = {};
  if (typeof payload.customerName === "string") nextData.customerName = payload.customerName.trim();
  if (typeof payload.phone === "string") nextData.phone = normalizePhone(payload.phone);
  if (typeof payload.lineDisplayName === "string") nextData.lineDisplayName = payload.lineDisplayName.trim();
  if (typeof payload.caseType === "string") nextData.caseType = payload.caseType.trim();
  if (payload.amount !== undefined) nextData.amount = payload.amount === null ? null : Number(payload.amount);
  if (typeof payload.ownerStaff === "string") nextData.ownerStaff = payload.ownerStaff.trim();
  if (typeof payload.note === "string") nextData.note = payload.note;
  if (typeof payload.status === "string") nextData.status = payload.status;

  const updated = await prisma.loanCase.update({
    where: { id: loanCaseId },
    data: nextData,
    include: loanCaseInclude()
  });

  await maybeLogLoanCaseStatus(current, updated, adminUserId, payload.statusNote || null);
  await syncLoanCaseRemindersForCase(updated);

  await logOperation({
    adminUserId,
    groupId: groupId || updated.groupId,
    memberId: null,
    eventType: payload.status && payload.status !== current.status ? "LOAN_CASE_STATUS_CHANGED" : "LOAN_CASE_UPDATED",
    title: payload.status && payload.status !== current.status ? "案件狀態更新" : "案件資料更新",
    detail: `${updated.customerName} / ${formatLoanCaseSummary(updated)}`
  });

  return updated;
}

export async function createOrUpdateManualLoanCase({ group, payload, adminUserId = null }) {
  const customerName = String(payload.customerName || "").trim();
  const phone = normalizePhone(payload.phone);
  if (!customerName) {
    return null;
  }

  const note = typeof payload.note === "string" ? payload.note : null;
  const ownerStaff = typeof payload.ownerStaff === "string" ? payload.ownerStaff.trim() : null;
  const caseType = typeof payload.caseType === "string" ? payload.caseType.trim() : null;
  const amount = payload.amount === undefined || payload.amount === null || payload.amount === "" ? null : Number(payload.amount);
  const status = typeof payload.status === "string" && payload.status ? payload.status : "SUBMITTING";
  const lineDisplayName = typeof payload.lineDisplayName === "string" ? payload.lineDisplayName.trim() : null;
  const sourceGroupId = group.lineGroupId;
  const sourceMessageId = payload.sourceMessageId || `manual:${randomUUID()}`;

  const current = await prisma.loanCase.findFirst({
    where: {
      groupId: group.id,
      OR: [{ customerName }, ...(phone ? [{ phone }] : [])]
    }
  });

  if (current) {
    const updated = await prisma.loanCase.update({
      where: { id: current.id },
      data: {
        customerName,
        phone: phone || current.phone,
        lineDisplayName: lineDisplayName || current.lineDisplayName,
        caseType: caseType || current.caseType,
        amount: amount ?? current.amount,
        status,
        ownerStaff: ownerStaff || current.ownerStaff,
        note: note ?? current.note,
        sourceGroupId,
        sourceMessageId
      },
      include: loanCaseInclude()
    });

    await maybeLogLoanCaseStatus(current, updated, adminUserId, payload.statusNote || null);
    await syncLoanCaseRemindersForCase(updated);

    await logOperation({
      adminUserId,
      groupId: group.id,
      eventType: "LOAN_CASE_UPDATED",
      title: "手動更新案件",
      detail: `${updated.customerName} / ${formatLoanCaseSummary(updated)}`
    });

    return { item: updated, created: false };
  }

  const created = await prisma.loanCase.create({
    data: {
      groupId: group.id,
      customerName,
      phone,
      lineDisplayName,
      caseType,
      amount,
      status,
      ownerStaff,
      note,
      sourceGroupId,
      sourceMessageId
    },
    include: loanCaseInclude()
  });

  await prisma.loanCaseStatusLog.create({
    data: {
      groupId: group.id,
      loanCaseId: created.id,
      fromStatus: null,
      toStatus: created.status,
      note: "手動建案",
      changedByAdminId: adminUserId
    }
  });

  await syncLoanCaseRemindersForCase(created);

  await logOperation({
    adminUserId,
    groupId: group.id,
    eventType: "LOAN_CASE_CREATED",
    title: "手動新增案件",
    detail: `${created.customerName} / ${formatLoanCaseSummary(created)}`
  });

  return { item: created, created: true };
}

export async function listLoanCases({
  groupId,
  q,
  status,
  ownerStaff,
  page = 1,
  limit = 20,
  sortBy = "updatedAt",
  sortDir = "desc"
}) {
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    ...(groupId ? { groupId } : {}),
    ...(status ? { status } : {}),
    ...(ownerStaff ? { ownerStaff: { contains: ownerStaff, mode: "insensitive" } } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { caseType: { contains: q, mode: "insensitive" } },
            { note: { contains: q, mode: "insensitive" } },
            { lineDisplayName: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.loanCase.findMany({
      where,
      include: {
        group: true,
        statusLogs: {
          orderBy: { createdAt: "desc" },
          take: 10
        },
        reminders: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      },
      orderBy: sortOrder(sortBy, sortDir),
      skip,
      take: Number(limit)
    }),
    prisma.loanCase.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function getLoanCaseDetail(loanCaseId) {
  return prisma.loanCase.findUnique({
    where: { id: loanCaseId },
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
}

export async function ensureDailyCaseReport({ groupId, reportDate = new Date(), force = false }) {
  const dateStart = startOfDay(reportDate);
  const dateEnd = endOfDay(reportDate);
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return null;

  const cases = await prisma.loanCase.findMany({
    where: {
      groupId,
      OR: [{ createdAt: { gte: dateStart, lt: dateEnd } }, { updatedAt: { gte: dateStart, lt: dateEnd } }]
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const content = buildDailyCaseReportContent(group, cases, dateStart);
  const periodKey = formatPeriodKey(dateStart);

  const report = await prisma.dailyCaseReport.upsert({
    where: {
      groupId_reportDate: {
        groupId,
        reportDate: dateStart
      }
    },
    update: force
      ? {
          content,
          caseCount: cases.length,
          periodKey,
          meta: serializeReportMeta(cases)
        }
      : {
          content,
          caseCount: cases.length,
          periodKey,
          meta: serializeReportMeta(cases)
        },
    create: {
      groupId,
      reportDate: dateStart,
      periodKey,
      title: `${group.name || group.lineGroupId} 案件匯報`,
      content,
      caseCount: cases.length,
      meta: serializeReportMeta(cases)
    }
  });

  await logOperation({
    groupId,
    eventType: "DAILY_CASE_REPORT_CREATED",
    title: "建立每日匯報",
    detail: `${group.name || group.lineGroupId} / ${dateStart.toISOString().slice(0, 10)}`
  }).catch(() => {});

  return report;
}

export async function sendDailyCaseReport(reportId) {
  const report = await prisma.dailyCaseReport.findUnique({
    where: { id: reportId },
    include: { group: true }
  });
  if (!report) return null;

  await pushText(report.group.lineGroupId, report.content);

  const updated = await prisma.dailyCaseReport.update({
    where: { id: report.id },
    data: {
      sentAt: report.sentAt || new Date(),
      sentGroupAt: new Date()
    },
    include: { group: true }
  });

  await logOperation({
    groupId: report.groupId,
    eventType: "DAILY_CASE_REPORT_SENT",
    title: "發送每日匯報",
    detail: `${report.group.name || report.group.lineGroupId}`
  }).catch(() => {});

  await createNotification({
    groupId: report.groupId,
    type: "LOAN_REPORT",
    title: "每日匯報已發送",
    content: report.title,
    meta: { reportId: report.id }
  }).catch(() => {});

  return updated;
}

export async function listDailyCaseReports({ groupId, from, to, page = 1, limit = 20 }) {
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    ...(groupId ? { groupId } : {}),
    ...(from || to
      ? {
          reportDate: {
            ...(from ? { gte: startOfDay(new Date(from)) } : {}),
            ...(to ? { lte: endOfDay(new Date(to)) } : {})
          }
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.dailyCaseReport.findMany({
      where,
      include: { group: true },
      orderBy: { reportDate: "desc" },
      skip,
      take: Number(limit)
    }),
    prisma.dailyCaseReport.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function listLoanReminders({ groupId, status, type, page = 1, limit = 20 }) {
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    ...(groupId ? { groupId } : {}),
    ...(status ? { status } : {}),
    ...(type ? { reminderType: type } : {})
  };

  const [items, total] = await Promise.all([
    prisma.loanCaseReminder.findMany({
      where,
      include: {
        group: true,
        loanCase: true
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip,
      take: Number(limit)
    }),
    prisma.loanCaseReminder.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function syncLoanCaseRemindersForGroup(groupId) {
  const cases = await prisma.loanCase.findMany({
    where: { groupId },
    include: { group: true }
  });

  for (const loanCase of cases) {
    await syncLoanCaseRemindersForCase(loanCase);
  }
}

export async function syncLoanCaseRemindersForCase(loanCase) {
  const reminders = [];
  const todayKey = formatPeriodKey(new Date());
  const now = new Date();
  const ageMs = now.getTime() - new Date(loanCase.updatedAt).getTime();
  const stale = ageMs >= 24 * 60 * 60 * 1000;
  const supplementOverdue = loanCase.status === "NEED_SUPPLEMENT" && ageMs >= 2 * 24 * 60 * 60 * 1000;
  const approvedWaitSign = loanCase.status === "APPROVED";
  const signedWaitDisburse = loanCase.status === "SIGNED";

  if (new Date(loanCase.createdAt).toDateString() === now.toDateString()) {
    reminders.push({
      reminderType: "NEW_CASE",
      message: `今日新進件：${loanCase.customerName} / ${formatLoanCaseSummary(loanCase)}`,
      dedupeKey: `NEW_CASE:${loanCase.id}:${todayKey}`
    });
  }

  if (stale && !FINAL_STATUSES.has(loanCase.status)) {
    reminders.push({
      reminderType: "STALE_UPDATE",
      message: `超過1天未更新：${loanCase.customerName} / ${formatLoanCaseSummary(loanCase)}`,
      dedupeKey: `STALE_UPDATE:${loanCase.id}:${todayKey}`
    });
  }

  if (supplementOverdue) {
    reminders.push({
      reminderType: "SUPPLEMENT_OVERDUE",
      message: `待補件超過2天：${loanCase.customerName} / ${formatLoanCaseSummary(loanCase)}`,
      dedupeKey: `SUPPLEMENT_OVERDUE:${loanCase.id}:${todayKey}`
    });
  }

  if (approvedWaitSign) {
    reminders.push({
      reminderType: "APPROVED_WAIT_SIGN",
      message: `已核准未簽約：${loanCase.customerName} / ${formatLoanCaseSummary(loanCase)}`,
      dedupeKey: `APPROVED_WAIT_SIGN:${loanCase.id}:${todayKey}`
    });
  }

  if (signedWaitDisburse) {
    reminders.push({
      reminderType: "SIGNED_WAIT_DISBURSE",
      message: `已簽約未撥款：${loanCase.customerName} / ${formatLoanCaseSummary(loanCase)}`,
      dedupeKey: `SIGNED_WAIT_DISBURSE:${loanCase.id}:${todayKey}`
    });
  }

  for (const item of reminders) {
    await prisma.loanCaseReminder.upsert({
      where: { dedupeKey: item.dedupeKey },
      update: {
        message: item.message,
        status: "PENDING",
        dueAt: now
      },
      create: {
        groupId: loanCase.groupId,
        loanCaseId: loanCase.id,
        reminderType: item.reminderType,
        message: item.message,
        dedupeKey: item.dedupeKey,
        dueAt: now
      }
    });

    await createNotification({
      groupId: loanCase.groupId,
      type: "LOAN_CASE",
      title: "貸款提醒",
      content: item.message,
      meta: { loanCaseId: loanCase.id, reminderType: item.reminderType }
    }).catch(() => {});
  }

  return reminders.length;
}

export async function getLoanReportsOverview() {
  const todayStart = startOfDay(new Date());
  const weekStart = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [todayNewCases, statusStats, groupStats, caseTrends, recentReports] = await Promise.all([
    prisma.loanCase.count({
      where: {
        createdAt: { gte: todayStart }
      }
    }),
    prisma.loanCase.groupBy({
      by: ["status"],
      _count: { status: true }
    }),
    prisma.loanCase.groupBy({
      by: ["ownerStaff"],
      where: {
        ownerStaff: { not: null }
      },
      _count: { ownerStaff: true },
      orderBy: {
        _count: {
          ownerStaff: "desc"
        }
      },
      take: 10
    }),
    prisma.loanCase.findMany({
      where: {
        updatedAt: { gte: weekStart }
      },
      select: {
        id: true,
        customerName: true,
        caseType: true,
        amount: true,
        status: true,
        ownerStaff: true,
        group: {
          select: {
            id: true,
            name: true,
            lineGroupId: true
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.dailyCaseReport.findMany({
      orderBy: { reportDate: "desc" },
      take: 10,
      include: { group: true }
    })
  ]);

  const groupedByStatus = Object.fromEntries(statusStats.map((item) => [item.status, item._count.status]));

  return {
    todayNewCases,
    statusStats: groupedByStatus,
    ownerStats: groupStats.map((item) => ({
      ownerStaff: item.ownerStaff || "未指定",
      count: item._count.ownerStaff
    })),
    recentCases: caseTrends,
    recentReports
  };
}

export async function runLoanAutomationTick() {
  const groups = await prisma.group.findMany({
    where: {
      loanCases: {
        some: {}
      },
      isActive: true
    },
    select: {
      id: true,
      lineGroupId: true,
      name: true
    }
  });

  const now = new Date();
  const [hour, minute] = String(env.loanDailyReportTime || "09:00").split(":").map((value) => Number(value));
  const shouldRunReport = now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);

  for (const group of groups) {
    await syncLoanCaseRemindersForGroup(group.id).catch(() => {});

    if (!shouldRunReport) continue;

    const report = await prisma.dailyCaseReport.findUnique({
      where: {
        groupId_reportDate: {
          groupId: group.id,
          reportDate: startOfDay(now)
        }
      }
    });

    if (!report) {
      const generated = await ensureDailyCaseReport({ groupId: group.id, reportDate: now });
      if (generated) {
        await sendDailyCaseReport(generated.id).catch(() => {});
      }
      continue;
    }

    if (!report.sentAt) {
      await sendDailyCaseReport(report.id).catch(() => {});
    }
  }
}

function extractField(text, keywords) {
  for (const keyword of keywords) {
    const pattern = new RegExp(`${keyword}\\s*[:：]?\\s*([^\\n\\r，,;；]+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function guessNameFromText(text) {
  const firstLine = String(text || "")
    .split(/\r?\n/)[0]
    .trim();

  if (!firstLine) return null;
  const match = firstLine.match(/^([\p{Script=Han}A-Za-z·]{2,8})(?:\s|[:：\-]|$)/u);
  if (!match) return null;
  if (!/[金額額度電話手機聯絡方式狀態方案類型車種]/.test(text)) {
    return null;
  }
  return match[1];
}

function parseStatus(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const map = [
    ["送件中", "SUBMITTING"],
    ["已送件", "SUBMITTED"],
    ["審核中", "REVIEWING"],
    ["已核准", "APPROVED"],
    ["已簽約", "SIGNED"],
    ["已撥款", "DISBURSED"],
    ["待補件", "NEED_SUPPLEMENT"],
    ["暫緩", "POSTPONED"],
    ["退件", "REJECTED"]
  ];
  for (const [keyword, status] of map) {
    if (value.includes(keyword)) {
      return status;
    }
  }
  return null;
}

function loanCaseInclude() {
  return {
    group: true,
    statusLogs: {
      orderBy: { createdAt: "desc" }
    },
    reminders: {
      orderBy: { createdAt: "desc" }
    }
  };
}

function mergeLoanCaseData(existing, incoming) {
  const merged = {
    customerName: incoming.customerName || existing.customerName,
    phone: incoming.phone || existing.phone,
    lineDisplayName: incoming.lineDisplayName || existing.lineDisplayName,
    caseType: incoming.caseType || existing.caseType,
    amount: incoming.amount ?? existing.amount,
    status: incoming.status || existing.status,
    ownerStaff: incoming.ownerStaff || existing.ownerStaff,
    note: incoming.note || existing.note,
    sourceGroupId: incoming.sourceGroupId || existing.sourceGroupId,
    sourceMessageId: incoming.sourceMessageId || existing.sourceMessageId
  };
  return merged;
}

async function maybeLogLoanCaseStatus(before, after, adminUserId, note = null) {
  if (before.status === after.status) return;
  await prisma.loanCaseStatusLog.create({
    data: {
      groupId: after.groupId,
      loanCaseId: after.id,
      fromStatus: before.status,
      toStatus: after.status,
      note,
      changedByAdminId: adminUserId
    }
  });
}

export function formatLoanCaseSummary(loanCase) {
  const type = loanCase.caseType || "案件";
  const amount = loanCase.amount ? `${formatAmount(loanCase.amount)}` : "";
  const status = loanStatusLabels[loanCase.status] || loanCase.status;
  return [type, amount, status].filter(Boolean).join(" ");
}

function buildDailyCaseReportContent(group, cases, reportDate) {
  const dateLabel = reportDate.toLocaleDateString("zh-TW");
  const header = `📋 ${group.name || group.lineGroupId} 案件匯報 (${dateLabel})`;
  if (!cases.length) {
    return `${header}\n\n今日無案件進度更新`;
  }

  const lines = cases.map((item) => `🔹 ${item.customerName} - ${formatLoanCaseSummary(item)}`);
  return [header, "", ...lines].join("\n");
}

function serializeReportMeta(cases) {
  return {
    caseIds: cases.map((item) => item.id),
    statuses: cases.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {})
  };
}

function formatPeriodKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortOrder(sortBy, sortDir) {
  const direction = sortDir === "asc" ? "asc" : "desc";
  return [{ [sortBy || "updatedAt"]: direction }];
}

function startOfDay(date) {
  const item = new Date(date);
  item.setHours(0, 0, 0, 0);
  return item;
}

function endOfDay(date) {
  const item = new Date(date);
  item.setHours(23, 59, 59, 999);
  return item;
}
