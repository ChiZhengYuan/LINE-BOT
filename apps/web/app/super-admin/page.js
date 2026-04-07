"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function SuperAdminPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [overview, setOverview] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, overviewRes, adminsRes, loginLogsRes, activityLogsRes, notificationsRes] = await Promise.all([
        apiFetch("/dashboard/summary"),
        apiFetch("/dashboard/overview"),
        apiFetch("/admins"),
        apiFetch("/admins/login-logs"),
        apiFetch("/admins/activity-logs"),
        apiFetch("/admins/notifications")
      ]);
      setSummary(summaryRes);
      setOverview(overviewRes);
      setAdmins(adminsRes.admins || []);
      setLoginLogs(loginLogsRes.items || []);
      setActivityLogs(activityLogsRes.items || []);
      setNotifications(notificationsRes.items || []);
    } catch (err) {
      setError(err.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="超級系統" subtitle="查看全部租戶、登入紀錄、操作紀錄與 LINE 綁定狀態。">
      {error ? <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="全部群組" value={summary?.groups ?? 0} />
        <StatCard label="全部成員" value={summary?.members ?? 0} />
        <StatCard label="全部違規" value={summary?.violations ?? 0} />
        <StatCard label="待處理" value={summary?.pendingActions ?? 0} />
        <StatCard label="全部管理員" value={admins.length} />
        <StatCard label="未讀通知" value={notifications.filter((item) => !item.isRead).length} />
        <StatCard label="近期登入" value={loginLogs.length} />
        <StatCard label="近期操作" value={activityLogs.length} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="超級管理員清單" loading={loading}>
          {admins.length ? (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div key={admin.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {admin.username ? (
                      <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs text-cyan-100">{admin.username}</span>
                    ) : null}
                    {admin.email ? (
                      <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs text-cyan-100">{admin.email}</span>
                    ) : (
                      <span className="rounded-full bg-slate-400/15 px-3 py-1 text-xs text-slate-200">未填 Email</span>
                    )}
                    <span className={`rounded-full px-3 py-1 text-xs ${badgeClass(admin.status)}`}>{admin.status}</span>
                    <span className={`rounded-full px-3 py-1 text-xs ${badgeClass(admin.role === "SUPER_ADMIN" ? "SUPER" : admin.role)}`}>{admin.role}</span>
                    <span className={`rounded-full px-3 py-1 text-xs ${admin.planType === "PERMANENT" ? "bg-emerald-400/15 text-emerald-100" : "bg-amber-400/15 text-amber-100"}`}>
                      {admin.planType === "PERMANENT" ? "永久版" : "期限版"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {admin.name || "未命名"} · 到期：{admin.expireAt ? formatDate(admin.expireAt) : "無"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="目前沒有管理員資料" />
          )}
        </Panel>

        <Panel title="系統統計趨勢" loading={loading}>
          {overview ? (
            <div className="space-y-3">
              <MiniRow label="最近 7 日違規" value={sumTrend(overview.trend, "violations")} />
              <MiniRow label="最近 7 日新增成員" value={sumTrend(overview.trend, "members")} />
              <MiniRow label="最近 7 日訊息" value={sumTrend(overview.trend, "messages")} />
              <MiniRow label="最近 7 日貸款案件" value={sumTrend(overview.trend, "loanCases")} />
            </div>
          ) : (
            <EmptyState text="尚無統計資料" />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel title="最近登入紀錄" loading={loading}>
          {loginLogs.length ? (
            <div className="space-y-3">
              {loginLogs.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${item.success ? "bg-emerald-400/15 text-emerald-100" : "bg-rose-400/15 text-rose-100"}`}>
                      {item.success ? "成功" : "失敗"}
                    </span>
                    <span className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 text-slate-100">{item.email}</div>
                  <div className="text-xs text-slate-400">{item.reason || "-"}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="沒有登入紀錄" />
          )}
        </Panel>

        <Panel title="最近操作紀錄" loading={loading}>
          {activityLogs.length ? (
            <div className="space-y-3">
              {activityLogs.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs text-cyan-100">{operationLabel(item.eventType)}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 text-slate-100">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.detail || "-"}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="沒有操作紀錄" />
          )}
        </Panel>

        <Panel title="最近通知" loading={loading}>
          {notifications.length ? (
            <div className="space-y-3">
              {notifications.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-fuchsia-400/15 px-3 py-1 text-xs text-fuchsia-100">{item.type}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 text-slate-100">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="沒有通知" />
          )}
        </Panel>
      </div>
    </Shell>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
      <div className="text-sm text-slate-300">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Panel({ title, loading, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <div className="mt-4">{loading ? <Skeleton /> : children}</div>
    </section>
  );
}

function Skeleton() {
  return <div className="h-28 animate-pulse rounded-3xl bg-white/5" />;
}

function EmptyState({ text }) {
  return <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">{text}</div>;
}

function MiniRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-base font-semibold text-white">{value}</span>
    </div>
  );
}

function sumTrend(trend = [], key) {
  return trend.reduce((sum, item) => sum + Number(item?.[key] || 0), 0);
}

function operationLabel(type) {
  const labels = {
    LOGIN: "登入",
    GROUP_SETTING_CHANGED: "群組設定",
    BLACKLIST_CHANGED: "黑名單",
    WHITELIST_CHANGED: "白名單",
    VIOLATION_REVIEWED: "違規審核",
    ANNOUNCEMENT_CREATED: "公告建立",
    ANNOUNCEMENT_UPDATED: "公告更新",
    ANNOUNCEMENT_SENT: "公告發送",
    LOTTERY_CREATED: "抽獎建立",
    LOTTERY_UPDATED: "抽獎更新",
    LOTTERY_DRAWN: "抽獎開獎",
    MISSION_CREATED: "任務建立",
    MISSION_UPDATED: "任務更新",
    AUTO_REPLY_CREATED: "自動回覆建立",
    AUTO_REPLY_UPDATED: "自動回覆更新",
    CHECKIN_CREATED: "簽到建立",
    MEMBER_UPDATED: "成員更新",
    SYSTEM_ERROR: "系統事件",
    LOAN_CASE_CREATED: "案件建立",
    LOAN_CASE_UPDATED: "案件更新",
    LOAN_CASE_STATUS_CHANGED: "案件狀態變更",
    DAILY_CASE_REPORT_CREATED: "匯報建立",
    DAILY_CASE_REPORT_SENT: "匯報發送",
    LOAN_REMINDER_CREATED: "提醒建立",
    LOAN_REMINDER_SENT: "提醒發送"
  };
  return labels[type] || type || "-";
}

function badgeClass(value) {
  if (value === "ACTIVE") return "bg-emerald-400/15 text-emerald-100";
  if (value === "EXPIRED") return "bg-amber-400/15 text-amber-100";
  if (value === "BLOCKED") return "bg-rose-400/15 text-rose-100";
  return "bg-slate-600/30 text-slate-200";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-TW");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-TW");
}
