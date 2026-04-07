"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyFilters = {
  adminUserId: "",
  groupId: "",
  eventType: "",
  q: "",
  from: "",
  to: ""
};

export default function OperationLogsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [groups, setGroups] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const [logsRes, groupsRes, adminsRes] = await Promise.all([
        apiFetch(`/operation-logs${query ? `?${query}` : ""}`),
        apiFetch("/groups"),
        apiFetch("/admins")
      ]);
      setItems(logsRes.items || []);
      setGroups(groupsRes.groups || []);
      setAdmins(adminsRes.admins || []);
    } catch (err) {
      setError(err.message || "讀取操作日誌失敗");
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

  return (
    <Shell title="操作日誌" subtitle="記錄所有後台行為，方便稽核與追蹤。">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-3">
          <Select label="管理員" value={filters.adminUserId} onChange={(value) => setFilters({ ...filters, adminUserId: value })}>
            <option value="">全部</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name || admin.email}
              </option>
            ))}
          </Select>
          <Select label="群組" value={filters.groupId} onChange={(value) => setFilters({ ...filters, groupId: value })}>
            <option value="">全部</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Input label="事件類型" value={filters.eventType} onChange={(value) => setFilters({ ...filters, eventType: value })} />
          <Input label="關鍵字" value={filters.q} onChange={(value) => setFilters({ ...filters, q: value })} />
          <Input label="起日" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
          <Input label="迄日" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => setFilters(emptyFilters)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">清除</button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">重新整理</button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <div className="mt-6 space-y-4">
        {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}

        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{item.eventType}</Badge>
              <Badge tone="emerald">{item.adminUser?.name || item.adminUser?.email || "系統"}</Badge>
              <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
            </div>
            <div className="mt-3 text-base font-semibold text-slate-50">{item.title}</div>
            <div className="mt-1 text-sm text-slate-300">{item.detail || "無"}</div>
            <div className="mt-3 text-xs text-slate-500">
              {item.group?.name || item.group?.lineGroupId || "無群組"}
              {item.member?.userId ? ` / ${item.member.userId}` : ""}
            </div>
          </article>
        ))}

        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            目前沒有操作日誌。
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      />
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

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
