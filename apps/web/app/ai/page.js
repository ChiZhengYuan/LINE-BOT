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
        setError(err.message || "無法載入 AI 紀錄");
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <Shell title="AI 判斷紀錄" subtitle="risk_score、category、reason、confidence 都已改成中文顯示。">
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? <LoadingCard /> : null}

        {rows.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge tone="cyan">{labelOf(CATEGORY_LABELS, item.category)}</Badge>
              <span className="text-slate-400">{formatTime(item.createdAt)}</span>
              <span className="text-slate-500">{item.group?.name || item.group?.lineGroupId || "未命名群組"}</span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Block label="風險分數" value={Math.round(item.riskScore)} />
              <Block label="信心值" value={formatConfidence(item.confidence)} />
              <Block label="發言者 userId" value={item.lineUserId || "未知"} />
              <Block label="訊息內容" value={item.messageLog?.content || "無內容"} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">原因</div>
              <p className="mt-2 text-sm leading-6 text-slate-100">{item.reason || "無"}</p>
            </div>
          </article>
        ))}

        {!loading && rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            目前沒有 AI 判斷紀錄
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
