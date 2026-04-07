"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken, setUser } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
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
        body: JSON.stringify({ email, password })
      });
      setToken(result.token);
      setUser(result.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur">
            <div className="flex items-center gap-4">
              <Image
                src="/brand-logo.png"
                alt="LINE Group Manager logo"
                width={64}
                height={64}
                className="h-16 w-16 rounded-3xl border border-white/10 bg-slate-950/70 object-contain p-2"
                priority
              />
              <div>
                <div className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">LINE GROUP MANAGER</div>
                <h1 className="mt-2 text-4xl font-semibold leading-tight">LINE 群組管理後台</h1>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-slate-300">
              這是一套使用官方 LINE Messaging API 的群組管理系統，可接收 webhook、做規則偵測、違規記錄與後台管理。
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {["Webhook 接收", "規則引擎", "JWT 後台登入"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-glow backdrop-blur">
            <h2 className="text-2xl font-semibold">登入</h2>
            <p className="mt-2 text-sm text-slate-400">請輸入管理員帳號與密碼</p>

            <label className="mt-6 block text-sm text-slate-300">
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0 focus:border-cyan-300/50"
                type="email"
              />
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              密碼
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0 focus:border-cyan-300/50"
                type="password"
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

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              預設帳密請看 `.env` 裡的 `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
