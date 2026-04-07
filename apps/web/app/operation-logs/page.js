"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../lib/api";
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
  const user = getUser();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [groups, setGroups] = useState([]);
  const [admins, setAdmins] = useState(isSuperAdmin ? [] : user ? [user] : []);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

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
    setWarning("");

    try {
      const [logsRes, groupsRes] = await Promise.all([
        apiFetch(`/operation-logs${query ? `?${query}` : ""}`),
        apiFetch("/groups")
      ]);

      setItems(logsRes.items || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      setError(err.message || "無法載入操作日誌");
      setLoading(false);
      return;
    }

    if (isSuperAdmin) {
      try {
        const adminsRes = await apiFetch("/admins");
        setAdmins(adminsRes.admins || []);
      } catch (err) {
        setWarning("管理員清單載入失敗，但操作日誌仍可正常顯示。");
        setAdmins([]);
      }
    } else {
      setAdmins(user ? [user] : []);
      if (filters.adminUserId && filters.adminUserId !== user?.id) {
        setFilters((prev) => ({ ...prev, adminUserId: user?.id || "" }));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    load().catch(() => {});
  }, [router, query]);

  const resetFilters = () => setFilters(emptyFilters);

  const deleteLog = async (id) => {
    if (!window.confirm("確定要刪除這筆操作日誌嗎？")) return;
    setDeletingId(id);
    setError("");
    try {
      await apiFetch(`/operation-logs/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message || "刪除操作日誌失敗");
    } finally {
      setDeletingId("");
    }
  };

  const clearLogs = async () => {
    if (!window.confirm("確定要刪除目前篩選條件下的所有操作日誌嗎？")) return;
    setClearing(true);
    setError("");
    try {
      await apiFetch(`/operation-logs${query ? `?${query}` : ""}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message || "清空操作日誌失敗");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Shell title="操作日誌" subtitle="查看所有後台操作、登入與系統事件，支援篩選、刪除與查詢。">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-3">
          <Select
            label="管理員"
            value={filters.adminUserId}
            onChange={(value) => setFilters({ ...filters, adminUserId: value })}
            disabled={!isSuperAdmin}
          >
            <option value="">{isSuperAdmin ? "全部" : "目前帳號"}</option>
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
          <Input label="起始日期" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
          <Input label="結束日期" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={resetFilters} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
            清除篩選
          </button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
            重新整理
          </button>
          <button
            onClick={clearLogs}
            disabled={clearing}
            className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 disabled:opacity-50"
          >
            {clearing ? "刪除中..." : "刪除目前篩選"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {warning ? (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {warning}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}

        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{item.eventType}</Badge>
              <Badge tone="emerald">{item.adminUser?.name || item.adminUser?.email || "未知管理員"}</Badge>
              <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
            </div>
            <div className="mt-3 text-base font-semibold text-slate-50">{item.title}</div>
            <div className="mt-1 text-sm text-slate-300">{item.detail || "沒有詳細說明"}</div>
            <div className="mt-3 text-xs text-slate-500">
              {item.group?.name || item.group?.lineGroupId || "未指定群組"}
              {item.member?.userId ? ` / ${item.member.userId}` : ""}
            </div>
            <button
              onClick={() => deleteLog(item.id)}
              disabled={deletingId === item.id}
              className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 disabled:opacity-50"
            >
              {deletingId === item.id ? "刪除中..." : "刪除"}
            </button>
          </article>
        ))}

        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            目前沒有操作日誌
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function Select({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none disabled:opacity-60"
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
