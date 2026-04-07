import { RuleType, ActionTaken } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { getCacheClient } from "../config/cache.js";
import { analyzeAiRisk } from "./aiAnalyzer.js";

const INVITE_REGEX = /(line\.me\/ti\/g\/|line\.me\/R\/ti\/g\/|line\.me\/~\/g\/|invite)/i;
const URL_REGEX = /(https?:\/\/|www\.)/i;

function containsBlacklistWord(content, words) {
  const lowered = content.toLowerCase();
  return words.find((word) => word && lowered.includes(String(word).toLowerCase())) || null;
}

export async function analyzeMessage({ group, content, lineUserId }) {
  const ruleSetting = group.ruleSetting || (await prisma.ruleSetting.upsert({
    where: { groupId: group.id },
    update: {},
    create: { groupId: group.id }
  }));

  const groupSetting = group.groupSetting || (await prisma.groupSetting.upsert({
    where: { groupId: group.id },
    update: {},
    create: { groupId: group.id }
  }));

  const cache = await getCacheClient();
  const spamKey = `spam:${group.lineGroupId}:${lineUserId}`;
  const spamCount = groupSetting.spamDetectionEnabled === false
    ? 0
    : await cache.incr(spamKey, ruleSetting.spamWindowSeconds || groupSetting.spamWindowSeconds || 10);

  const matches = [];
  let totalPoints = 0;

  if ((ruleSetting.protectUrl ?? true) && URL_REGEX.test(content || "")) {
    matches.push({
      ruleType: RuleType.URL,
      category: "url_protection",
      reason: "偵測到網址連結",
      points: ruleSetting.warningPoints
    });
  }

  if ((ruleSetting.protectInvite ?? true) && INVITE_REGEX.test(content || "")) {
    matches.push({
      ruleType: RuleType.INVITE,
      category: "invite_protection",
      reason: "偵測到邀請連結",
      points: ruleSetting.warningPoints
    });
  }

  if (groupSetting.blacklistFilteringEnabled !== false) {
    const blacklistWord = containsBlacklistWord(content || "", ruleSetting.blacklistWords || []);
    if (blacklistWord) {
      matches.push({
        ruleType: RuleType.BLACKLIST,
        category: "blacklist_word",
        reason: `命中黑名單詞：${blacklistWord}`,
        points: ruleSetting.reviewPoints
      });
    }
  }

  if ((groupSetting.spamDetectionEnabled ?? true) && spamCount > (ruleSetting.spamMaxMessages || groupSetting.spamMaxMessages || 5)) {
    matches.push({
      ruleType: RuleType.SPAM,
      category: "spam",
      reason: `在 ${ruleSetting.spamWindowSeconds || groupSetting.spamWindowSeconds || 10} 秒內發言過多`,
      points: ruleSetting.kickPoints
    });
  }

  for (const match of matches) {
    totalPoints += match.points;
  }

  const aiAssessment =
    groupSetting.aiEnabled === false
      ? {
          riskScore: 0,
          category: "benign",
          reason: "AI 已關閉，略過風險判斷",
          confidence: 0,
          raw: { disabled: true }
        }
      : await analyzeAiRisk({
          content: content || "",
          matches,
          spamCount
        });

  totalPoints += Math.round((aiAssessment.riskScore || 0) / 25);

  const autoEnforcement = groupSetting.autoEnforcement !== false;
  const actionTaken = autoEnforcement ? resolveAction(totalPoints, ruleSetting, groupSetting) : ActionTaken.NONE;
  const status = totalPoints >= (groupSetting.violationThreshold ?? ruleSetting.kickThreshold)
    ? "KICK_PENDING"
    : totalPoints >= (ruleSetting.reviewThreshold || 5)
      ? "ESCALATED"
      : "FLAGGED";

  return {
    matches,
    aiAssessment,
    totalPoints,
    actionTaken,
    status,
    setting: ruleSetting,
    groupSetting
  };
}

function resolveAction(points, ruleSetting, groupSetting) {
  const kickThreshold = groupSetting.violationThreshold ?? ruleSetting.kickThreshold;
  const reviewThreshold = ruleSetting.reviewThreshold || 5;
  const warningThreshold = ruleSetting.warningThreshold || 3;

  if (points >= kickThreshold) return ActionTaken.PENDING_KICK;
  if (points >= reviewThreshold) return ActionTaken.ADMIN_NOTIFY;
  if (points >= warningThreshold) return ActionTaken.WARNING;
  return ActionTaken.NONE;
}
