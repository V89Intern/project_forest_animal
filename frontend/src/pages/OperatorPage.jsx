import React, { useEffect, useState, useCallback } from "react";
import { ForestAPI } from "../lib/api.js";
import { useAuth } from "../main.jsx";

// ─── API helper ───────────────────────────────────────────────────────────────
function authHeader() {
  try {
    const u = JSON.parse(sessionStorage.getItem("forest_user") || "{}");
    return u.token ? { Authorization: `Bearer ${u.token}` } : {};
  } catch { return {}; }
}

async function apiFetch(path, opts = {}) {
  const base = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(opts.headers || {})
    }
  });
  let data = {};
  try { data = await res.json(); } catch (_) { }
  return { ok: res.ok, status: res.status, data };
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart({ data, label }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="db-chart">
      <div className="db-chart__bars">
        {data.map((d) => (
          <div key={d.key} className="db-chart__col">
            <div className="db-chart__bar" style={{ height: `${(d.value / max) * 100}%` }} title={`${d.key}: ${d.value}`} />
            <div className="db-chart__xlabel">{d.key}</div>
          </div>
        ))}
      </div>
      <div className="db-chart__label">{label}</div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color = "cyan" }) {
  return (
    <div className={`db-stat db-stat--${color}`}>
      <div className="db-stat__icon">{icon}</div>
      <div className="db-stat__body">
        <div className="db-stat__value">{value}</div>
        <div className="db-stat__label">{label}</div>
      </div>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ title, children, className = "" }) {
  return (
    <div className={`db-card ${className}`}>
      {title && <div className="db-card__title">{title}</div>}
      {children}
    </div>
  );
}

// ─── Picture table ────────────────────────────────────────────────────────────
function PictureTable({ rows = [], showAll = false }) {
  if (rows.length === 0) return <div className="db-empty">ยังไม่มีข้อมูล</div>;
  return (
    <div className="db-table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>เบอร์โทร</th>
            <th>ชื่อเจ้าของ</th>
            <th>ประเภท</th>
            <th>วันที่อัปโหลด</th>
            {showAll && <th>URL</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.pe_id}>
              <td className="db-table__id">{p.pe_id}</td>
              <td>{p.phone_number || "—"}</td>
              <td>{p.owner_name || "—"}</td>
              <td>
                <span className={`db-badge db-badge--${(p.uploader_type || "").toLowerCase()}`}>
                  {p.uploader_type || "—"}
                </span>
              </td>
              <td className="db-table__date">
                {p.upload_timestamp ? new Date(p.upload_timestamp).toLocaleString("th-TH") : "—"}
              </td>
              {showAll && (
                <td>
                  <a href={p.url_path} target="_blank" rel="noreferrer" className="db-link">View</a>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function OperatorPage() {
  const { user, logout } = useAuth();

  const [pictures, setPictures] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [pipeline, setPipeline] = useState({ state: "IDLE", active_entities: 0, message: "" });
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchOwner, setSearchOwner] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedAnimals, setSelectedAnimals] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  // ── Fetch all data ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [picRes, animalRes, pipeRes] = await Promise.all([
      apiFetch("/api/pictures"),
      ForestAPI.getLatestAnimals(),
      ForestAPI.getPipelineStatus({ wait: false })
    ]);
    if (picRes.ok && Array.isArray(picRes.data?.pictures)) setPictures(picRes.data.pictures);
    if (animalRes.ok && Array.isArray(animalRes.data?.items)) setAnimals(animalRes.data.items);
    if (pipeRes.ok) setPipeline(pipeRes.data || {});
    setSelectedAnimals(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Live pipeline refresh every 5 s ──────────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await ForestAPI.getPipelineStatus({ wait: false });
      if (r.ok) setPipeline(r.data || {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalPics = pictures.length;
  const uniquePhones = new Set(pictures.map((p) => p.phone_number).filter(Boolean)).size;
  const todayPics = pictures.filter((p) => {
    const d = new Date(p.upload_timestamp);
    return d.toDateString() === new Date().toDateString();
  }).length;
  const activeCreatures = pipeline.active_entities ?? 0;
  const custCount = pictures.filter((p) => p.uploader_type === "CUSTOMER").length;
  const userCount = pictures.filter((p) => p.uploader_type === "USER").length;

  // Weekly bar (last 7 days)
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: d.toLocaleDateString("th-TH", { weekday: "short" }), date: d.toDateString(), value: 0 };
  });
  for (const p of pictures) {
    const ds = new Date(p.upload_timestamp).toDateString();
    const slot = weekBars.find((b) => b.date === ds);
    if (slot) slot.value++;
  }

  // Filtered lists
  const filteredPics = pictures.filter((p) => {
    const phoneOk = !searchPhone || (p.phone_number || "").includes(searchPhone);
    const ownerOk = !searchOwner || (p.owner_name || "").toLowerCase().includes(searchOwner.toLowerCase());
    return phoneOk && ownerOk;
  });
  const filteredAnimals = animals.filter((a) => filterType === "all" || a.type === filterType);

  // ── Delete helpers ────────────────────────────────────────────────────────
  const toggleSelect = useCallback((fn) => {
    setSelectedAnimals((prev) => {
      const next = new Set(prev);
      next.has(fn) ? next.delete(fn) : next.add(fn);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    setSelectedAnimals((prev) =>
      prev.size === filteredAnimals.length && filteredAnimals.length > 0
        ? new Set()
        : new Set(filteredAnimals.map((a) => a.filename))
    );
  };

  const deleteSelected = async () => {
    if (selectedAnimals.size === 0) return;
    if (!window.confirm(`ลบ ${selectedAnimals.size} รายการที่เลือก?`)) return;
    setDeleting(true);
    await apiFetch("/api/animals/delete_many", {
      method: "POST",
      body: JSON.stringify({ filenames: Array.from(selectedAnimals) })
    });
    setDeleting(false);
    fetchAll();
  };

  const deleteAll = async () => {
    if (!window.confirm("ลบสัตว์ทั้งหมดในป่า? ไม่สามารถกู้คืนได้")) return;
    setDeleting(true);
    await apiFetch("/api/clear_forest", { method: "POST", body: JSON.stringify({}) });
    setDeleting(false);
    fetchAll();
  };

  const deleteOne = async (filename) => {
    if (!window.confirm(`ลบ ${filename}?`)) return;
    setDeleting(true);
    await apiFetch(`/api/animals/${encodeURIComponent(filename)}`, { method: "DELETE", body: JSON.stringify({}) });
    setDeleting(false);
    fetchAll();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="db-root">

      {/* ── Header ── */}
      <header className="db-header">
        <div className="db-header__left">
          <div className="db-logo">🌳</div>
          <div>
            <div className="db-header__title">Report &amp; Dashboard</div>
            <div className="db-header__sub">Magic Forest · Back-office</div>
          </div>
        </div>
        <div className="db-header__right">
          <div className="db-header__user">👤 {user?.name || "—"}</div>
          <button className="db-btn db-btn--ghost" onClick={fetchAll}>⟳ Refresh</button>
          <a href="/scan" className="db-btn db-btn--cyan">Scanner →</a>
          <a href="/" className="db-btn db-btn--ghost">Home</a>
          <button className="db-btn db-btn--danger" onClick={logout}>ออกจากระบบ</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="db-tabs">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "gallery", label: "🖼️ Picture Gallery" },
          { id: "animals", label: "🦁 Forest Animals" }
        ].map((t) => (
          <button
            key={t.id}
            className={`db-tab ${activeTab === t.id ? "db-tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Main ── */}
      <main className="db-main">
        {loading && <div className="db-loading">กำลังโหลดข้อมูล…</div>}

        {/* ════════ OVERVIEW ════════ */}
        {activeTab === "overview" && !loading && (
          <>
            {/* Stat cards */}
            <div className="db-stats-row">
              <StatCard icon="🖼️" value={totalPics} label="Total Pictures" color="cyan" />
              <StatCard icon="📅" value={todayPics} label="Uploaded Today" color="emerald" />
              <StatCard icon="📱" value={uniquePhones} label="Unique Phone Numbers" color="violet" />
              <StatCard icon="🦊" value={activeCreatures} label="Live Creatures in Forest" color="amber" />
            </div>

            {/* Charts */}
            <div className="db-grid-2">
              <Card title="📈 Uploads — Last 7 Days">
                <BarChart data={weekBars} label="รูปภาพที่อัปโหลดต่อวัน" />
              </Card>

              <Card title="👥 Uploader Type">
                <div className="db-donut-wrap">
                  <div className="db-donut-item">
                    <div
                      className="db-donut-circle"
                      style={{
                        background: `conic-gradient(#4ecca3 0% ${totalPics ? (custCount / totalPics * 100) : 0}%, #7c9fff ${totalPics ? (custCount / totalPics * 100) : 0}% 100%)`
                      }}
                    />
                    <div className="db-donut-legend">
                      <div><span className="db-dot db-dot--cyan" />Customer: <b>{custCount}</b></div>
                      <div><span className="db-dot db-dot--violet" />User: <b>{userCount}</b></div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Pipeline status */}
            <Card title="⚙️ Pipeline Status" className="db-card--full">
              <div className="db-pipeline-row">
                {["IDLE", "CAPTURING", "PROCESSING", "READY_FOR_REVIEW", "SYNCING"].map((s) => (
                  <div key={s} className={`db-pipeline-step ${pipeline.state === s ? "db-pipeline-step--active" : ""}`}>
                    {s}
                  </div>
                ))}
                <div className="db-pipeline-msg">{pipeline.message || "—"}</div>
              </div>
            </Card>

            {/* Recent uploads */}
            <Card title="🕐 Recent Uploads" className="db-card--full">
              <PictureTable rows={pictures.slice(0, 10)} />
            </Card>
          </>
        )}

        {/* ════════ GALLERY ════════ */}
        {activeTab === "gallery" && !loading && (
          <>
            <Card title="🔍 Search &amp; Filter" className="db-card--full">
              <div className="db-filter-row">
                <input
                  className="db-input"
                  placeholder="กรองตามเบอร์โทร"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                />
                <input
                  className="db-input"
                  placeholder="กรองตามชื่อเจ้าของ"
                  value={searchOwner}
                  onChange={(e) => setSearchOwner(e.target.value)}
                />
                <button className="db-btn db-btn--ghost" onClick={() => { setSearchPhone(""); setSearchOwner(""); }}>
                  Clear
                </button>
                <span className="db-filter-count">{filteredPics.length} รายการ</span>
              </div>
            </Card>

            <Card title="🖼️ Picture Records" className="db-card--full">
              <PictureTable rows={filteredPics} showAll />
            </Card>
          </>
        )}

        {/* ════════ ANIMALS ════════ */}
        {activeTab === "animals" && !loading && (
          <>
            <Card title="🎛️ Filter &amp; Actions" className="db-card--full">
              <div className="db-filter-row">
                {["all", "sky", "ground", "water"].map((t) => (
                  <button
                    key={t}
                    className={`db-btn ${filterType === t ? "db-btn--cyan" : "db-btn--ghost"}`}
                    onClick={() => setFilterType(t)}
                  >
                    {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}

                <span className="db-filter-count">{filteredAnimals.length} ตัวสัตว์</span>
                <span style={{ flex: 1 }} />

                <button className="db-btn db-btn--ghost" onClick={toggleSelectAll}>
                  {selectedAnimals.size === filteredAnimals.length && filteredAnimals.length > 0
                    ? "☑ Deselect All"
                    : "☐ Select All"}
                </button>

                <button
                  className="db-btn db-btn--danger"
                  disabled={selectedAnimals.size === 0 || deleting}
                  onClick={deleteSelected}
                >
                  🗑 ลบที่เลือก ({selectedAnimals.size})
                </button>

                <button
                  className="db-btn db-btn--danger-hard"
                  disabled={animals.length === 0 || deleting}
                  onClick={deleteAll}
                >
                  💥 ลบทั้งหมด
                </button>
              </div>
            </Card>

            <div className="db-animal-grid">
              {filteredAnimals.map((a) => {
                const isSelected = selectedAnimals.has(a.filename);
                return (
                  <div
                    key={a.filename}
                    className={`db-animal-card ${isSelected ? "db-animal-card--selected" : ""}`}
                    onClick={() => toggleSelect(a.filename)}
                  >
                    <div className="db-animal-check">{isSelected ? "✅" : "⬜"}</div>
                    <img
                      src={ForestAPI.assetUrl(a.url)}
                      alt={a.filename}
                      className="db-animal-img"
                      loading="lazy"
                    />
                    <div className="db-animal-meta">
                      <div className="db-animal-name">{a.filename}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className={`db-badge db-badge--${a.type}`}>{a.type}</span>
                        <button
                          className="db-btn-icon"
                          title="ลบสัตว์นี้"
                          onClick={(e) => { e.stopPropagation(); deleteOne(a.filename); }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredAnimals.length === 0 && <div className="db-empty">ไม่มีสัตว์ในตาราง</div>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
