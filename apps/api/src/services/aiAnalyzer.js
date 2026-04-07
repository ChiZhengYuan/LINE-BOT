import { env } from "../config/env.js";
import { RuleType } from "@prisma/client";

function heuristicAnalyze(content, matches, spamCount) {
  const hasUrl = /(https?:\/\/|www\.)/i.test(content);
  const hasInvite = /(line\.me\/ti\/g\/|line\.me\/R\/ti\/g\/|line\.me\/~\/g\/)/i.test(content);
  const length = content.length;

  let riskScore = 8;
  if (hasUrl) riskScore += 18;
  if (hasInvite) riskScore += 22;
  if (matches.some((item) => item.ruleType === RuleType.BLACKLIST)) riskScore += 25;
  if (spamCount > 1) riskScore += Math.min(20, spamCount * 3);
  if (length < 3) riskScore += 5;

  riskScore = Math.min(100, riskScore);
  const category = hasInvite
    ? "invite"
    : hasUrl
      ? "url"
      : matches.some((item) => item.ruleType === RuleType.BLACKLIST)
        ? "blacklist"
        : spamCount > 1
          ? "spam"
          : "benign";

  return {
    riskScore,
    category,
    reason:
      category === "benign"
        ? "內容看起來正常，目前未發現明顯違規跡象。"
        : `系統偵測到可能的${categoryLabel(category)}違規風險，請進一步確認。`,
    confidence: Math.min(0.95, 0.55 + riskScore / 200),
    raw: {
      mode: "heuristic",
      contentLength: length,
      hasUrl,
      hasInvite,
      matchedRules: matches.map((item) => item.ruleType),
      spamCount
    }
  };
}

export async function analyzeAiRisk({ content, matches, spamCount }) {
  if (env.aiProvider === "heuristic" || !env.aiApiKey) {
    return heuristicAnalyze(content, matches, spamCount);
  }

  try {
    const response = await fetch(env.aiApiUrl, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        model: env.aiModel,
        temperature: 0,
        messages: [
          { role: "system", content: env.aiSystemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              task: "Classify a LINE group message for moderation risk.",
              content,
              matchedRules: matches.map((item) => item.ruleType),
              spamCount,
              expectedOutput: {
                risk_score: 0,
                category: "benign",
                reason: "short explanation",
                confidence: 0
              }
            })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI request failed with ${response.status}`);
    }

    const payload = await response.json();
    const message = extractMessageContent(payload);
    const parsed = safeParseJson(message);

    if (!parsed) {
      throw new Error("AI response was not valid JSON");
    }

    return normalizeAiPayload(parsed, content, matches, spamCount);
  } catch (error) {
    return {
      ...heuristicAnalyze(content, matches, spamCount),
      raw: {
        mode: "fallback",
        provider: env.aiProvider,
        error: error.message
      }
    };
  }
}

function buildHeaders() {
  const headers = {
    Authorization: `Bearer ${env.aiApiKey}`,
    "Content-Type": "application/json"
  };

  if (env.aiProvider === "gemini") {
    headers["x-goog-api-key"] = env.aiApiKey;
  }

  return headers;
}

function extractMessageContent(payload) {
  const choiceContent = payload.choices?.[0]?.message?.content;
  if (typeof choiceContent === "string" && choiceContent.trim()) {
    return choiceContent;
  }

  if (Array.isArray(choiceContent)) {
    const joined = choiceContent
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
    if (joined) {
      return joined;
    }
  }

  const candidateParts = payload.candidates?.[0]?.content?.parts;
  if (Array.isArray(candidateParts)) {
    const text = candidateParts
      .map((part) => part?.text || "")
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeAiPayload(payload, content, matches, spamCount) {
  const riskScore = clampNumber(payload.risk_score ?? payload.riskScore ?? 0, 0, 100);
  const confidence = clampNumber(payload.confidence ?? 0.6, 0, 1);
  return {
    riskScore,
    category: String(payload.category || "benign"),
    reason: String(payload.reason || "AI 已完成違規判斷。"),
    confidence,
    raw: {
      mode: "llm",
      provider: env.aiProvider,
      model: env.aiModel,
      contentLength: content.length,
      matchedRules: matches.map((item) => item.ruleType),
      spamCount,
      payload
    }
  };
}

function safeParseJson(text) {
  try {
    const trimmed = text.trim();
    const jsonText = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
      : trimmed;
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function categoryLabel(category) {
  const labels = {
    invite: "邀請連結",
    url: "網址",
    blacklist: "黑名單",
    spam: "洗版",
    benign: "正常"
  };
  return labels[category] || category || "未知";
}
