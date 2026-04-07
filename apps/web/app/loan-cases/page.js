"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

const emptyFilters = {
  groupId: "",
  q: "",
  status: "",
  ownerStaff: "",
  sortBy: "updatedAt",
  sortDir: "desc"
};

const emptyForm = {
  groupId: "",
  customerName: "",
  phone: "",
  lineDisplayName: "",
  caseType: "",
  amount: "",
  status: "SUBMITTING",
  ownerStaff: "",
  note: ""
};

export default function LoanCasesPage() {
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [filters, page, limit]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [casesRes, groupsRes] = await Promise.all([
        apiFetch(`/loans/cases?${query}`),
        apiFetch("/groups")
      ]);
      const nextGroups = groupsRes.groups || [];
      setItems(casesRes.items || []);
      setTotal(casesRes.total || 0);
      setGroups(nextGroups);
      if (!form.groupId && nextGroups[0]?.id) {
        setForm((current) => ({ ...current, groupId: nextGroups[0].id }));
      }
    } catch (err) {
      setError(err.message || "無法載入貸款案件");
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
    try {
      await apiFetch("/loans/cases", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: form.amount === "" ? null : Number(form.amount)
        })
      });
      setForm((current) => ({
        ...emptyForm,
        groupId: current.groupId || groups[0]?.id || ""
      }));
      await load();
    } catch (err) {
      setError(err.message || "建立案件失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="貸款案件" subtitle="自動解析群組訊息與手動建案都會匯入這裡">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-4">
          <Select label="群組" value={filters.groupId} onChange={(value) => setFilters({ ...filters, groupId: value })}>
            <option value="">全部群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Input label="搜尋" value={filters.q} onChange={(value) => setFilters({ ...filters, q: value })} placeholder="姓名 / 電話 / 方案" />
          <Select label="狀態" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
            <option value="">全部狀態</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input label="業務" value={filters.ownerStaff} onChange={(value) => setFilters({ ...filters, ownerStaff: value })} />
          <Select label="排序欄位" value={filters.sortBy} onChange={(value) => setFilters({ ...filters, sortBy: value })}>
            <option value="updatedAt">更新時間</option>
            <option value="createdAt">建立時間</option>
            <option value="customerName">姓名</option>
            <option value="amount">金額</option>
            <option value="status">狀態</option>
          </Select>
          <Select label="排序方向" value={filters.sortDir} onChange={(value) => setFilters({ ...filters, sortDir: value })}>
            <option value="desc">由新到舊</option>
            <option value="asc">由舊到新</option>
          </Select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setFilters(emptyFilters);
              setPage(1);
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
          >
            重置
          </button>
          <button onClick={load} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
            重新載入
          </button>
        </div>
      </section>

      {error ? <Alert tone="rose">{error}</Alert> : null}

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-50">手動新增案件</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Select label="群組" value={form.groupId} onChange={(value) => setForm({ ...form, groupId: value })}>
            <option value="">請選擇群組</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || group.lineGroupId}
              </option>
            ))}
          </Select>
          <Input label="客戶姓名" value={form.customerName} onChange={(value) => setForm({ ...form, customerName: value })} />
          <Input label="電話" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <Input label="LINE 名稱" value={form.lineDisplayName} onChange={(value) => setForm({ ...form, lineDisplayName: value })} />
          <Input label="方案 / 車種" value={form.caseType} onChange={(value) => setForm({ ...form, caseType: value })} />
          <Input label="金額" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} placeholder="例如 35萬" />
          <Select label="狀態" value={form.status} onChange={(value) => setForm({ ...form, status: value })}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input label="業務" value={form.ownerStaff} onChange={(value) => setForm({ ...form, ownerStaff: value })} />
        </div>
        <div className="mt-4">
          <TextArea label="備註" value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
        </div>
        <button onClick={create} disabled={saving || !form.groupId || !form.customerName} className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
          {saving ? "建立中..." : "建立 / 更新案件"}
        </button>
      </section>

      <div className="mt-6 space-y-4">
        {loading ? <LoadingCard label="載入案件中..." /> : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{statusLabel(item.status)}</Badge>
              <Badge tone="emerald">{item.group?.name || item.group?.lineGroupId}</Badge>
              {item.ownerStaff ? <Badge tone="emerald">{item.ownerStaff}</Badge> : null}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-50">{item.customerName}</div>
            <div className="mt-1 text-sm text-slate-300">
              {item.caseType || "未填方案"}
              {item.amount ? ` / ${formatAmount(item.amount)}` : ""}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {item.phone || "未填電話"}
              {item.lineDisplayName ? ` / ${item.lineDisplayName}` : ""}
            </div>
            {item.note ? <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">{item.note}</div> : null}
            <div className="mt-3 text-xs text-slate-500">更新時間：{formatTime(item.updatedAt)}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/loan-cases/${item.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                查看詳情
              </Link>
            </div>
          </article>
        ))}

        {!loading && items.length === 0 ? <EmptyState text="目前沒有貸款案件" /> : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          第 {page} 頁 / 共 {Math.max(1, Math.ceil(total / limit))} 頁
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
          >
            上一頁
          </button>
          <button
            disabled={page * limit >= total}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
          >
            下一頁
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Input({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
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
        rows={4}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none"
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

function EmptyState({ text }) {
  return <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">{text}</div>;
}

function statusLabel(value) {
  return statusLabels[value] || value;
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
