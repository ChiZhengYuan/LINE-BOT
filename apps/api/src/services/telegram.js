import { getTelegramSettings } from "./telegramSettings.js";

const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramMessage(chatId, text) {
  const { telegramBotToken } = await getTelegramSettings();

  if (!telegramBotToken || !chatId) {
    return;
  }

  const response = await fetch(`${TELEGRAM_API}/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage 失敗：${response.status} ${details}`);
  }
}
