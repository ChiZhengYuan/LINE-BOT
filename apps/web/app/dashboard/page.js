"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";
import { StatCard } from "../../components/StatCard";

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    Promise.all([apiFetch("/dashboard/summary"), apiFetch("/dashboard/groups")])
      .then(([summaryRes, groupsRes]) => {
        setSummary(summaryRes);
        setGroups(groupsRes.groups || []);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <Shell title="儀表板" subtitle="在手機上會優先顯示卡片式資訊，閱讀更輕鬆。">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="群組總數" value={summary?.groups ?? 0} hint="目前已建立的 LINE 群組" />
        <StatCard label="違規數" value={summary?.violations ?? 0} hint="所有違規事件總數" />
        <StatCard label="待處理" value={summary?.pendingActions ?? 0} hint="待審 / 待踢 / 後台待處理" />
        <StatCard label="AI 紀錄" value={summary?.assessments ?? 0} hint="AI 或 heuristic 判斷紀錄" />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold sm:text-xl">群組總覽</h2>
          <div className="text-xs text-slate-400 sm:text-sm">手機版會顯示卡片，桌機版顯示表格</div>
        </div>

        {loading ? <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">載入中...</div> : null}

        {!loading && groups.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-center text-slate-400">
            還沒有任何群組，先到群組管理新增一筆。
          </div>
        ) : null}

        <div className="mt-4 space-y-3 md:hidden">
          {groups.map((group) => {
            const latestAction = group.pendingActions?.[0];
            return (
              <div key={group.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-cyan-200">{group.lineGroupId}</div>
                    <div className="mt-1 text-base font-semibold text-slate-50">{group.name || "未命名群組"}</div>
                  </div>
                  <StatusBadge active={group.isActive} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <MiniStat label="違規" value={group._count?.violations ?? 0} />
                  <MiniStat label="訊息" value={group._count?.messages ?? 0} />
                  <MiniStat label="待處理" value={group._count?.pendingActions ?? 0} />
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">最近動作</div>
                  <div className="mt-1 text-slate-100">
                    {latestAction ? formatAction(latestAction.actionType) : "尚未有動作"}
                  </div>
                  {latestAction ? <div className="mt-1 text-xs text-slate-400">{formatTime(latestAction.createdAt)}</div> : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">群組 ID</th>
                <th className="px-4 py-3">狀態</th>
                <th className="px-4 py-3">最近動作</th>
                <th className="px-4 py-3">違規</th>
                <th className="px-4 py-3">訊息</th>
                <th className="px-4 py-3">待處理</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const latestAction = group.pendingActions?.[0];
                return (
                  <tr key={group.id} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono text-xs text-cyan-200">{group.lineGroupId}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={group.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      {latestAction ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-100">{formatAction(latestAction.actionType)}</span>
                          <span className="text-xs text-slate-400">{formatTime(latestAction.createdAt)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">尚未有動作</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{group._count?.violations ?? 0}</td>
                    <td className="px-4 py-3">{group._count?.messages ?? 0}</td>
                    <td className="px-4 py-3">{group._count?.pendingActions ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-300/30 bg-rose-500/10 text-rose-100"
      }`}
    >
      {active ? "開" : "關"}
    </span>
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
