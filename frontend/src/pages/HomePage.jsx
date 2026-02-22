import React, { useState } from "react";
import { useAuth } from "../main.jsx";

export function HomePage() {
  const { user, logout } = useAuth();
  const [showOperatorModal, setShowOperatorModal] = useState(false);

  return (
    <div className="min-h-screen text-slate-100 flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_20%_20%,#14263f_0%,#080d17_45%,#04070d_100%)]">
      <main className="rounded-2xl p-6 sm:p-8 w-full max-w-xl border border-white/20 bg-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide">Digital Magic Forest</h1>
          <div className="user-bar">
            <span>👤</span>
            <span className="user-name">{user?.name || ""}</span>
            <button className="logout-btn" onClick={logout}>ออก</button>
          </div>
        </div>
        <p className="text-slate-300 mb-6 text-sm sm:text-base">Choose a workspace to continue.</p>

        <div className="grid grid-cols-1 gap-4">
          {/* Operator — opens popup */}
          <button
            onClick={() => setShowOperatorModal(true)}
            className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 p-5 hover:bg-cyan-400/20 transition text-left w-full"
          >
            <div className="text-lg font-semibold">Operator Dashboard</div>
            <div className="text-sm text-slate-300 mt-1">Capture, review, approve, clear forest</div>
          </button>

          <a href="/forest" className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 p-5 hover:bg-emerald-400/20 transition">
            <div className="text-lg font-semibold">Forest Display</div>
            <div className="text-sm text-slate-300 mt-1">3D Forest runtime view</div>
          </a>
        </div>
      </main>

      {/* ── Operator Mode Popup ── */}
      {showOperatorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowOperatorModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900/95 backdrop-blur-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-2 text-center">เลือกโหมดใช้งาน</h2>
            <p className="text-sm text-slate-400 mb-5 text-center">คุณต้องการเปิด Operator ด้วยอุปกรณ์ใด?</p>

            <div className="grid grid-cols-1 gap-3">
              <a
                href="/operator"
                className="flex items-center gap-3 rounded-xl border border-cyan-300/40 bg-cyan-400/10 p-4 hover:bg-cyan-400/20 transition"
              >
                <span className="text-2xl">🖥️</span>
                <div>
                  <div className="font-semibold">ใช้บนคอมพิวเตอร์</div>
                  <div className="text-xs text-slate-300">Report & Dashboard สำหรับดูข้อมูลต่างๆ </div>
                </div>
              </a>

              <a
                href="/scan"
                className="flex items-center gap-3 rounded-xl border border-violet-300/40 bg-violet-400/10 p-4 hover:bg-violet-400/20 transition"
              >
                <span className="text-2xl">📱</span>
                <div>
                  <div className="font-semibold">ใช้บนมือถือ</div>
                  <div className="text-xs text-slate-300">สแกนภาพสัตว์เข้าป่า ใช้ง่ายบนจอเล็ก</div>
                </div>
              </a>
            </div>

            <button
              onClick={() => setShowOperatorModal(false)}
              className="mt-4 w-full rounded-lg border border-slate-500/40 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/40 transition"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
