"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "../../lib/api";
import { Shell } from "../../components/Shell";

export default function ListsPage() {
  const router = useRouter();
  const [data, setData] = useState({ blacklist: [], whitelist: [] });
  const [groupId, setGroupId] = useState("");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState("blacklist");

  const load = async () => {
    const result = await apiFetch("/lists");
    setData(result);
  };

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch(() => {});
  }, [router]);

  const createItem = async (event) => {
    event.preventDefault();
    await apiFetch(`/groups/${groupId}/${kind}`, {
      method: "POST",
      body: JSON.stringify({ value })
    });
    setValue("");
    await load();
  };

  return (
    <Shell title="黑白名單" subtitle="管理群組的黑名單詞與白名單字串">
      <form onSubmit={createItem} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-3">
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            placeholder="Group ID"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          />
          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            placeholder="內容"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="blacklist">黑名單</option>
            <option value="whitelist">白名單</option>
          </select>
        </div>
        <button className="mt-4 rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">新增</button>
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="黑名單" items={data.blacklist} onRefresh={load} />
        <Section title="白名單" items={data.whitelist} onRefresh={load} />
      </div>
    </Shell>
  );
}

function Section({ title, items, onRefresh }) {
  const kind = title === "黑名單" ? "blacklist" : "whitelist";

  const remove = async (id) => {
    await apiFetch(`/lists/${kind}/${id}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <div>
              <div className="font-medium">{item.value}</div>
              <div className="text-xs text-slate-400">{item.group?.lineGroupId}</div>
            </div>
            <button className="rounded-xl border border-white/10 px-3 py-2 text-sm" onClick={() => remove(item.id)}>
              刪除
            </button>
          </div>
        ))}
        {items.length === 0 ? <div className="text-sm text-slate-400">尚無項目</div> : null}
      </div>
    </div>
  );
}
