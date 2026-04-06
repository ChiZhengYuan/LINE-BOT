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
    <Shell title="群組管理" subtitle="建立與維護多群組的 LINE 群組主檔">
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
            onSave={saveGroup}
            onDelete={deleteGroup}
          />
        ))}
        {groups.length === 0 ? <div className="text-sm text-slate-400">目前還沒有群組資料。</div> : null}
      </div>
    </Shell>
  );
}

function GroupCard({ group, canWrite, onSave, onDelete }) {
  const [name, setName] = useState(group.name || "");
  const [lineGroupId, setLineGroupId] = useState(group.lineGroupId);
  const [isActive, setIsActive] = useState(group.isActive);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.6fr_auto] lg:items-end">
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
          狀態
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            value={String(isActive)}
            onChange={(e) => setIsActive(e.target.value === "true")}
            disabled={!canWrite}
          >
            <option value="true">啟用</option>
            <option value="false">停用</option>
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

      <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-4">
        <Info label="違規" value={group._count?.violations ?? 0} />
        <Info label="訊息" value={group._count?.messages ?? 0} />
        <Info label="待處理" value={group._count?.pendingActions ?? 0} />
        <Info label="AI" value={group._count?.aiAssessments ?? 0} />
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
