<template>
    <div>
        <!-- Carousel -->
        <div v-if="latestImages.length > 0" class="carousel-section">
            <h2 class="carousel-title">🌟 ภาพล่าสุด</h2>
            <div class="carousel-track-wrapper">
                <div class="carousel-track">
                    <div v-for="(img, idx) in duplicatedLatest" :key="'lat-' + idx" class="carousel-card">
                        <img :src="apiBase + '/static/animations/' + img.filename" :alt="img.creature_name"
                            class="carousel-img" loading="lazy" />
                        <div class="carousel-label">{{ img.creature_name || 'ไม่ระบุ' }}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Search Box -->
        <div class="content-wrapper">
            <h2 class="section-title">ค้นหาภาพสัตว์ของคุณ</h2>

            <div class="input-group">
                <label>ชื่อผู้วาด</label>
                <input v-model="drawerName" type="text" placeholder="พิมพ์ชื่อผู้วาด..." class="custom-input"
                    @keyup.enter="searchImages" />
            </div>

            <div class="btn-row">
                <button class="search-btn" @click="searchImages" :disabled="loading">
                    <span v-if="loading" class="spinner"></span>
                    <span v-else>🔍</span>
                    {{ loading ? 'กำลังค้นหา...' : 'ค้นหา' }}
                </button>
            </div>
        </div>

        <!-- Result Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3 class="modal-title">🖼️ ผลการค้นหา ({{ entries.length }})</h3>
                            <button class="modal-close" @click="closeModal">✕</button>
                        </div>
                        <div class="modal-body">
                            <!-- Loading -->
                            <div v-if="loading" class="modal-loading">
                                <span class="spinner spinner-lg"></span>
                                <p>กำลังค้นหา...</p>
                            </div>

                            <!-- Results -->
                            <div v-else-if="entries.length > 0" class="image-grid">
                                <div v-for="item in entries" :key="item.uuid" class="image-card">
                                    <div class="card-img-wrap">
                                        <img :src="apiBase + '/static/animations/' + item.filename"
                                            :alt="item.creature_name" class="card-img" loading="lazy" />
                                        <span :class="['type-badge', 'badge-' + item.creature_type]">
                                            {{ item.creature_type }}
                                        </span>
                                    </div>
                                    <div class="card-body">
                                        <div class="card-creature">{{ item.creature_name || 'ไม่ระบุชื่อ' }}</div>
                                        <div class="card-drawer">👤 {{ item.drawer_name || '-' }}</div>
                                        <div class="card-time">{{ item.timestamp }}</div>
                                        <button class="download-btn" :disabled="downloadingId === item.uuid"
                                            @click="downloadImage(item)">
                                            <span v-if="downloadingId === item.uuid" class="spinner spinner-sm"></span>
                                            <span v-else>⬇</span>
                                            {{ downloadingId === item.uuid ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด' }}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Empty -->
                            <div v-else class="empty-state">
                                <div class="empty-icon">{{ drawerName.trim() === '' ? '✏️' : '🔍' }}</div>
                                <p>{{ drawerName.trim() === '' ? 'กรุณาพิมพ์ชื่อผู้วาด' : 'ไม่พบผลลัพธ์' }}</p>
                                <p class="empty-hint">
                                    {{ drawerName.trim() === '' ? 'ใส่ชื่อในช่องค้นหาแล้วกดค้นหา' :
                                    'ลองเปลี่ยนชื่อผู้วาด' }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE || ''
const apiBase = API_BASE.replace(/\/+$/, '')

// ─── State ───────────────────────────────────────────────────────────────────
const drawerName = ref('')
const entries = ref([])
const loading = ref(false)
const showModal = ref(false)
const latestImages = ref([])
const downloadingId = ref(null)

const duplicatedLatest = computed(() => {
    if (latestImages.value.length === 0) return []
    return [...latestImages.value, ...latestImages.value]
})

// ─── Methods ─────────────────────────────────────────────────────────────────
async function searchImages() {
    if (!drawerName.value.trim()) {
        entries.value = []
        showModal.value = true
        return
    }
    showModal.value = true
    loading.value = true
    try {
        const params = new URLSearchParams()
        params.set('drawer_name', drawerName.value.trim())
        const res = await fetch(`${apiBase}/api/gallery?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json()
        entries.value = data.ok ? (data.entries || []) : []
    } catch (err) {
        console.error('Search failed:', err)
        entries.value = []
    } finally {
        loading.value = false
    }
}

function closeModal() { showModal.value = false }

async function downloadImage(item) {
    if (downloadingId.value) return
    downloadingId.value = item.uuid
    try {
        const res = await fetch(`${apiBase}/api/download/${item.filename}`)
        if (!res.ok) throw new Error('Download failed')
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = item.filename || `${item.creature_name || 'image'}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
    } catch (err) {
        console.error('Download error:', err)
        alert('ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
        downloadingId.value = null
    }
}

async function fetchLatest() {
    try {
        const res = await fetch(`${apiBase}/api/gallery`, { cache: 'no-store' })
        const data = await res.json()
        if (data.ok && data.entries) {
            const sorted = [...data.entries].sort((a, b) =>
                (b.timestamp || '').localeCompare(a.timestamp || '')
            )
            latestImages.value = sorted.slice(0, 10)
        }
    } catch (err) {
        console.error('Failed to fetch latest:', err)
    }
}

onMounted(fetchLatest)
</script>

<style scoped>
* {
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* ── Carousel ── */
.carousel-section {
    padding: 20px 0 10px;
    overflow: hidden;
}

.carousel-title {
    text-align: center;
    font-size: 1.15rem;
    color: #333;
    margin-bottom: 14px;
}

.carousel-track-wrapper {
    overflow: hidden;
    width: 100%;
    mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
}

.carousel-track {
    display: flex;
    gap: 14px;
    width: max-content;
    animation: scrollCarousel 20s linear infinite;
}

.carousel-track:hover {
    animation-play-state: paused;
}

@keyframes scrollCarousel {
    0% {
        transform: translateX(0);
    }

    100% {
        transform: translateX(-50%);
    }
}

.carousel-card {
    flex-shrink: 0;
    width: 160px;
    background: #fff;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
    border: 1px solid #e8eaf0;
    transition: transform 0.2s;
}

.carousel-card:hover {
    transform: scale(1.05);
}

.carousel-img {
    width: 100%;
    height: 120px;
    object-fit: contain;
    background: #f0f2f5;
}

.carousel-label {
    padding: 6px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #444;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ── Search Box ── */
.content-wrapper {
    max-width: 600px;
    margin: 0 auto;
    padding: 36px 20px 48px;
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.section-title {
    color: #333;
    font-size: 1.2rem;
    margin-bottom: 6px;
    text-align: center;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.input-group label {
    font-size: 0.9rem;
    font-weight: 600;
    color: #555;
    margin-left: 4px;
}

.custom-input {
    width: 100%;
    padding: 14px 18px;
    border-radius: 14px;
    border: 1.5px solid #e1e1e1;
    background: #fff;
    color: #333;
    font-size: 1rem;
    outline: none;
    transition: all 0.3s;
}

.custom-input:focus {
    border-color: #2a5298;
    box-shadow: 0 4px 14px rgba(42, 82, 152, 0.12);
}

.btn-row {
    display: flex;
    margin-top: 4px;
}

.search-btn {
    flex: 1;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 15px;
    font-size: 1rem;
    font-weight: 700;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(42, 82, 152, 0.28);
    transition: transform 0.2s, opacity 0.2s;
    min-height: 50px;
}

.search-btn:active:not(:disabled) {
    transform: scale(0.96);
}

.search-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2.5px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}

.spinner-sm {
    width: 13px;
    height: 13px;
    border-width: 2px;
}

.spinner-lg {
    width: 32px;
    height: 32px;
    border-width: 3px;
    border-color: rgba(42, 82, 152, 0.2);
    border-top-color: #2a5298;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Modal overlay (global via Teleport, scoped won't apply — use :global) ── */
:global(.modal-overlay) {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
}

:global(.modal-container) {
    background: #fff;
    border-radius: 20px;
    width: 100%;
    max-width: 880px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
    overflow: hidden;
    margin: auto;
}

:global(.modal-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid #eee;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}

:global(.modal-title) {
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
}

:global(.modal-close) {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: #fff;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

:global(.modal-close:hover) {
    background: rgba(255, 255, 255, 0.35);
}

:global(.modal-body) {
    padding: 22px;
    overflow-y: auto;
    flex: 1;
}

/* ── Image Grid ── */
.image-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
}

.image-card {
    width: 230px;
    background: #fff;
    border-radius: 15px;
    border: 1px solid #e8eaf0;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
    transition: transform 0.2s, box-shadow 0.2s;
}

.image-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.card-img-wrap {
    position: relative;
    width: 100%;
    height: 155px;
    background: #f0f2f5;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.card-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.type-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
}

.badge-sky {
    background: rgba(56, 189, 248, 0.13);
    color: #0284c7;
    border: 1px solid rgba(56, 189, 248, 0.3);
}

.badge-ground {
    background: rgba(52, 211, 153, 0.13);
    color: #059669;
    border: 1px solid rgba(52, 211, 153, 0.3);
}

.badge-water {
    background: rgba(96, 165, 250, 0.13);
    color: #2563eb;
    border: 1px solid rgba(96, 165, 250, 0.3);
}

.card-body {
    padding: 12px 13px;
}

.card-creature {
    font-weight: 700;
    font-size: 0.95rem;
    color: #222;
    margin-bottom: 3px;
}

.card-drawer {
    font-size: 0.82rem;
    color: #666;
    margin-bottom: 2px;
}

.card-time {
    font-size: 0.73rem;
    color: #999;
    margin-bottom: 9px;
}

.download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    border: none;
    cursor: pointer;
    padding: 9px;
    border-radius: 10px;
    background: linear-gradient(135deg, #1e3c72, #2a5298);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    transition: opacity 0.2s, transform 0.15s;
}

.download-btn:active:not(:disabled) {
    transform: scale(0.96);
}

.download-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.download-btn:hover:not(:disabled) {
    opacity: 0.85;
}

/* ── Empty / Loading ── */
.empty-state {
    text-align: center;
    padding: 40px 0;
    color: #999;
}

.empty-icon {
    font-size: 2.8rem;
    margin-bottom: 8px;
}

.empty-hint {
    font-size: 0.78rem;
    color: #bbb;
    margin-top: 4px;
}

.modal-loading {
    text-align: center;
    padding: 60px 0;
    color: #777;
}

/* ── Modal Transition ── */
:global(.modal-enter-active) {
    transition: opacity 0.28s ease;
}

:global(.modal-leave-active) {
    transition: opacity 0.18s ease;
}

:global(.modal-enter-from),
:global(.modal-leave-to) {
    opacity: 0;
}

/* ── Mobile ── */
@media (max-width: 600px) {
    :global(.modal-overlay) {
        padding: 0;
        align-items: flex-end;
    }

    :global(.modal-container) {
        border-radius: 20px 20px 0 0;
        max-height: 92vh;
    }

    :global(.modal-body) {
        padding: 14px 12px;
    }

    .carousel-card {
        width: 120px;
    }

    .carousel-img {
        height: 88px;
    }

    .content-wrapper {
        padding: 20px 14px 40px;
    }

    .custom-input {
        font-size: 16px;
    }

    .image-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        justify-items: stretch;
    }

    .image-card {
        width: 100%;
    }

    .card-img-wrap {
        height: 125px;
    }
}

@media (max-width: 400px) {
    .carousel-card {
        width: 100px;
    }

    .carousel-img {
        height: 74px;
    }

    .custom-input {
        font-size: 16px;
        padding: 13px 14px;
    }

    .card-img-wrap {
        height: 105px;
    }
}
</style>
