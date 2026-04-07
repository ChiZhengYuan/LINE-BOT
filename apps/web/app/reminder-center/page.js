"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyFilters = {
  groupId: "",
  status: "",
  type: ""
};

export default function ReminderCenterPage() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [remindersRes, groupsRes] = await Promise.all([
        apiFetch(`/loans/reminders${query ? `?${query}` : ""}`),
        apiFetch("/groups")
      ]);
      setItems(remindersRes.items || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      setError(err.message || "無法載入提醒");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch(() => router.replace("/login"));
  }, [router, query]);

  const sync = async () => {
    setSyncing(true);
    setError("");
    try {
      await apiFetch("/loans/reminders/sync", { method: "POST" });
      await load();
    } catch (err) {
      setError(err.message || "同步提醒失敗");
    } finally {
      setSyncing(false);
    }
  };

  const sendReminder = async (id) => {
    await apiFetch(`/loans/reminders/${id}/send`, { method: "POST" });
    await load();
  };

  return (
    <Shell title="提醒中心" subtitle="查看今日新進件、未更新、待補件與待撥款提醒">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-3">
          <Select label="群組" value={filters.groupId} onChange={(value) => setFilters({ ...filters, groupId: value })}>
            <option value="">全部群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Select label="狀態" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
            <option value="">全部狀態</option>
            <option value="PENDING">待處理</option>
            <option value="SENT">已送出</option>
            <option value="DISMISSED">已忽略</option>
          </Select>
          <Select label="類型" value={filters.type} onChange={(value) => setFilters({ ...filters, type: value })}>
            <option value="">全部類型</option>
            <option value="NEW_CASE">今日新進件</option>
            <option value="STALE_UPDATE">超過1天未更新</option>
            <option value="SUPPLEMENT_OVERDUE">待補件超過2天</option>
            <option value="APPROVED_WAIT_SIGN">已核准未簽約</option>
            <option value="SIGNED_WAIT_DISBURSE">已簽約未撥款</option>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => setFilters(emptyFilters)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
            重置
          </button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
            重新載入
          </button>
          <button onClick={sync} disabled={syncing} className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 disabled:opacity-50">
            {syncing ? "同步中..." : "同步提醒"}
          </button>
        </div>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard label="載入提醒中..." /> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{typeLabel(item.reminderType)}</Badge>
              <Badge tone={item.status === "SENT" ? "emerald" : item.status === "DISMISSED" ? "rose" : "cyan"}>
                {statusLabel(item.status)}
              </Badge>
              <span className="text-xs text-slate-400">{item.group?.name || item.group?.lineGroupId}</span>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-50">{item.loanCase?.customerName}</div>
            <div className="mt-1 text-sm text-slate-300">{item.message}</div>
            <div className="mt-2 text-xs text-slate-500">期限：{formatTime(item.dueAt)} / 建立：{formatTime(item.createdAt)}</div>
            {item.status !== "SENT" ? (
              <button onClick={() => sendReminder(item.id)} className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                發送提醒
              </button>
            ) : null}
          </article>
        ))}
        {!loading && items.length === 0 ? <EmptyState text="目前沒有提醒" /> : null}
      </div>
    </Shell>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none">
        {children}
      </select>
    </label>
  );
}

function Badge({ tone = "cyan", children }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100"
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function Alert({ tone = "rose", children }) {
  const tones = {
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
  };
  return <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

function LoadingCard({ label }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">{label}</div>;
}

function EmptyState({ text }) {
  return <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">{text}</div>;
}

function typeLabel(value) {
  const map = {
    NEW_CASE: "今日新進件",
    STALE_UPDATE: "超過1天未更新",
    SUPPLEMENT_OVERDUE: "待補件超過2天",
    APPROVED_WAIT_SIGN: "已核准未簽約",
    SIGNED_WAIT_DISBURSE: "已簽約未撥款"
  };
  return map[value] || value;
}

function statusLabel(value) {
  const map = {
    PENDING: "待處理",
    SENT: "已送出",
    DISMISSED: "已忽略"
  };
  return map[value] || value;
}

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
