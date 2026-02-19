import React, { useEffect, useRef, useState } from "react";

import { ForestAPI } from "../lib/api.js";

export function OperatorPage() {
  const videoRef = useRef(null);
  const versionRef = useRef(0);
  const [pipelineState, setPipelineState] = useState("IDLE");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Ready");
  const [previewUrl, setPreviewUrl] = useState("");
  const [detectedType, setDetectedType] = useState("");
  const [activeEntities, setActiveEntities] = useState(0);
  const [actionLog, setActionLog] = useState("Awaiting operator action.");
  const [name, setName] = useState("");
  const [drawerName, setDrawerName] = useState("");
  const [type, setType] = useState("ground");

  const stateOrder = ["IDLE", "CAPTURING", "PROCESSING", "READY_FOR_REVIEW", "SYNCING"];

  useEffect(() => {
    async function initCamera() {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoRef.current.srcObject = stream;
      } catch (_err) {
        setActionLog("Camera permission denied or unavailable.");
      }
    }
    initCamera();
  }, []);

  useEffect(() => {
    let alive = true;
    async function loop() {
      try {
        const resp = await ForestAPI.getPipelineStatus({ wait: true, timeout: 20, since: versionRef.current });
        if (!alive || !resp.ok) throw new Error("status");
        const data = resp.data || {};
        setPipelineState(data.state || "IDLE");
        setProgress(Number(data.progress || 0));
        setMessage(data.message || "Ready");
        const basePreview = data.preview_url ? ForestAPI.assetUrl(data.preview_url) : ForestAPI.previewUrl();
        setPreviewUrl(basePreview);
        setDetectedType((data.detected_type || "").toLowerCase());
        setActiveEntities(Number(data.active_entities || 0));
        versionRef.current = Number(data.version || versionRef.current || 0);
      } catch (_err) {
        if (alive) setActionLog("Status sync failed.");
      }
      if (alive) setTimeout(loop, 150);
    }
    loop();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (detectedType && ["sky", "ground", "water"].includes(detectedType)) {
      setType(detectedType);
    }
  }, [detectedType]);

  async function captureAndProcess() {
    const video = videoRef.current;
    setActionLog("Triggering capture and RMBG pipeline...");
    if (!video || !video.videoWidth || !video.videoHeight) {
      setActionLog("Camera frame not ready.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg", 0.92);

    const resp = await ForestAPI.captureProcess({ image_data: imageData });
    if (!resp.ok) {
      setActionLog(resp.data?.error || "Capture request failed.");
      return;
    }
    setActionLog("Capture pipeline started.");
  }

  async function approveAndSpawn(event) {
    event.preventDefault();
    const resp = await ForestAPI.approve({ type, name, drawer_name: drawerName });
    if (!resp.ok) {
      setActionLog(resp.data?.error || "Approve failed.");
      return;
    }
    setActionLog(`Approved: ${resp.data?.filename || "unknown file"}`);
    setName("");
    setDrawerName("");
  }

  async function clearForest() {
    const resp = await ForestAPI.clearForest();
    if (!resp.ok) {
      setActionLog("Clear forest failed.");
      return;
    }
    const removed = resp.data?.removed || 0;
    setActionLog(`Forest cleared (${removed} files).`);
  }

  return (
    <div className="text-slate-100">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
        <header className="mb-4 rounded-2xl glass p-4 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-wide">Digital Magic Forest Operator Dashboard</h1>
              <p className="text-sm text-slate-300">Dark-Tech Control SPA | Real-time Pipeline Monitoring</p>
            </div>
            <div className="flex items-center gap-2">
              <a href="/" className="rounded-lg border border-slate-400/40 bg-slate-900/50 px-3 py-2 text-xs hover:bg-slate-700/60">
                Back
              </a>
              <div id="stateBadge" className="rounded-full border border-cyan-300/60 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                {`STATE: ${pipelineState}`}
              </div>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="glass rounded-2xl p-4 lg:col-span-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Scanner Viewport</h2>
              <span className="text-xs text-slate-300">getUserMedia</span>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-500/30 bg-slate-900/70">
              <video ref={videoRef} className="h-[200px] sm:h-[280px] w-full object-cover" autoPlay playsInline muted />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-slate-200">
                Live feed for operator framing
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={captureAndProcess} className="flex-1 min-w-[120px] rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-400">
                Capture + Process
              </button>
              <button
                onClick={() => {
                  versionRef.current = 0;
                  setActionLog("Manual refresh requested.");
                }}
                className="flex-1 min-w-[120px] rounded-lg border border-slate-500 px-4 py-2 text-sm hover:bg-slate-700/60"
              >
                Refresh Status
              </button>
            </div>
          </section>

          <section className="glass rounded-2xl p-4 lg:col-span-4">
            <h2 className="mb-3 text-lg font-semibold">Processing Pipeline</h2>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                id="progressBar"
                className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <p id="statusText" className="mb-4 text-sm text-slate-300">
              {message}
            </p>

            <div className="relative ml-6 space-y-3 border-l border-slate-600/70 pl-5 text-sm">
              {stateOrder.map((step) => {
                const stepIndex = stateOrder.indexOf(step);
                const currentIndex = stateOrder.indexOf(pipelineState);
                const active = stepIndex === currentIndex;
                const done = stepIndex < currentIndex;
                const label = step === "PROCESSING" ? "PROCESSING (RMBG)" : step;
                return (
                  <div key={step} id={`step-${step}`} className={`step relative${active ? " active" : ""}${done ? " done" : ""}`}>
                    {label}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass rounded-2xl p-4 lg:col-span-3">
            <h2 className="mb-3 text-lg font-semibold">System Controls</h2>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-500/40 bg-slate-900/50 p-3">
                <div className="text-slate-300">Active Entities</div>
                <div id="activeCount" className="text-2xl font-semibold text-emerald-300">
                  {String(activeEntities)}
                </div>
              </div>
              <button onClick={clearForest} id="clearBtn" className="w-full rounded-lg bg-rose-600 px-4 py-2 font-semibold hover:bg-rose-500">
                Clear Forest
              </button>
            </div>
          </section>

          <section className="glass rounded-2xl p-4 lg:col-span-7">
            <h2 className="mb-3 text-lg font-semibold">High-Resolution Preview</h2>
            <div className="overflow-hidden rounded-xl border border-slate-500/30 bg-slate-900/60">
              <img
                id="previewImg"
                alt="RMBG Preview"
                className="h-[200px] sm:h-[300px] w-full object-contain"
                src={previewUrl ? `${previewUrl}?t=${Date.now()}` : ""}
              />
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Displays latest processed output from <code>/static/rmbg_temp.png</code>.
            </p>
          </section>

          <section className="glass rounded-2xl p-4 lg:col-span-5">
            <h2 className="mb-3 text-lg font-semibold">Metadata & Spawn Approval</h2>
            <form onSubmit={approveAndSpawn} id="metaForm" className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-300">ชื่อผู้วาด (Drawer Name)</label>
                <input
                  id="drawerNameInput"
                  type="text"
                  value={drawerName}
                  onChange={(e) => setDrawerName(e.target.value)}
                  placeholder="e.g. น้องมิว"
                  className="w-full rounded-lg border border-slate-500/40 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Creature Name</label>
                <input
                  id="nameInput"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Azure Falcon"
                  className="w-full rounded-lg border border-slate-500/40 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Creature Type</label>
                <select
                  id="typeInput"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-slate-500/40 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                >
                  <option value="ground">Ground</option>
                  <option value="sky">Sky</option>
                  <option value="water">Water</option>
                </select>
              </div>
              <button type="submit" id="approveBtn" className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-400">
                Approve & Spawn
              </button>
            </form>
            <p id="actionLog" className="mt-3 text-xs text-slate-300">
              {actionLog}
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
