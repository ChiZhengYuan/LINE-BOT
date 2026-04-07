import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { pushText } from "./line.js";
import { sendTelegramMessage } from "./telegram.js";
import { getTelegramSettings } from "./telegramSettings.js";

export async function recordViolation({
  group,
  messageLog,
  lineUserId,
  analysis
}) {
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
    const notice = buildGroupNotice(group.lineGroupId, analysis);
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
        await pushText(adminId, `群組 ${group.lineGroupId} 觸發違規通知：${analysis.aiAssessment.reason}`);
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
        await sendTelegramMessage(chatId, `群組 ${group.lineGroupId} 觸發違規通知：${analysis.aiAssessment.reason}`);
      } catch (error) {
        console.error("Failed to push Telegram notification", error);
      }
    }
  }

  return created;
}

function buildGroupNotice(lineGroupId, analysis) {
  const lines = [];

  if (analysis.actionTaken === "WARNING") {
    lines.push("請注意群組規範，系統已偵測到違規內容。");
  } else if (analysis.actionTaken === "ADMIN_NOTIFY") {
    lines.push("系統已通知管理員，請留意群組規範。");
  } else if (analysis.actionTaken === "PENDING_KICK") {
    lines.push("系統已將此成員加入待踢清單。");
  } else if (analysis.actionTaken === "KICKED") {
    lines.push("系統已執行踢出處置。");
  }

  if (lines.length === 0) {
    return null;
  }

  lines.push(`群組：${lineGroupId}`);
  lines.push(`原因：${analysis.aiAssessment.reason}`);

  return lines.join("\n");
}
