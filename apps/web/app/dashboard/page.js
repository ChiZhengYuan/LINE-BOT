"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const loanStatusLabels = {
  SUBMITTING: "送件中",
  SUBMITTED: "已送件",
  REVIEWING: "審核中",
  APPROVED: "已核准",
  SIGNED: "已簽約",
  DISBURSED: "已撥款",
  NEED_SUPPLEMENT: "待補件",
  POSTPONED: "暫緩",
  REJECTED: "退件"
};

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

  const trendBars = overview?.trend || [];
  const statusStats = overview?.loanStatusStats || {};

  return (
    <Shell title="儀表板" subtitle="整合群組、違規、成員、通知與貸款案件的即時總覽">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="群組總數" value={summary?.groups ?? 0} hint="目前連線中的 LINE 群組" />
        <StatCard label="成員總數" value={summary?.members ?? 0} hint="已建立的群組成員資料" />
        <StatCard label="違規總數" value={summary?.violations ?? 0} hint="所有群組的違規事件" />
        <StatCard label="通知數量" value={summary?.notifications ?? 0} hint="後台通知中心未讀與歷史" />
        <StatCard label="貸款案件" value={summary?.loanCases ?? 0} hint="案件自動登記總數" />
        <StatCard label="每日匯報" value={summary?.loanReports ?? 0} hint="已建立的每日案件匯報" />
        <StatCard label="待處理提醒" value={summary?.loanReminders ?? 0} hint="需要發送或處理的提醒" />
        <StatCard label="待審案件" value={summary?.pendingActions ?? 0} hint="群組風控待處理項目" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Section title="近 7 日趨勢" action={<Link href="/violations" className="text-sm text-cyan-200">查看違規</Link>}>
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
            <EmptyState text="目前沒有高風險成員資料" />
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Section title="最近通知" action={<Link href="/notifications" className="text-sm text-cyan-200">查看通知中心</Link>}>
          {overview?.recentNotifications?.length ? (
            <div className="space-y-3">
              {overview.recentNotifications.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{notificationLabel(item.type)}</Badge>
                    {!item.isRead ? <Badge tone="rose">未讀</Badge> : null}
                  </div>
                  <div className="mt-2 font-medium text-slate-100">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="目前沒有通知" />
          )}
        </Section>

        <Section title="最近操作日誌" action={<Link href="/operation-logs" className="text-sm text-cyan-200">查看操作日誌</Link>}>
          {overview?.recentLogs?.length ? (
            <div className="space-y-3">
              {overview.recentLogs.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="emerald">{operationLabel(item.eventType)}</Badge>
                    <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 font-medium text-slate-100">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.detail || "沒有詳細內容"}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="目前沒有操作日誌" />
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Section title="每日案件匯報" action={<Link href="/daily-reports" className="text-sm text-cyan-200">前往匯報</Link>}>
          {overview?.recentLoanReports?.length ? (
            <div className="space-y-3">
              {overview.recentLoanReports.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{formatDate(item.reportDate)}</Badge>
                    <Badge tone="emerald">{item.group?.name || item.group?.lineGroupId}</Badge>
                    <Badge tone="rose">{item.caseCount} 筆</Badge>
                  </div>
                  <div className="mt-2 font-medium text-slate-100">{item.title}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-slate-300 line-clamp-3">{item.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="目前沒有每日匯報" />
          )}
        </Section>

        <Section title="貸款案件狀態分布" action={<Link href="/reports" className="text-sm text-cyan-200">查看報表</Link>}>
          <div className="space-y-3">
            {Object.entries(loanStatusLabels).map(([key, label]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-200">{label}</div>
                  <div className="text-sm font-semibold text-cyan-100">{statusStats[key] || 0}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="群組總覽" action={<Link href="/groups" className="text-sm text-cyan-200">查看群組</Link>} className="mt-6">
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
                  <MiniStat label="案件" value={group._count?.loanCases ?? 0} />
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">最近動作</div>
                  <div className="mt-1 text-slate-100">{latestAction ? operationLabel(latestAction.actionType) : "尚無動作"}</div>
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
  const max = Math.max(1, ...data.map((item) => Math.max(item.violations || 0, item.messages || 0, item.members || 0, item.loanCases || 0)));
  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.date} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{item.date}</span>
            <span>違規 {item.violations} / 貸款 {item.loanCases || 0}</span>
          </div>
          <div className="mt-3 space-y-2">
            <Bar label="違規" value={item.violations} max={max} tone="rose" />
            <Bar label="訊息" value={item.messages} max={max} tone="cyan" />
            <Bar label="新成員" value={item.members} max={max} tone="emerald" />
            <Bar label="案件" value={item.loanCases || 0} max={max} tone="amber" />
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
    emerald: "bg-emerald-400",
    amber: "bg-amber-400"
  };
  return (
    <div className="grid grid-cols-[72px_1fr_40px] items-center gap-2 text-xs text-slate-400">
      <div>{label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tones[tone] || tones.cyan}`} style={{ width: `${(Number(value || 0) / max) * 100}%` }} />
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
      {active ? "啟用" : "停用"}
    </span>
  );
}

function Badge({ tone = "cyan", children }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-100"
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone] || tones.cyan}`}>{children}</span>;
}

function EmptyState({ text }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-center text-slate-400">{text}</div>;
}

function Skeleton() {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">載入中...</div>;
}

function notificationLabel(value) {
  const map = {
    VIOLATION: "違規",
    NEW_MEMBER: "新人",
    HIGH_RISK: "高風險",
    ANNOUNCEMENT_SENT: "公告",
    LOTTERY_DRAWN: "抽獎",
    MISSION_DUE: "任務",
    SYSTEM_ERROR: "系統錯誤",
    WELCOME: "歡迎",
    GROUP_SETTING_CHANGED: "群組設定",
    LOAN_CASE: "貸款案件",
    LOAN_REPORT: "貸款匯報"
  };
  return map[value] || value;
}

function operationLabel(value) {
  const map = {
    LOGIN: "登入",
    GROUP_SETTING_CHANGED: "群組設定變更",
    BLACKLIST_CHANGED: "黑名單變更",
    WHITELIST_CHANGED: "白名單變更",
    VIOLATION_REVIEWED: "違規審核",
    ANNOUNCEMENT_CREATED: "新增公告",
    ANNOUNCEMENT_UPDATED: "修改公告",
    ANNOUNCEMENT_SENT: "發送公告",
    LOTTERY_CREATED: "新增抽獎",
    LOTTERY_UPDATED: "修改抽獎",
    LOTTERY_DRAWN: "抽獎完成",
    MISSION_CREATED: "新增任務",
    MISSION_UPDATED: "修改任務",
    AUTO_REPLY_CREATED: "新增自動回覆",
    AUTO_REPLY_UPDATED: "修改自動回覆",
    CHECKIN_CREATED: "簽到",
    MEMBER_UPDATED: "成員更新",
    LOAN_CASE_CREATED: "新增案件",
    LOAN_CASE_UPDATED: "案件更新",
    LOAN_CASE_STATUS_CHANGED: "案件狀態更新",
    DAILY_CASE_REPORT_CREATED: "建立匯報",
    DAILY_CASE_REPORT_SENT: "發送匯報",
    LOAN_REMINDER_CREATED: "建立提醒",
    LOAN_REMINDER_SENT: "發送提醒",
    SYSTEM_ERROR: "系統錯誤"
  };
  return map[value] || value;
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("zh-TW");
  } catch {
    return "";
  }
}

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
