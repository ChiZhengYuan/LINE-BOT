"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "../lib/api";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center text-slate-200">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5">載入中...</div>
    </div>
  );
}
