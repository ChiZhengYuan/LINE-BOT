"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyFilters = {
  groupId: "",
  q: "",
  isBlacklisted: "",
  isWhitelisted: "",
  sortBy: "updatedAt",
  sortDir: "desc"
};

export default function MembersPage() {
  return (
    <Suspense fallback={<PageFallback title="成員管理" />}>
      <MembersContent />
    </Suspense>
  );
}

function MembersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(emptyFilters);
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") params.set(key, String(value));
    });
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [filters, page, limit]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [membersRes, groupsRes] = await Promise.all([apiFetch(`/members?${query}`), apiFetch("/groups")]);
      setItems(membersRes.items || []);
      setTotal(membersRes.total || 0);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      setError(err.message || "無法載入成員資料");
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

    const groupId = searchParams.get("groupId");
    if (groupId) {
      setFilters((current) => ({ ...current, groupId }));
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (!getToken()) return;
    load().catch(() => router.replace("/login"));
  }, [router, query]);

  return (
    <Shell title="成員管理" subtitle="搜尋、篩選、排序與檢視群組成員資料">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-4">
          <Select label="群組" value={filters.groupId} onChange={(value) => setFilters({ ...filters, groupId: value })}>
            <option value="">全部群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Input label="關鍵字" value={filters.q} onChange={(value) => setFilters({ ...filters, q: value })} placeholder="名稱 / userId" />
          <Select label="黑名單" value={filters.isBlacklisted} onChange={(value) => setFilters({ ...filters, isBlacklisted: value })}>
            <option value="">全部</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </Select>
          <Select label="白名單" value={filters.isWhitelisted} onChange={(value) => setFilters({ ...filters, isWhitelisted: value })}>
            <option value="">全部</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </Select>
          <Select label="排序欄位" value={filters.sortBy} onChange={(value) => setFilters({ ...filters, sortBy: value })}>
            <option value="updatedAt">更新時間</option>
            <option value="joinedAt">加入時間</option>
            <option value="messageCount">發言數</option>
            <option value="violationCount">違規數</option>
            <option value="riskScore">風險分數</option>
            <option value="activeScore">活躍值</option>
          </Select>
          <Select label="排序方向" value={filters.sortDir} onChange={(value) => setFilters({ ...filters, sortDir: value })}>
            <option value="desc">由新到舊</option>
            <option value="asc">由舊到新</option>
          </Select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setFilters(emptyFilters);
              setPage(1);
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
          >
            重置
          </button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
            重新載入
          </button>
        </div>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard label="載入成員資料中..." /> : null}

        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{item.displayName || item.userId}</Badge>
              <Badge tone="emerald">{item.group?.name || item.group?.lineGroupId}</Badge>
              {item.isBlacklisted ? <Badge tone="rose">黑名單</Badge> : null}
              {item.isWhitelisted ? <Badge tone="emerald">白名單</Badge> : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="userId" value={item.userId} />
              <Metric label="加入時間" value={formatTime(item.joinedAt)} />
              <Metric label="發言數" value={item.messageCount} />
              <Metric label="違規數" value={item.violationCount} />
              <Metric label="風險分數" value={Math.round(item.riskScore || 0)} />
              <Metric label="活躍值" value={item.activeScore} />
              <Metric label="簽到次數" value={item.checkinCount} />
              <Metric label="任務完成數" value={item.missionCompletedCount} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/members/${item.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                查看詳情
              </Link>
              <Link href={`/violations?lineUserId=${encodeURIComponent(item.userId)}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                相關違規
              </Link>
            </div>
          </article>
        ))}

        {!loading && items.length === 0 ? <EmptyState title="目前沒有符合條件的成員" /> : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          第 {page} 頁 / 共 {Math.max(1, Math.ceil(total / limit))} 頁
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
          >
            上一頁
          </button>
          <button
            disabled={page * limit >= total}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
          >
            下一頁
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Input({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      />
    </label>
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

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-slate-100">{value}</div>
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

function EmptyState({ title }) {
  return <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">{title}</div>;
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}

function PageFallback({ title }) {
  return (
    <Shell title={title} subtitle="載入中">
      <LoadingCard label="載入中..." />
    </Shell>
  );
}
