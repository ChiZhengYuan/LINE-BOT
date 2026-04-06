import { RuleType, ActionTaken } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { getCacheClient } from "../config/cache.js";
import { analyzeAiRisk } from "./aiAnalyzer.js";

const INVITE_REGEX = /(line\.me\/ti\/g\/|line\.me\/R\/ti\/g\/|line\.me\/~\/g\/|加入群組|invite)/i;
const URL_REGEX = /(https?:\/\/|www\.)/i;

function containsBlacklistWord(content, words) {
  const lowered = content.toLowerCase();
  return words.find((word) => word && lowered.includes(String(word).toLowerCase())) || null;
}

export async function analyzeMessage({ group, content, lineUserId }) {
  const setting = group.ruleSetting || (await prisma.ruleSetting.upsert({
    where: { groupId: group.id },
    update: {},
    create: { groupId: group.id }
  }));

  const cache = await getCacheClient();
  const spamKey = `spam:${group.lineGroupId}:${lineUserId}`;
  const spamCount = await cache.incr(spamKey, setting.spamWindowSeconds);
  const matches = [];
  let totalPoints = 0;

  if (setting.protectUrl && URL_REGEX.test(content || "")) {
    matches.push({
      ruleType: RuleType.URL,
      category: "url_protection",
      reason: "偵測到網址內容",
      points: setting.warningPoints
    });
  }

  if (setting.protectInvite && INVITE_REGEX.test(content || "")) {
    matches.push({
      ruleType: RuleType.INVITE,
      category: "invite_protection",
      reason: "偵測到邀請連結或邀請關鍵字",
      points: setting.warningPoints
    });
  }

  const blacklistWord = containsBlacklistWord(content || "", setting.blacklistWords || []);
  if (blacklistWord) {
    matches.push({
      ruleType: RuleType.BLACKLIST,
      category: "blacklist_word",
      reason: `命中黑名單詞：${blacklistWord}`,
      points: setting.reviewPoints
    });
  }

  if (spamCount > setting.spamMaxMessages) {
    matches.push({
      ruleType: RuleType.SPAM,
      category: "spam",
      reason: `在 ${setting.spamWindowSeconds} 秒內訊息數超過 ${setting.spamMaxMessages}`,
      points: setting.kickPoints
    });
  }

  for (const match of matches) {
    totalPoints += match.points;
  }

  const aiAssessment = await analyzeAiRisk({
    content: content || "",
    matches,
    spamCount
  });
  totalPoints += Math.round(aiAssessment.riskScore / 25);

  const actionTaken = resolveAction(totalPoints, setting);
  const status = totalPoints >= setting.kickThreshold ? "KICK_PENDING" : totalPoints >= setting.reviewThreshold ? "ESCALATED" : "FLAGGED";

  return {
    matches,
    aiAssessment,
    totalPoints,
    actionTaken,
    status,
    setting
  };
}

function resolveAction(points, setting) {
  if (points >= setting.kickThreshold) return ActionTaken.PENDING_KICK;
  if (points >= setting.reviewThreshold) return ActionTaken.ADMIN_NOTIFY;
  if (points >= setting.warningThreshold) return ActionTaken.WARNING;
  return ActionTaken.NONE;
}
