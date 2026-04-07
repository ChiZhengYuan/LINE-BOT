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

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    Promise.all([apiFetch("/dashboard/summary"), apiFetch("/dashboard/groups")])
      .then(([summaryRes, groupsRes]) => {
        setSummary(summaryRes);
        setGroups(groupsRes.groups || []);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <Shell title="儀表板" subtitle="快速查看目前群組狀態、違規量與最近執行動作。">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="群組數" value={summary?.groups ?? 0} hint="目前已納管 LINE 群組" />
        <StatCard label="違規數" value={summary?.violations ?? 0} hint="累計違規紀錄" />
        <StatCard label="待處理" value={summary?.pendingActions ?? 0} hint="待審 / 待踢清單" />
        <StatCard label="AI 紀錄" value={summary?.assessments ?? 0} hint="AI 或 heuristic 判斷紀錄" />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <h2 className="text-xl font-semibold">群組狀態總覽</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
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
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${
                          group.isActive
                            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                            : "border-rose-300/30 bg-rose-500/10 text-rose-100"
                        }`}
                      >
                        {group.isActive ? "開" : "關"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {latestAction ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-100">{formatAction(latestAction.actionType)}</span>
                          <span className="text-xs text-slate-400">{formatTime(latestAction.createdAt)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">尚未執行</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{group._count?.violations ?? 0}</td>
                    <td className="px-4 py-3">{group._count?.messages ?? 0}</td>
                    <td className="px-4 py-3">{group._count?.pendingActions ?? 0}</td>
                  </tr>
                );
              })}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                    尚未收到任何群組 webhook 資料
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function formatAction(value) {
  const map = {
    NONE: "無動作",
    WARNING: "警告",
    BACKOFFICE_TAG: "後台標記",
    ADMIN_NOTIFY: "管理員通知",
    PENDING_KICK: "待踢清單",
    KICKED: "已踢出"
  };
  return map[value] || value || "未定義";
}

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
