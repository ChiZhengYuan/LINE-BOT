"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getUser } from "../lib/api";

export function Shell({ children, title, subtitle }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const isAdmin = user?.role === "ADMIN";
  const isManager = user?.role === "ADMIN" || user?.role === "MANAGER";

  const navItems = [
    { href: "/dashboard", label: "儀表板" },
    { href: "/groups", label: "群組管理", show: isManager },
    { href: "/violations", label: "違規紀錄" },
    { href: "/lists", label: "黑白名單" },
    { href: "/rules", label: "規則設定", show: isManager },
    { href: "/ai", label: "AI 判斷" },
    { href: "/telegram", label: "Telegram 設定", show: isAdmin },
    { href: "/admins", label: "管理員", show: isAdmin },
    { href: "/more-programs", label: "更多程式", show: isAdmin }
  ].filter((item) => item.show !== false);

  const logout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto min-h-screen max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:flex lg:gap-6 lg:px-8 lg:py-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
            <div className="mb-6 flex items-center gap-3">
              <Image
                src="/brand-logo.png"
                alt="LINE Group Manager logo"
                width={44}
                height={44}
                className="h-11 w-11 rounded-2xl border border-white/10 bg-slate-950/70 object-contain p-1.5"
                priority
              />
              <div>
                <div className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">LINE BOT</div>
                <div className="mt-1 text-xl font-semibold">Group Manager</div>
              </div>
            </div>

            <p className="mb-6 text-sm text-slate-300">LINE Messaging API 群組管理後台</p>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-2xl px-4 py-3 text-sm transition ${
                      active
                        ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={logout}
              className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
            >
              登出
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="sticky top-3 z-20 mb-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 shadow-glow backdrop-blur sm:top-4 sm:px-5 lg:static">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold sm:text-2xl">{title}</h1>
                <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">{subtitle}</p>
              </div>
              <button
                onClick={logout}
                className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900 sm:px-4 sm:py-2.5 sm:text-sm lg:hidden"
              >
                登出
              </button>
            </div>

            <div className="mt-4 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
                          : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
