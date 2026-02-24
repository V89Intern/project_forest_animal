import React, { useState, useRef, useEffect } from "react";
import { ForestAPI } from "../lib/api.js";

/**
 * Full-screen login page — requires a 6-digit PIN verified against Sheet2.
 * On success, stores session in sessionStorage and calls `onLogin(user)`.
 */
export function LoginPage({ onLogin }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index, value) {
    // Allow only single digit
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");

    // Auto-advance to next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (char && index === 5 && next.every((d) => d !== "")) {
      submitPin(next.join(""));
    }
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
    if (pasted.length === 6) {
      submitPin(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  }

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
        setError(resp.data?.error || "PIN ไม่ถูกต้อง");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (_err) {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">🌲</div>
        <h1 className="login-title">Digital Magic Forest</h1>
        <p className="login-subtitle">กรุณาใส่ PIN 6 หลักเพื่อเข้าสู่ระบบ</p>

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
              className={`pin-input${error ? " pin-error" : ""}`}
              disabled={loading}
              autoComplete="off"
            />
          ))}
        </div>

        {error && <p className="login-error">{error}</p>}

        {loading && (
          <div className="login-loading">
            <div className="login-spinner" />
            <span>กำลังตรวจสอบ...</span>
          </div>
        )}

        <button
          className="login-btn"
          disabled={loading || digits.some((d) => d === "")}
          onClick={() => submitPin(digits.join(""))}
        >
          เข้าสู่ระบบ
        </button>

        <p className="login-hint">ติดต่อผู้ดูแลระบบหากยังไม่มี PIN</p>
      </div>
    </div>
  );
}
