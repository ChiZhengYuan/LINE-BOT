"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function LoanReportsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    apiFetch("/loans/reports")
      .then((result) => setOverview(result.overview))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const statusStats = overview?.statusStats || {};

  return (
    <Shell title="統計報表" subtitle="查看今日新增、各狀態與業務統計">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="今日新增案件" value={overview?.todayNewCases ?? 0} />
        <StatCard label="送件中" value={statusStats.SUBMITTING || 0} />
        <StatCard label="已簽約" value={statusStats.SIGNED || 0} />
        <StatCard label="已撥款" value={statusStats.DISBURSED || 0} />
        <StatCard label="待補件" value={statusStats.NEED_SUPPLEMENT || 0} />
        <StatCard label="已核准" value={statusStats.APPROVED || 0} />
        <StatCard label="審核中" value={statusStats.REVIEWING || 0} />
        <StatCard label="提醒待處理" value={overview?.pendingReminders ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Section title="各業務案件數">
          {loading ? <LoadingCard label="載入統計中..." /> : null}
          <div className="space-y-3">
            {(overview?.ownerStats || []).map((item) => (
              <div key={item.ownerStaff} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-200">{item.ownerStaff}</div>
                  <div className="text-sm font-semibold text-cyan-100">{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="各狀態案件數">
          <div className="space-y-3">
            {Object.entries(statusLabels).map(([key, label]) => (
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

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Section title="最近案件">
          <div className="space-y-3">
            {(overview?.recentCases || []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-100">
                    {item.customerName} - {item.caseType || "案件"} {formatAmount(item.amount)}
                  </div>
                  <div className="text-xs text-slate-400">{statusLabels[item.status] || item.status}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.group?.name || item.group?.lineGroupId}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="最近每日匯報">
          <div className="space-y-3">
            {(overview?.recentReports || []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-100">{item.title}</div>
                  <div className="text-xs text-slate-400">{formatDate(item.reportDate)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {item.group?.name || item.group?.lineGroupId} / {item.caseCount} 筆
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </Shell>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function LoadingCard({ label }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">{label}</div>;
}

function formatAmount(value) {
  const amount = Number(value || 0);
  if (!amount) return "";
  if (amount >= 10000 && amount % 10000 === 0) {
    return `${amount / 10000}萬`;
  }
  return String(amount);
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("zh-TW");
  } catch {
    return "";
  }
}

const statusLabels = {
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
