"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function WelcomePage() {
  return (
    <Suspense fallback={<PageFallback title="歡迎與群規" />}>
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [item, setItem] = useState({
    enabled: false,
    welcomeMessage: "",
    groupRulesMessage: "",
    flexTemplate: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const groupsRes = await apiFetch("/groups");
      const nextGroups = groupsRes.groups || [];
      setGroups(nextGroups);
      const initialGroupId = groupId || searchParams.get("groupId") || nextGroups[0]?.id || "";
      setGroupId(initialGroupId);
      if (initialGroupId) {
        const welcomeRes = await apiFetch(`/welcome/groups/${initialGroupId}`);
        setItem(welcomeRes.item || item);
      }
    } catch (err) {
      setError(err.message || "無法載入歡迎設定");
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
  }, [router]);

  useEffect(() => {
    if (!groupId) return;
    apiFetch(`/welcome/groups/${groupId}`).then((res) => setItem(res.item || item)).catch(() => {});
  }, [groupId]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/welcome/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({ groupId, ...item })
      });
      setSuccess("歡迎與群規已儲存");
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="歡迎與群規" subtitle="新人加入時可自動送出歡迎訊息與群規內容，並支援 Flex Message">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <Select label="群組" value={groupId} onChange={setGroupId}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name || group.lineGroupId}
            </option>
          ))}
        </Select>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}
      {success ? <Alert tone="emerald">{success}</Alert> : null}
      {loading ? <LoadingCard label="載入設定中..." /> : null}

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
        <div className="grid gap-4">
          <ToggleRow label="啟用歡迎訊息" checked={item.enabled} onChange={(checked) => setItem((current) => ({ ...current, enabled: checked }))} />
          <TextArea label="歡迎訊息" value={item.welcomeMessage || ""} onChange={(value) => setItem((current) => ({ ...current, welcomeMessage: value }))} />
          <TextArea label="群規訊息" value={item.groupRulesMessage || ""} onChange={(value) => setItem((current) => ({ ...current, groupRulesMessage: value }))} />
          <TextArea label="Flex JSON" value={item.flexTemplate ? JSON.stringify(item.flexTemplate, null, 2) : ""} onChange={(value) => setItem((current) => ({ ...current, flexTemplate: safeJson(value) }))} />
        </div>

        <button onClick={save} disabled={saving || !groupId} className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
          {saving ? "儲存中..." : "儲存設定"}
        </button>
      </section>
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

function TextArea({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="font-medium text-slate-100">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
    </label>
  );
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

function safeJson(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function PageFallback({ title }) {
  return (
    <Shell title={title} subtitle="載入中">
      <LoadingCard label="載入中..." />
    </Shell>
  );
}
