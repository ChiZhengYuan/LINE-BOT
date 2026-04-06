"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function AiPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    apiFetch("/violations/ai")
      .then((data) => setRows(data.assessments || []))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <Shell title="AI 判斷紀錄" subtitle="檢視 risk_score、category、reason、confidence">
      <div className="space-y-4">
        {rows.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-200">{item.category}</span>
              <span className="text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
              <span className="text-slate-400">{item.group?.lineGroupId}</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Block label="risk_score" value={Math.round(item.riskScore)} />
              <Block label="confidence" value={Number(item.confidence).toFixed(2)} />
              <Block label="user" value={item.lineUserId} />
              <Block label="message" value={item.messageLog?.content || "—"} />
            </div>
            <p className="mt-4 text-slate-200">{item.reason}</p>
          </article>
        ))}
        {rows.length === 0 ? <div className="text-sm text-slate-400">目前還沒有 AI 判斷紀錄。</div> : null}
      </div>
    </Shell>
  );
}

function Block({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-2 break-all text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
