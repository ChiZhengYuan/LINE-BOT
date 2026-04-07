"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../../lib/api";
import { Shell } from "../../../components/Shell";

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params?.memberId;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch(`/members/${memberId}`);
      setItem(result.item);
      setNote(result.item?.note || "");
      setIsBlacklisted(Boolean(result.item?.isBlacklisted));
      setIsWhitelisted(Boolean(result.item?.isWhitelisted));
    } catch (err) {
      setError(err.message || "讀取成員失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (!memberId) return;
    load().catch(() => router.replace("/login"));
  }, [memberId, router]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({
          note,
          isBlacklisted,
          isWhitelisted
        })
      });
      await load();
    } catch (err) {
      setError(err.message || "儲存成員失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="成員明細" subtitle="可直接調整備註與黑白名單狀態。">
      <Link href="/members" className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
        回成員列表
      </Link>

      {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {loading ? <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}

      {item ? (
        <div className="mt-6 space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{item.displayName || item.userId}</Badge>
              <Badge tone="emerald">{item.group?.name || item.group?.lineGroupId}</Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="userId" value={item.userId} />
              <Metric label="加入時間" value={formatTime(item.joinedAt)} />
              <Metric label="訊息數" value={item.messageCount} />
              <Metric label="違規數" value={item.violationCount} />
              <Metric label="風險分數" value={Math.round(item.riskScore || 0)} />
              <Metric label="活躍值" value={item.activeScore} />
              <Metric label="簽到數" value={item.checkinCount} />
              <Metric label="任務完成" value={item.missionCompletedCount} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-50">管理備註</h2>
            <textarea
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <Toggle label="黑名單" checked={isBlacklisted} onChange={setIsBlacklisted} />
              <Toggle label="白名單" checked={isWhitelisted} onChange={setIsWhitelisted} />
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存成員設定"}
            </button>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-50">最近任務與活動</h2>
            <div className="mt-4 space-y-3">
              {(item.missionProgress || []).map((progress) => (
                <div key={progress.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="font-medium text-slate-100">{progress.mission?.title || "任務"}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    進度 {progress.currentCount} / {progress.targetCount || progress.mission?.targetCount || 0}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-full border px-4 py-2 text-sm ${checked ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-200"}`}
    >
      {label}：{checked ? "是" : "否"}
    </button>
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

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
