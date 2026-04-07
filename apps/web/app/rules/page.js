"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../lib/api";
import { Shell } from "../../components/Shell";

const defaultRule = {
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
  warningMessage: "請注意群組規範，若持續違規系統會自動升級處理。",
  adminNotifyLineIds: [],
  adminNotifyTelegramChatIds: []
};

export default function RulesPage() {
  const router = useRouter();
  const user = getUser();
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [rule, setRule] = useState(defaultRule);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRule, setLoadingRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeGroupCount = useMemo(() => groups.filter((group) => group.isActive).length, [groups]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    loadGroups().catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroup(null);
      setRule(defaultRule);
      return;
    }

    loadRule(selectedGroupId).catch(() => {});
  }, [selectedGroupId]);

  const loadGroups = async () => {
    setLoadingGroups(true);
    setError("");
    try {
      const result = await apiFetch("/groups");
      const nextGroups = result.groups || [];
      setGroups(nextGroups);
      if (!selectedGroupId && nextGroups.length > 0) {
        setSelectedGroupId(nextGroups[0].id);
      }
    } catch (err) {
      setError(err.message || "讀取群組失敗");
      throw err;
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadRule = async (groupId) => {
    setLoadingRule(true);
    setError("");
    try {
      const [groupResult, ruleResult] = await Promise.all([
        apiFetch(`/groups/${groupId}`),
        apiFetch(`/groups/${groupId}/rules`)
      ]);

      setSelectedGroup(groupResult.group || null);
      setRule(mergeRule(ruleResult.rule));
    } catch (err) {
      setError(err.message || "讀取規則失敗");
      throw err;
    } finally {
      setLoadingRule(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selectedGroupId) {
      setError("請先選擇群組");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/groups/${selectedGroupId}/rules`, {
        method: "PUT",
        body: JSON.stringify(normalizeRule(rule))
      });
      setSuccess("規則已儲存");
      await loadRule(selectedGroupId);
    } catch (err) {
      setError(err.message || "儲存規則失敗");
    } finally {
      setSaving(false);
    }
  };

  const updateArrayField = (field, value) => {
    setRule((current) => ({
      ...current,
      [field]: value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    }));
  };

  return (
    <Shell
      title="規則設定"
      subtitle="先選群組，再設定保護與通知門檻。手機版會自動縱向排列。"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="群組總數" value={groups.length} hint="目前可設定的群組數量" />
        <StatCard label="啟用中" value={activeGroupCount} hint="正在監控的群組" />
        <StatCard
          label="目前群組"
          value={selectedGroup ? "已選擇" : "未選擇"}
          hint="先選一個群組再讀取規則"
        />
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

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <label className="block text-sm text-slate-300">
              選擇群組
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none ring-0 transition focus:border-cyan-300/50 disabled:opacity-50"
                disabled={loadingGroups || groups.length === 0}
              >
                <option value="">請先選擇群組</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name || "未命名群組"} / {group.lineGroupId}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              選完群組後會自動載入該群組的規則，手機上也能直接編輯。
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadGroups()}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
            >
              重新載入群組
            </button>
            <button
              type="button"
              onClick={() => selectedGroupId && loadRule(selectedGroupId)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:opacity-50"
              disabled={!selectedGroupId}
            >
              重新載入規則
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          {loadingRule ? (
            <div className="text-sm text-slate-400">規則載入中...</div>
          ) : selectedGroup ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="群組名稱" value={selectedGroup.name || "未命名群組"} />
              <Info label="LINE Group ID" value={selectedGroup.lineGroupId} mono />
              <Info label="狀態" value={selectedGroup.isActive ? "啟用中" : "已停用"} tone={selectedGroup.isActive ? "emerald" : "rose"} />
            </div>
          ) : (
            <div className="text-sm text-slate-400">尚未選擇群組，請先從上方清單選一個。</div>
          )}
        </div>

        <form onSubmit={save} className="mt-6 grid gap-4">
          <Toggle
            label="網址保護"
            description="偵測群組中是否出現網址連結。"
            checked={rule.protectUrl}
            onChange={(checked) => setRule((current) => ({ ...current, protectUrl: checked }))}
            disabled={!canWrite}
          />
          <Toggle
            label="邀請連結保護"
            description="偵測 LINE 邀請連結或類似邀請網址。"
            checked={rule.protectInvite}
            onChange={(checked) => setRule((current) => ({ ...current, protectInvite: checked }))}
            disabled={!canWrite}
          />

          <Field
            label="黑名單詞"
            helper="多個關鍵字請用逗號分隔，例如：賺錢, 免費, 抽獎"
            value={rule.blacklistWords.join(", ")}
            onChange={(value) => updateArrayField("blacklistWords", value)}
            placeholder="賺錢, 免費, 抽獎"
            disabled={!canWrite}
          />

          <Field
            label="警告訊息"
            helper="觸發警告時送到群組內的中文提示。"
            value={rule.warningMessage}
            onChange={(value) => setRule((current) => ({ ...current, warningMessage: value }))}
            placeholder="請注意群組規範，若持續違規系統會自動升級處理。"
            disabled={!canWrite}
          />

          <Field
            label="通知 LINE User IDs"
            helper="輸入管理員的 LINE userId，逗號分隔，不是 token。"
            value={rule.adminNotifyLineIds.join(", ")}
            onChange={(value) => updateArrayField("adminNotifyLineIds", value)}
            placeholder="Uxxxxxxxxxx, Uyyyyyyyyyy"
            disabled={!canWrite}
          />

          <Field
            label="通知 Telegram Chat IDs"
            helper="輸入 Telegram chat id，逗號分隔，不是 Bot Token。"
            value={rule.adminNotifyTelegramChatIds.join(", ")}
            onChange={(value) => updateArrayField("adminNotifyTelegramChatIds", value)}
            placeholder="123456789, -1001234567890"
            disabled={!canWrite}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <NumberField
              label="洗版秒數"
              helper="在這段時間內發送過多訊息會觸發。"
              value={rule.spamWindowSeconds}
              onChange={(value) => setRule((current) => ({ ...current, spamWindowSeconds: Number(value) }))}
              min={1}
              disabled={!canWrite}
            />
            <NumberField
              label="洗版次數"
              helper="超過這個次數就視為洗版。"
              value={rule.spamMaxMessages}
              onChange={(value) => setRule((current) => ({ ...current, spamMaxMessages: Number(value) }))}
              min={1}
              disabled={!canWrite}
            />
            <NumberField
              label="警告門檻"
              helper="累積到這個分數就先警告。"
              value={rule.warningThreshold}
              onChange={(value) => setRule((current) => ({ ...current, warningThreshold: Number(value) }))}
              min={0}
              disabled={!canWrite}
            />
            <NumberField
              label="待審門檻"
              helper="累積到這個分數就列入待審。"
              value={rule.reviewThreshold}
              onChange={(value) => setRule((current) => ({ ...current, reviewThreshold: Number(value) }))}
              min={0}
              disabled={!canWrite}
            />
            <NumberField
              label="待踢門檻"
              helper="累積到這個分數就加入待踢。"
              value={rule.kickThreshold}
              onChange={(value) => setRule((current) => ({ ...current, kickThreshold: Number(value) }))}
              min={0}
              disabled={!canWrite}
            />
            <NumberField
              label="警告分數"
              helper="網址、黑名單或洗版可各自加分。"
              value={rule.warningPoints}
              onChange={(value) => setRule((current) => ({ ...current, warningPoints: Number(value) }))}
              min={0}
              disabled={!canWrite}
            />
            <NumberField
              label="待審分數"
              helper="達到待審時加多少分。"
              value={rule.reviewPoints}
              onChange={(value) => setRule((current) => ({ ...current, reviewPoints: Number(value) }))}
              min={0}
              disabled={!canWrite}
            />
            <NumberField
              label="待踢分數"
              helper="達到待踢時加多少分。"
              value={rule.kickPoints}
              onChange={(value) => setRule((current) => ({ ...current, kickPoints: Number(value) }))}
              min={0}
              disabled={!canWrite}
            />
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
            <h3 className="text-base font-semibold text-slate-100">操作說明</h3>
            <div className="mt-2 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
              <div>網址與邀請連結可直接開關。</div>
              <div>黑名單與通知名單支援逗號分隔。</div>
              <div>洗版、警告、待審、待踢都可獨立調整。</div>
              <div>手機版可直接按下方儲存，不需要另外縮放。</div>
            </div>
          </div>

          <button
            disabled={!canWrite || saving || !selectedGroupId}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存規則"}
          </button>
        </form>
      </div>
    </Shell>
  );
}

function mergeRule(rule) {
  if (!rule) return defaultRule;
  return {
    ...defaultRule,
    ...rule,
    blacklistWords: rule.blacklistWords || [],
    adminNotifyLineIds: rule.adminNotifyLineIds || [],
    adminNotifyTelegramChatIds: rule.adminNotifyTelegramChatIds || []
  };
}

function normalizeRule(rule) {
  return {
    ...rule,
    blacklistWords: Array.isArray(rule.blacklistWords) ? rule.blacklistWords : [],
    adminNotifyLineIds: Array.isArray(rule.adminNotifyLineIds) ? rule.adminNotifyLineIds : [],
    adminNotifyTelegramChatIds: Array.isArray(rule.adminNotifyTelegramChatIds) ? rule.adminNotifyTelegramChatIds : []
  };
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-50">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
      <div>
        <div className="text-sm font-medium text-slate-100">{label}</div>
        {description ? <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div> : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border transition ${
        checked ? "border-emerald-300/40 bg-emerald-500/35" : "border-white/15 bg-slate-700/70"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Field({ label, helper, value, onChange, placeholder, disabled }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="font-medium text-slate-100">{label}</div>
      {helper ? <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div> : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function NumberField({ label, helper, value, onChange, min, disabled }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="font-medium text-slate-100">{label}</div>
      {helper ? <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div> : null}
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function Info({ label, value, tone = "cyan", mono = false }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100"
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</div>
      <div className={`mt-2 text-sm font-semibold ${mono ? "font-mono break-all" : ""}`}>{value}</div>
    </div>
  );
}
