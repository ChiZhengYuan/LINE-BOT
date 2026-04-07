"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyForm = {
  groupId: "",
  title: "",
  content: "",
  scheduleType: "ONCE",
  targetGroupIds: "",
  startAt: "",
  endAt: "",
  nextRunAt: "",
  isActive: true
};

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<PageFallback title="定時公告" />}>
      <AnnouncementsContent />
    </Suspense>
  );
}

function AnnouncementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (form.groupId) params.set("groupId", form.groupId);
    return params.toString();
  }, [form.groupId]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [announcementsRes, groupsRes] = await Promise.all([apiFetch(`/announcements${query ? `?${query}` : ""}`), apiFetch("/groups")]);
      const nextGroups = groupsRes.groups || [];
      setItems(announcementsRes.items || []);
      setGroups(nextGroups);
      const nextGroupId = searchParams.get("groupId") || form.groupId || nextGroups[0]?.id || "";
      if (nextGroupId) setForm((current) => ({ ...current, groupId: nextGroupId }));
    } catch (err) {
      setError(err.message || "無法載入公告資料");
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

  const create = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/announcements", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          targetGroupIds: form.targetGroupIds.split(",").map((item) => item.trim()).filter(Boolean)
        })
      });
      setForm(emptyForm);
      setSuccess("公告已建立");
      await load();
    } catch (err) {
      setError(err.message || "建立公告失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="定時公告" subtitle="建立單次、每日、每週、每月公告並管理發送紀錄">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-2">
          <Select label="群組" value={form.groupId} onChange={(value) => setForm({ ...form, groupId: value })}>
            <option value="">請選擇群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Input label="標題" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <Select label="排程類型" value={form.scheduleType} onChange={(value) => setForm({ ...form, scheduleType: value })}>
            <option value="ONCE">單次</option>
            <option value="DAILY">每日</option>
            <option value="WEEKLY">每週</option>
            <option value="MONTHLY">每月</option>
          </Select>
          <Input label="指定群組 ID（逗號分隔）" value={form.targetGroupIds} onChange={(value) => setForm({ ...form, targetGroupIds: value })} />
          <Input label="開始時間" type="datetime-local" value={form.startAt} onChange={(value) => setForm({ ...form, startAt: value })} />
          <Input label="結束時間" type="datetime-local" value={form.endAt} onChange={(value) => setForm({ ...form, endAt: value })} />
          <Input label="下次執行時間" type="datetime-local" value={form.nextRunAt} onChange={(value) => setForm({ ...form, nextRunAt: value })} />
          <ToggleRow label="啟用" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
        </div>

        <div className="mt-4">
          <TextArea label="內容" value={form.content} onChange={(value) => setForm({ ...form, content: value })} />
        </div>

        <button onClick={create} disabled={saving || !form.groupId || !form.title} className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
          {saving ? "建立中..." : "建立公告"}
        </button>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}
      {success ? <Alert tone="emerald">{success}</Alert> : null}

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard label="載入公告中..." /> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{scheduleLabel(item.scheduleType)}</Badge>
              <Badge tone={item.isActive ? "emerald" : "rose"}>{item.isActive ? "啟用" : "停用"}</Badge>
              <span className="text-xs text-slate-400">{item.group?.name || item.group?.lineGroupId}</span>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-50">{item.title}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.content}</div>
            <div className="mt-3 text-xs text-slate-500">發送次數：{item.sendCount} / 上次發送：{formatTime(item.lastSentAt)}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => apiFetch(`/announcements/${item.id}/send`, { method: "POST" }).then(load)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                立即發送
              </button>
              <Link href={`/announcements/${item.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                編輯 / 預覽
              </Link>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <EmptyState title="目前沒有公告資料" /> : null}
      </div>
    </Shell>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
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

function TextArea({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="font-medium text-slate-100">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
    </label>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
      <div className="text-sm font-medium text-slate-100">{label}</div>
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative inline-flex h-8 w-14 items-center rounded-full border transition ${checked ? "border-emerald-300/40 bg-emerald-500/35" : "border-white/15 bg-slate-700/70"}`}>
      <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition ${checked ? "translate-x-7" : "translate-x-1"}`} />
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

function Alert({ tone = "rose", children }) {
  const tones = {
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100",
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
  };
  return <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

function LoadingCard({ label }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">{label}</div>;
}

function EmptyState({ title }) {
  return <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">{title}</div>;
}

function scheduleLabel(value) {
  const map = { ONCE: "單次", DAILY: "每日", WEEKLY: "每週", MONTHLY: "每月" };
  return map[value] || value;
}

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}

function PageFallback({ title }) {
  return (
    <Shell title={title} subtitle="載入中">
      <LoadingCard label="載入中..." />
    </Shell>
  );
}
