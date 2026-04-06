"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function RulesPage() {
  const router = useRouter();
  const [groupId, setGroupId] = useState("");
  const [rule, setRule] = useState({
    protectUrl: true,
    protectInvite: true,
    blacklistWords: [],
    spamWindowSeconds: 10,
    spamMaxMessages: 5,
    warningThreshold: 3,
    reviewThreshold: 5,
    kickThreshold: 7,
    warningPoints: 2,
    reviewPoints: 4,
    kickPoints: 6,
    warningMessage: "請注意，您的訊息已違反群組規則。",
    adminNotifyLineIds: [],
    adminNotifyTelegramChatIds: []
  });

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    }
  }, [router]);

  const load = async () => {
    const data = await apiFetch(`/groups/${groupId}/rules`);
    if (data.rule) {
      setRule({
        ...data.rule,
        blacklistWords: data.rule.blacklistWords || [],
        adminNotifyLineIds: data.rule.adminNotifyLineIds || [],
        adminNotifyTelegramChatIds: data.rule.adminNotifyTelegramChatIds || []
      });
    }
  };

  const save = async (event) => {
    event.preventDefault();
    await apiFetch(`/groups/${groupId}/rules`, {
      method: "PUT",
      body: JSON.stringify(rule)
    });
  };

  const setArrayField = (field, value) => {
    setRule((current) => ({
      ...current,
      [field]: value.split(",").map((item) => item.trim()).filter(Boolean)
    }));
  };

  return (
    <Shell title="規則設定" subtitle="調整網址保護、邀請連結、黑名單詞、洗版門檻與通知管道">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="輸入 Group ID"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          />
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">
            載入
          </button>
        </div>

        <form onSubmit={save} className="mt-6 grid gap-4 lg:grid-cols-2">
          <Toggle label="網址保護" checked={rule.protectUrl} onChange={(checked) => setRule({ ...rule, protectUrl: checked })} />
          <Toggle label="邀請連結保護" checked={rule.protectInvite} onChange={(checked) => setRule({ ...rule, protectInvite: checked })} />

          <Field label="黑名單詞（逗號分隔）" value={rule.blacklistWords.join(", ")} onChange={(value) => setArrayField("blacklistWords", value)} />
          <Field label="通知 LINE User IDs（逗號分隔）" value={rule.adminNotifyLineIds.join(", ")} onChange={(value) => setArrayField("adminNotifyLineIds", value)} />
          <Field label="通知 Telegram Chat IDs（逗號分隔）" value={rule.adminNotifyTelegramChatIds.join(", ")} onChange={(value) => setArrayField("adminNotifyTelegramChatIds", value)} />
          <Field label="洗版秒數" type="number" value={rule.spamWindowSeconds} onChange={(value) => setRule({ ...rule, spamWindowSeconds: Number(value) })} />
          <Field label="洗版次數" type="number" value={rule.spamMaxMessages} onChange={(value) => setRule({ ...rule, spamMaxMessages: Number(value) })} />
          <Field label="警告門檻" type="number" value={rule.warningThreshold} onChange={(value) => setRule({ ...rule, warningThreshold: Number(value) })} />
          <Field label="待審門檻" type="number" value={rule.reviewThreshold} onChange={(value) => setRule({ ...rule, reviewThreshold: Number(value) })} />
          <Field label="待踢門檻" type="number" value={rule.kickThreshold} onChange={(value) => setRule({ ...rule, kickThreshold: Number(value) })} />
          <Field label="警告分數" type="number" value={rule.warningPoints} onChange={(value) => setRule({ ...rule, warningPoints: Number(value) })} />
          <Field label="待審分數" type="number" value={rule.reviewPoints} onChange={(value) => setRule({ ...rule, reviewPoints: Number(value) })} />
          <Field label="待踢分數" type="number" value={rule.kickPoints} onChange={(value) => setRule({ ...rule, kickPoints: Number(value) })} />

          <label className="lg:col-span-2 block text-sm text-slate-300">
            警告訊息
            <textarea
              value={rule.warningMessage}
              onChange={(e) => setRule({ ...rule, warningMessage: e.target.value })}
              className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            />
          </label>

          <button className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 lg:col-span-2">儲存規則</button>
        </form>
      </div>
    </Shell>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
      />
    </label>
  );
}
