import { prisma } from "../config/prisma.js";

export async function ensureMember({ group, lineUserId, displayName }) {
  if (!group || !lineUserId) return null;

  const member = await prisma.member.upsert({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: lineUserId
      }
    },
    update: {
      displayName: displayName || undefined,
      lastMessageAt: new Date()
    },
    create: {
      groupId: group.id,
      userId: lineUserId,
      displayName: displayName || null,
      lastMessageAt: new Date()
    }
  });

  await prisma.memberStats.upsert({
    where: { memberId: member.id },
    update: {},
    create: {
      groupId: group.id,
      memberId: member.id
    }
  });

  return member;
}

export async function updateMemberActivity(memberId, patch = {}) {
  if (!memberId) return null;
  return prisma.member.update({
    where: { id: memberId },
    data: patch
  });
}

export async function ensureGroupSettings(groupId) {
  const [groupSetting, welcomeSetting] = await Promise.all([
    prisma.groupSetting.upsert({
      where: { groupId },
      update: {},
      create: { groupId }
    }),
    prisma.welcomeSetting.upsert({
      where: { groupId },
      update: {},
      create: {
        groupId,
        welcomeMessage: "歡迎加入群組，請先閱讀群規。",
        groupRulesMessage: "請遵守群組規範，避免洗版、廣告與違規連結。"
      }
    })
  ]);

  return { groupSetting, welcomeSetting };
}

export async function logOperation({
  adminUserId = null,
  groupId = null,
  memberId = null,
  eventType,
  title,
  detail = null,
  meta = null
}) {
  return prisma.operationLog.create({
    data: {
      adminUserId,
      groupId,
      memberId,
      eventType,
      title,
      detail,
      meta
    }
  });
}

export async function createNotification({
  groupId = null,
  memberId = null,
  type,
  title,
  content,
  meta = null
}) {
  return prisma.notification.create({
    data: {
      groupId,
      memberId,
      type,
      title,
      content,
      meta
    }
  });
}

export async function markNotificationRead(notificationId) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() }
  });
}

export async function markAllNotificationsRead() {
  return prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true, readAt: new Date() }
  });
}

export async function rebuildRankingsForGroup(groupId) {
  const members = await prisma.member.findMany({
    where: { groupId },
    orderBy: [{ activeScore: "desc" }, { updatedAt: "desc" }]
  });

  const periods = [
    { period: "DAY", periodKey: formatPeriodKey(new Date(), "DAY") },
    { period: "WEEK", periodKey: formatPeriodKey(new Date(), "WEEK") },
    { period: "MONTH", periodKey: formatPeriodKey(new Date(), "MONTH") },
    { period: "TOTAL", periodKey: "TOTAL" }
  ];

  for (const { period, periodKey } of periods) {
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index];
      await prisma.ranking.upsert({
        where: {
          groupId_period_periodKey_memberId: {
            groupId,
            period,
            periodKey,
            memberId: member.id
          }
        },
        update: {
          activeScore: member.activeScore,
          messageCount: member.messageCount,
          checkinCount: member.checkinCount,
          missionCount: member.missionCompletedCount,
          lotteryCount: member.lotteryEntries?.length || 0,
          rankPosition: index + 1
        },
        create: {
          groupId,
          memberId: member.id,
          period,
          periodKey,
          activeScore: member.activeScore,
          messageCount: member.messageCount,
          checkinCount: member.checkinCount,
          missionCount: member.missionCompletedCount,
          lotteryCount: member.lotteryEntries?.length || 0,
          rankPosition: index + 1
        }
      });
    }
  }
}

export function formatPeriodKey(date, period) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (period === "DAY") return `${year}-${month}-${day}`;
  if (period === "WEEK") {
    const start = new Date(date);
    const dayOfWeek = start.getDay() || 7;
    start.setDate(start.getDate() - dayOfWeek + 1);
    const week = String(Math.ceil((((start - new Date(start.getFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, "0");
    return `${start.getFullYear()}-W${week}`;
  }
  if (period === "MONTH") return `${year}-${month}`;
  return "TOTAL";
}

export async function ensureWelcomeForGroup(groupId) {
  return prisma.welcomeSetting.upsert({
    where: { groupId },
    update: {},
    create: {
      groupId,
      welcomeMessage: "歡迎加入群組，請先閱讀群規。",
      groupRulesMessage: "請遵守群組規範，避免洗版、廣告與違規連結。"
    }
  });
}
