import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { pushText } from "./line.js";
import { sendTelegramMessage } from "./telegram.js";
import { getTelegramSettings } from "./telegramSettings.js";

export async function recordViolation({ group, messageLog, lineUserId, analysis }) {
  const created = [];

  for (const match of analysis.matches) {
    const violation = await prisma.violation.create({
      data: {
        groupId: group.id,
        messageLogId: messageLog.id,
        lineUserId,
        lineGroupId: group.lineGroupId,
        ruleType: match.ruleType,
        category: match.category,
        reason: match.reason,
        riskScore: analysis.aiAssessment.riskScore,
        confidence: analysis.aiAssessment.confidence,
        points: match.points,
        actionTaken: analysis.actionTaken,
        status: analysis.status
      }
    });
    created.push(violation);
  }

  await prisma.pendingAction.create({
    data: {
      groupId: group.id,
      lineUserId,
      lineGroupId: group.lineGroupId,
      messageLogId: messageLog.id,
      reason: analysis.aiAssessment.reason,
      actionType: analysis.actionTaken,
      status: analysis.status
    }
  });

  if (analysis.actionTaken !== "NONE") {
    const notice = buildGroupNotice(group, analysis);
    if (notice) {
      try {
        await pushText(group.lineGroupId, notice);
      } catch (error) {
        console.error("Failed to push group notification", error);
      }
    }
  }

  if (analysis.actionTaken === "ADMIN_NOTIFY") {
    const targets = (analysis.setting.adminNotifyLineIds || []).length
      ? analysis.setting.adminNotifyLineIds
      : env.lineAdminUserIds;

    for (const adminId of targets) {
      try {
        await pushText(adminId, buildAdminNotice(group, analysis));
      } catch (error) {
        console.error("Failed to push LINE admin notification", error);
      }
    }

    const telegramSettings = await getTelegramSettings();
    const telegramTargets = (analysis.setting.adminNotifyTelegramChatIds || []).length
      ? analysis.setting.adminNotifyTelegramChatIds
      : telegramSettings.telegramChatIds;

    for (const chatId of telegramTargets) {
      try {
        await sendTelegramMessage(chatId, buildAdminNotice(group, analysis));
      } catch (error) {
        console.error("Failed to push Telegram notification", error);
      }
    }
  }

  return created;
}

function buildGroupNotice(group, analysis) {
  const titleMap = {
    WARNING: "⚠️ 已觸發警告",
    ADMIN_NOTIFY: "📣 已通知管理員",
    PENDING_KICK: "🧾 已加入待踢清單",
    KICKED: "⛔ 已執行踢出處置"
  };

  const title = titleMap[analysis.actionTaken];
  if (!title) return null;

  const lines = [title];
  if (group?.name) {
    lines.push(`群組：${group.name}`);
  }
  lines.push(`原因：${analysis.aiAssessment.reason}`);

  if (analysis.matches?.length) {
    const matchedRules = analysis.matches.map((item) => formatRule(item.ruleType)).join("、");
    lines.push(`觸發規則：${matchedRules}`);
  }

  return lines.join("\n");
}

function buildAdminNotice(group, analysis) {
  const titleMap = {
    WARNING: "⚠️ 群組發現違規內容",
    ADMIN_NOTIFY: "📣 群組需要管理員注意",
    PENDING_KICK: "🧾 群組待踢清單更新",
    KICKED: "⛔ 群組已執行踢出處置"
  };

  const title = titleMap[analysis.actionTaken] || "📌 群組通知";
  const lines = [title];
  if (group?.name) {
    lines.push(`群組：${group.name}`);
  }
  lines.push(`原因：${analysis.aiAssessment.reason}`);
  lines.push(`狀態：${formatStatus(analysis.status)}`);
  lines.push(`動作：${formatAction(analysis.actionTaken)}`);
  return lines.join("\n");
}

function formatRule(ruleType) {
  const map = {
    URL: "網址保護",
    INVITE: "邀請連結",
    BLACKLIST: "黑名單詞",
    SPAM: "洗版偵測",
    AI: "AI 判斷"
  };
  return map[ruleType] || ruleType || "未知規則";
}

function formatStatus(status) {
  const map = {
    FLAGGED: "已標記",
    REVIEWED: "待審",
    ESCALATED: "已升級",
    KICK_PENDING: "待踢",
    RESOLVED: "已處理"
  };
  return map[status] || status || "未知";
}

function formatAction(action) {
  const map = {
    NONE: "無",
    WARNING: "群內警告",
    BACKOFFICE_TAG: "後台標記",
    ADMIN_NOTIFY: "通知管理員",
    PENDING_KICK: "加入待踢",
    KICKED: "已踢出"
  };
  return map[action] || action || "未知";
}
