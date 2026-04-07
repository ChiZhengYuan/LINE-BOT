"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const CATEGORY_LABELS = {
  invite: "邀請連結",
  url: "網址",
  blacklist: "黑名單",
  spam: "洗版",
  benign: "正常"
};

export default function AiPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    apiFetch("/violations/ai")
      .then((data) => setRows(data.assessments || []))
      .catch((err) => {
        setError(err.message || "讀取 AI 紀錄失敗");
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <Shell title="AI 判斷紀錄" subtitle="這裡會顯示風險分數、分類、原因與信心值。">
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? <LoadingCard /> : null}

        {rows.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{labelOf(CATEGORY_LABELS, item.category)}</Badge>
              <Badge tone="emerald">{formatConfidence(item.confidence)}</Badge>
              <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Block label="風險分數" value={Math.round(item.riskScore || 0)} />
              <Block label="信心值" value={formatConfidence(item.confidence)} />
              <Block label="發言者 userId" value={item.lineUserId || "無"} />
              <Block label="群組" value={item.group?.name || item.group?.lineGroupId || "未命名群組"} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">原因</div>
              <p className="mt-2 text-sm leading-6 text-slate-100">{item.reason || "無"}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">訊息內容</div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{item.messageLog?.content || "無"}</p>
            </div>
          </article>
        ))}

        {!loading && rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            目前沒有 AI 判斷紀錄。
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function LoadingCard() {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div>;
}

function Block({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-2 break-all text-sm font-medium text-slate-100">{value}</div>
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
