import React, { useEffect, useRef, useState, useCallback } from "react";
import { CinematicSpawnOverlay } from "../components/CinematicSpawnOverlay.jsx";
import { ForestAPI } from "../lib/api.js";
import { initializeForestScene } from "../lib/forestScene.js";

// ─── Icon SVGs ────────────────────────────────────────────────────────────────
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const RainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
    <line x1="8" y1="19" x2="8" y2="21" /><line x1="8" y1="23" x2="8" y2="25" />
    <line x1="12" y1="18" x2="12" y2="20" /><line x1="12" y1="22" x2="12" y2="24" />
    <line x1="16" y1="19" x2="16" y2="21" /><line x1="16" y1="23" x2="16" y2="25" />
  </svg>
);
const SnowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="M18 6L6 18M18 18L6 6" />
    <path d="M12 6L8.5 2.5M12 6L15.5 2.5M12 18L8.5 21.5M12 18L15.5 21.5" />
    <path d="M6 12L2.5 8.5M6 12L2.5 15.5M18 12L21.5 8.5M18 12L21.5 15.5" />
  </svg>
);
const CloudIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);
const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
  </svg>
);
const ForestIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L8 9h3l-4 6h4l-5 7h4v0h8l-5-7h4l-4-6h3z" />
  </svg>
);
const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Toggle Switch Component ──────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, label, activeLabel, inactiveLabel, activeIcon, inactiveIcon }) {
  return (
    <div className="toggle-group">
      <div className="toggle-label">{label}</div>
      <div className="toggle-row">
        <span className={`toggle-side-label ${!checked ? "active" : ""}`}>
          {inactiveIcon} {inactiveLabel}
        </span>
        <button
          className={`toggle-switch ${checked ? "checked" : ""}`}
          onClick={() => onChange(!checked)}
          role="switch"
          aria-checked={checked}
        >
          <span className="toggle-thumb" />
        </button>
        <span className={`toggle-side-label ${checked ? "active" : ""}`}>
          {activeIcon} {activeLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Weather Selector ─────────────────────────────────────────────────────────
function WeatherSelector({ value, onChange }) {
  const options = [
    { key: "sunny", label: "Sunny", icon: <SunIcon /> },
    { key: "rain", label: "Rain", icon: <RainIcon /> },
    { key: "snow", label: "Snow", icon: <SnowIcon /> }
  ];
  return (
    <div className="toggle-group">
      <div className="toggle-label">Weather</div>
      <div className="weather-buttons">
        {options.map((opt) => (
          <button
            key={opt.key}
            className={`weather-btn ${value === opt.key ? "selected" : ""}`}
            onClick={() => onChange(opt.key)}
            title={opt.label}
          >
            <span className="weather-icon">{opt.icon}</span>
            <span className="weather-text">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
function NavItem({ icon, label, href, active }) {
  return (
    <a href={href} className={`nav-item ${active ? "nav-item--active" : ""}`}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </a>
  );
}

function normalizeFilename(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const noQuery = raw.split("?")[0];
  const tail = noQuery.split("/").pop() || "";
  try {
    return decodeURIComponent(tail);
  } catch (_) {
    return tail;
  }
}

function shortCreatureLabel(filename) {
  const raw = normalizeFilename(filename);
  if (!raw) return "-";
  return raw.replace(/\.[^.]+$/, "");
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ForestPage() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const focusFilename = (() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return (params.get("focus") || "").trim();
    } catch (_) {
      return "";
    }
  })();
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("System Active — Listening for Spawn");
  const [overlayAnimal, setOverlayAnimal] = useState(null);
  const [forestLoadError, setForestLoadError] = useState("");
  const [timeMode, setTimeMode] = useState("morning"); // "morning" | "night"
  const [weatherMode, setWeatherMode] = useState("sunny"); // "sunny" | "rain" | "snow"
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [availableAnimals, setAvailableAnimals] = useState([]);
  const [selectedFocus, setSelectedFocus] = useState(normalizeFilename(focusFilename));
  const [focusOwnerPhone, setFocusOwnerPhone] = useState("");
  const [focusType, setFocusType] = useState("all");
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    let result = null;
    try {
      result = initializeForestScene({
        mountEl: mountRef.current,
        api: ForestAPI,
        focusFilename,
        onSpawnStart: (animal) => setOverlayAnimal({ ...animal, url: ForestAPI.assetUrl(animal.url) }),
        onSpawnEnd: () => setOverlayAnimal(null),
        onStatusChange: (text) => setStatus(text),
        onCountChange: (value) => setCount(value),
        onFocusModeChange: (active) => setIsFocusMode(Boolean(active))
      });
      sceneRef.current = result;
      if (focusFilename) {
        setStatus(`Finding target in forest: ${focusFilename}`);
      }
    } catch (err) {
      const reason = err?.message || String(err);
      setForestLoadError(`Failed to load forest scene: ${reason}`);
    }
    return () => {
      if (result && typeof result.cleanup === "function") result.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!focusFilename) return;
    const filename = normalizeFilename(focusFilename);
    setSelectedFocus(filename);
    sceneRef.current?.focusOnAnimal?.(filename);
  }, [focusFilename]);

  useEffect(() => {
    let stop = false;
    async function loadAnimals() {
      const r = await ForestAPI.getLatestAnimals();
      if (!r.ok || stop) return;
      const items = Array.isArray(r.data?.items) ? r.data.items : [];
      const normalized = items
        .map((a) => ({
          filename: normalizeFilename(a.filename || a.url),
          type: String(a.type || "unknown"),
          owner_name: String(a.owner_name || ""),
          phone_number: String(a.phone_number || ""),
        }))
        .filter((a) => a.filename);
      setAvailableAnimals(normalized);
    }
    loadAnimals();
    const id = setInterval(loadAnimals, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const handleFocusCreature = useCallback((filename) => {
    const normalized = normalizeFilename(filename);
    if (!normalized) return;
    setSelectedFocus(normalized);
    sceneRef.current?.focusOnAnimal?.(normalized);
  }, []);

  const handleFreeCamera = useCallback(() => {
    sceneRef.current?.releaseFocus?.();
    setIsFocusMode(false);
  }, []);

  const filteredAnimals = availableAnimals.filter((a) => {
    const q = focusOwnerPhone.trim().toLowerCase();
    const owner = (a.owner_name || "").toLowerCase();
    const phone = (a.phone_number || "").toLowerCase();
    const ownerPhoneMatch = !q || owner.includes(q) || phone.includes(q);
    const typeMatch = focusType === "all" || a.type === focusType;
    return ownerPhoneMatch && typeMatch;
  });

  const handleTimeChange = useCallback((isNight) => {
    const mode = isNight ? "night" : "morning";
    setTimeMode(mode);
    sceneRef.current?.applyTimeMode(mode);
  }, []);

  const handleWeatherChange = useCallback((mode) => {
    setWeatherMode(mode);
    sceneRef.current?.applyWeatherMode(mode);
  }, []);

  const isNight = timeMode === "night";

  return (
    <div className={`forest-root ${isNight ? "theme-night" : "theme-day"}`}>
      {/* 3D Canvas */}
      <div ref={mountRef} className="forest-canvas" />

      {/* Error overlay */}
      {forestLoadError && (
        <div className="error-toast">{forestLoadError}</div>
      )}

      {/* ── Sidebar Toggle Button ── */}
      <button
        className="sidebar-toggle-btn"
        onClick={() => setSidebarOpen((v) => !v)}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : "sidebar--closed"}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <ForestIcon />
          <div>
            <div className="sidebar-title">Magic Forest</div>
            <div className="sidebar-sub">v13 · Live</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <NavItem icon={<HomeIcon />} label="Home" href="/" />
          <NavItem icon={<ForestIcon />} label="Forest" href="/forest" active />
          <NavItem icon={<CameraIcon />} label="Scan" href="/scan" />
        </nav>

        <div className="sidebar-divider" />

        {/* Stats */}
        <div className="sidebar-section">
          <div className="section-heading">Live Stats</div>
          <div className="stat-card">
            <span className="stat-value">{String(count)}</span>
            <span className="stat-name">Creatures Alive</span>
          </div>
          <div className="status-bar">
            <span className={`pulse-dot ${isNight ? "pulse-blue" : "pulse-gold"}`} />
            <span className="status-text">{status}</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Controls */}
        <div className="sidebar-section">
          <div className="section-heading">Environment</div>

          {/* Time Mode Toggle */}
          <ToggleSwitch
            checked={isNight}
            onChange={handleTimeChange}
            label="Time of Day"
            inactiveLabel="Day"
            activeLabel="Night"
            inactiveIcon={<SunIcon />}
            activeIcon={<MoonIcon />}
          />

          {/* Weather Selector */}
          <WeatherSelector value={weatherMode} onChange={handleWeatherChange} />
        </div>

        <div className="sidebar-divider" />

        {/* Atmosphere indicator */}
        <div className="atmosphere-badge">
          <span className="atm-icon">
            {isNight ? <MoonIcon /> : weatherMode === "snow" ? <SnowIcon /> : weatherMode === "rain" ? <RainIcon /> : <SunIcon />}
          </span>
          <span className="atm-label">
            {isNight ? "Night" : "Day"} · {weatherMode.charAt(0).toUpperCase() + weatherMode.slice(1)}
          </span>
        </div>
        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <div className="section-heading">Creature Focus</div>
          <button
            className="focus-free-btn"
            onClick={handleFreeCamera}
            disabled={!isFocusMode}
            title={isFocusMode ? "Exit focus mode" : "Already in free camera mode"}
          >
            Free Camera
          </button>
          <div className="focus-filters">
            <input
              className="focus-search"
              type="text"
              value={focusOwnerPhone}
              onChange={(e) => setFocusOwnerPhone(e.target.value)}
              placeholder="Filter owner or phone"
            />
            <div className="focus-type-group" role="tablist" aria-label="Filter creature type">
              {[
                { key: "all", label: "All" },
                { key: "ground", label: "Ground" },
                { key: "sky", label: "Sky" },
                { key: "water", label: "Water" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  className={`focus-type-btn ${focusType === opt.key ? "focus-type-btn--active" : ""}`}
                  onClick={() => setFocusType(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="focus-list">
            {filteredAnimals.length === 0 ? (
              <div className="focus-empty">No creatures available</div>
            ) : (
              filteredAnimals.map((a) => (
                <button
                  key={a.filename}
                  className={`focus-item ${selectedFocus === a.filename ? "focus-item--active" : ""}`}
                  onClick={() => handleFocusCreature(a.filename)}
                  title={a.filename}
                >
                  <span className="focus-item__name">{shortCreatureLabel(a.filename)}</span>
                  <span className="focus-item__meta">{a.owner_name || a.phone_number || "-"}</span>
                  <span className={`focus-item__type focus-item__type--${a.type}`}>{a.type}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Cinematic overlay */}
      <CinematicSpawnOverlay animal={overlayAnimal} />
    </div>
  );
}
