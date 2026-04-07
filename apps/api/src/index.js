import bcrypt from "bcryptjs";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { startAdminLifecycleScheduler } from "./services/adminLifecycle.js";
import { startLoanAutomationScheduler } from "./services/loanScheduler.js";

async function ensureDefaultAccounts() {
  await ensureAdminAccount({
    email: env.defaultSuperAdminEmail,
    password: env.defaultSuperAdminPassword,
    name: env.defaultSuperAdminName,
    role: "SUPER_ADMIN",
    planType: "PERMANENT"
  });

  await ensureAdminAccount({
    email: env.defaultAdminEmail,
    password: env.defaultAdminPassword,
    name: env.defaultAdminName,
    role: "ADMIN",
    planType: "PERMANENT"
  });
}

async function ensureAdminAccount({ email, password, name, role, planType, expireAt = null }) {
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    if (!existing.ownerAdminId) {
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: { ownerAdminId: existing.id }
      });
    }
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      planType,
      expireAt,
      status: "ACTIVE"
    }
  });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { ownerAdminId: admin.id }
  });

  return admin;
}

async function backfillOwnership() {
  const defaultOwner = await prisma.adminUser.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    orderBy: { createdAt: "asc" }
  });

  if (!defaultOwner) return;

  const ownerAdminId = defaultOwner.id;

  const groupIds = await prisma.group.findMany({
    where: { ownerAdminId: null },
    select: { id: true }
  });
  for (const item of groupIds) {
    await prisma.group.update({
      where: { id: item.id },
      data: { ownerAdminId }
    }).catch(() => {});
  }

  await backfillByGroup("groupSetting", ownerAdminId);
  await backfillByGroup("welcomeSetting", ownerAdminId);
  await backfillByGroup("member", ownerAdminId);
  await backfillByGroup("memberStats", ownerAdminId);
  await backfillByGroup("messageLog", ownerAdminId);
  await backfillByGroup("violation", ownerAdminId);
  await backfillByGroup("aiAssessment", ownerAdminId);
  await backfillByGroup("blacklistEntry", ownerAdminId);
  await backfillByGroup("whitelistEntry", ownerAdminId);
  await backfillByGroup("pendingAction", ownerAdminId);
  await backfillByGroup("operationLog", ownerAdminId);
  await backfillByGroup("notification", ownerAdminId);
  await backfillByGroup("announcement", ownerAdminId);
  await backfillByGroup("announcementJob", ownerAdminId);
  await backfillByGroup("autoReplyRule", ownerAdminId);
  await backfillByGroup("checkin", ownerAdminId);
  await backfillByGroup("mission", ownerAdminId);
  await backfillByGroup("missionProgress", ownerAdminId);
  await backfillByGroup("lottery", ownerAdminId);
  await backfillByGroup("lotteryEntry", ownerAdminId);
  await backfillByGroup("lotteryWinner", ownerAdminId);
  await backfillByGroup("ranking", ownerAdminId);
  await backfillByGroup("loanCase", ownerAdminId);
  await backfillByGroup("loanCaseStatusLog", ownerAdminId);
  await backfillByGroup("loanCaseReminder", ownerAdminId);
  await backfillByGroup("dailyCaseReport", ownerAdminId);
  await prisma.adminNotification.updateMany({
    where: { ownerAdminId: null },
    data: { ownerAdminId }
  }).catch(() => {});
  await prisma.lineDeveloperConfig.updateMany({
    where: { ownerAdminId: null },
    data: { ownerAdminId }
  }).catch(() => {});
}

async function backfillByGroup(modelName, ownerAdminId) {
  const mapping = {
    groupSetting: prisma.groupSetting,
    welcomeSetting: prisma.welcomeSetting,
    member: prisma.member,
    memberStats: prisma.memberStats,
    messageLog: prisma.messageLog,
    violation: prisma.violation,
    aiAssessment: prisma.aiAssessment,
    blacklistEntry: prisma.blacklistEntry,
    whitelistEntry: prisma.whitelistEntry,
    pendingAction: prisma.pendingAction,
    operationLog: prisma.operationLog,
    notification: prisma.notification,
    announcement: prisma.announcement,
    announcementJob: prisma.announcementJob,
    autoReplyRule: prisma.autoReplyRule,
    checkin: prisma.checkin,
    mission: prisma.mission,
    missionProgress: prisma.missionProgress,
    lottery: prisma.lottery,
    lotteryEntry: prisma.lotteryEntry,
    lotteryWinner: prisma.lotteryWinner,
    ranking: prisma.ranking,
    loanCase: prisma.loanCase,
    loanCaseStatusLog: prisma.loanCaseStatusLog,
    loanCaseReminder: prisma.loanCaseReminder,
    dailyCaseReport: prisma.dailyCaseReport
  };

  const client = mapping[modelName];
  if (!client) return;

  await client.updateMany({
    where: { ownerAdminId: null },
    data: { ownerAdminId }
  }).catch(() => {});
}

async function main() {
  await prisma.$connect();
  await ensureDefaultAccounts();
  await backfillOwnership();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
  startAdminLifecycleScheduler();
  startLoanAutomationScheduler();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
