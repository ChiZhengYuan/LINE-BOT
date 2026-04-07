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
  welcomeMessage: "歡迎加入群組，請先閱讀群規，並保持友善互動。",
  groupRulesMessage: "請遵守群組規範，勿發送廣告、洗版或違規內容。",
  flexTemplate: null
};

const featureSwitches = [
  {
    key: "autoEnforcement",
    label: "自動執法",
    description: "違規會自動計分、警告與處置。"
  },
  {
    key: "aiEnabled",
    label: "AI 判斷",
    description: "啟用 AI 輔助判斷風險與違規類型。"
  },
  {
    key: "blacklistFilteringEnabled",
    label: "黑名單過濾",
    description: "發言命中黑名單詞時自動計分。"
  },
  {
    key: "spamDetectionEnabled",
    label: "洗版偵測",
    description: "偵測短時間內大量發言。"
  },
  {
    key: "welcomeEnabled",
    label: "新人歡迎",
    description: "成員加入群組時自動歡迎。"
  },
  {
    key: "announcementEnabled",
    label: "定時公告",
    description: "依排程自動發送群組公告。"
  },
  {
    key: "keywordAutoReplyEnabled",
    label: "關鍵字自動回覆",
    description: "命中規則關鍵字時自動回覆。"
  },
  {
    key: "lotteryEnabled",
    label: "抽獎功能",
    description: "開啟抽獎活動與中獎名單管理。"
  },
  {
    key: "missionEnabled",
    label: "任務功能",
    description: "開啟任務建立與進度追蹤。"
  },
  {
    key: "checkinEnabled",
    label: "簽到功能",
    description: "成員每日簽到與連續簽到統計。"
  },
  {
    key: "rankingEnabled",
    label: "排行榜",
    description: "顯示活躍分數與群組排行。"
  },
  {
    key: "pushToGroup",
    label: "變更後推送群組",
    description: "儲存設定時同步推送通知到群組。"
  },
  {
    key: "notifyAdmins",
    label: "同步通知管理員",
    description: "違規或重要事件時通知管理員。"
  }
];

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId;
  const user = getUser();
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "SUPER_ADMIN";
  const [group, setGroup] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [welcome, setWelcome] = useState(defaultWelcome);
  const [rule, setRule] = useState(null);
  const [savingKey, setSavingKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeFeatureCount = useMemo(() => {
    return featureSwitches.filter((item) => Boolean(settings[item.key])).length;
  }, [settings]);

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
      setError(err.message || "無法載入群組資料");
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
    load().catch(() => {});
  }, [groupId, router]);

  const updateGroupActive = async (checked) => {
    if (!canWrite || !group) return;
    const previous = group.isActive;
    setGroup((current) => (current ? { ...current, isActive: checked } : current));
    setSavingKey("group-status");
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch(`/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: checked })
      });
      setGroup(result.group);
      setSuccess(checked ? "群組已啟用" : "群組已停用");
    } catch (err) {
      setGroup((current) => (current ? { ...current, isActive: previous } : current));
      setError(err.message || "更新群組狀態失敗");
    } finally {
      setSavingKey("");
    }
  };

  const updateSettingField = async (field, value) => {
    if (!canWrite) return;
    const previousValue = settings[field];
    setSettings((current) => ({ ...current, [field]: value }));
    setSavingKey(field);
    setError("");
    setSuccess("");

    try {
      const result = await apiFetch(`/groups/${groupId}/settings`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value })
      });

      if (result?.groupSetting) {
        setSettings((current) => ({ ...current, ...result.groupSetting }));
      }
      if (result?.ruleSetting) {
        setRule(result.ruleSetting);
      }

      setSuccess("功能設定已更新");
    } catch (err) {
      setSettings((current) => ({ ...current, [field]: previousValue }));
      setError(err.message || "更新功能設定失敗");
    } finally {
      setSavingKey("");
    }
  };

  const saveRule = async () => {
    if (!rule) return;
    setSavingKey("rule");
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch(`/groups/${groupId}/rules`, {
        method: "PUT",
        body: JSON.stringify(rule)
      });
      setRule(result.rule);
      setSuccess("規則已儲存");
    } catch (err) {
      setError(err.message || "儲存規則失敗");
    } finally {
      setSavingKey("");
    }
  };

  const saveWelcome = async () => {
    setSavingKey("welcome");
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch(`/welcome/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({
          groupId,
          enabled: welcome.enabled,
          welcomeMessage: welcome.welcomeMessage,
          groupRulesMessage: welcome.groupRulesMessage,
          flexTemplate: welcome.flexTemplate
        })
      });
      setWelcome((current) => ({ ...current, ...(result.item || {}) }));
      setSuccess("歡迎與群規已儲存");
    } catch (err) {
      setError(err.message || "儲存歡迎設定失敗");
    } finally {
      setSavingKey("");
    }
  };

  if (!groupId) return null;

  return (
    <Shell title="群組功能設定中心" subtitle="在這裡管理每個群組的功能開關、規則與歡迎訊息。">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/groups" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200 transition hover:bg-white/10">
          返回群組列表
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">群組概況</h2>
                <p className="mt-1 text-sm text-slate-400">先確認群組是否啟用，再調整下面的功能開關。</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
                <span className="text-slate-400">群組總開關</span>
                <StatusBadge active={group.isActive} />
                <ToggleSwitch
                  checked={group.isActive}
                  onChange={updateGroupActive}
                  disabled={!canWrite || savingKey === "group-status"}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Info label="群組名稱" value={group.name || "未命名群組"} />
              <Info label="LINE Group ID" value={group.lineGroupId} />
              <Info
                label="最近動作"
                value={formatAction(group.pendingActions?.[0]?.actionType) || "尚無動作"}
                tone={group.pendingActions?.[0]?.actionType ? "emerald" : "cyan"}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">功能開關</h2>
                <p className="mt-1 text-sm text-slate-400">
                  每個開關切換後都會直接寫入資料庫並記錄操作日誌。已啟用 {activeFeatureCount} / {featureSwitches.length} 項功能。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {featureSwitches.map((item) => (
                <FeatureToggle
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  checked={Boolean(settings[item.key])}
                  busy={savingKey === item.key}
                  canWrite={canWrite}
                  onChange={(checked) => updateSettingField(item.key, checked)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">風控門檻</h2>
                <p className="mt-1 text-sm text-slate-400">調整違規分數與洗版門檻，直接影響自動執法結果。</p>
              </div>
              <button
                onClick={saveSettings}
                disabled={!canWrite || savingKey === "settings"}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingKey === "settings" ? "儲存中..." : "儲存門檻設定"}
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <NumberField
                label="違規門檻"
                value={settings.violationThreshold}
                onChange={(value) => setSettings((current) => ({ ...current, violationThreshold: Number(value) }))}
              />
              <NumberField
                label="洗版秒數"
                value={settings.spamWindowSeconds}
                onChange={(value) => setSettings((current) => ({ ...current, spamWindowSeconds: Number(value) }))}
              />
              <NumberField
                label="洗版次數"
                value={settings.spamMaxMessages}
                onChange={(value) => setSettings((current) => ({ ...current, spamMaxMessages: Number(value) }))}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">黑名單與通知規則</h2>
                <p className="mt-1 text-sm text-slate-400">這裡是違規處置與通知對象設定。</p>
              </div>
              <button
                onClick={saveRule}
                disabled={!canWrite || savingKey === "rule" || !rule}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingKey === "rule" ? "儲存中..." : "儲存規則"}
              </button>
            </div>

            {rule ? (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  <FeatureToggle
                    label="網址保護"
                    description="偵測到網址時自動標記或處置。"
                    checked={Boolean(rule.protectUrl)}
                    busy={false}
                    canWrite={canWrite}
                    onChange={(checked) => setRule((current) => ({ ...current, protectUrl: checked }))}
                  />
                  <FeatureToggle
                    label="邀請連結保護"
                    description="偵測群組邀請連結時自動處理。"
                    checked={Boolean(rule.protectInvite)}
                    busy={false}
                    canWrite={canWrite}
                    onChange={(checked) => setRule((current) => ({ ...current, protectInvite: checked }))}
                  />
                </div>

                <TextArea
                  label="黑名單詞"
                  value={(rule.blacklistWords || []).join(", ")}
                  onChange={(value) =>
                    setRule((current) => ({
                      ...current,
                      blacklistWords: value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    }))
                  }
                />
                <TextArea label="警告訊息" value={rule.warningMessage || ""} onChange={(value) => setRule((current) => ({ ...current, warningMessage: value }))} />

                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField
                    label="警告門檻"
                    value={rule.warningThreshold}
                    onChange={(value) => setRule((current) => ({ ...current, warningThreshold: Number(value) }))}
                  />
                  <NumberField
                    label="待審門檻"
                    value={rule.reviewThreshold}
                    onChange={(value) => setRule((current) => ({ ...current, reviewThreshold: Number(value) }))}
                  />
                  <NumberField
                    label="待踢門檻"
                    value={rule.kickThreshold}
                    onChange={(value) => setRule((current) => ({ ...current, kickThreshold: Number(value) }))}
                  />
                  <NumberField
                    label="警告分數"
                    value={rule.warningPoints}
                    onChange={(value) => setRule((current) => ({ ...current, warningPoints: Number(value) }))}
                  />
                  <NumberField
                    label="待審分數"
                    value={rule.reviewPoints}
                    onChange={(value) => setRule((current) => ({ ...current, reviewPoints: Number(value) }))}
                  />
                  <NumberField
                    label="待踢分數"
                    value={rule.kickPoints}
                    onChange={(value) => setRule((current) => ({ ...current, kickPoints: Number(value) }))}
                  />
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">新人歡迎與群規</h2>
                <p className="mt-1 text-sm text-slate-400">成員加入群組時自動發送歡迎與群規內容。</p>
              </div>
              <button
                onClick={saveWelcome}
                disabled={!canWrite || savingKey === "welcome"}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingKey === "welcome" ? "儲存中..." : "儲存歡迎設定"}
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <FeatureToggle
                label="啟用新人歡迎"
                description="成員加入時自動發送歡迎與群規。"
                checked={Boolean(welcome.enabled)}
                busy={false}
                canWrite={canWrite}
                onChange={(checked) => setWelcome((current) => ({ ...current, enabled: checked }))}
              />
              <TextArea
                label="歡迎訊息"
                value={welcome.welcomeMessage || ""}
                onChange={(value) => setWelcome((current) => ({ ...current, welcomeMessage: value }))}
              />
              <TextArea
                label="群規訊息"
                value={welcome.groupRulesMessage || ""}
                onChange={(value) => setWelcome((current) => ({ ...current, groupRulesMessage: value }))}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <h2 className="text-lg font-semibold text-slate-50">快速前往</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/members?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10">
                成員管理
              </Link>
              <Link href={`/announcements?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10">
                公告管理
              </Link>
              <Link href={`/auto-replies?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10">
                關鍵字回覆
              </Link>
              <Link href={`/missions?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10">
                任務管理
              </Link>
              <Link href={`/lotteries?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10">
                抽獎管理
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}

function FeatureToggle({ label, description, checked, onChange, canWrite, busy }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">{label}</h3>
          <StatusBadge active={checked} />
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={!canWrite || busy} />
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border transition ${
        checked ? "border-emerald-300/40 bg-emerald-500/35" : "border-white/15 bg-slate-700/70"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? "border border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border border-rose-300/20 bg-rose-500/10 text-rose-100"
      }`}
    >
      {active ? "已開啟" : "已關閉"}
    </span>
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
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
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
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
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
      <div className="mt-2 text-sm font-semibold break-all">{value}</div>
    </div>
  );
}

function formatAction(actionType) {
  const map = {
    NONE: "無動作",
    WARNING: "群內警告",
    BACKOFFICE_TAG: "後台標記",
    ADMIN_NOTIFY: "通知管理員",
    PENDING_KICK: "加入待踢",
    KICKED: "已踢出"
  };
  return map[actionType] || actionType || "";
}
