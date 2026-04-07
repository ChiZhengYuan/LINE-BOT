"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "../../lib/api";
import { Shell } from "../../components/Shell";

const slots = [
  {
    name: "業務管理與貸款契約系統",
    url: "https://loan-agreement-test.vercel.app/superadmin.html",
    description: "超級管理員入口"
  },
  null,
  null,
  null,
  null
];

export default function MoreProgramsPage() {
  const router = useRouter();
  const user = getUser();
  const canView = user?.role === "ADMIN";

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    if (!canView) {
      router.replace("/dashboard");
    }
  }, [router, canView]);

  return (
    <Shell title="更多程式" subtitle="只有最大權限者可以看到這個入口，下面有 5 個可填入的小方框。">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {slots.map((slot, index) =>
          slot ? (
            <a
              key={slot.name}
              href={slot.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5 shadow-glow backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-400/15"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/20 text-lg font-bold text-cyan-100">
                {index + 1}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-50">{slot.name}</h2>
              <p className="mt-2 text-sm text-slate-300">{slot.description}</p>
              <div className="mt-4 break-all text-xs text-cyan-100/80 underline decoration-cyan-300/40 underline-offset-4 group-hover:text-cyan-50">
                {slot.url}
              </div>
            </a>
          ) : (
            <div
              key={`empty-${index}`}
              className="flex min-h-40 flex-col justify-between rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-slate-400"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 text-sm">
                {index + 1}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-200">尚未設定</h2>
                <p className="mt-2 text-sm text-slate-500">這裡可以再新增一個程式入口。</p>
              </div>
              <div className="text-xs text-slate-500">預留位置</div>
            </div>
          )
        )}
      </div>
    </Shell>
  );
}
