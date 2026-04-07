"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearToken, getUser } from "../lib/api";

export function Shell({ children, title, subtitle }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    apiFetch("/notifications/unread-count")
      .then((result) => setUnreadCount(result.unreadCount || 0))
      .catch(() => {});
  }, [mounted, pathname, user]);

  const role = user?.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdminLike = role === "ADMIN" || role === "SUPER_ADMIN";
  const isManagerLike = isAdminLike || role === "MANAGER";

  const navItems = useMemo(() => {
    const items = [
      { href: "/dashboard", label: "儀表板" },
      { href: "/groups", label: "群組管理", show: isManagerLike },
      { href: "/members", label: "成員管理", show: isManagerLike },
      { href: "/violations", label: "違規紀錄" },
      { href: "/lists", label: "黑白名單" },
      { href: "/ai", label: "AI 判斷" },
      { href: "/notifications", label: "通知中心" },
      { href: "/operation-logs", label: "操作日誌", show: isManagerLike },
      { href: "/loan-cases", label: "貸款案件", show: isManagerLike },
      { href: "/daily-reports", label: "每日匯報", show: isManagerLike },
      { href: "/reports", label: "統計報表", show: isManagerLike },
      { href: "/reminder-center", label: "提醒中心", show: isManagerLike },
      { href: "/welcome", label: "新人歡迎", show: isManagerLike },
      { href: "/announcements", label: "定時公告", show: isManagerLike },
      { href: "/auto-replies", label: "關鍵字回覆", show: isManagerLike },
      { href: "/checkins", label: "每日簽到", show: isManagerLike },
      { href: "/missions", label: "任務", show: isManagerLike },
      { href: "/lotteries", label: "抽獎", show: isManagerLike },
      { href: "/rankings", label: "排行榜", show: isManagerLike },
      { href: "/telegram", label: "Telegram", show: isAdminLike },
      { href: "/line-configs", label: "LINE 綁定", show: isAdminLike },
      { href: "/admins", label: "管理員", show: isSuperAdmin },
      { href: "/super-admin", label: "超級系統", show: isSuperAdmin },
      { href: "/more-programs", label: "更多程式", show: isAdminLike }
    ];

    return items.filter((item) => item.show !== false);
  }, [isAdminLike, isManagerLike, isSuperAdmin]);

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

            <p className="mb-6 text-sm text-slate-300">LINE 群組管理後台</p>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
              <div className="flex min-w-0 items-start gap-3">
                <Link href="/dashboard" className="flex shrink-0 items-center gap-2 lg:hidden" aria-label="LINE Group Manager">
                  <Image
                    src="/brand-logo.png"
                    alt="LINE Group Manager logo"
                    width={34}
                    height={34}
                    className="h-9 w-9 rounded-xl border border-white/10 bg-slate-950/70 object-contain p-1"
                    priority
                  />
                </Link>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold sm:text-2xl">{title}</h1>
                  <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">{subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch("/notifications", { method: "DELETE" });
                      setUnreadCount(0);
                    } catch {
                      // ignore
                    } finally {
                      router.push("/notifications");
                    }
                  }}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 text-slate-100 hover:bg-slate-900"
                  aria-label="??????"
                >
                  ??
                  {mounted && unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={logout}
                  className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900 sm:px-4 sm:py-2.5 sm:text-sm lg:hidden"
                >
                  登出
                </button>
              </div>
            </div>

            <div className="mt-4 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
