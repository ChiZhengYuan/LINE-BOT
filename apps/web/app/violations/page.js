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

const STATUS_LABELS = {
  FLAGGED: "已標記",
  REVIEWED: "已審核",
  ESCALATED: "已升級",
  KICK_PENDING: "待踢",
  RESOLVED: "已處理"
};

const ACTION_LABELS = {
  NONE: "無",
  WARNING: "群內警告",
  BACKOFFICE_TAG: "後台標記",
  ADMIN_NOTIFY: "通知管理員",
  PENDING_KICK: "加入待踢",
  KICKED: "已踢出"
};

const RULE_LABELS = {
  URL: "網址保護",
  INVITE: "邀請連結",
  BLACKLIST: "黑名單詞",
  SPAM: "洗版偵測",
  AI: "AI 判斷"
};

export default function ViolationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
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
      const [violationsRes, groupsRes] = await Promise.all([
        apiFetch(`/violations${query ? `?${query}` : ""}`),
        apiFetch("/groups")
      ]);
      setRows(violationsRes.violations || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      setError(err.message || "無法載入違規紀錄");
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

  const copyUserId = async (userId) => {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setCopied(userId);
    window.setTimeout(() => setCopied(""), 1200);
  };

  return (
    <Shell title="違規紀錄" subtitle="這裡會顯示觸發規則的訊息、發言者 userId，旁邊可以直接複製。">
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
          <TextField label="LINE User ID" value={filters.lineUserId} onChange={(value) => setFilters({ ...filters, lineUserId: value })} />
          <TextField label="關鍵字" value={filters.q} onChange={(value) => setFilters({ ...filters, q: value })} />
          <SelectField label="規則類型" value={filters.ruleType} onChange={(value) => setFilters({ ...filters, ruleType: value })}>
            <option value="">全部</option>
            <option value="URL">網址保護</option>
            <option value="INVITE">邀請連結</option>
            <option value="BLACKLIST">黑名單詞</option>
            <option value="SPAM">洗版偵測</option>
            <option value="AI">AI 判斷</option>
          </SelectField>
          <SelectField label="狀態" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
            <option value="">全部</option>
            <option value="FLAGGED">已標記</option>
            <option value="REVIEWED">已審核</option>
            <option value="ESCALATED">已升級</option>
            <option value="KICK_PENDING">待踢</option>
            <option value="RESOLVED">已處理</option>
          </SelectField>
          <SelectField label="動作" value={filters.actionTaken} onChange={(value) => setFilters({ ...filters, actionTaken: value })}>
            <option value="">全部</option>
            <option value="NONE">無</option>
            <option value="WARNING">群內警告</option>
            <option value="BACKOFFICE_TAG">後台標記</option>
            <option value="ADMIN_NOTIFY">通知管理員</option>
            <option value="PENDING_KICK">加入待踢</option>
            <option value="KICKED">已踢出</option>
          </SelectField>
          <TextField label="起始日期" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
          <TextField label="結束日期" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => setFilters(emptyFilters)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            清除條件
          </button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
            重新載入
          </button>
          <button onClick={exportCsv} className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            匯出 CSV
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard /> : null}

        {rows.map((item) => {
          const userId = item.lineUserId || "";
          const isCopied = copied === userId;

          return (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone="cyan">{labelOf(RULE_LABELS, item.ruleType)}</Badge>
                <span className="text-slate-400">{formatTime(item.createdAt)}</span>
                <span className="text-slate-500">{item.group?.name || item.group?.lineGroupId || "未命名群組"}</span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">發言者 userId</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="break-all rounded-xl bg-black/30 px-3 py-2 font-mono text-sm text-cyan-100">{userId || "未知"}</code>
                      <button
                        onClick={() => copyUserId(userId)}
                        disabled={!userId}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isCopied ? "已複製" : "複製"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-400">原因</div>
                    <div className="mt-1 text-base text-slate-100">{item.reason}</div>
                  </div>

                  <div className="text-sm text-slate-400">
                    訊息內容
                    <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-slate-200">
                      {item.messageLog?.content || "無內容"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric label="分數" value={item.points} />
                  <Metric label="風險分數" value={Math.round(item.riskScore || 0)} />
                  <Metric label="狀態" value={labelOf(STATUS_LABELS, item.status)} />
                  <Metric label="分類" value={item.category || "-"} />
                  <Metric label="信心值" value={formatConfidence(item.confidence)} />
                  <Metric label="動作" value={labelOf(ACTION_LABELS, item.actionTaken)} />
                </div>
              </div>
            </article>
          );
        })}

        {!loading && rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            目前沒有符合條件的違規紀錄
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function LoadingCard() {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div>;
}

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none ring-0 transition focus:border-cyan-300/50"
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
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none ring-0 transition focus:border-cyan-300/50"
      >
        {children}
      </select>
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 break-all text-lg font-semibold text-slate-100">{value}</div>
    </div>
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

function labelOf(map, key) {
  return map[key] || key || "未知";
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}

function formatConfidence(value) {
  if (value === null || value === undefined) return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `${Math.round(number * 100)}%`;
}
