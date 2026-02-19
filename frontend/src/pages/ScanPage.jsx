import React, { useCallback, useEffect, useRef, useState } from "react";
import { ForestAPI } from "../lib/api.js";

const POLL_INTERVAL = 800;

/**
 * Mobile-friendly scan page.
 * Uses rear camera (getUserMedia) OR file input fallback (for HTTP).
 */
export function ScanPage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // "camera" mode: "stream" (getUserMedia) or "file" (file input fallback)
  const [cameraMode, setCameraMode] = useState("stream");

  // UI state machine: "camera" | "review" | "processing" | "success"
  const [phase, setPhase] = useState("camera");
  const [capturedImage, setCapturedImage] = useState(null);

  // form fields
  const [drawerName, setDrawerName] = useState("");
  const [creatureName, setCreatureName] = useState("");
  const [creatureType, setCreatureType] = useState("ground");

  // processing feedback
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [resultFilename, setResultFilename] = useState("");

  /* ── Camera lifecycle ───────────────────────────── */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraMode("stream");
    } catch (err) {
      console.warn("getUserMedia failed, falling back to file input:", err.message);
      setCameraMode("file");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  /* ── Capture frame (stream mode) ───────────────── */
  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    setCapturedImage(dataUrl);
    setPhase("review");
    stopCamera();
  }

  /* ── Capture from file input (fallback mode) ───── */
  function handleFileCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setCapturedImage(dataUrl);
        setPhase("review");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  /* ── Retake ────────────────────────────────────── */
  function retake() {
    setCapturedImage(null);
    setPhase("camera");
    if (cameraMode === "stream") {
      startCamera();
    }
  }

  /* ── Submit → capture_process + poll + approve ── */
  async function submitImage() {
    if (!capturedImage) return;
    setPhase("processing");
    setProgress(10);
    setStatusMsg("กำลังส่งรูปไปประมวลผล...");

    const captureResp = await ForestAPI.captureProcess({ image_data: capturedImage });
    if (!captureResp.ok) {
      setStatusMsg(captureResp.data?.error || "ส่งรูปไม่สำเร็จ");
      setTimeout(() => retake(), 2000);
      return;
    }

    setProgress(30);
    setStatusMsg("กำลังลบพื้นหลัง...");

    let resolved = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      try {
        const statusResp = await ForestAPI.getPipelineStatus({ wait: false, timeout: 1, since: 0 });
        if (!statusResp.ok) continue;
        const d = statusResp.data || {};
        const pct = Number(d.progress || 0);
        setProgress(Math.max(30, pct));
        setStatusMsg(d.message || "กำลังประมวลผล...");

        if (d.state === "READY_FOR_REVIEW") {
          const detected = (d.detected_type || "").toLowerCase();
          const finalType = ["sky", "ground", "water"].includes(detected) ? detected : creatureType;

          setProgress(90);
          setStatusMsg("กำลังบันทึกสัตว์เข้าป่า...");
          const approveResp = await ForestAPI.approve({
            type: finalType,
            name: creatureName || `${finalType}_creature`,
            drawer_name: drawerName,
          });
          if (approveResp.ok) {
            setResultFilename(approveResp.data?.filename || "");
            setCreatureType(finalType);
            setPhase("success");
          } else {
            setStatusMsg(approveResp.data?.error || "Approve failed");
            setTimeout(() => retake(), 2000);
          }
          resolved = true;
          break;
        }

        if (d.state === "IDLE" && pct === 0 && i > 2) {
          setStatusMsg(d.message || "การประมวลผลล้มเหลว");
          setTimeout(() => retake(), 2000);
          resolved = true;
          break;
        }
      } catch (_) {
        // network blip
      }
    }

    if (!resolved) {
      setStatusMsg("หมดเวลารอการประมวลผล");
      setTimeout(() => retake(), 2000);
    }
  }

  /* ── Reset after success ────────────────────────── */
  function scanAnother() {
    setCapturedImage(null);
    setDrawerName("");
    setCreatureName("");
    setCreatureType("ground");
    setResultFilename("");
    setProgress(0);
    setStatusMsg("");
    setPhase("camera");
    if (cameraMode === "stream") {
      startCamera();
    }
  }

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="scan-page">
      <a href="/" className="scan-back-link">← กลับ</a>

      {/* Hidden file input for fallback mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileCapture}
        style={{ display: "none" }}
      />

      {/* ─ Phase: Camera ─ */}
      {phase === "camera" && (
        <>
          {cameraMode === "stream" ? (
            <div className="scan-viewport">
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="scan-overlay">
                <div className="scan-frame" />
              </div>
            </div>
          ) : (
            <div className="scan-file-fallback">
              <div className="scan-file-icon">📷</div>
              <h2>สแกนสัตว์เข้าป่า</h2>
              <p>กดปุ่มด้านล่างเพื่อเปิดกล้องถ่ายรูป</p>
            </div>
          )}

          <div className="scan-bottom-bar">
            {cameraMode === "stream" ? (
              <button className="scan-capture-btn" onClick={captureFrame} aria-label="Capture" />
            ) : (
              <button
                className="scan-btn primary"
                style={{ fontSize: "1.1rem", padding: "16px 32px" }}
                onClick={() => fileInputRef.current?.click()}
              >
                📸 เปิดกล้องถ่ายรูป
              </button>
            )}
          </div>
        </>
      )}

      {/* ─ Phase: Review ─ */}
      {phase === "review" && (
        <div className="scan-review">
          <div className="scan-review-img-wrap">
            <img src={capturedImage} alt="Captured preview" />
          </div>

          <div className="scan-review-form">
            <div>
              <label>ชื่อผู้วาด</label>
              <input
                type="text"
                value={drawerName}
                onChange={(e) => setDrawerName(e.target.value)}
                placeholder="เช่น น้องมิว"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>ชื่อสัตว์</label>
                <input
                  type="text"
                  value={creatureName}
                  onChange={(e) => setCreatureName(e.target.value)}
                  placeholder="เช่น นกอินทรี"
                />
              </div>
              <div>
                <label>ประเภท</label>
                <select value={creatureType} onChange={(e) => setCreatureType(e.target.value)}>
                  <option value="ground">🌿 Ground</option>
                  <option value="sky">🌤️ Sky</option>
                  <option value="water">🌊 Water</option>
                </select>
              </div>
            </div>

            <div className="scan-review-actions">
              <button className="scan-btn secondary" onClick={retake}>
                🔄 ถ่ายใหม่
              </button>
              <button className="scan-btn primary" onClick={submitImage}>
                ✅ ส่ง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Phase: Processing ─ */}
      {phase === "processing" && (
        <div className="scan-processing">
          <div className="spinner" />
          <div className="scan-progress-bar">
            <div className="scan-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p>{statusMsg}</p>
        </div>
      )}

      {/* ─ Phase: Success ─ */}
      {phase === "success" && (
        <div className="scan-success">
          <div className="check-icon">✓</div>
          <h2>สำเร็จ!</h2>
          <p>
            สัตว์ของคุณถูกส่งเข้าป่าแล้ว
            {resultFilename && (
              <>
                <br />
                <small style={{ opacity: 0.6 }}>{resultFilename}</small>
              </>
            )}
          </p>
          <button className="scan-btn primary" onClick={scanAnother} style={{ marginTop: 8 }}>
            📸 สแกนอีกตัว
          </button>
        </div>
      )}
    </div>
  );
}
