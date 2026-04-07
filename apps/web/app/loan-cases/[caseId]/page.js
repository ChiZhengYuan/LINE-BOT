"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../../lib/api";
import { Shell } from "../../../components/Shell";

const emptyForm = {
  customerName: "",
  phone: "",
  lineDisplayName: "",
  caseType: "",
  amount: "",
  status: "SUBMITTING",
  ownerStaff: "",
  note: ""
};

export default function LoanCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.caseId;
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch(`/loans/cases/${caseId}`);
      setItem(result.item);
      setForm({
        customerName: result.item?.customerName || "",
        phone: result.item?.phone || "",
        lineDisplayName: result.item?.lineDisplayName || "",
        caseType: result.item?.caseType || "",
        amount: result.item?.amount ?? "",
        status: result.item?.status || "SUBMITTING",
        ownerStaff: result.item?.ownerStaff || "",
        note: result.item?.note || ""
      });
    } catch (err) {
      setError(err.message || "無法載入案件詳情");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (caseId) {
      load().catch(() => router.replace("/login"));
    }
  }, [caseId, router]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/loans/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          amount: form.amount === "" ? null : Number(form.amount)
        })
      });
      await load();
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const sendReminder = async (reminderId) => {
    await apiFetch(`/loans/reminders/${reminderId}/send`, { method: "POST" });
    await load();
  };

  return (
    <Shell title="案件詳情" subtitle="查看狀態軌跡、提醒與更新紀錄">
      <Link href="/loan-cases" className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
        返回案件列表
      </Link>

      {error ? <Alert tone="rose">{error}</Alert> : null}
      {loading ? <LoadingCard label="載入案件中..." /> : null}

      {item ? (
        <div className="mt-6 space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{statusLabel(item.status)}</Badge>
              <Badge tone="emerald">{item.group?.name || item.group?.lineGroupId}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="姓名" value={item.customerName} />
              <Metric label="電話" value={item.phone || "未填"} />
              <Metric label="方案 / 車種" value={item.caseType || "未填"} />
              <Metric label="金額" value={formatAmount(item.amount)} />
              <Metric label="業務" value={item.ownerStaff || "未填"} />
              <Metric label="來源群組" value={item.sourceGroupId} />
              <Metric label="來源訊息" value={item.sourceMessageId} />
              <Metric label="更新時間" value={formatTime(item.updatedAt)} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-50">編輯案件</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="姓名" value={form.customerName} onChange={(value) => setForm({ ...form, customerName: value })} />
              <Input label="電話" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <Input label="LINE 名稱" value={form.lineDisplayName} onChange={(value) => setForm({ ...form, lineDisplayName: value })} />
              <Input label="方案 / 車種" value={form.caseType} onChange={(value) => setForm({ ...form, caseType: value })} />
              <Input label="金額" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
              <Input label="業務" value={form.ownerStaff} onChange={(value) => setForm({ ...form, ownerStaff: value })} />
              <Select label="狀態" value={form.status} onChange={(value) => setForm({ ...form, status: value })}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mt-4">
              <TextArea label="備註" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
            </div>
            <button onClick={save} disabled={saving} className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {saving ? "儲存中..." : "儲存變更"}
            </button>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-50">狀態紀錄</h2>
            <div className="mt-4 space-y-3">
              {(item.statusLogs || []).map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{statusLabel(log.toStatus)}</Badge>
                    <span className="text-xs text-slate-400">{formatTime(log.createdAt)}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {log.fromStatus ? `${statusLabel(log.fromStatus)} → ` : "新增案件 → "}
                    {statusLabel(log.toStatus)}
                  </div>
                  {log.note ? <div className="mt-1 text-sm text-slate-400">{log.note}</div> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-50">提醒中心</h2>
            <div className="mt-4 space-y-3">
              {(item.reminders || []).map((reminder) => (
                <div key={reminder.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="cyan">{reminderLabel(reminder.reminderType)}</Badge>
                    <Badge tone={reminder.status === "SENT" ? "emerald" : "rose"}>{reminder.status === "SENT" ? "已送出" : "待處理"}</Badge>
                    <span className="text-xs text-slate-400">{formatTime(reminder.createdAt)}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{reminder.message}</div>
                  {reminder.status !== "SENT" ? (
                    <button onClick={() => sendReminder(reminder.id)} className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                      發送提醒
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none" />
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
  return <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">{label}</div>;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function statusLabel(value) {
  return statusLabels[value] || value;
}

function reminderLabel(value) {
  const map = {
    NEW_CASE: "今日新進件",
    STALE_UPDATE: "超過1天未更新",
    SUPPLEMENT_OVERDUE: "待補件超過2天",
    APPROVED_WAIT_SIGN: "已核准未簽約",
    SIGNED_WAIT_DISBURSE: "已簽約未撥款"
  };
  return map[value] || value;
}

function formatAmount(value) {
  const amount = Number(value || 0);
  if (!amount) return "";
  if (amount >= 10000 && amount % 10000 === 0) {
    return `${amount / 10000}萬`;
  }
  return String(amount);
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-TW");
  } catch {
    return "";
  }
}

const statusLabels = {
  SUBMITTING: "送件中",
  SUBMITTED: "已送件",
  REVIEWING: "審核中",
  APPROVED: "已核准",
  SIGNED: "已簽約",
  DISBURSED: "已撥款",
  NEED_SUPPLEMENT: "待補件",
  POSTPONED: "暫緩",
  REJECTED: "退件"
};
