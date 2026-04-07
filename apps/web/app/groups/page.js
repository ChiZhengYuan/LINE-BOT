"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyForm = {
  lineGroupId: "",
  name: "",
  isActive: true
};

export default function GroupsPage() {
  const router = useRouter();
  const user = getUser();
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const stats = useMemo(() => {
    const active = groups.filter((group) => group.isActive).length;
    return {
      total: groups.length,
      active,
      inactive: groups.length - active
    };
  }, [groups]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    loadGroups().catch(() => router.replace("/login"));
  }, [router]);

  const loadGroups = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/groups");
      setGroups(result.groups || []);
    } catch (err) {
      setError(err.message || "讀取群組失敗");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (event) => {
    event.preventDefault();
    if (!canWrite) return;

    setSavingId("create");
    setError("");
    try {
      await apiFetch("/groups", {
        method: "POST",
        body: JSON.stringify({
          lineGroupId: form.lineGroupId.trim(),
          name: form.name.trim() || null,
          isActive: form.isActive
        })
      });
      setForm(emptyForm);
      await loadGroups();
    } catch (err) {
      setError(err.message || "新增群組失敗");
    } finally {
      setSavingId(null);
    }
  };

  const updateGroup = async (groupId, patch) => {
    if (!canWrite) return;

    setSavingId(groupId);
    setError("");
    const previousGroups = groups;
    setGroups((current) => current.map((group) => (group.id === groupId ? { ...group, ...patch } : group)));

    try {
      await apiFetch(`/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      await loadGroups();
    } catch (err) {
      setGroups(previousGroups);
      setError(err.message || "更新群組失敗");
    } finally {
      setSavingId(null);
    }
  };

  const removeGroup = async (groupId) => {
    if (!canWrite) return;
    if (!window.confirm("確定要刪除此群組嗎？")) return;

    setSavingId(groupId);
    setError("");
    try {
      await apiFetch(`/groups/${groupId}`, { method: "DELETE" });
      await loadGroups();
    } catch (err) {
      setError(err.message || "刪除群組失敗");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Shell title="群組管理" subtitle="手機版會以卡片方式呈現群組，操作更直覺。">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="群組總數" value={stats.total} />
        <Stat label="啟用中" value={stats.active} accent="emerald" />
        <Stat label="已停用" value={stats.inactive} accent="rose" />
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
        <h2 className="text-lg font-semibold text-slate-50">新增群組</h2>
        <form onSubmit={createGroup} className="mt-4 grid gap-4">
          <label className="block text-sm text-slate-300">
            LINE Group ID
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/50"
              placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={form.lineGroupId}
              onChange={(e) => setForm((current) => ({ ...current, lineGroupId: e.target.value }))}
              disabled={!canWrite}
            />
          </label>

          <label className="block text-sm text-slate-300">
            群組名稱
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/50"
              placeholder="例如：客服群"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              disabled={!canWrite}
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <div>
              <div className="text-sm text-slate-200">預設狀態</div>
              <div className="mt-1 text-xs text-slate-500">開啟後才會開始紀錄訊息與違規</div>
            </div>
            <ToggleSwitch
              checked={form.isActive}
              onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              disabled={!canWrite}
            />
          </div>

          <button
            disabled={!canWrite || savingId === "create"}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingId === "create" ? "新增中..." : "新增群組"}
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-slate-300">載入中...</div>
        ) : null}

        {!loading && groups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            尚未建立任何群組，先新增第一個 LINE 群組吧。
          </div>
        ) : null}

        {groups.map((group) => {
          const latestAction = group.pendingActions?.[0];
          const busy = savingId === group.id;

          return (
            <article key={group.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                    {group.lineGroupId}
                  </span>
                  <StatusBadge active={group.isActive} />
                  {latestAction ? <ActionBadge actionType={latestAction.actionType} /> : null}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-50 sm:text-xl">{group.name || "未命名群組"}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    這裡可以直接管理群組開關、名稱與是否啟用監控。
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                  <Info label="違規數" value={group._count?.violations ?? 0} />
                  <Info label="訊息數" value={group._count?.messages ?? 0} />
                  <Info label="待處理" value={group._count?.pendingActions ?? 0} />
                </div>

                {latestAction ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                    最近動作
                    <span className="ml-2 font-medium text-slate-100">{formatAction(latestAction.actionType)}</span>
                    <span className="ml-2 text-slate-500">{formatTime(latestAction.createdAt)}</span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 px-4 py-3 text-sm text-slate-500">
                    尚未有動作
                  </div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">群組狀態</div>
                    <div className="mt-1 text-sm text-slate-200">{group.isActive ? "啟用中" : "已停用"}</div>
                  </div>
                  <ToggleSwitch
                    checked={group.isActive}
                    onChange={(checked) => updateGroup(group.id, { isActive: checked })}
                    disabled={!canWrite || busy}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => updateGroup(group.id, { name: group.name || "" })}
                    disabled={!canWrite || busy}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    儲存目前名稱
                  </button>
                  <button
                    onClick={() => removeGroup(group.id)}
                    disabled={!canWrite || busy}
                    className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    刪除群組
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
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

function StatusBadge({ active }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-300/30 bg-rose-500/10 text-rose-100"
      }`}
    >
      {active ? "開" : "關"}
    </span>
  );
}

function ActionBadge({ actionType }) {
  return (
    <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-100">
      {formatAction(actionType)}
    </span>
  );
}

function Stat({ label, value, accent = "cyan" }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100"
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-glow backdrop-blur ${tones[accent]}`}>
      <div className="text-sm/6 opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function formatAction(value) {
  const map = {
    NONE: "無",
    WARNING: "群內警告",
    BACKOFFICE_TAG: "後台標記",
    ADMIN_NOTIFY: "通知管理員",
    PENDING_KICK: "加入待踢",
    KICKED: "已踢出"
  };
  return map[value] || value || "未知";
}

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
