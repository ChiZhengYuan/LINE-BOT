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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    const result = await apiFetch("/settings/telegram");
    setTokenSet(Boolean(result.settings?.telegramBotTokenSet));
    setTelegramChatIds((result.settings?.telegramChatIds || []).join(", "));
    setTelegramBotToken("");
    setLoading(false);
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
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiFetch("/settings/telegram", {
        method: "PUT",
        body: JSON.stringify({
          telegramBotToken: telegramBotToken.trim(),
          telegramChatIds
        })
      });
      setSuccess("Telegram 設定已儲存");
      await load();
    } catch (err) {
      setError(err.message || "儲存 Telegram 設定失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Telegram 設定"
      subtitle="在這裡輸入 Bot Token 與 Chat IDs，手機版表單已改成單欄顯示。"
    >
      {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="font-semibold">提醒</div>
          <div className="mt-1 leading-6">
            Telegram Bot Token 與 Chat IDs 是兩個不同欄位。Bot Token 用來連 Telegram，Chat IDs 用來指定要接收通知的地方。
          </div>
        </div>

        <form onSubmit={save} className="mt-5 grid gap-4">
          <label className="block text-sm text-slate-300">
            Telegram Bot Token
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {tokenSet ? "目前已設定，若留空則維持原本的 Token。" : "尚未設定，請輸入 Telegram Bot Token。"}
            </div>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/50 disabled:opacity-50"
              placeholder="123456789:AA..."
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              disabled={!canWrite}
            />
          </label>

          <label className="block text-sm text-slate-300">
            Telegram Chat IDs（逗號分隔）
            <div className="mt-1 text-xs leading-5 text-slate-500">
              例如：123456789, -1001234567890。這裡填的是 Chat ID，不是 Token。
            </div>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/50 disabled:opacity-50"
              placeholder="123456789, -1001234567890"
              value={telegramChatIds}
              onChange={(e) => setTelegramChatIds(e.target.value)}
              disabled={!canWrite}
            />
          </label>

          <button
            disabled={!canWrite || saving}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存 Telegram 設定"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
