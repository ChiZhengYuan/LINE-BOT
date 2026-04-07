"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyFilters = {
  groupId: "",
  from: "",
  to: ""
};

export default function DailyReportsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);

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
      const [reportsRes, groupsRes] = await Promise.all([
        apiFetch(`/loans/daily-reports${query ? `?${query}` : ""}`),
        apiFetch("/groups")
      ]);
      setItems(reportsRes.items || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      setError(err.message || "無法載入每日匯報");
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
    load().catch(() => {});
  }, [router, query]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/loans/daily-reports/generate", {
        method: "POST",
        body: JSON.stringify({
          groupId: filters.groupId || undefined,
          date: filters.from || undefined
        })
      });
      setSuccess("已重新產生匯報");
      await load();
    } catch (err) {
      setError(err.message || "產生匯報失敗");
    } finally {
      setGenerating(false);
    }
  };

  const sendNow = async (reportId) => {
    await apiFetch(`/loans/daily-reports/${reportId}/send`, { method: "POST" });
    await load();
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm("確定要刪除這份每日匯報嗎？")) return;
    setDeletingId(reportId);
    setError("");
    try {
      await apiFetch(`/loans/daily-reports/${reportId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message || "刪除每日匯報失敗");
    } finally {
      setDeletingId("");
    }
  };

  const clearReports = async () => {
    if (!window.confirm("確定要刪除目前篩選條件下的所有每日匯報嗎？")) return;
    setClearing(true);
    setError("");
    try {
      await apiFetch(`/loans/daily-reports${query ? `?${query}` : ""}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message || "清空每日匯報失敗");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Shell title="每日匯報" subtitle="查看今天與歷史匯報，可重新產生並手動發送到群組">
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
          <Input label="日期開始" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
          <Input label="日期結束" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => setFilters(emptyFilters)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
            重置
          </button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
            重新載入
          </button>
          <button onClick={generate} disabled={generating} className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 disabled:opacity-50">
            {generating ? "產生中..." : "重新產生匯報"}
          </button>
          <button
            onClick={clearReports}
            disabled={clearing}
            className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 disabled:opacity-50"
          >
            {clearing ? "刪除中..." : "刪除目前篩選"}
          </button>
        </div>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}
      {success ? <Alert tone="emerald">{success}</Alert> : null}

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard label="載入匯報中..." /> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{formatDate(item.reportDate)}</Badge>
              <Badge tone="emerald">{item.group?.name || item.group?.lineGroupId}</Badge>
              <Badge tone="rose">{item.caseCount} 筆</Badge>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-50">{item.title}</div>
            <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">
              {item.content}
            </div>
            <div className="mt-3 text-xs text-slate-500">發送時間：{formatTime(item.sentAt || item.sentGroupAt)}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => sendNow(item.id)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                發送到群組
              </button>
              <Link href={`/loan-cases?groupId=${encodeURIComponent(item.groupId)}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                查看案件
              </Link>
              <button
                onClick={() => deleteReport(item.id)}
                disabled={deletingId === item.id}
                className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 disabled:opacity-50"
              >
                {deletingId === item.id ? "刪除中..." : "刪除"}
              </button>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <EmptyState text="目前沒有每日匯報" /> : null}
      </div>
    </Shell>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
    </label>
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

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("zh-TW");
  } catch {
    return "";
  }
}
