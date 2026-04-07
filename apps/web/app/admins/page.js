"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function AdminsPage() {
  const router = useRouter();
  const user = getUser();
  const canWrite = user?.role === "ADMIN";
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "VIEWER"
  });

  const load = async () => {
    setLoading(true);
    const data = await apiFetch("/admins");
    setAdmins(data.admins || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    load().catch(() => router.replace("/login"));
  }, [router]);

  const createAdmin = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await apiFetch("/admins", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ email: "", name: "", password: "", role: "VIEWER" });
      await load();
    } catch (err) {
      setError(err.message || "新增管理員失敗");
    } finally {
      setSaving(false);
    }
  };

  const saveAdmin = async (adminId, payload) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/admins/${adminId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      await load();
    } catch (err) {
      setError(err.message || "更新管理員失敗");
    } finally {
      setSaving(false);
    }
  };

  const deleteAdmin = async (adminId) => {
    if (!window.confirm("確定要刪除這位管理員嗎？")) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/admins/${adminId}`, {
        method: "DELETE"
      });
      await load();
    } catch (err) {
      setError(err.message || "刪除管理員失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="管理員" subtitle="手機版以卡片方式編輯帳號、角色與密碼。">
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
        <h2 className="text-xl font-semibold text-slate-50">新增管理員</h2>
        <form onSubmit={createAdmin} className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm({ ...form, email: value })}
            disabled={!canWrite}
          />
          <Field
            label="姓名"
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
            disabled={!canWrite}
          />
          <Field
            label="密碼"
            type="password"
            value={form.password}
            onChange={(value) => setForm({ ...form, password: value })}
            disabled={!canWrite}
          />
          <label className="block text-sm text-slate-300">
            權限
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={!canWrite}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={!canWrite || saving}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50 sm:col-span-2 xl:col-span-4"
          >
            {saving ? "建立中..." : "建立管理員"}
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">載入中...</div> : null}

        {admins.map((admin) => (
          <AdminCard
            key={admin.id}
            admin={admin}
            canWrite={canWrite}
            saving={saving}
            onSave={saveAdmin}
            onDelete={deleteAdmin}
          />
        ))}

        {!loading && admins.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
            目前沒有管理員資料。
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function AdminCard({ admin, canWrite, saving, onSave, onDelete }) {
  const [name, setName] = useState(admin.name || "");
  const [email, setEmail] = useState(admin.email);
  const [role, setRole] = useState(admin.role);
  const [password, setPassword] = useState("");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="cyan">{role}</Badge>
        <Badge tone="emerald">{admin.email}</Badge>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_1fr_auto] xl:items-end">
        <Field label="Email" value={email} onChange={setEmail} disabled={!canWrite || saving} />
        <Field label="姓名" value={name} onChange={setName} disabled={!canWrite || saving} />
        <label className="block text-sm text-slate-300">
          權限
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={!canWrite || saving}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>
        <Field label="新密碼" value={password} onChange={setPassword} disabled={!canWrite || saving} type="password" />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 disabled:opacity-50"
            disabled={!canWrite || saving}
            onClick={() => onSave(admin.id, { email, name, role, ...(password ? { password } : {}) })}
          >
            儲存
          </button>
          <button
            type="button"
            className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 disabled:opacity-50"
            disabled={!canWrite || saving}
            onClick={() => onDelete(admin.id)}
          >
            刪除
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        type={type}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
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
