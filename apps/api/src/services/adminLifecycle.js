import { prisma } from "../config/prisma.js";
import { createNotification, logOperation } from "./activity.js";

let timer = null;

export function startAdminLifecycleScheduler() {
  if (timer) return;

  const intervalMs = 30 * 60 * 1000;
  timer = setInterval(() => {
    runAdminLifecycleTick().catch((error) => {
  console.error("[adminLifecycle] 週期檢查失敗", error);
    });
  }, intervalMs);

  runAdminLifecycleTick().catch((error) => {
  console.error("[adminLifecycle] 初始檢查失敗", error);
  });
}

export function stopAdminLifecycleScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function runAdminLifecycleTick() {
  const now = new Date();

  const expiringAdmins = await prisma.adminUser.findMany({
    where: {
      planType: "EXPIRING",
      status: "ACTIVE",
      expireAt: { not: null }
    }
  });

  for (const admin of expiringAdmins) {
    const expireAt = new Date(admin.expireAt);
    const diffDays = Math.ceil((expireAt.getTime() - now.getTime()) / 86400000);

    if (diffDays < 0) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { status: "EXPIRED" }
      });

      await createAdminReminder(admin, "EXPIRED", "帳號已到期", "此帳號已過期，請盡快續約後再登入。");
      await logOperation({
        adminUserId: admin.id,
        ownerAdminId: admin.ownerAdminId || admin.id,
        eventType: "SYSTEM_ERROR",
        title: "帳號到期",
        detail: `${admin.email} 已自動變更為到期狀態`
      }).catch(() => {});
      continue;
    }

    if ([7, 3, 1, 0].includes(diffDays)) {
      await createAdminReminder(
        admin,
        `EXPIRY_${diffDays}`,
        `帳號即將到期（${diffDays} 天）`,
        diffDays === 0
          ? "您的帳號今天到期，請立即續約。"
          : `您的帳號距離到期還有 ${diffDays} 天，請提前處理。`
      );
    }
  }
}

async function createAdminReminder(admin, dedupeSuffix, title, content) {
  const dedupeKey = `admin-expiry:${admin.id}:${dedupeSuffix}`;
  await prisma.adminNotification.upsert({
    where: { dedupeKey },
    update: {
      title,
      content,
      type: "ACCOUNT_EXPIRY",
      ownerAdminId: admin.ownerAdminId || admin.id,
      adminUserId: admin.id
    },
    create: {
      dedupeKey,
      ownerAdminId: admin.ownerAdminId || admin.id,
      adminUserId: admin.id,
      title,
      content,
      type: "ACCOUNT_EXPIRY"
    }
  });

  await createNotification({
    ownerAdminId: admin.ownerAdminId || admin.id,
    title,
    content,
    type: "SYSTEM_ERROR",
    meta: { adminId: admin.id, dedupeSuffix }
  }).catch(() => {});
}
