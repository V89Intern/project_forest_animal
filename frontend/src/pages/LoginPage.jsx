import React, { useState, useRef, useEffect } from "react";
import { ForestAPI } from "../lib/api.js";
import "../styles/login.css";

/**
 * Full-screen PIN login page — 6-digit PIN verified against the Customer table.
 * On success stores session in sessionStorage and calls `onLogin(user)`.
 */
export function LoginPage({ onLogin }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake]   = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  /* ── Keyboard input ─────────────────────────────────────────────── */
  function handleChange(index, value) {
    const char = value.replace(/\D/g, "").slice(-1);
    const next  = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");

    if (char && index < 5) inputRefs.current[index + 1]?.focus();
    if (char && index === 5 && next.every((d) => d !== "")) submitPin(next.join(""));
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      const pin = digits.join("");
      if (pin.length === 6) submitPin(pin);
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    if (pasted.length === 6) submitPin(pasted);
    else inputRefs.current[pasted.length]?.focus();
  }

  /* ── Numpad ─────────────────────────────────────────────────────── */
  const numpadKeys = ["1","2","3","4","5","6","7","8","9","⌫","0","✓"];

  function numpadPress(key) {
    if (key === "✓") {
      const pin = digits.join("");
      if (pin.length === 6) submitPin(pin);
      return;
    }
    if (key === "⌫") {
      setError("");
      setDigits((prev) => {
        const next = [...prev];
        for (let i = 5; i >= 0; i--) {
          if (next[i]) { next[i] = ""; inputRefs.current[i]?.focus(); break; }
        }
        return next;
      });
      return;
    }
    // Number — find next empty slot
    setDigits((prev) => {
      const next      = [...prev];
      const emptyIdx  = next.findIndex((d) => d === "");
      if (emptyIdx === -1) return prev;
      next[emptyIdx] = key;
      if (emptyIdx < 5) inputRefs.current[emptyIdx + 1]?.focus();
      if (emptyIdx === 5 && next.every((d) => d)) {
        setTimeout(() => submitPin(next.join("")), 0);
      }
      return next;
    });
  }

  /* ── Submit ─────────────────────────────────────────────────────── */
  async function submitPin(pin) {
    setLoading(true);
    setError("");
    try {
      const resp = await ForestAPI.login(pin);
      if (resp.ok && resp.data?.ok) {
        const user = { name: resp.data.name, token: resp.data.token };
        sessionStorage.setItem("forest_user", JSON.stringify(user));
        onLogin(user);
      } else {
        triggerError(resp.data?.error || "PIN ไม่ถูกต้อง กรุณาลองใหม่");
      }
    } catch {
      triggerError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  function triggerError(msg) {
    setError(msg);
    setShake(true);
    setDigits(["", "", "", "", "", ""]);
    setTimeout(() => {
      setShake(false);
      inputRefs.current[0]?.focus();
    }, 500);
  }

  const allFilled = digits.every((d) => d !== "");

  return (
    <div className="login-page">
      {/* Decorative blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

      <div className="login-card">
        {/* Header */}
        <div className="login-icon">🌲</div>
        <h1 className="login-title">Digital Magic Forest</h1>
        <p className="login-subtitle">กรุณาใส่ PIN 6 หลักเพื่อเข้าสู่ระบบ</p>

        {/* PIN boxes */}
        <div className="pin-container" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={[
                "pin-input",
                d         ? "pin-filled" : "",
                error     ? "pin-error"  : "",
                shake     ? "pin-shake"  : "",
              ].filter(Boolean).join(" ")}
              disabled={loading}
              autoComplete="off"
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="login-error-box">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="login-loading">
            <div className="login-spinner" />
            <span>กำลังตรวจสอบ...</span>
          </div>
        )}




        {/* Submit button */}
        <button
          className="login-btn"
          disabled={loading || !allFilled}
          onClick={() => submitPin(digits.join(""))}
        >
          {loading ? (
            <><div className="login-spinner login-spinner--btn" /> กำลังตรวจสอบ...</>
          ) : (
            <>🔓 เข้าสู่ระบบ</>
          )}
        </button>

        <p className="login-hint">ติดต่อผู้ดูแลระบบหากยังไม่มี PIN</p>
      </div>
    </div>
  );
}
