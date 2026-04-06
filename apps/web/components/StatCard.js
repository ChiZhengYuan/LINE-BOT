export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="text-sm text-slate-300">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-2 text-xs text-slate-400">{hint}</div>
    </div>
  );
}
