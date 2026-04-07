import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

const SETTINGS_KEY = "telegram";

export async function getTelegramSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: SETTINGS_KEY }
  });

  return {
    telegramBotToken: setting?.telegramBotToken || env.telegramBotToken || "",
    telegramChatIds:
      (setting?.telegramChatIds && setting.telegramChatIds.length ? setting.telegramChatIds : env.telegramDefaultChatIds) || []
  };
}

export async function updateTelegramSettings({ telegramBotToken, telegramChatIds }) {
  const data = {};
  if (telegramBotToken !== undefined) {
    data.telegramBotToken = telegramBotToken || null;
  }
  if (telegramChatIds !== undefined) {
    data.telegramChatIds = telegramChatIds;
  }

  return prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: data,
    create: {
      key: SETTINGS_KEY,
      telegramBotToken: telegramBotToken || null,
      telegramChatIds: telegramChatIds || []
    }
  });
}
