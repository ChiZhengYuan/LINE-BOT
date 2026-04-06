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
    <Shell title="儀表板" subtitle="查看多群組狀態、違規量與待處理項目">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="群組數" value={summary?.groups ?? "—"} hint="已納管的 LINE 群組" />
        <StatCard label="違規紀錄" value={summary?.violations ?? "—"} hint="所有規則觸發紀錄" />
        <StatCard label="待處理" value={summary?.pendingActions ?? "—"} hint="待審 / 待踢清單" />
        <StatCard label="AI 判斷" value={summary?.assessments ?? "—"} hint="AI 模組輸出紀錄" />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <h2 className="text-xl font-semibold">群組概覽</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">Group ID</th>
                <th className="px-4 py-3">違規</th>
                <th className="px-4 py-3">訊息</th>
                <th className="px-4 py-3">待處理</th>
                <th className="px-4 py-3">狀態</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-200">{group.lineGroupId}</td>
                  <td className="px-4 py-3">{group._count?.violations ?? 0}</td>
                  <td className="px-4 py-3">{group._count?.messages ?? 0}</td>
                  <td className="px-4 py-3">{group._count?.pendingActions ?? 0}</td>
                  <td className="px-4 py-3">{group.isActive ? "啟用" : "停用"}</td>
                </tr>
              ))}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    尚未收到任何群組 webhook
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
