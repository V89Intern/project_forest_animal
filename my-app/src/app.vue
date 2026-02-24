<template>
  <div class="app-container">
    <header :class="['header', { 'header-splash': isSplash, 'header-ready': !isSplash }]">
      <div class="logo">
        <span class="logo-icon">✨</span> LOGO
      </div>
    </header>

    <main v-if="!isSplash" class="main-content fade-up-anim">
      <!-- ========== Latest Images Carousel ========== -->
      <div v-if="latestImages.length > 0" class="carousel-section">
        <h2 class="carousel-title">🌟 ภาพล่าสุด</h2>
        <div class="carousel-track-wrapper">
          <div class="carousel-track" ref="carouselTrack">
            <div 
              v-for="(img, idx) in duplicatedLatest" 
              :key="'lat-' + idx" 
              class="carousel-card"
            >
            <img 
              :src="apiBase + '/' + img.url_path"
              :alt="img.creature_name" 
              class="carousel-img" 
              loading="lazy"
            />
            <div class="carousel-label">
              {{ img.creature_name || 'ไม่ระบุ' }}
            </div>
          </div>
          </div>
        </div>
      </div>

      <div class="content-wrapper">
        <h2 class="section-title">ค้นหาภาพสัตว์ของคุณ</h2>
        
        <div class="input-group">
          <label>ค้นหาชื่อหรือเบอร์โทร</label>
            <input 
              v-model="searchText"
              type="text"
              placeholder="พิมพ์ชื่อ หรือ เบอร์โทร..."
              class="custom-input"
              @keyup.enter="searchImages"
            />
        </div>

        <div class="btn-row">
          <button class="search-btn" @click="searchImages" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span v-else>🔍</span>
            {{ loading ? 'กำลังค้นหา...' : 'ค้นหา' }}
          </button>
        </div>

      </div>
    </main>

    <!-- ========== Result Popup Modal ========== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
          <div class="modal-container">
            <div class="modal-header">
              <h3 class="modal-title">🖼️ ผลการค้นหา ({{ entries.length }})</h3>
              <button class="modal-close" @click="closeModal">✕</button>
            </div>
            <div class="modal-body">
              <div v-if="loading" class="modal-loading">
                <span class="spinner spinner-lg"></span>
                <p>กำลังค้นหา...</p>
              </div>

              <div v-else-if="entries.length > 0" class="image-grid">

        <!--เพิ่มแล้วDownload ตามPicture_Electronic-->
        <div v-for="item in entries" :key="item.pe_id" class="image-card"> 
    
          <div class="card-img-wrap">
            <img 
              :src="apiBase + '/' + item.url_path"
              alt="image"
              class="card-img"
              loading="lazy"
            />
          </div>

          <div class="card-body">
            <div class="card-creature">
              {{ item.owner_name || 'ไม่ระบุชื่อ' }}
            </div>

          <div class="card-time">
              {{ item.upload_timestamp }}
          </div>
          
          <button 
            class="download-btn"
            :disabled="downloadingId === item.pe_id" 
            @click="downloadImage(item)"
          >
            <span v-if="downloadingId === item.pe_id" class="spinner spinner-dl"></span>
            <span v-else>⬇</span>
              {{ downloadingId === item.pe_id ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด' }}
          </button>
          </div>
        </div>
      </div>

              <div v-else class="empty-state">
                <div class="empty-icon">{{ drawerName.trim() === '' ? '✏️' : '🔍' }}</div>
                <p>{{ drawerName.trim() === '' ? 'กรุณาพิมพ์ชื่อผู้วาด' : 'ไม่พบผลลัพธ์' }}</p>
                <p class="empty-hint">{{ drawerName.trim() === '' ? 'ใส่ชื่อในช่องค้นหาแล้วกดค้นหา' : 'ลองเปลี่ยนชื่อผู้วาด' }}</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// const API_BASE = import.meta.env.VITE_API_BASE || ''
const API_BASE = "http://localhost:5000" // กำหนดค่าเริ่มต้นเป็น localhost ใช้สำหรับทดสอบในเครื่องถ้าไม่มีการตั้งค่า VITE_API_BASE ใน .env จะใช้ค่านี้แทน
const apiBase = API_BASE
console.log('API_BASE =', API_BASE)

const downloadingId = ref(null)
async function downloadImage(item) {
  if (downloadingId.value) return
  downloadingId.value = item.pe_id
  try {
    const token = localStorage.getItem("token")
    //ดึงชื่อไฟล์จาก url_path
    const filename = item.url_path.split('/').pop()
    const url = `${apiBase}/api/download/${filename}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
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


const isSplash = ref(true)
const drawerName = ref('')
const entries = ref([])
const loading = ref(false)
const searched = ref(false)
const showModal = ref(false)
const latestImages = ref([])
const carouselTrack = ref(null)
const searchText = ref('')

// Duplicate latest images for seamless infinite scroll
const duplicatedLatest = computed(() => {
  if (latestImages.value.length === 0) return []
  return [...latestImages.value, ...latestImages.value]
})

// ฟังก์ชันค้นหาที่อัพเดตใหม่:การค้นหาทั้งชื่อและเบอร์โทร
async function searchImages() {

  const keyword = searchText.value.trim()

  if (!keyword) {
    entries.value = []
    showModal.value = true
    return
  }

  showModal.value = true
  loading.value = true

  try {
    const params = new URLSearchParams()

    // 🔥 Smart detect
    const isPhone = /^[0-9]+$/.test(keyword)

    if (isPhone) {
      params.set('phone', keyword)
    } else {
      params.set('owner', keyword)
    }

    const token = localStorage.getItem('token')

    const res = await fetch(
      `${apiBase}/api/pictures?${params.toString()}`,
      {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    const data = await res.json()
    entries.value = data.ok ? (data.pictures || []) : []

  } catch (err) {
    console.error('Search failed:', err)
    entries.value = []
  } finally {
    loading.value = false
  }
}


function closeModal() {
  showModal.value = false
}

async function fetchLatest() {
  try {
    const token = localStorage.getItem('token')

    const res = await fetch(`${apiBase}/api/gallery`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const data = await res.json()
    console.log("Latest:", data)

    if (data.ok && data.entries) {
      latestImages.value = data.pictures // แก้ชื่อ key เป็น pictures ตามที่ backend ส่งมา
    }

  } catch (err) {
    console.error('Failed to fetch latest:', err)
  }
}

onMounted(() => {
  fetchLatest()
  setTimeout(() => {
    isSplash.value = false
  }, 1200)
})

onUnmounted(() => {
  // cleanup placeholder
})
</script>

<style>
/* Reset CSS */
body, html, #app {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  background-color: #f4f6f9 !important;
  place-items: start !important;
  overflow-x: hidden;
}
</style>

<!-- Global styles for Teleported modal -->
<style>
/* ================= Modal Popup ================= */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  overflow-y: auto;
}

.modal-container {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 880px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  margin: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}

.modal-title {
  color: #fff;
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}

.modal-close {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  font-size: 1.2rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.modal-close:hover {
  background: rgba(255,255,255,0.35);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-body .image-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.modal-body .image-card {
  width: 240px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e8eaf0;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  transition: transform 0.2s, box-shadow 0.2s;
}

.modal-body .image-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

.modal-body .card-img-wrap {
  position: relative;
  width: 100%;
  height: 160px;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.modal-body .card-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.modal-body .type-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.modal-body .badge-sky {
  background: rgba(56, 189, 248, 0.15);
  color: #0284c7;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.modal-body .badge-ground {
  background: rgba(52, 211, 153, 0.15);
  color: #059669;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.modal-body .badge-water {
  background: rgba(96, 165, 250, 0.15);
  color: #2563eb;
  border: 1px solid rgba(96, 165, 250, 0.3);
}

.modal-body .card-body {
  padding: 12px 14px;
}

.modal-body .card-creature {
  font-weight: 700;
  font-size: 1rem;
  color: #222;
  margin-bottom: 4px;
}

.modal-body .card-drawer {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 2px;
}

.modal-body .card-time {
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 10px;
}

.modal-body .download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  border: none;
  cursor: pointer;
  text-align: center;
  padding: 10px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.15s;
}

.modal-body .download-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.modal-body .download-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.modal-body .download-btn .spinner-dl {
  width: 13px;
  height: 13px;
  border-width: 2px;
  border-color: rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-style: solid;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

.modal-body .download-btn:hover {
  opacity: 0.85;
}

.modal-body .empty-state {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

.modal-body .empty-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

.modal-body .empty-hint {
  font-size: 0.8rem;
  color: #bbb;
  margin-top: 4px;
}

.modal-loading {
  text-align: center;
  padding: 60px 0;
  color: #777;
}

.modal-loading .spinner {
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid rgba(42, 82, 152, 0.2);
  border-top-color: #2a5298;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-bottom: 12px;
}

/* ================= Modal Transition ================= */
.modal-enter-active {
  transition: opacity 0.3s ease;
}
.modal-enter-active .modal-container {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-leave-active .modal-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-container {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal-container {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
</style>

<style scoped>
/* ================= โครงสร้างหลัก ================= */
* {
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* ================= Header & Logo ================= */
.header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  /* เพิ่ม cubic-bezier ให้แอนิเมชันตอนหดตัวดูเด้งๆ นุ่มนวลขึ้น */
  transition: all 0.8s cubic-bezier(0.65, 0, 0.05, 1);
  z-index: 50;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

/* สถานะที่ 1: โชว์ 1.2 วิแรก (เต็มจอ) */
.header-splash {
  height: 100vh;
}

/* สถานะที่ 2: หลังจาก 1.2 วิ (เตรียมพร้อมให้เลื่อน) */
.header-ready {
  height: 35vh; 
}

.logo {
  color: #ffffff;
  font-size: 3.5rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ================= Main Content ================= */
.main-content {
  padding-top: 35vh;
  width: 100%;
  flex: 1;
}

/* แอนิเมชันตอนหน้าค้นหาโผล่ขึ้นมา */
.fade-up-anim {
  opacity: 0;
  transform: translateY(30px);
  /* หน่วงเวลาให้รอ Header หดตัวแป๊บนึงก่อนค่อยลอยขึ้นมา */
  animation: fadeUpEffect 0.6s forwards 0.2s; 
}

@keyframes fadeUpEffect {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.content-wrapper {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  color: #333;
  font-size: 1.25rem;
  margin-bottom: 10px;
  text-align: center;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  margin-left: 5px;
}

.custom-input {
  width: 100%;
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid #e1e1e1;
  background-color: #fff;
  color: #333;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
}

.custom-input:focus {
  border-color: #2a5298;
  box-shadow: 0 4px 15px rgba(42, 82, 152, 0.15);
}



/* ================= Buttons ================= */
.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.search-btn {
  flex: 1;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white;
  border: none;
  border-radius: 16px;
  padding: 16px;
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(42, 82, 152, 0.3);
  transition: transform 0.2s, opacity 0.2s;
}

.search-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ================= Spinner ================= */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ================= Results ================= */
.result-count {
  font-size: 0.9rem;
  color: #777;
  text-align: center;
  margin: 0;
}

/* ================= Image Grid ================= */
.image-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.image-card {
  width: 260px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e8eaf0;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  transition: transform 0.2s, box-shadow 0.2s;
}

.image-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

.card-img-wrap {
  position: relative;
  width: 100%;
  height: 180px;
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
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-sky {
  background: rgba(56, 189, 248, 0.15);
  color: #0284c7;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.badge-ground {
  background: rgba(52, 211, 153, 0.15);
  color: #059669;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.badge-water {
  background: rgba(96, 165, 250, 0.15);
  color: #2563eb;
  border: 1px solid rgba(96, 165, 250, 0.3);
}

.card-body {
  padding: 12px 14px;
}

.card-creature {
  font-weight: 700;
  font-size: 1rem;
  color: #222;
  margin-bottom: 4px;
}

.card-drawer {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 2px;
}

.card-time {
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 10px;
}

.download-btn {
  display: block;
  width: 100%;
  text-align: center;
  padding: 10px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.2s;
}

.download-btn:hover {
  opacity: 0.85;
}

/* ================= Empty State ================= */
.empty-state {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 0.8rem;
  color: #bbb;
  margin-top: 4px;
}

/* ================= Latest Carousel ================= */
.carousel-section {
  padding: 20px 0 10px;
  overflow: hidden;
}

.carousel-title {
  text-align: center;
  font-size: 1.2rem;
  color: #333;
  margin-bottom: 14px;
}

.carousel-track-wrapper {
  overflow: hidden;
  width: 100%;
  position: relative;
  mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
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
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.carousel-card {
  flex-shrink: 0;
  width: 160px;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
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
  font-size: 0.8rem;
  font-weight: 600;
  color: #444;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ================= Responsive Breakpoints ================= */

/* Tablet & below (≤ 900px) */
@media (max-width: 900px) {
  .header-ready {
    height: 30vh;
  }

  .main-content {
    padding-top: 30vh;
  }

  .modal-body .image-grid {
    gap: 12px;
  }

  .modal-body .image-card {
    width: 200px;
  }
}

/* Mobile landscape / small tablet (≤ 768px) */
@media (max-width: 768px) {
  .carousel-card {
    width: 120px;
  }

  .carousel-img {
    height: 90px;
  }

  .carousel-label {
    font-size: 0.72rem;
  }

  .header-ready {
    height: 28vh;
  }

  .main-content {
    padding-top: 28vh;
  }

  .logo {
    font-size: 2.8rem;
  }

  .content-wrapper {
    padding: 28px 16px;
    gap: 16px;
  }

  .section-title {
    font-size: 1.1rem;
  }

  /* Modal: tighter on tablet */
  .modal-overlay {
    padding: 20px 10px;
  }

  .modal-container {
    max-height: 90vh;
    border-radius: 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-body .image-card {
    width: 180px;
  }
}

/* Mobile portrait (≤ 600px) */
@media (max-width: 600px) {
  .header-ready {
    height: 220px;
  }

  .logo {
    font-size: 2.2rem;
    letter-spacing: -0.5px;
  }

  .content-wrapper {
    padding: 24px 14px;
    gap: 14px;
  }

  .section-title {
    font-size: 1rem;
  }

  .custom-input {
    padding: 14px 16px;
    font-size: 0.95rem;
    border-radius: 14px;
  }

  .search-btn {
    padding: 14px;
    font-size: 0.95rem;
    border-radius: 14px;
  }

  /* Carousel */
  .carousel-section {
    padding: 14px 0 8px;
  }

  .carousel-title {
    font-size: 1rem;
    margin-bottom: 10px;
  }

  .carousel-card {
    width: 110px;
  }

  .carousel-img {
    height: 80px;
  }

  .carousel-label {
    font-size: 0.68rem;
    padding: 5px 8px;
  }

  /* Modal: tighter padding on mobile */
  .modal-overlay {
    padding: 12px;
  }

  .modal-container {
    border-radius: 16px;
    max-height: 90vh;
  }

  .modal-header {
    padding: 14px 18px;
  }

  .modal-title {
    font-size: 1rem;
  }

  .modal-body {
    padding: 14px 12px;
  }

  /* Cards: 2 columns on mobile */
  .modal-body .image-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    justify-items: center;
  }

  .modal-body .image-card {
    width: 100%;
  }

  .modal-body .card-img-wrap {
    height: 130px;
  }
}

/* Very small phones (≤ 400px) */
@media (max-width: 400px) {
  .header-ready {
    height: 190px;
  }

  .main-content {
    padding-top: 190px;
  }

  .logo {
    font-size: 1.8rem;
  }

  .content-wrapper {
    padding: 20px 12px;
  }

  .btn-row {
    flex-direction: column;
  }

  .carousel-card {
    width: 95px;
  }

  .carousel-img {
    height: 68px;
  }

  .modal-body .image-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .modal-body .card-img-wrap {
    height: 110px;
  }

  .modal-body .card-creature {
    font-size: 0.88rem;
  }
}
</style>