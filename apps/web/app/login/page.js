"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken, setUser } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("superadmin");
  const [password, setPassword] = useState("Admin12345!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: account, account, email: account, password })
      });
      setToken(result.token);
      setUser(result.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "登入失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Image
                src="/brand-logo.png"
                alt="LINE Group Manager logo"
                width={80}
                height={80}
                className="h-16 w-16 rounded-3xl border border-white/10 bg-slate-950/70 object-contain p-2"
                priority
              />
              <div>
                <div className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">LINE GROUP MANAGER</div>
                <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                  LINE 群組管理系統
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              透過 LINE Messaging API 管理群組訊息、違規、黑名單與通知，手機也能方便操作。
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Webhook 即時處理", "規則集中管理", "手機友善後台"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <form
            onSubmit={submit}
            className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-glow backdrop-blur sm:p-8"
          >
            <h2 className="text-2xl font-semibold">登入後台</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              使用管理員帳號登入後即可進入儀表板與各項設定頁面。
            </p>

            <label className="mt-6 block text-sm text-slate-300">
              帳號 / Email
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0 focus:border-cyan-300/50"
                type="text"
                autoComplete="username"
                placeholder="superadmin 或你的帳號"
              />
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              密碼
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0 focus:border-cyan-300/50"
                type="password"
                autoComplete="current-password"
              />
            </label>

            {error ? <div className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {loading ? "登入中..." : "登入後台"}
            </button>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              有任何問題請加開發者LINE:nostalgai。
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
