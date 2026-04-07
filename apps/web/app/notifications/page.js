"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyFilters = { groupId: "", type: "", isRead: "" };

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [groups, setGroups] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [notificationsRes, groupsRes, unreadRes] = await Promise.all([
        apiFetch(`/notifications${query ? `?${query}` : ""}`),
        apiFetch("/groups"),
        apiFetch("/notifications/unread-count")
      ]);
      setItems(notificationsRes.items || []);
      setGroups(groupsRes.groups || []);
      setUnreadCount(unreadRes.unreadCount || 0);
    } catch (err) {
      setError(err.message || "讀取通知失敗");
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

  const markRead = async (id) => {
    await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    await load();
  };

  const markAll = async () => {
    await apiFetch("/notifications/read-all", { method: "POST" });
    await load();
  };

  const removeNotification = async (id) => {
    if (!window.confirm("確定要刪除這則通知嗎？")) return;
    setDeletingId(id);
    setError("");
    try {
      await apiFetch(`/notifications/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message || "刪除通知失敗");
    } finally {
      setDeletingId("");
    }
  };

  const clearNotifications = async () => {
    if (!window.confirm("確定要刪除目前篩選條件下的所有通知嗎？")) return;
    setClearing(true);
    setError("");
    try {
      await apiFetch(`/notifications${query ? `?${query}` : ""}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message || "清空通知失敗");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Shell title="通知中心" subtitle={`未讀 ${unreadCount} 則，支援標記已讀與篩選。`}>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="群組" value={filters.groupId} onChange={(value) => setFilters({ ...filters, groupId: value })}>
            <option value="">全部</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Select label="類型" value={filters.type} onChange={(value) => setFilters({ ...filters, type: value })}>
            <option value="">全部</option>
            <option value="VIOLATION">有違規事件</option>
            <option value="NEW_MEMBER">有新人加入</option>
            <option value="HIGH_RISK">高風險成員升級</option>
            <option value="ANNOUNCEMENT_SENT">公告已送出</option>
            <option value="LOTTERY_DRAWN">抽獎已開獎</option>
            <option value="MISSION_DUE">任務已到期</option>
            <option value="SYSTEM_ERROR">系統錯誤</option>
            <option value="WELCOME">歡迎訊息</option>
          </Select>
          <Select label="已讀" value={filters.isRead} onChange={(value) => setFilters({ ...filters, isRead: value })}>
            <option value="">全部</option>
            <option value="true">已讀</option>
            <option value="false">未讀</option>
          </Select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => setFilters(emptyFilters)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">清除</button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">重新整理</button>
          <button onClick={markAll} className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">全部標記已讀</button>
          <button onClick={clearNotifications} disabled={clearing} className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 disabled:opacity-50">
            {clearing ? "刪除中..." : "刪除目前篩選"}
          </button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <div className="mt-6 space-y-4">
        {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}
        {items.map((item) => (
          <article key={item.id} className={`rounded-3xl border p-4 shadow-glow backdrop-blur sm:p-5 ${item.isRead ? "border-white/10 bg-white/5" : "border-cyan-300/20 bg-cyan-500/10"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.isRead ? "emerald" : "cyan"}>{item.type}</Badge>
              <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
              {!item.isRead ? <Badge tone="rose">未讀</Badge> : null}
            </div>
            <div className="mt-3 text-base font-semibold text-slate-50">{item.title}</div>
            <div className="mt-1 text-sm leading-6 text-slate-300">{item.content}</div>
            <div className="mt-3 text-xs text-slate-500">
              {item.group?.name || item.group?.lineGroupId || "無群組"}
              {item.member?.userId ? ` / ${item.member.userId}` : ""}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!item.isRead ? (
                <button onClick={() => markRead(item.id)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                  標記已讀
                </button>
              ) : null}
              <button
                onClick={() => removeNotification(item.id)}
                disabled={deletingId === item.id}
                className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 disabled:opacity-50"
              >
                {deletingId === item.id ? "刪除中..." : "刪除"}
              </button>
            </div>
          </article>
        ))}

        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            目前沒有通知。
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      >
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

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}
