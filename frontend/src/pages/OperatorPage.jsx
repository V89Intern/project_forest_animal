import React, { useEffect, useState, useCallback } from "react";
import { ForestAPI } from "../lib/api.js";
import { useAuth } from "../main.jsx";

const TABLE_PAGE_SIZE = 10;

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
function extractAnimationFilename(urlPath = "") {
  const raw = String(urlPath || "").trim();
  if (!raw) return "";
  const noQuery = raw.split("?")[0];
  const tail = noQuery.split("/").pop() || "";
  try {
    return decodeURIComponent(tail);
  } catch (_) {
    return tail;
  }
}

function TablePagination({ page, totalPages, totalRows, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalRows);
  const maxButtons = 5;
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  const pages = [];
  for (let p = startPage; p <= endPage; p++) pages.push(p);

  return (
    <div className="db-pagination">
      <div className="db-pagination__meta">Showing {start}-{end} of {totalRows}</div>
      <div className="db-pagination__controls">
        <button className="db-page-btn" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            className={`db-page-btn ${p === page ? "db-page-btn--active" : ""}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button className="db-page-btn" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Picture table ────────────────────────────────────────────────────────────
function PictureTable({ rows = [], showAll = false }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  if (rows.length === 0) return <div className="db-empty">No data</div>;
  const startIdx = (page - 1) * TABLE_PAGE_SIZE;
  const pageRows = rows.slice(startIdx, startIdx + TABLE_PAGE_SIZE);

  return (
    <>
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Phone</th>
              <th>Owner</th>
              <th>Type</th>
              <th>Uploaded</th>
              <th>Forest</th>
              {showAll && <th>URL</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p) => {
              const filename = extractAnimationFilename(p.url_path);
              const focusHref = filename ? `/forest?focus=${encodeURIComponent(filename)}` : "";
              return (
                <tr key={p.pe_id}>
                  <td className="db-table__id">{p.pe_id}</td>
                  <td>{p.phone_number || "-"}</td>
                  <td>{p.owner_name || "-"}</td>
                  <td>
                    <span className={`db-badge db-badge--${(p.uploader_type || "").toLowerCase()}`}>
                      {p.uploader_type || "-"}
                    </span>
                  </td>
                  <td className="db-table__date">
                    {p.upload_timestamp ? new Date(p.upload_timestamp).toLocaleString("th-TH") : "-"}
                  </td>
                  <td>
                    {focusHref ? <a href={focusHref} className="db-link">Go to Position</a> : "-"}
                  </td>
                  {showAll && (
                    <td>
                      <a href={p.url_path} target="_blank" rel="noreferrer" className="db-link">View</a>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
        totalPages={totalPages}
        totalRows={rows.length}
        pageSize={TABLE_PAGE_SIZE}
        onPageChange={setPage}
      />
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function QueueJobsTable({ rows = [] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  if (rows.length === 0) return <div className="db-empty">No queue jobs</div>;
  const startIdx = (page - 1) * TABLE_PAGE_SIZE;
  const pageRows = rows.slice(startIdx, startIdx + TABLE_PAGE_SIZE);

  return (
    <>
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Status</th>
              <th>Queue</th>
              <th>Type</th>
              <th>Requester</th>
              <th>Phone</th>
              <th>Progress</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((j) => (
              <tr key={j.job_id}>
                <td className="db-table__id">{j.job_id}</td>
                <td>{j.status}</td>
                <td>{j.queue_position ? `${j.queue_position}/${j.queue_total}` : "-"}</td>
                <td>{j.requested_type || "-"}</td>
                <td>{j.requester_name || j.drawer_name || "-"}</td>
                <td>{j.phone_number || "-"}</td>
                <td>{Number(j.progress || 0)}%</td>
                <td className="db-table__date">
                  {j.update_timestamp ? new Date(j.update_timestamp).toLocaleString("th-TH") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={page}
        totalPages={totalPages}
        totalRows={rows.length}
        pageSize={TABLE_PAGE_SIZE}
        onPageChange={setPage}
      />
    </>
  );
}

export function OperatorPage() {
  const { user, logout } = useAuth();

  const [pictures, setPictures] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [queueJobs, setQueueJobs] = useState([]);
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
    const [picRes, animalRes, pipeRes, queueRes] = await Promise.all([
      apiFetch("/api/pictures"),
      ForestAPI.getLatestAnimals(),
      ForestAPI.getPipelineStatus({ wait: false }),
      apiFetch("/api/queue_jobs?limit=200")
    ]);
    if (picRes.ok && Array.isArray(picRes.data?.pictures)) setPictures(picRes.data.pictures);
    if (animalRes.ok && Array.isArray(animalRes.data?.items)) setAnimals(animalRes.data.items);
    if (queueRes.ok && Array.isArray(queueRes.data?.items)) setQueueJobs(queueRes.data.items);
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
  const queueTotal = pipeline.queue_total ?? 0;
  const queueInProgress = queueJobs.filter((j) => ["CAPTURING", "PROCESSING", "READY_FOR_REVIEW", "SYNCING"].includes(j.status)).length;
  const queueWaiting = queueJobs.filter((j) => j.status === "QUEUED").length;
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
  const queueJobsSorted = [...queueJobs].sort((a, b) => {
    const aActive = Number.isFinite(Number(a.queue_position)) ? 0 : 1;
    const bActive = Number.isFinite(Number(b.queue_position)) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (!aActive && !bActive) return Number(a.queue_position) - Number(b.queue_position);
    return new Date(b.update_timestamp || 0).getTime() - new Date(a.update_timestamp || 0).getTime();
  });
  const queueTop5 = queueJobsSorted.filter((j) => Number.isFinite(Number(j.queue_position))).slice(0, 5);
  const queueCurrent = pipeline.queue_current || null;
  const queueCurrentLabel = queueCurrent
    ? [queueCurrent.requester_name || queueCurrent.drawer_name || "-", queueCurrent.phone_number || "-"].join(" | ")
    : "-";

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
          { id: "animals", label: "🦁 Forest Animals" },
          { id: "queue", label: "🧾 Queue Jobs" }
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
              <StatCard icon="🧾" value={queueTotal} label="Queue Total" color="cyan" />
              <StatCard icon="⚙️" value={queueInProgress} label="Queue In Progress" color="amber" />
              <StatCard icon="⏳" value={queueWaiting} label="Queue Waiting" color="violet" />
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
                <div className="db-pipeline-msg">
                  Current Queue: {queueCurrent?.job_id || "-"} | {queueCurrent?.status || "-"} | {Number(queueCurrent?.progress || 0)}%
                </div>
                <div className="db-pipeline-msg">
                  Uploading By: {queueCurrentLabel}
                </div>
              </div>
            </Card>

            <Card title="🧾 Queue Order (Top 5)" className="db-card--full">
              {queueTop5.length === 0 ? (
                <div className="db-empty">No active queue</div>
              ) : (
                <div className="db-table-wrap">
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Status</th>
                        <th>Requester</th>
                        <th>Phone</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueTop5.map((j) => (
                        <tr key={j.job_id}>
                          <td className="db-table__id">{j.job_id}</td>
                          <td>{j.status}</td>
                          <td>{j.requester_name || j.drawer_name || "-"}</td>
                          <td>{j.phone_number || "-"}</td>
                          <td>{Number(j.progress || 0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

        {activeTab === "queue" && !loading && (
          <Card title="🧾 Queue Jobs" className="db-card--full">
            <QueueJobsTable rows={queueJobsSorted} />
          </Card>
        )}
      </main>
    </div>
  );
}

