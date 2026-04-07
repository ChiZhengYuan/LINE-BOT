"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyForm = {
  groupId: "",
  keyword: "",
  matchType: "CONTAINS",
  responseType: "TEXT",
  responseText: "",
  responseFlex: "",
  cooldownSeconds: 0,
  isActive: true
};

export default function AutoReplyPage() {
  return (
    <Suspense fallback={<PageFallback title="關鍵字自動回覆" />}>
      <AutoReplyContent />
    </Suspense>
  );
}

function AutoReplyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [groupId, setGroupId] = useState("");
  const [queryText, setQueryText] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("all");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (groupId) params.set("groupId", groupId);
    if (queryText.trim()) params.set("q", queryText.trim());
    if (isActiveFilter === "active") params.set("isActive", "true");
    if (isActiveFilter === "inactive") params.set("isActive", "false");
    return params.toString();
  }, [groupId, queryText, isActiveFilter]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [rulesRes, groupsRes] = await Promise.all([
        apiFetch(`/auto-replies${query ? `?${query}` : ""}`),
        apiFetch("/groups")
      ]);
      const nextGroups = groupsRes.groups || [];
      setItems(rulesRes.items || []);
      setGroups(nextGroups);
      const nextGroupId = searchParams.get("groupId") || groupId || nextGroups[0]?.id || "";
      setGroupId(nextGroupId);
      if (nextGroupId && !form.groupId) {
        setForm((current) => ({ ...current, groupId: nextGroupId }));
      }
    } catch (err) {
      setError(err.message || "無法載入關鍵字自動回覆");
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
      if (!form.groupId.trim() || !form.keyword.trim() || !form.responseText.trim()) {
        throw new Error("請先填寫群組、關鍵字與回覆內容");
      }

      await apiFetch("/auto-replies", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          cooldownSeconds: Number(form.cooldownSeconds || 0),
          responseFlex: safeJson(form.responseFlex)
        })
      });
      setForm({ ...emptyForm, groupId: form.groupId });
      setSuccess("關鍵字回覆已新增");
      await load();
    } catch (err) {
      setError(err.message || "新增失敗");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!confirm("確定要刪除這條關鍵字回覆嗎？")) return;
    setDeletingId(ruleId);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/auto-replies/${ruleId}`, { method: "DELETE" });
      setSuccess("關鍵字回覆已刪除");
      await load();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  };

  const clearFiltered = async () => {
    if (!confirm("確定要刪除目前篩選到的關鍵字回覆嗎？")) return;
    setClearing(true);
    setError("");
    setSuccess("");
    try {
      const params = new URLSearchParams();
      if (groupId) params.set("groupId", groupId);
      if (queryText.trim()) params.set("q", queryText.trim());
      if (isActiveFilter === "active") params.set("isActive", "true");
      if (isActiveFilter === "inactive") params.set("isActive", "false");

      const result = await apiFetch(`/auto-replies${params.toString() ? `?${params.toString()}` : ""}`, {
        method: "DELETE"
      });
      setSuccess(`已刪除 ${result.deletedCount || 0} 筆關鍵字回覆`);
      await load();
    } catch (err) {
      setError(err.message || "批次刪除失敗");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Shell title="關鍵字自動回覆" subtitle="設定群組關鍵字命中後要自動回覆的內容。">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-2">
          <Select label="群組" value={groupId} onChange={(value) => setGroupId(value)}>
            <option value="">請選擇群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Input label="關鍵字搜尋" value={queryText} onChange={(value) => setQueryText(value)} placeholder="搜尋關鍵字或回覆內容" />
          <Select label="狀態" value={isActiveFilter} onChange={(value) => setIsActiveFilter(value)}>
            <option value="all">全部</option>
            <option value="active">啟用</option>
            <option value="inactive">停用</option>
          </Select>
          <Select label="比對方式" value={form.matchType} onChange={(value) => setForm({ ...form, matchType: value })}>
            <option value="EXACT">完全比對</option>
            <option value="CONTAINS">包含比對</option>
            <option value="REGEX">正則比對</option>
          </Select>
          <Select label="回覆類型" value={form.responseType} onChange={(value) => setForm({ ...form, responseType: value })}>
            <option value="TEXT">文字</option>
            <option value="FLEX">Flex Message JSON</option>
          </Select>
          <Input
            label="冷卻時間（秒）"
            type="number"
            value={form.cooldownSeconds}
            onChange={(value) => setForm({ ...form, cooldownSeconds: value })}
          />
        </div>

        <div className="mt-4 grid gap-4">
          <Input label="關鍵字" value={form.keyword} onChange={(value) => setForm({ ...form, keyword: value })} placeholder="例如：你好" />
          <TextArea label="回覆文字" value={form.responseText} onChange={(value) => setForm({ ...form, responseText: value })} />
          <TextArea label="Flex JSON（選填）" value={form.responseFlex} onChange={(value) => setForm({ ...form, responseFlex: value })} />
          <ToggleRow label="啟用" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={create}
            disabled={saving || !form.groupId || !form.keyword || !form.responseText}
            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? "儲存中..." : "新增回覆"}
          </button>
          <button
            onClick={clearFiltered}
            disabled={clearing || items.length === 0}
            className="rounded-2xl border border-rose-400/30 px-4 py-3 text-sm font-medium text-rose-100 disabled:opacity-50"
          >
            {clearing ? "刪除中..." : "刪除目前篩選"}
          </button>
        </div>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}
      {success ? <Alert tone="emerald">{success}</Alert> : null}

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard label="載入回覆規則中..." /> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{matchLabel(item.matchType)}</Badge>
              <Badge tone="emerald">{responseLabel(item.responseType)}</Badge>
              <Badge tone={item.isActive ? "emerald" : "rose"}>{item.isActive ? "啟用" : "停用"}</Badge>
              <span className="text-xs text-slate-400">命中 {item.hitCount || 0} 次</span>
              {item.status === "VERIFIED" ? <Badge tone="emerald">已綁定（永久）</Badge> : null}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-50">{item.keyword}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{item.responseText}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => deleteRule(item.id)}
                disabled={deletingId === item.id}
                className="rounded-2xl border border-rose-400/30 px-3 py-2 text-sm text-rose-100 disabled:opacity-50"
              >
                {deletingId === item.id ? "刪除中..." : "刪除"}
              </button>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <EmptyState title="目前沒有關鍵字回覆規則" /> : null}
      </div>
    </Shell>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      />
    </label>
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

function TextArea({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="font-medium text-slate-100">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
      />
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border transition ${
        checked ? "border-emerald-300/40 bg-emerald-500/35" : "border-white/15 bg-slate-700/70"
      }`}
    >
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

function matchLabel(value) {
  const map = {
    EXACT: "完全比對",
    CONTAINS: "包含比對",
    REGEX: "正則比對"
  };
  return map[value] || value;
}

function responseLabel(value) {
  const map = { TEXT: "文字", FLEX: "Flex" };
  return map[value] || value;
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
    <Shell title={title} subtitle="載入中...">
      <LoadingCard label="載入中..." />
    </Shell>
  );
}
