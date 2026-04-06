"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyFilters = {
  groupId: "",
  lineGroupId: "",
  lineUserId: "",
  ruleType: "",
  status: "",
  actionTaken: "",
  q: "",
  from: "",
  to: ""
};

export default function ViolationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const load = async () => {
    const [violationsRes, groupsRes] = await Promise.all([
      apiFetch(`/violations${query ? `?${query}` : ""}`),
      apiFetch("/groups")
    ]);
    setRows(violationsRes.violations || []);
    setGroups(groupsRes.groups || []);
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    load().catch(() => router.replace("/login"));
  }, [router, query]);

  const exportCsv = async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api"}/violations/export${query ? `?${query}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${window.localStorage.getItem("linebot_token") || ""}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("CSV export failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "violations.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell title="違規紀錄" subtitle="搜尋、篩選與匯出所有違規事件">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-4">
          <SelectField label="群組" value={filters.groupId} onChange={(value) => setFilters({ ...filters, groupId: value })}>
            <option value="">全部群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </SelectField>
          <TextField label="LINE Group ID" value={filters.lineGroupId} onChange={(value) => setFilters({ ...filters, lineGroupId: value })} />
          <TextField label="User ID" value={filters.lineUserId} onChange={(value) => setFilters({ ...filters, lineUserId: value })} />
          <TextField label="關鍵字" value={filters.q} onChange={(value) => setFilters({ ...filters, q: value })} />
          <SelectField label="規則類型" value={filters.ruleType} onChange={(value) => setFilters({ ...filters, ruleType: value })}>
            <option value="">全部</option>
            <option value="URL">URL</option>
            <option value="INVITE">INVITE</option>
            <option value="BLACKLIST">BLACKLIST</option>
            <option value="SPAM">SPAM</option>
            <option value="AI">AI</option>
          </SelectField>
          <SelectField label="狀態" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
            <option value="">全部</option>
            <option value="FLAGGED">FLAGGED</option>
            <option value="REVIEWED">REVIEWED</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="KICK_PENDING">KICK_PENDING</option>
            <option value="RESOLVED">RESOLVED</option>
          </SelectField>
          <SelectField label="處置" value={filters.actionTaken} onChange={(value) => setFilters({ ...filters, actionTaken: value })}>
            <option value="">全部</option>
            <option value="NONE">NONE</option>
            <option value="WARNING">WARNING</option>
            <option value="BACKOFFICE_TAG">BACKOFFICE_TAG</option>
            <option value="ADMIN_NOTIFY">ADMIN_NOTIFY</option>
            <option value="PENDING_KICK">PENDING_KICK</option>
            <option value="KICKED">KICKED</option>
          </SelectField>
          <TextField label="起始日" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
          <TextField label="結束日" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => setFilters(emptyFilters)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
          >
            清除篩選
          </button>
          <button
            onClick={load}
            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950"
          >
            重新載入
          </button>
          <button
            onClick={exportCsv}
            className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100"
          >
            匯出 CSV
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {rows.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-200">{item.ruleType}</span>
              <span className="text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
              <span className="text-slate-400">{item.group?.lineGroupId}</span>
              <span className="text-slate-400">{item.lineUserId}</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="text-sm text-slate-400">原因</div>
                <div className="mt-1 text-base">{item.reason}</div>
                <div className="mt-3 text-sm text-slate-400">
                  {item.messageLog?.content || "無內容"}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="分數" value={item.points} />
                <Metric label="風險" value={Math.round(item.riskScore)} />
                <Metric label="狀態" value={item.status} />
              </div>
            </div>
          </article>
        ))}
        {rows.length === 0 ? <div className="text-sm text-slate-400">目前沒有符合條件的違規紀錄。</div> : null}
      </div>
    </Shell>
  );
}

function TextField({ label, value, onChange, type = "text" }) {
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

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
      >
        {children}
      </select>
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 break-all text-xl font-semibold">{value}</div>
    </div>
  );
}
