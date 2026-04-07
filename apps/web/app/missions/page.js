"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyForm = {
  groupId: "",
  title: "",
  description: "",
  missionType: "CHECKIN",
  targetCount: 1,
  keyword: "",
  pointsReward: 0,
  startAt: "",
  dueAt: "",
  isActive: true
};

export default function MissionsPage() {
  return (
    <Suspense fallback={<PageFallback title="任務管理" />}>
      <MissionsContent />
    </Suspense>
  );
}

function MissionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useMemo(() => (form.groupId ? `groupId=${encodeURIComponent(form.groupId)}` : ""), [form.groupId]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [missionsRes, groupsRes] = await Promise.all([apiFetch(`/missions${query ? `?${query}` : ""}`), apiFetch("/groups")]);
      const nextGroups = groupsRes.groups || [];
      setItems(missionsRes.items || []);
      setGroups(nextGroups);
      const nextGroupId = searchParams.get("groupId") || form.groupId || nextGroups[0]?.id || "";
      if (nextGroupId) setForm((current) => ({ ...current, groupId: nextGroupId }));
    } catch (err) {
      setError(err.message || "無法載入任務資料");
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
    load().catch(() => router.replace("/login"));
  }, [router, query]);

  const create = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/missions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          targetCount: Number(form.targetCount),
          pointsReward: Number(form.pointsReward)
        })
      });
      setSuccess("任務已建立");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message || "建立任務失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="任務管理" subtitle="支援簽到、發言次數、關鍵字任務與積分獎勵">
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
          <Input label="任務名稱" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <Select label="任務類型" value={form.missionType} onChange={(value) => setForm({ ...form, missionType: value })}>
            <option value="CHECKIN">簽到</option>
            <option value="MESSAGE_COUNT">發言次數</option>
            <option value="KEYWORD">關鍵字觸發</option>
          </Select>
          <Input label="目標數量" type="number" value={form.targetCount} onChange={(value) => setForm({ ...form, targetCount: value })} />
          <Input label="關鍵字" value={form.keyword} onChange={(value) => setForm({ ...form, keyword: value })} />
          <Input label="積分獎勵" type="number" value={form.pointsReward} onChange={(value) => setForm({ ...form, pointsReward: value })} />
          <Input label="開始時間" type="datetime-local" value={form.startAt} onChange={(value) => setForm({ ...form, startAt: value })} />
          <Input label="截止時間" type="datetime-local" value={form.dueAt} onChange={(value) => setForm({ ...form, dueAt: value })} />
        </div>
        <div className="mt-4">
          <TextArea label="任務說明" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ToggleRow label="啟用" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          <button onClick={create} disabled={saving || !form.groupId || !form.title} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {saving ? "建立中..." : "建立任務"}
          </button>
        </div>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}
      {success ? <Alert tone="emerald">{success}</Alert> : null}

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard label="載入任務中..." /> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{missionLabel(item.missionType)}</Badge>
              <Badge tone={item.isActive ? "emerald" : "rose"}>{item.isActive ? "啟用" : "停用"}</Badge>
              <span className="text-xs text-slate-400">{item.group?.name || item.group?.lineGroupId}</span>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-50">{item.title}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.description}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Metric label="目標數量" value={item.targetCount} />
              <Metric label="積分獎勵" value={item.pointsReward} />
              <Metric label="截止時間" value={formatTime(item.dueAt)} />
            </div>
            <div className="mt-4 space-y-2">
              {(item.progress || []).map((progress) => (
                <div key={progress.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
                  {progress.member?.displayName || progress.member?.userId}：{progress.currentCount} / {progress.targetCount || item.targetCount}
                </div>
              ))}
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <EmptyState title="目前沒有任務資料" /> : null}
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
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
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

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function missionLabel(value) {
  const map = { CHECKIN: "簽到", MESSAGE_COUNT: "發言次數", KEYWORD: "關鍵字" };
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
