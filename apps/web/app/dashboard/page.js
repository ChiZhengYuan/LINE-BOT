"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    Promise.all([
      apiFetch("/dashboard/summary"),
      apiFetch("/dashboard/groups"),
      apiFetch("/dashboard/overview")
    ])
      .then(([summaryRes, groupsRes, overviewRes]) => {
        setSummary(summaryRes);
        setGroups(groupsRes.groups || []);
        setOverview(overviewRes);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const trendBars = useMemo(() => overview?.trend || [], [overview]);

  return (
    <Shell title="儀表板" subtitle="快速查看群組、違規趨勢、活躍度與最近通知。">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="群組總數" value={summary?.groups ?? 0} hint="目前已建立的 LINE 群組" />
        <StatCard label="成員總數" value={summary?.members ?? 0} hint="所有群組的成員總和" />
        <StatCard label="違規數" value={summary?.violations ?? 0} hint="累積違規事件總數" />
        <StatCard label="未讀通知" value={summary?.notifications ?? 0} hint="通知中心未讀數量" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Section title="近 7 日違規 / 活躍趨勢" action={<Link href="/violations" className="text-sm text-cyan-200">查看違規</Link>}>
          {loading ? <Skeleton /> : <TrendChart data={trendBars} />}
        </Section>
        <Section title="高風險成員榜" action={<Link href="/rankings" className="text-sm text-cyan-200">查看排行榜</Link>}>
          {overview?.highRiskMembers?.length ? (
            <div className="space-y-3">
              {overview.highRiskMembers.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-100">
                      #{index + 1} {item.member?.displayName || item.member?.userId || "未命名成員"}
                    </div>
                    <div className="text-xs text-slate-400">{item.group?.name || item.group?.lineGroupId}</div>
                  </div>
                  <div className="text-right text-sm text-cyan-100">{item.activeScore} 分</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="目前沒有高風險成員資料。" />
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="公告數" value={summary?.announcements ?? 0} hint="公告排程與已建立總數" />
        <StatCard label="任務數" value={summary?.missions ?? 0} hint="任務建立數量" />
        <StatCard label="抽獎數" value={summary?.lotteries ?? 0} hint="抽獎活動數量" />
        <StatCard label="簽到數" value={summary?.checkins ?? 0} hint="簽到紀錄總數" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Section title="最近通知" action={<Link href="/notifications" className="text-sm text-cyan-200">通知中心</Link>}>
          {overview?.recentNotifications?.length ? (
            <div className="space-y-3">
              {overview.recentNotifications.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{item.type}</Badge>
                    {!item.isRead ? <Badge tone="rose">未讀</Badge> : null}
                  </div>
                  <div className="mt-2 font-medium text-slate-100">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="目前沒有通知。" />
          )}
        </Section>
        <Section title="最近操作日誌" action={<Link href="/operation-logs" className="text-sm text-cyan-200">操作日誌</Link>}>
          {overview?.recentLogs?.length ? (
            <div className="space-y-3">
              {overview.recentLogs.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="emerald">{item.eventType}</Badge>
                    <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 font-medium text-slate-100">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.detail || "無"}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="目前沒有操作紀錄。" />
          )}
        </Section>
      </div>

      <Section
        title="群組總覽"
        action={<Link href="/groups" className="text-sm text-cyan-200">管理群組</Link>}
        className="mt-6"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => {
            const latestAction = group.pendingActions?.[0];
            return (
              <Link key={group.id} href={`/groups/${group.id}`} className="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-cyan-200">{group.lineGroupId}</div>
                    <div className="mt-1 truncate text-lg font-semibold text-slate-50">{group.name || "未命名群組"}</div>
                  </div>
                  <StatusBadge active={group.isActive} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <MiniStat label="違規" value={group._count?.violations ?? 0} />
                  <MiniStat label="成員" value={group._count?.members ?? 0} />
                  <MiniStat label="通知" value={group._count?.notifications ?? 0} />
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">最近動作</div>
                  <div className="mt-1 text-slate-100">
                    {latestAction ? formatAction(latestAction.actionType) : "尚未有動作"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>
    </Shell>
  );
}

function Section({ title, action, children, className = "" }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-50">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function TrendChart({ data }) {
  const max = Math.max(1, ...data.map((item) => Math.max(item.violations || 0, item.messages || 0, item.members || 0)));
  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.date} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{item.date}</span>
            <span>違規 {item.violations} / 活躍 {item.messages}</span>
          </div>
          <div className="mt-3 space-y-2">
            <Bar label="違規" value={item.violations} max={max} tone="rose" />
            <Bar label="活躍" value={item.messages} max={max} tone="cyan" />
            <Bar label="新成員" value={item.members} max={max} tone="emerald" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Bar({ label, value, max, tone }) {
  const tones = {
    rose: "bg-rose-400",
    cyan: "bg-cyan-400",
    emerald: "bg-emerald-400"
  };
  return (
    <div className="grid grid-cols-[72px_1fr_40px] items-center gap-2 text-xs text-slate-400">
      <div>{label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-rose-300/30 bg-rose-500/10 text-rose-100"}`}>
      {active ? "開" : "關"}
    </span>
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

function EmptyState({ text }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-center text-slate-400">{text}</div>;
}

function Skeleton() {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">載入中...</div>;
}

function formatAction(value) {
  const map = {
    NONE: "無",
    WARNING: "群內警告",
    BACKOFFICE_TAG: "後台標記",
    ADMIN_NOTIFY: "通知管理員",
    PENDING_KICK: "加入待踢",
    KICKED: "已踢出"
  };
  return map[value] || value || "未知";
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
