"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function TelegramSettingsPage() {
  const router = useRouter();
  const user = getUser();
  const canWrite = user?.role === "ADMIN";
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatIds, setTelegramChatIds] = useState("");
  const [tokenSet, setTokenSet] = useState(false);

  const load = async () => {
    const result = await apiFetch("/settings/telegram");
    setTokenSet(Boolean(result.settings?.telegramBotTokenSet));
    setTelegramChatIds((result.settings?.telegramChatIds || []).join(", "));
    setTelegramBotToken("");
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    load().catch(() => router.replace("/login"));
  }, [router]);

  const save = async (event) => {
    event.preventDefault();
    await apiFetch("/settings/telegram", {
      method: "PUT",
      body: JSON.stringify({
        telegramBotToken: telegramBotToken.trim(),
        telegramChatIds
      })
    });
    await load();
  };

  return (
    <Shell
      title="Telegram 設定"
      subtitle="這裡可直接輸入 Bot Token 與 Chat IDs。Token 是機器人金鑰，Chat ID 是要接收通知的目標。"
    >
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="font-semibold">請注意</div>
          <div className="mt-1">Bot Token 是 Telegram 機器人的金鑰；Chat IDs 是要收通知的群組 / 私訊 ID，不是 token。</div>
        </div>

        <form onSubmit={save} className="grid gap-4">
          <label className="block text-sm text-slate-300">
            Telegram Bot Token
            <div className="mt-1 text-xs text-slate-500">
              目前狀態：{tokenSet ? "已設定" : "尚未設定"}。如果不想修改，可留空。
            </div>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm"
              placeholder="123456789:AA..."
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              disabled={!canWrite}
            />
          </label>

          <label className="block text-sm text-slate-300">
            Telegram Chat IDs（逗號分隔）
            <div className="mt-1 text-xs text-slate-500">
              例如：123456789, -1001234567890
            </div>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm"
              placeholder="123456789, -1001234567890"
              value={telegramChatIds}
              onChange={(e) => setTelegramChatIds(e.target.value)}
              disabled={!canWrite}
            />
          </label>

          <button
            disabled={!canWrite}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            儲存 Telegram 設定
          </button>
        </form>
      </div>
    </Shell>
  );
}
