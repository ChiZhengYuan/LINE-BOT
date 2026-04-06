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
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "VIEWER"
  });

  const load = async () => {
    const data = await apiFetch("/admins");
    setAdmins(data.admins || []);
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
    await apiFetch("/admins", {
      method: "POST",
      body: JSON.stringify(form)
    });
    setForm({ email: "", name: "", password: "", role: "VIEWER" });
    await load();
  };

  const saveAdmin = async (adminId, payload) => {
    await apiFetch(`/admins/${adminId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await load();
  };

  const deleteAdmin = async (adminId) => {
    await apiFetch(`/admins/${adminId}`, {
      method: "DELETE"
    });
    await load();
  };

  return (
    <Shell title="管理員" subtitle="建立與維護後台帳號與角色">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <h2 className="text-xl font-semibold">新增管理員</h2>
        <form onSubmit={createAdmin} className="mt-4 grid gap-4 lg:grid-cols-4">
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            placeholder="姓名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            placeholder="密碼"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button
            type="submit"
            disabled={!canWrite}
            className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50 lg:col-span-4"
          >
            建立管理員
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {admins.map((admin) => (
          <AdminCard
            key={admin.id}
            admin={admin}
            canWrite={canWrite}
            onSave={saveAdmin}
            onDelete={deleteAdmin}
          />
        ))}
        {admins.length === 0 ? <div className="text-sm text-slate-400">目前還沒有管理員。</div> : null}
      </div>
    </Shell>
  );
}

function AdminCard({ admin, canWrite, onSave, onDelete }) {
  const [name, setName] = useState(admin.name || "");
  const [email, setEmail] = useState(admin.email);
  const [role, setRole] = useState(admin.role);
  const [password, setPassword] = useState("");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.8fr_1fr_auto] lg:items-end">
        <Field label="Email" value={email} onChange={setEmail} disabled={!canWrite} />
        <Field label="姓名" value={name} onChange={setName} disabled={!canWrite} />
        <label className="block text-sm text-slate-300">
          角色
          <select
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={!canWrite}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>
        <Field label="新密碼" value={password} onChange={setPassword} disabled={!canWrite} type="password" />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 disabled:opacity-50"
            disabled={!canWrite}
            onClick={() => onSave(admin.id, { email, name, role, ...(password ? { password } : {}) })}
          >
            儲存
          </button>
          <button
            type="button"
            className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 disabled:opacity-50"
            disabled={!canWrite}
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
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
