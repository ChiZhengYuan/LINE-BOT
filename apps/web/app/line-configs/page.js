"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../lib/api";
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
  const user = getUser();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setError(err.message || "無法載入 LINE 綁定");
    } finally {
      setLoading(false);
    }
  }

  const beginCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setError("");
    setSuccess("");
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
      isActive: Boolean(item.isActive),
      isDefault: Boolean(item.isDefault)
    });
    setError("");
    setSuccess("");
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        configName: form.configName.trim(),
        channelId: form.channelId.trim(),
        basicId: form.basicId.trim() || null,
        botId: form.botId.trim() || null,
        webhookUrl: form.webhookUrl.trim() || null,
        webhookToken: form.webhookToken.trim() || null,
        isActive: form.isActive,
        isDefault: form.isDefault
      };

      if (!editingId || form.channelSecret.trim()) payload.channelSecret = form.channelSecret.trim();
      if (!editingId || form.channelAccessToken.trim()) payload.channelAccessToken = form.channelAccessToken.trim();

      const endpoint = editingId ? `/line-configs/${editingId}` : "/line-configs";
      const method = editingId ? "PATCH" : "POST";
      const result = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      setSuccess(editingId ? "LINE 綁定已更新完成" : "LINE 綁定已新增完成");
      await load();
      beginCreate();
      if (!editingId && result?.item?.id) {
        setEditingId(result.item.id);
      }
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const testConfig = async (id) => {
    setTestingId(id);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/line-configs/${id}/test`, { method: "POST" });
      setSuccess("綁定驗證成功，已標記為永久綁定");
      await load();
    } catch (err) {
      setError(err.message || "測試失敗");
    } finally {
      setTestingId(null);
    }
  };

  const removeConfig = async (id) => {
    if (!confirm("確定要刪除這組 LINE 綁定嗎？")) return;
    setDeletingId(id);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/line-configs/${id}`, { method: "DELETE" });
      setSuccess("LINE 綁定已刪除");
      await load();
      if (editingId === id) beginCreate();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Shell
      title="LINE 綁定"
      subtitle={isSuperAdmin ? "超級管理員可查看所有租戶的 LINE 綁定設定。" : "請在這裡管理你自己的 LINE Developers 綁定。"}
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">綁定清單</h2>
              <p className="mt-1 text-sm text-slate-300">已建立的 LINE Developers 綁定會顯示在這裡。</p>
            </div>
            <button onClick={beginCreate} className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950">
              新增綁定
            </button>
          </div>

          {success ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {success}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {loading ? (
              <CardSkeleton />
            ) : items.length ? (
              items.map((item) => (
                <ConfigCard
                  key={item.id}
                  item={item}
                  testing={testingId === item.id}
                  deleting={deletingId === item.id}
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
            <h2 className="text-lg font-semibold text-slate-100">{editingItem ? "編輯綁定" : "新增綁定"}</h2>
            <p className="mt-1 text-sm text-slate-300">填入 LINE Developers 設定後按儲存即可。測試成功會顯示「已綁定（永久）」。</p>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

          <form className="mt-4 space-y-4" onSubmit={saveConfig}>
            <Field label="名稱" value={form.configName} onChange={(value) => setForm((prev) => ({ ...prev, configName: value }))} />
            <Field label="Channel ID" value={form.channelId} onChange={(value) => setForm((prev) => ({ ...prev, channelId: value }))} />
            <Field
              label="Channel Secret"
              type="password"
              value={form.channelSecret}
              onChange={(value) => setForm((prev) => ({ ...prev, channelSecret: value }))}
              placeholder={editingItem ? "留空表示不變更" : "請輸入 LINE Channel Secret"}
            />
            <Field
              label="Channel Access Token"
              type="password"
              value={form.channelAccessToken}
              onChange={(value) => setForm((prev) => ({ ...prev, channelAccessToken: value }))}
              placeholder={editingItem ? "留空表示不變更" : "請輸入 LINE Access Token"}
            />
            <Field label="Basic ID" value={form.basicId} onChange={(value) => setForm((prev) => ({ ...prev, basicId: value }))} />
            <Field label="Bot ID" value={form.botId} onChange={(value) => setForm((prev) => ({ ...prev, botId: value }))} />
            <Field
              label="Webhook URL"
              value={form.webhookUrl}
              onChange={(value) => setForm((prev) => ({ ...prev, webhookUrl: value }))}
              placeholder="例如：https://line-group-manager-api.onrender.com/api/webhooks/line"
            />
            <Field
              label="Webhook Token"
              value={form.webhookToken}
              onChange={(value) => setForm((prev) => ({ ...prev, webhookToken: value }))}
              placeholder="留空系統會自動產生"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle label="啟用" checked={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
              <Toggle label="設為預設" checked={form.isDefault} onChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))} />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {saving ? "儲存中..." : editingItem ? "儲存變更" : "確認新增"}
              </button>
              <button type="button" onClick={beginCreate} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200">
                清空
              </button>
            </div>
          </form>
        </section>
      </div>
    </Shell>
  );
}

function ConfigCard({ item, testing, deleting, onEdit, onTest, onDelete }) {
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
            {item.status === "VERIFIED" ? (
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-100">已綁定（永久）</span>
            ) : null}
          </div>
          <div className="mt-2 text-sm text-slate-300">Channel ID：{item.channelId}</div>
          <div className="mt-1 text-xs text-slate-400">
            Webhook：{item.webhookUrl || "未填"} ｜ Token：{item.webhookToken || "未設定"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onEdit} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-100">
          編輯
        </button>
        <button
          onClick={onTest}
          disabled={testing}
          className="rounded-2xl border border-cyan-400/30 px-3 py-2 text-sm text-cyan-100 disabled:opacity-60"
        >
          {testing ? "測試中..." : "測試"}
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded-2xl border border-rose-400/30 px-3 py-2 text-sm text-rose-100 disabled:opacity-60"
        >
          {deleting ? "刪除中..." : "刪除"}
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
      尚未建立任何 LINE 綁定，請先新增一筆。
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
