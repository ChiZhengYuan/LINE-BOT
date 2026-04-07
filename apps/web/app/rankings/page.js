"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function RankingsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [period, setPeriod] = useState("TOTAL");
  const [periodKey, setPeriodKey] = useState("TOTAL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (groupId) params.set("groupId", groupId);
    if (period) params.set("period", period);
    if (periodKey) params.set("periodKey", periodKey);
    return params.toString();
  }, [groupId, period, periodKey]);

  const load = async () => {
    setLoading(true);
    try {
      const [rankingsRes, groupsRes] = await Promise.all([
        apiFetch(`/rankings${query ? `?${query}` : ""}`),
        apiFetch("/groups")
      ]);
      setItems(rankingsRes.items || []);
      setGroups(groupsRes.groups || []);
      if (!groupId && groupsRes.groups?.[0]?.id) {
        setGroupId(groupsRes.groups[0].id);
      }
    } catch (err) {
      setError(err.message || "讀取排行榜失敗");
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

  return (
    <Shell title="排行榜" subtitle="可看日 / 週 / 月 / 總榜，依活躍值排序。">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="群組" value={groupId} onChange={setGroupId}>
            <option value="">全部群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Select label="期間" value={period} onChange={setPeriod}>
            <option value="DAY">日榜</option>
            <option value="WEEK">週榜</option>
            <option value="MONTH">月榜</option>
            <option value="TOTAL">總榜</option>
          </Select>
          <Input label="期間鍵" value={periodKey} onChange={setPeriodKey} />
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">重新整理</button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <div className="mt-6 space-y-4">
        {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">#{item.rankPosition || 0}</Badge>
              <Badge tone="emerald">{item.period}</Badge>
              <span className="text-xs text-slate-400">{item.group?.name || item.group?.lineGroupId}</span>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-50">{item.member?.displayName || item.member?.userId}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Metric label="活躍值" value={item.activeScore} />
              <Metric label="訊息數" value={item.messageCount} />
              <Metric label="簽到數" value={item.checkinCount} />
              <Metric label="任務數" value={item.missionCount} />
              <Metric label="抽獎數" value={item.lotteryCount} />
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">目前沒有排行榜資料。</div> : null}
      </div>
    </Shell>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
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

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}
