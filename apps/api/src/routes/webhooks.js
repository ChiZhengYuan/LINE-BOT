import express from "express";
import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { decryptSecret } from "../services/cryptoVault.js";
import { analyzeMessage } from "../services/ruleEngine.js";
import { recordViolation } from "../services/violationProcessor.js";
import { pushText, replyText, getProfile } from "../services/line.js";
import { createNotification, ensureGroupSettings, ensureMember, logOperation, rebuildRankingsForGroup } from "../services/activity.js";
import { upsertLoanCaseFromMessage } from "../services/loanAutomation.js";

export const webhooksRouter = express.Router();

webhooksRouter.post(["/line", "/webhook/:configId/:webhookToken"], express.raw({ type: "application/json" }), async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const lineConfig = await resolveWebhookConfig(req);
    if ((req.params?.configId || req.params?.webhookToken) && !lineConfig) {
      return res.status(404).json({ message: "Webhook config not found" });
    }
    const signature = String(req.headers["x-line-signature"] || "");
    const channelSecret = lineConfig ? decryptSecret(lineConfig.channelSecretCiphertext) : env.lineChannelSecret;
    const valid = verifySignature(rawBody, signature, channelSecret);

    if (!valid) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const events = Array.isArray(payload.events) ? payload.events : [];

    for (const event of events) {
      if (event.type === "memberJoined") {
        await handleMemberJoined(event, lineConfig?.ownerAdminId || null);
        continue;
      }

      if (event.type !== "message" || event.message?.type !== "text") {
        continue;
      }

      const lineGroupId = event.source?.groupId || event.source?.roomId;
      const lineUserId = event.source?.userId;
      if (!lineGroupId || !lineUserId) {
        continue;
      }

      const group = await upsertGroup(lineGroupId, lineConfig?.ownerAdminId || null);
      const profile = await getProfile(lineUserId).catch(() => null);
      const member = await ensureMember({
        group,
        lineUserId,
        displayName: profile?.displayName || profile?.displayName || null
      });

      await prisma.member.update({
        where: { id: member.id },
        data: {
          messageCount: { increment: 1 },
          activeScore: { increment: 1 },
          lastMessageAt: new Date()
        }
      });

      await prisma.memberStats.upsert({
        where: { memberId: member.id },
        update: {
          totalMessages: { increment: 1 },
          totalActiveScore: { increment: 1 }
        },
        create: {
          groupId: group.id,
          memberId: member.id,
          totalMessages: 1,
          totalActiveScore: 1
        }
      });

      const messageLog = await prisma.messageLog.create({
        data: {
          groupId: group.id,
          lineGroupId,
          lineUserId,
          content: event.message.text,
          messageType: "text",
          raw: event
        }
      });

      const analysis = await analyzeMessage({
        group,
        content: event.message.text,
        lineUserId
      });

      await prisma.aiAssessment.create({
        data: {
          groupId: group.id,
          messageLogId: messageLog.id,
          lineUserId,
          riskScore: analysis.aiAssessment.riskScore,
          category: analysis.aiAssessment.category,
          reason: analysis.aiAssessment.reason,
          confidence: analysis.aiAssessment.confidence,
          raw: analysis.aiAssessment.raw
        }
      });

      if (analysis.matches.length > 0) {
        await recordViolation({
          group,
          messageLog,
          lineUserId,
          analysis
        });
      }

      await handleCheckin(group, member, event.message.text);
      await handleMissions(group, member, event.message.text);
      await handleAutoReply(group, event.message.text, event.replyToken);

      await upsertLoanCaseFromMessage({
        group,
        sourceGroupId: lineGroupId,
        sourceMessageId: String(event.message.id || messageLog.id),
        content: event.message.text,
        lineDisplayName: profile?.displayName || null,
        lineUserId
      });

      if (analysis.actionTaken === "WARNING") {
        await replyText(event.replyToken, group.ruleSetting?.warningMessage || "請注意群組規範。");
      }
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

async function handleMemberJoined(event, ownerAdminId = null) {
  const lineGroupId = event.source?.groupId || event.source?.roomId;
  if (!lineGroupId) return;

  const group = await upsertGroup(lineGroupId, ownerAdminId);
  const joinedMembers = Array.isArray(event.joined?.members) ? event.joined.members : [];
  const settings = await ensureGroupSettings(group.id);

  for (const joined of joinedMembers) {
    const lineUserId = joined.userId;
    const profile = await getProfile(lineUserId).catch(() => null);
    const member = await ensureMember({
      group,
      lineUserId,
      displayName: profile?.displayName || null
    });

    await createNotification({
      groupId: group.id,
      memberId: member.id,
      type: "NEW_MEMBER",
      title: "新成員加入",
      content: `${profile?.displayName || lineUserId} 加入了群組`
    });

    await logOperation({
      groupId: group.id,
      memberId: member.id,
      eventType: "MEMBER_UPDATED",
      title: "新成員加入",
      detail: `${profile?.displayName || lineUserId} 加入群組`
    });

    if (settings.welcomeSetting?.enabled) {
      const message = buildWelcomeMessage(settings.welcomeSetting, profile?.displayName || lineUserId);
      await pushText(group.lineGroupId, message);
    }
  }

  await rebuildRankingsForGroup(group.id).catch(() => {});
}

async function handleCheckin(group, member, content) {
  const settings = await ensureGroupSettings(group.id);
  if (settings.groupSetting?.checkinEnabled === false) return;
  if (!String(content || "").includes("簽到")) return;

  const checkinDate = new Date();
  checkinDate.setHours(0, 0, 0, 0);

  const already = await prisma.checkin.findFirst({
    where: {
      groupId: group.id,
      lineUserId: member.userId,
      checkinDate
    }
  });
  if (already) return;

  await prisma.checkin.create({
    data: {
      groupId: group.id,
      memberId: member.id,
      lineUserId: member.userId,
      checkinDate,
      streakDays: 1,
      pointsEarned: 5
    }
  });

  await prisma.member.update({
    where: { id: member.id },
    data: {
      checkinCount: { increment: 1 },
      activeScore: { increment: 5 },
      lastCheckinAt: new Date()
    }
  });

  await prisma.memberStats.upsert({
    where: { memberId: member.id },
    update: {
      totalCheckins: { increment: 1 },
      currentStreak: { increment: 1 },
      totalActiveScore: { increment: 5 }
    },
    create: {
      groupId: group.id,
      memberId: member.id,
      totalCheckins: 1,
      currentStreak: 1,
      totalActiveScore: 5
    }
  });

  await createNotification({
    groupId: group.id,
    memberId: member.id,
    type: "NEW_MEMBER",
    title: "簽到完成",
    content: `${member.displayName || member.userId} 完成每日簽到`
  });
}

async function handleMissions(group, member, content) {
  const missions = await prisma.mission.findMany({
    where: {
      groupId: group.id,
      isActive: true
    }
  });

  if (!missions.length) return;

  for (const mission of missions) {
    let shouldIncrease = false;
    if (mission.missionType === "MESSAGE_COUNT") {
      shouldIncrease = true;
    } else if (mission.missionType === "KEYWORD" && mission.keyword) {
      shouldIncrease = String(content || "").includes(mission.keyword);
    } else if (mission.missionType === "CHECKIN" && String(content || "").includes("簽到")) {
      shouldIncrease = true;
    }

    if (!shouldIncrease) continue;

    const progress = await prisma.missionProgress.upsert({
      where: {
        missionId_memberId: {
          missionId: mission.id,
          memberId: member.id
        }
      },
      update: {
        currentCount: { increment: 1 },
        lastProgressAt: new Date()
      },
      create: {
        missionId: mission.id,
        memberId: member.id,
        currentCount: 1,
        targetCount: mission.targetCount,
        lastProgressAt: new Date()
      }
    });

    if (progress.currentCount >= mission.targetCount && !progress.isCompleted) {
      await prisma.missionProgress.update({
        where: {
          missionId_memberId: {
            missionId: mission.id,
            memberId: member.id
          }
        },
        data: {
          isCompleted: true,
          completedAt: new Date()
        }
      });

      await prisma.member.update({
        where: { id: member.id },
        data: {
          missionCompletedCount: { increment: 1 },
          activeScore: { increment: mission.pointsReward }
        }
      });

      await createNotification({
        groupId: group.id,
        memberId: member.id,
        type: "MISSION_DUE",
        title: "任務完成",
        content: `${member.displayName || member.userId} 已完成任務：${mission.title}`
      });
    }
  }

  await rebuildRankingsForGroup(group.id).catch(() => {});
}

async function handleAutoReply(group, content, replyToken) {
  const settings = await ensureGroupSettings(group.id);
  if (settings.groupSetting?.keywordAutoReplyEnabled === false) return;

  const rules = await prisma.autoReplyRule.findMany({
    where: { groupId: group.id, isActive: true },
    orderBy: { updatedAt: "desc" }
  });

  for (const rule of rules) {
    const matched = matchAutoReply(rule, content);
    if (!matched) continue;

    const now = new Date();
    if (rule.lastHitAt && rule.cooldownSeconds > 0) {
      const elapsed = (now.getTime() - new Date(rule.lastHitAt).getTime()) / 1000;
      if (elapsed < rule.cooldownSeconds) {
        continue;
      }
    }

    await prisma.autoReplyRule.update({
      where: { id: rule.id },
      data: {
        hitCount: { increment: 1 },
        lastHitAt: now
      }
    });

    if (rule.responseType === "FLEX" && rule.responseFlex) {
      await replyText(replyToken, rule.responseText || "已收到");
    } else {
      await replyText(replyToken, rule.responseText);
    }
    return;
  }
}

function matchAutoReply(rule, content) {
  const text = String(content || "");
  if (rule.matchType === "EXACT") return text === rule.keyword;
  if (rule.matchType === "CONTAINS") return text.includes(rule.keyword);
  if (rule.matchType === "REGEX") {
    try {
      return new RegExp(rule.keyword, "i").test(text);
    } catch {
      return false;
    }
  }
  return false;
}

function buildWelcomeMessage(welcomeSetting, name) {
  return [
    `👋 歡迎 ${name} 加入群組`,
    "",
    welcomeSetting.welcomeMessage,
    "",
    welcomeSetting.groupRulesMessage
  ].join("\n");
}

function verifySignature(rawBody, signature, channelSecret) {
  if (!channelSecret || !signature) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");

  return digest === signature;
}

async function upsertGroup(lineGroupId, ownerAdminId = null) {
  const group = await prisma.group.upsert({
    where: { lineGroupId },
    update: ownerAdminId ? { ownerAdminId } : {},
    create: {
      lineGroupId,
      ownerAdminId,
      ruleSetting: {
        create: {}
      },
      groupSetting: {
        create: {}
      },
      welcomeSetting: {
        create: {
          enabled: false,
          welcomeMessage: "歡迎加入群組，請先閱讀群規。",
          groupRulesMessage: "請遵守群組規範，避免洗版、廣告與違規連結。"
        }
      }
    },
    include: {
      ruleSetting: true,
      groupSetting: true,
      welcomeSetting: true
    }
  });

  if (!group.ruleSetting) {
    await prisma.ruleSetting.upsert({
      where: { groupId: group.id },
      update: {},
      create: { groupId: group.id }
    });
  }

  await ensureGroupSettings(group.id);

  return prisma.group.findUnique({
    where: { id: group.id },
    include: { ruleSetting: true, groupSetting: true, welcomeSetting: true }
  });
}

async function resolveWebhookConfig(req) {
  const configId = req.params?.configId;
  const webhookToken = req.params?.webhookToken;
  if (!configId || !webhookToken) {
    return null;
  }

  const config = await prisma.lineDeveloperConfig.findUnique({
    where: { id: configId }
  });
  if (!config || !config.isActive || config.webhookToken !== webhookToken) {
    return null;
  }

  return config;
}
