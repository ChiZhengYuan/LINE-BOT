import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const rootEnv = resolve(process.cwd(), "../../.env");
const localEnv = resolve(process.cwd(), ".env");

if (existsSync(rootEnv)) {
  config({ path: rootEnv });
}

if (existsSync(localEnv)) {
  config({ path: localEnv, override: true });
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || process.env.API_PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || "",
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  lineAdminUserIds: (process.env.LINE_ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  redisUrl: process.env.REDIS_URL || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramDefaultChatIds: (process.env.TELEGRAM_CHAT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  aiProvider: process.env.AI_PROVIDER || "gemini",
  aiApiUrl:
    process.env.AI_API_URL ||
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  aiApiKey: process.env.AI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "gemini-2.5-flash-lite",
  aiSystemPrompt:
    process.env.AI_SYSTEM_PROMPT ||
    "You are a LINE group moderation classifier. Return strict JSON only with keys: risk_score, category, reason, confidence.",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "Admin12345!",
  defaultAdminName: process.env.DEFAULT_ADMIN_NAME || "System Admin"
};
