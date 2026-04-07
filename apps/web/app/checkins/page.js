"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyForm = {
  groupId: "",
  lineUserId: "",
  displayName: "",
  pointsEarned: 5
};

export default function CheckinsPage() {
  const router = useRouter();
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
    try {
      const [checkinsRes, groupsRes] = await Promise.all([
        apiFetch(`/checkins${query ? `?${query}` : ""}`),
        apiFetch("/groups")
      ]);
      setItems(checkinsRes.items || []);
      setGroups(groupsRes.groups || []);
      if (!form.groupId && groupsRes.groups?.[0]?.id) {
        setForm((current) => ({ ...current, groupId: groupsRes.groups[0].id }));
      }
    } catch (err) {
      setError(err.message || "讀取簽到失敗");
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
      await apiFetch("/checkins", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          pointsEarned: Number(form.pointsEarned)
        })
      });
      setSuccess("簽到已建立");
      await load();
    } catch (err) {
      setError(err.message || "建立簽到失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="每日簽到" subtitle="可查簽到紀錄，並手動補簽。">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-2">
          <Select label="群組" value={form.groupId} onChange={(value) => setForm({ ...form, groupId: value })}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Input label="成員 userId" value={form.lineUserId} onChange={(value) => setForm({ ...form, lineUserId: value })} />
          <Input label="顯示名稱" value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} />
          <Input label="獎勵積分" type="number" value={form.pointsEarned} onChange={(value) => setForm({ ...form, pointsEarned: value })} />
        </div>

        <button onClick={create} disabled={saving || !form.groupId || !form.lineUserId} className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
          {saving ? "建立中..." : "新增簽到"}
        </button>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {success ? <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div> : null}

      <div className="mt-6 space-y-4">
        {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{item.group?.name || item.group?.lineGroupId}</Badge>
              <Badge tone="emerald">{item.member?.displayName || item.lineUserId}</Badge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Metric label="簽到日期" value={formatTime(item.checkinDate)} />
              <Metric label="連續天數" value={item.streakDays} />
              <Metric label="獲得積分" value={item.pointsEarned} />
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">目前沒有簽到紀錄。</div> : null}
      </div>
    </Shell>
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

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-slate-100">{value}</div>
    </div>
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
