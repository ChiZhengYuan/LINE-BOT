"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const initialForm = {
  configName: "",
  channelId: "",
  channelSecret: "",
  channelAccessToken: "",
  basicId: "",
  botId: "",
  webhookUrl: "",
  webhookToken: "",
  isActive: true,
  isDefault: false
};

export default function LineConfigsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const editingItem = useMemo(() => items.find((item) => item.id === editingId) || null, [items, editingId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/line-configs");
      setItems(result.items || []);
    } catch (err) {
      setError(err.message || "載入 LINE 設定失敗");
    } finally {
      setLoading(false);
    }
  }

  const beginCreate = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  const beginEdit = (item) => {
    setEditingId(item.id);
    setForm({
      configName: item.configName || "",
      channelId: item.channelId || "",
      channelSecret: "",
      channelAccessToken: "",
      basicId: item.basicId || "",
      botId: item.botId || "",
      webhookUrl: item.webhookUrl || "",
      webhookToken: item.webhookToken || "",
      isActive: item.isActive,
      isDefault: item.isDefault
    });
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        configName: form.configName,
        channelId: form.channelId,
        basicId: form.basicId || null,
        botId: form.botId || null,
        webhookUrl: form.webhookUrl || null,
        webhookToken: form.webhookToken || null,
        isActive: form.isActive,
        isDefault: form.isDefault
      };
      if (!editingId || form.channelSecret) payload.channelSecret = form.channelSecret;
      if (!editingId || form.channelAccessToken) payload.channelAccessToken = form.channelAccessToken;

      if (editingId) {
        await apiFetch(`/line-configs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/line-configs", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      beginCreate();
      await load();
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const testConfig = async (id) => {
    setTestingId(id);
    setError("");
    try {
      await apiFetch(`/line-configs/${id}/test`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err.message || "測試失敗");
    } finally {
      setTestingId(null);
    }
  };

  const removeConfig = async (id) => {
    if (!confirm("確定要刪除此 LINE 設定嗎？")) return;
    try {
      await apiFetch(`/line-configs/${id}`, { method: "DELETE" });
      await load();
      if (editingId === id) beginCreate();
    } catch (err) {
      setError(err.message || "刪除失敗");
    }
  };

  return (
    <Shell title="LINE 綁定" subtitle="每個租戶可綁定自己的 LINE Developers 設定，並獨立驗證 webhook。">
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">設定列表</h2>
              <p className="mt-1 text-sm text-slate-300">可建立多組 LINE Developers 設定，並指定一組預設。</p>
            </div>
            <button onClick={beginCreate} className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950">
              新增設定
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <CardSkeleton />
            ) : items.length ? (
              items.map((item) => (
                <ConfigCard
                  key={item.id}
                  item={item}
                  testing={testingId === item.id}
                  onEdit={() => beginEdit(item)}
                  onTest={() => testConfig(item.id)}
                  onDelete={() => removeConfig(item.id)}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{editingItem ? "編輯設定" : "新增設定"}</h2>
            <p className="mt-1 text-sm text-slate-300">Secret / Token 只在建立或更新時輸入，畫面會遮罩顯示。</p>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

          <form className="mt-4 space-y-4" onSubmit={saveConfig}>
            <Field label="名稱" value={form.configName} onChange={(value) => setForm((prev) => ({ ...prev, configName: value }))} />
            <Field label="Channel ID" value={form.channelId} onChange={(value) => setForm((prev) => ({ ...prev, channelId: value }))} />
            <Field label="Channel Secret" type="password" value={form.channelSecret} onChange={(value) => setForm((prev) => ({ ...prev, channelSecret: value }))} placeholder={editingItem ? "留空表示不更新" : "輸入 LINE Channel Secret"} />
            <Field label="Channel Access Token" type="password" value={form.channelAccessToken} onChange={(value) => setForm((prev) => ({ ...prev, channelAccessToken: value }))} placeholder={editingItem ? "留空表示不更新" : "輸入 LINE Access Token"} />
            <Field label="Basic ID" value={form.basicId} onChange={(value) => setForm((prev) => ({ ...prev, basicId: value }))} />
            <Field label="Bot ID" value={form.botId} onChange={(value) => setForm((prev) => ({ ...prev, botId: value }))} />
            <Field label="Webhook URL" value={form.webhookUrl} onChange={(value) => setForm((prev) => ({ ...prev, webhookUrl: value }))} placeholder="可填 LINE Developers 或服務專屬網址" />
            <Field label="Webhook Token" value={form.webhookToken} onChange={(value) => setForm((prev) => ({ ...prev, webhookToken: value }))} placeholder="留空會自動產生" />

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle label="啟用" checked={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              <Toggle label="預設設定" checked={form.isDefault} onChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))} />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {saving ? "儲存中..." : editingItem ? "更新設定" : "建立設定"}
              </button>
              <button type="button" onClick={beginCreate} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200">
                清除
              </button>
            </div>
          </form>
        </section>
      </div>
    </Shell>
  );
}

function ConfigCard({ item, testing, onEdit, onTest, onDelete }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs text-cyan-100">{item.configName}</span>
            {item.isDefault ? <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-100">預設</span> : null}
            <span className={`rounded-full px-3 py-1 text-xs ${item.isActive ? "bg-lime-400/15 text-lime-100" : "bg-rose-400/15 text-rose-100"}`}>
              {item.isActive ? "啟用" : "停用"}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs ${item.status === "VERIFIED" ? "bg-cyan-400/15 text-cyan-100" : item.status === "FAILED" ? "bg-rose-400/15 text-rose-100" : "bg-slate-600/30 text-slate-200"}`}>
              {statusLabel(item.status)}
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-300">Channel ID：{item.channelId}</div>
          <div className="mt-1 text-xs text-slate-400">
            Webhook：{item.webhookUrl || "未設定"} · Token：{item.webhookToken || "自動產生"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onEdit} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-100">
          編輯
        </button>
        <button onClick={onTest} disabled={testing} className="rounded-2xl border border-cyan-400/30 px-3 py-2 text-sm text-cyan-100 disabled:opacity-60">
          {testing ? "測試中..." : "測試"}
        </button>
        <button onClick={onDelete} className="rounded-2xl border border-rose-400/30 px-3 py-2 text-sm text-rose-100">
          刪除
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-slate-300">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/40"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
        checked ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-slate-950/40 text-slate-200"
      }`}
    >
      <span>{label}</span>
      <span className={`inline-flex h-6 w-11 items-center rounded-full p-1 ${checked ? "bg-cyan-400" : "bg-slate-600"}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-10 text-center text-sm text-slate-400">
      目前沒有 LINE Developers 設定，請先新增一組。
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-3xl bg-white/5" />
      <div className="h-24 animate-pulse rounded-3xl bg-white/5" />
    </div>
  );
}

function statusLabel(status) {
  if (status === "VERIFIED") return "已驗證";
  if (status === "FAILED") return "驗證失敗";
  return "待驗證";
}
