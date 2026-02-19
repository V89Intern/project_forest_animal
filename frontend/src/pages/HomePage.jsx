import React from "react";

export function HomePage() {
  return (
    <div className="min-h-screen text-slate-100 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_20%_20%,#14263f_0%,#080d17_45%,#04070d_100%)]">
      <main className="rounded-2xl p-8 w-full max-w-2xl border border-white/20 bg-white/5 backdrop-blur-md">
        <h1 className="text-3xl font-semibold tracking-wide mb-2">Digital Magic Forest</h1>
        <p className="text-slate-300 mb-6">Choose a workspace to continue.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/operator" className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 p-5 hover:bg-cyan-400/20 transition">
            <div className="text-lg font-semibold">Operator Dashboard</div>
            <div className="text-sm text-slate-300 mt-1">Capture, review, approve, clear forest</div>
          </a>

          <a href="/forest" className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 p-5 hover:bg-emerald-400/20 transition">
            <div className="text-lg font-semibold">Forest Display</div>
            <div className="text-sm text-slate-300 mt-1">3D Forest runtime view</div>
          </a>

          <a href="/scan" className="rounded-xl border border-violet-300/40 bg-violet-400/10 p-5 hover:bg-violet-400/20 transition">
            <div className="text-lg font-semibold">📱 Mobile Scan</div>
            <div className="text-sm text-slate-300 mt-1">ใช้โทรศัพท์สแกนสัตว์เข้าป่า</div>
          </a>
        </div>
      </main>
    </div>
  );
}

