"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "../../lib/api";
import { Shell } from "../../components/Shell";

const programs = [
  {
    name: "業務管理與貸款契約系統",
    description: "快速前往另一套管理系統，提供業務與合約流程入口。",
    href: "https://loan-agreement-test.vercel.app/superadmin.html",
    actionLabel: "前往開啟"
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
    <Shell
      title="更多程式"
      subtitle="只有最高權限者可見，這裡放常用系統入口，方便快速切換。"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {programs.map((program, index) =>
          program ? (
            <a
              key={program.name}
              href={program.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5 shadow-glow backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-400/15"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/20 text-lg font-semibold text-cyan-100">
                {index + 1}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-50">{program.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{program.description}</p>
              <div className="mt-5 inline-flex rounded-full border border-cyan-200/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-50 transition group-hover:bg-cyan-300/15">
                {program.actionLabel}
              </div>
            </a>
          ) : (
            <div
              key={`empty-${index}`}
              className="flex min-h-40 flex-col justify-between rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-slate-400"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 text-sm text-slate-300">
                {index + 1}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-200">尚未新增</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  這個位置保留給未來要加入的其他系統入口。
                </p>
              </div>
              <div className="text-xs text-slate-500">預留空位</div>
            </div>
          )
        )}
      </div>
    </Shell>
  );
}
