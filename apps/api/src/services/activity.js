import { prisma } from "../config/prisma.js";

async function getGroupOwnerAdminId(groupOrGroupId) {
  if (!groupOrGroupId) return null;
  if (typeof groupOrGroupId === "object" && "ownerAdminId" in groupOrGroupId) {
    return groupOrGroupId.ownerAdminId || null;
  }
  const group = await prisma.group.findUnique({
    where: { id: String(groupOrGroupId) },
    select: { ownerAdminId: true }
  });
  return group?.ownerAdminId || null;
}

export async function ensureMember({ group, lineUserId, displayName }) {
  if (!group || !lineUserId) return null;
  const ownerAdminId = await getGroupOwnerAdminId(group);

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
      ownerAdminId,
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
      ownerAdminId,
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
  const ownerAdminId = await getGroupOwnerAdminId(groupId);

  await prisma.groupSetting.upsert({
    where: { groupId },
    update: {
      ownerAdminId
    },
    create: {
      groupId,
      ownerAdminId,
      autoEnforcement: true,
      aiEnabled: true,
      blacklistFilteringEnabled: true,
      spamDetectionEnabled: true,
      welcomeEnabled: false,
      announcementEnabled: false,
      dailyReportEnabled: true,
      dailyReportTime: "09:00",
      protectionStatusTargetLineGroupId: null,
      violationThreshold: 3,
      spamWindowSeconds: 10,
      spamMaxMessages: 5,
      pushToGroup: false,
      notifyAdmins: true
    }
  });

  await prisma.welcomeSetting.upsert({
    where: { groupId },
    update: {
      ownerAdminId
    },
    create: {
      groupId,
      ownerAdminId,
      enabled: false,
      welcomeMessage: "歡迎加入群組，請先閱讀群規。",
      groupRulesMessage: "請遵守群組規範，勿洗版、勿貼廣告、勿發送違規內容。"
    }
  });

  const [groupSetting, welcomeSetting] = await Promise.all([
    prisma.groupSetting.findUnique({ where: { groupId } }),
    prisma.welcomeSetting.findUnique({ where: { groupId } })
  ]);

  return { groupSetting, welcomeSetting };
}

export async function logOperation({
  adminUserId = null,
  ownerAdminId = null,
  groupId = null,
  memberId = null,
  eventType,
  title,
  detail = null,
  meta = null
}) {
  if (!ownerAdminId && groupId) {
    ownerAdminId = await getGroupOwnerAdminId(groupId);
  }
  return prisma.operationLog.create({
    data: {
      ownerAdminId,
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
  ownerAdminId = null,
  groupId = null,
  memberId = null,
  type,
  title,
  content,
  meta = null
}) {
  if (!ownerAdminId && groupId) {
    ownerAdminId = await getGroupOwnerAdminId(groupId);
  }
  return prisma.notification.create({
    data: {
      ownerAdminId,
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

export async function markAllNotificationsRead(req) {
  const ownerAdminId = getTenantOwnerId(req);
  return prisma.notification.updateMany({
    where: {
      isRead: false,
      ...(ownerAdminId ? { ownerAdminId } : {})
    },
    data: { isRead: true, readAt: new Date() }
  });
}

export async function rebuildRankingsForGroup(groupId) {
  const ownerAdminId = await getGroupOwnerAdminId(groupId);

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
          ownerAdminId,
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
  const ownerAdminId = await getGroupOwnerAdminId(groupId);
  return prisma.welcomeSetting.upsert({
    where: { groupId },
    update: {},
    create: {
      groupId,
      ownerAdminId,
      welcomeMessage: "歡迎加入群組，請先閱讀群規。",
      groupRulesMessage: "請遵守群組規範，勿洗版、勿貼廣告、勿發送違規內容。"
    }
  });
}

export async function touchGroupOwner(groupId, ownerAdminId) {
  if (!groupId || !ownerAdminId) return;
  await prisma.group.update({
    where: { id: groupId },
    data: { ownerAdminId }
  }).catch(() => {});
}

export async function getGroupOwner(groupId) {
  return getGroupOwnerAdminId(groupId);
}
