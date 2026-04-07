import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { getTelegramSettings, updateTelegramSettings } from "../services/telegramSettings.js";

export const settingsRouter = express.Router();

settingsRouter.get("/telegram", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const settings = await getTelegramSettings();
  res.json({
    settings: {
      telegramBotTokenSet: Boolean(settings.telegramBotToken),
      telegramChatIds: settings.telegramChatIds || []
    }
  });
});

settingsRouter.put("/telegram", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const payload = req.body || {};
  const telegramBotToken =
    typeof payload.telegramBotToken === "string" && payload.telegramBotToken.trim()
      ? payload.telegramBotToken.trim()
      : undefined;
  const telegramChatIds = Array.isArray(payload.telegramChatIds)
    ? payload.telegramChatIds
    : typeof payload.telegramChatIds === "string"
      ? payload.telegramChatIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

  const updated = await updateTelegramSettings({
    telegramBotToken,
    telegramChatIds
  });

  res.json({
    settings: {
      telegramBotTokenSet: Boolean(updated.telegramBotToken),
      telegramChatIds: updated.telegramChatIds || []
    }
  });
});
