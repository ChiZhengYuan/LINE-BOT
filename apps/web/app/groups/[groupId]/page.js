"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../../lib/api";
import { Shell } from "../../../components/Shell";

const defaultSettings = {
  autoEnforcement: true,
  aiEnabled: true,
  blacklistFilteringEnabled: true,
  spamDetectionEnabled: true,
  welcomeEnabled: false,
  announcementEnabled: false,
  keywordAutoReplyEnabled: false,
  lotteryEnabled: false,
  missionEnabled: false,
  checkinEnabled: false,
  rankingEnabled: false,
  violationThreshold: 3,
  spamWindowSeconds: 10,
  spamMaxMessages: 5,
  pushToGroup: false,
  notifyAdmins: true
};

const defaultWelcome = {
  enabled: false,
  welcomeMessage: "歡迎加入群組，請先閱讀群規。",
  groupRulesMessage: "請遵守群組規範，避免洗版、廣告與違規連結。",
  flexTemplate: null
};

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId;
  const user = getUser();
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [group, setGroup] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [welcome, setWelcome] = useState(defaultWelcome);
  const [rule, setRule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const quickStats = useMemo(() => {
    if (!group) return [];
    return [
      { label: "違規數", value: group._count?.violations ?? 0 },
      { label: "成員數", value: group._count?.members ?? 0 },
      { label: "公告數", value: group._count?.announcements ?? 0 },
      { label: "任務數", value: group._count?.missions ?? 0 }
    ];
  }, [group]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [groupRes, settingsRes, ruleRes, welcomeRes] = await Promise.all([
        apiFetch(`/groups/${groupId}`),
        apiFetch(`/groups/${groupId}/settings`),
        apiFetch(`/groups/${groupId}/rules`),
        apiFetch(`/welcome/groups/${groupId}`)
      ]);

      setGroup(groupRes.group);
      setSettings({
        ...defaultSettings,
        ...(settingsRes.groupSetting || {})
      });
      setRule(ruleRes.rule);
      setWelcome({
        ...defaultWelcome,
        ...(welcomeRes.item || {})
      });
    } catch (err) {
      setError(err.message || "讀取群組資料失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    if (!groupId) return;
    load().catch(() => router.replace("/login"));
  }, [groupId, router]);

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/groups/${groupId}/settings`, {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      setSuccess("群組設定已儲存");
      await load();
    } catch (err) {
      setError(err.message || "儲存群組設定失敗");
    } finally {
      setSaving(false);
    }
  };

  const saveRule = async () => {
    if (!rule) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/groups/${groupId}/rules`, {
        method: "PUT",
        body: JSON.stringify(rule)
      });
      setSuccess("違規規則已儲存");
      await load();
    } catch (err) {
      setError(err.message || "儲存規則失敗");
    } finally {
      setSaving(false);
    }
  };

  const saveWelcome = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/welcome/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({
          groupId,
          enabled: welcome.enabled,
          welcomeMessage: welcome.welcomeMessage,
          groupRulesMessage: welcome.groupRulesMessage,
          flexTemplate: welcome.flexTemplate
        })
      });
      setSuccess("歡迎設定已儲存");
      await load();
    } catch (err) {
      setError(err.message || "儲存歡迎設定失敗");
    } finally {
      setSaving(false);
    }
  };

  if (!groupId) {
    return null;
  }

  return (
    <Shell title="群組設定中心" subtitle="每個群組都能獨立調整執法、歡迎、公告與互動功能。">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/groups" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
          回群組列表
        </Link>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
          LINE Group ID：{groupId}
        </span>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickStats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      {loading ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-slate-300">載入中...</div>
      ) : null}

      {group ? (
        <div className="mt-6 space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <h2 className="text-lg font-semibold text-slate-50">基本資訊</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Info label="群組名稱" value={group.name || "未命名群組"} />
              <Info label="狀態" value={group.isActive ? "啟用中" : "已停用"} tone={group.isActive ? "emerald" : "rose"} />
              <Info label="最近動作" value={group.pendingActions?.[0]?.actionType || "無"} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-50">群組功能開關</h2>
              <button
                onClick={saveSettings}
                disabled={!canWrite || saving}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving ? "儲存中..." : "儲存設定"}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <Toggle label="自動執法" checked={settings.autoEnforcement} onChange={(checked) => setSettings((s) => ({ ...s, autoEnforcement: checked }))} />
              <Toggle label="AI 判斷" checked={settings.aiEnabled} onChange={(checked) => setSettings((s) => ({ ...s, aiEnabled: checked }))} />
              <Toggle label="黑名單過濾" checked={settings.blacklistFilteringEnabled} onChange={(checked) => setSettings((s) => ({ ...s, blacklistFilteringEnabled: checked }))} />
              <Toggle label="洗版偵測" checked={settings.spamDetectionEnabled} onChange={(checked) => setSettings((s) => ({ ...s, spamDetectionEnabled: checked }))} />
              <Toggle label="新人歡迎" checked={settings.welcomeEnabled} onChange={(checked) => setSettings((s) => ({ ...s, welcomeEnabled: checked }))} />
              <Toggle label="定時公告" checked={settings.announcementEnabled} onChange={(checked) => setSettings((s) => ({ ...s, announcementEnabled: checked }))} />
              <Toggle label="關鍵字自動回覆" checked={settings.keywordAutoReplyEnabled} onChange={(checked) => setSettings((s) => ({ ...s, keywordAutoReplyEnabled: checked }))} />
              <Toggle label="抽獎" checked={settings.lotteryEnabled} onChange={(checked) => setSettings((s) => ({ ...s, lotteryEnabled: checked }))} />
              <Toggle label="任務" checked={settings.missionEnabled} onChange={(checked) => setSettings((s) => ({ ...s, missionEnabled: checked }))} />
              <Toggle label="簽到" checked={settings.checkinEnabled} onChange={(checked) => setSettings((s) => ({ ...s, checkinEnabled: checked }))} />
              <Toggle label="排行榜" checked={settings.rankingEnabled} onChange={(checked) => setSettings((s) => ({ ...s, rankingEnabled: checked }))} />
              <Toggle label="推送到群組" checked={settings.pushToGroup} onChange={(checked) => setSettings((s) => ({ ...s, pushToGroup: checked }))} />
              <Toggle label="通知管理員" checked={settings.notifyAdmins} onChange={(checked) => setSettings((s) => ({ ...s, notifyAdmins: checked }))} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <NumberField label="違規閾值" value={settings.violationThreshold} onChange={(value) => setSettings((s) => ({ ...s, violationThreshold: Number(value) }))} />
              <NumberField label="洗版秒數" value={settings.spamWindowSeconds} onChange={(value) => setSettings((s) => ({ ...s, spamWindowSeconds: Number(value) }))} />
              <NumberField label="洗版次數" value={settings.spamMaxMessages} onChange={(value) => setSettings((s) => ({ ...s, spamMaxMessages: Number(value) }))} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-50">違規規則</h2>
              <button
                onClick={saveRule}
                disabled={!canWrite || saving || !rule}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
              >
                儲存違規規則
              </button>
            </div>

            {rule ? (
              <div className="mt-4 grid gap-4">
                <Toggle label="網址保護" checked={rule.protectUrl} onChange={(checked) => setRule((r) => ({ ...r, protectUrl: checked }))} />
                <Toggle label="邀請連結保護" checked={rule.protectInvite} onChange={(checked) => setRule((r) => ({ ...r, protectInvite: checked }))} />
                <TextArea label="黑名單詞" value={(rule.blacklistWords || []).join(", ")} onChange={(value) => setRule((r) => ({ ...r, blacklistWords: value.split(",").map((item) => item.trim()).filter(Boolean) }))} />
                <TextArea label="警告訊息" value={rule.warningMessage || ""} onChange={(value) => setRule((r) => ({ ...r, warningMessage: value }))} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label="警告門檻" value={rule.warningThreshold} onChange={(value) => setRule((r) => ({ ...r, warningThreshold: Number(value) }))} />
                  <NumberField label="待審門檻" value={rule.reviewThreshold} onChange={(value) => setRule((r) => ({ ...r, reviewThreshold: Number(value) }))} />
                  <NumberField label="待踢門檻" value={rule.kickThreshold} onChange={(value) => setRule((r) => ({ ...r, kickThreshold: Number(value) }))} />
                  <NumberField label="警告分數" value={rule.warningPoints} onChange={(value) => setRule((r) => ({ ...r, warningPoints: Number(value) }))} />
                  <NumberField label="待審分數" value={rule.reviewPoints} onChange={(value) => setRule((r) => ({ ...r, reviewPoints: Number(value) }))} />
                  <NumberField label="待踢分數" value={rule.kickPoints} onChange={(value) => setRule((r) => ({ ...r, kickPoints: Number(value) }))} />
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-50">新人歡迎與群規</h2>
              <button
                onClick={saveWelcome}
                disabled={!canWrite || saving}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
              >
                儲存歡迎設定
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <Toggle label="啟用歡迎訊息" checked={welcome.enabled} onChange={(checked) => setWelcome((w) => ({ ...w, enabled: checked }))} />
              <TextArea label="歡迎訊息" value={welcome.welcomeMessage} onChange={(value) => setWelcome((w) => ({ ...w, welcomeMessage: value }))} />
              <TextArea label="群規訊息" value={welcome.groupRulesMessage} onChange={(value) => setWelcome((w) => ({ ...w, groupRulesMessage: value }))} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <h2 className="text-lg font-semibold text-slate-50">快速入口</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/members?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                成員管理
              </Link>
              <Link href={`/announcements?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                公告
              </Link>
              <Link href={`/auto-replies?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                自動回覆
              </Link>
              <Link href={`/missions?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                任務
              </Link>
              <Link href={`/lotteries?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                抽獎
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
      <div className="text-sm font-medium text-slate-100">{label}</div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-8 w-14 items-center rounded-full border transition ${
          checked ? "border-emerald-300/40 bg-emerald-500/35" : "border-white/15 bg-slate-700/70"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition ${
            checked ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="font-medium text-slate-100">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="font-medium text-slate-100">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      />
    </label>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function Info({ label, value, tone = "cyan" }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100"
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}
