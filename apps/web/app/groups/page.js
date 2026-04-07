"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function GroupsPage() {
  const router = useRouter();
  const user = getUser();
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canDelete = user?.role === "ADMIN";
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({
    lineGroupId: "",
    name: "",
    isActive: true
  });

  const load = async () => {
    const data = await apiFetch("/groups");
    setGroups(data.groups || []);
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    load().catch(() => router.replace("/login"));
  }, [router]);

  const createGroup = async (event) => {
    event.preventDefault();
    await apiFetch("/groups", {
      method: "POST",
      body: JSON.stringify(form)
    });
    setForm({ lineGroupId: "", name: "", isActive: true });
    await load();
  };

  const saveGroup = async (groupId, payload) => {
    await apiFetch(`/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await load();
  };

  const deleteGroup = async (groupId) => {
    await apiFetch(`/groups/${groupId}`, {
      method: "DELETE"
    });
    await load();
  };

  return (
    <Shell title="群組管理" subtitle="每個群組都可以看到啟用狀態，以及最近一次是否有觸發處置動作。">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <h2 className="text-xl font-semibold">新增群組</h2>
        <form onSubmit={createGroup} className="mt-4 grid gap-4 lg:grid-cols-3">
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            placeholder="LINE Group ID"
            value={form.lineGroupId}
            onChange={(e) => setForm({ ...form, lineGroupId: e.target.value })}
          />
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            placeholder="群組名稱"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            value={String(form.isActive)}
            onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}
          >
            <option value="true">啟用</option>
            <option value="false">停用</option>
          </select>
          <button
            type="submit"
            disabled={!canWrite}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50 lg:col-span-3"
          >
            建立群組
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            canWrite={canWrite}
            canDelete={canDelete}
            onSave={saveGroup}
            onDelete={deleteGroup}
          />
        ))}
        {groups.length === 0 ? <div className="text-sm text-slate-400">目前尚未有群組資料。</div> : null}
      </div>
    </Shell>
  );
}

function GroupCard({ group, canWrite, canDelete, onSave, onDelete }) {
  const [name, setName] = useState(group.name || "");
  const [lineGroupId, setLineGroupId] = useState(group.lineGroupId);
  const [isActive, setIsActive] = useState(group.isActive);
  const latestAction = group.pendingActions?.[0];

  const actionLabel = latestAction ? formatAction(latestAction.actionType) : "未執行動作";
  const actionTone = latestAction
    ? latestAction.actionType === "PENDING_KICK"
      ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
      : latestAction.actionType === "ADMIN_NOTIFY"
        ? "border-amber-300/30 bg-amber-500/10 text-amber-100"
        : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
    : "border-white/10 bg-slate-950/40 text-slate-300";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">{group.name || "未命名群組"}</h3>
        <Badge tone={group.isActive ? "green" : "slate"}>{group.isActive ? "啟用中" : "已停用"}</Badge>
        {latestAction ? (
          <Badge tone={latestAction.actionType === "PENDING_KICK" ? "red" : latestAction.actionType === "ADMIN_NOTIFY" ? "amber" : "cyan"}>
            最近動作：{actionLabel}
          </Badge>
        ) : (
          <Badge tone="slate">最近動作：無</Badge>
        )}
      </div>

      <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-4">
        <Info label="群組狀態" value={group.isActive ? "開" : "關"} />
        <Info label="違規數" value={group._count?.violations ?? 0} />
        <Info label="訊息數" value={group._count?.messages ?? 0} />
        <Info label="待處理" value={group._count?.pendingActions ?? 0} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className={`rounded-2xl border px-4 py-2 text-sm ${actionTone}`}>
          {latestAction ? (
            <>
              <span className="font-semibold">{actionLabel}</span>
              <span className="ml-2 opacity-80">{latestAction.status}</span>
              <span className="ml-2 opacity-70">{formatTime(latestAction.createdAt)}</span>
            </>
          ) : (
            "尚未觸發任何處置動作"
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.6fr_auto] lg:items-end">
        <label className="block text-sm text-slate-300">
          群組名稱
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canWrite}
          />
        </label>
        <label className="block text-sm text-slate-300">
          LINE Group ID
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs"
            value={lineGroupId}
            onChange={(e) => setLineGroupId(e.target.value)}
            disabled={!canWrite}
          />
        </label>
        <label className="block text-sm text-slate-300">
          開關
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            value={String(isActive)}
            onChange={(e) => setIsActive(e.target.value === "true")}
            disabled={!canWrite}
          >
            <option value="true">開</option>
            <option value="false">關</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 disabled:opacity-50"
            disabled={!canWrite}
            onClick={() => onSave(group.id, { name, lineGroupId, isActive })}
          >
            儲存
          </button>
          <button
            type="button"
            className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 disabled:opacity-50"
            disabled={!canDelete}
            onClick={() => onDelete(group.id)}
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ tone, children }) {
  const styles = {
    green: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-300/30 bg-amber-500/10 text-amber-100",
    red: "border-rose-300/30 bg-rose-500/10 text-rose-100",
    cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
    slate: "border-white/10 bg-slate-950/40 text-slate-300"
  };

  return <span className={`rounded-full border px-3 py-1 text-xs ${styles[tone]}`}>{children}</span>;
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function formatAction(value) {
  const map = {
    NONE: "無動作",
    WARNING: "警告",
    BACKOFFICE_TAG: "後台標記",
    ADMIN_NOTIFY: "管理員通知",
    PENDING_KICK: "待踢清單",
    KICKED: "已踢出"
  };
  return map[value] || value || "未定義";
}

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
