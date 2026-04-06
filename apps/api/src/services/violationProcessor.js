import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { pushText } from "./line.js";
import { sendTelegramMessage } from "./telegram.js";

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

  if (analysis.actionTaken === "ADMIN_NOTIFY") {
    const targets = (analysis.setting.adminNotifyLineIds || []).length
      ? analysis.setting.adminNotifyLineIds
      : env.lineAdminUserIds;

    for (const adminId of targets) {
      await pushText(adminId, `群組 ${group.lineGroupId} 偵測到違規：${analysis.aiAssessment.reason}`);
    }

    const telegramTargets = (analysis.setting.adminNotifyTelegramChatIds || []).length
      ? analysis.setting.adminNotifyTelegramChatIds
      : env.telegramDefaultChatIds;

    for (const chatId of telegramTargets) {
      await sendTelegramMessage(chatId, `群組 ${group.lineGroupId} 偵測到違規：${analysis.aiAssessment.reason}`);
    }
  }

  return created;
}
