<template>
  <div class="app-container">

    <!-- ========== Register Page (full screen overlay) ========== -->
    <Transition name="slide-up">
      <div v-if="showRegister" class="register-overlay">
        <RegisterView :apiBase="apiBase" @back="showRegister = false" @registered="onRegistered" />
      </div>
    </Transition>

    <header :class="['header', { 'header-splash': isSplash, 'header-ready': !isSplash }]">
      <div class="logo">
        <span class="logo-icon">✨</span> LOGO
      </div>
    </header>

    <main v-if="!isSplash && isLoggedIn" class="main-content fade-up-anim">
      <!-- ========== Latest Images Carousel ========== -->
      <div v-if="latestImages.length > 0" class="carousel-section">
        <h2 class="carousel-title">🌟 ภาพล่าสุด</h2>
        <div class="carousel-track-wrapper">
          <div class="carousel-track" ref="carouselTrack">
            <div v-for="(img, idx) in duplicatedLatest" :key="'lat-' + idx" class="carousel-card">
              <img :src="apiBase + '/' + img.url_path" :alt="img.creature_name" class="carousel-img" loading="lazy" />
              <div class="carousel-label">
                {{ img.creature_name || 'ไม่ระบุ' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="content-wrapper">
        <div style="display:flex;justify-content:flex-end;">
          <button class="search-btn" style="max-width:140px;padding:10px 14px;" @click="logout">
            ออกจากระบบ
          </button>
        </div>

        <h2 class="section-title">เมนูผู้ใช้งาน</h2>

        <div v-if="activeView === 'menu'" class="option-grid">
          <button class="option-card" @click="autoSearchMyImages">
            <div class="option-icon">🖼️</div>
            <div class="option-title">ดาวน์โหลดรูปของฉัน</div>
            <div class="option-sub">ค้นหารูปจากเบอร์โทรที่ลงทะเบียน</div>
          </button>
        </div>

        <div v-else-if="activeView === 'upload'" class="panel-card">
          <h3 class="panel-title">ลงทะเบียนรูป Upload</h3>

          <div class="input-group">
            <label>ชื่อเจ้าของรูป</label>
            <input v-model="uploadOwnerName" type="text" class="custom-input" placeholder="เช่น น้องมิว" />
          </div>
          <div class="input-group">
            <label>ชื่อสัตว์</label>
            <input v-model="uploadCreatureName" type="text" class="custom-input" placeholder="เช่น อินทรีทอง" />
          </div>
          <div class="input-group">
            <label>ประเภทสัตว์</label>
            <select v-model="uploadType" class="custom-input">
              <option value="ground">Ground</option>
              <option value="sky">Sky</option>
              <option value="water">Water</option>
            </select>
          </div>
          <div class="input-group">
            <label>เลือกรูปภาพ</label>
            <input type="file" accept="image/*" class="custom-input" @change="onUploadFileChange" />
          </div>

          <div v-if="uploadPreview" class="upload-preview-wrap">
            <img :src="uploadPreview" alt="upload preview" class="upload-preview" />
          </div>

          <p v-if="uploadMessage" class="upload-message">{{ uploadMessage }}</p>

          <div class="btn-row">
            <button class="search-btn" @click="submitUpload" :disabled="uploadLoading">
              <span v-if="uploadLoading" class="spinner"></span>
              <span v-else>📤</span>
              {{ uploadLoading ? 'กำลังประมวลผล...' : 'อัปโหลดและลงทะเบียน' }}
            </button>
            <button class="search-btn ghost-btn" @click="activeView = 'menu'" :disabled="uploadLoading">
              กลับเมนู
            </button>
          </div>
        </div>

        <div v-else-if="activeView === 'download'" class="panel-card">
          <h3 class="panel-title">เลือกดาวน์โหลดรูป</h3>
          <div class="input-group">
            <label>ค้นหาชื่อหรือเบอร์โทร</label>
            <input v-model="searchText" type="text" placeholder="พิมพ์ชื่อ หรือ เบอร์โทร..." class="custom-input"
              @keyup.enter="searchImages" />
          </div>
          <div class="btn-row">
            <button class="search-btn" @click="searchImages" :disabled="loading">
              <span v-if="loading" class="spinner"></span>
              <span v-else>🔍</span>
              {{ loading ? 'กำลังค้นหา...' : 'ค้นหา' }}
            </button>
            <button class="search-btn ghost-btn" @click="activeView = 'menu'">
              กลับเมนู
            </button>
          </div>
        </div>
      </div>
    </main>

    <main v-else-if="!isSplash" class="main-content fade-up-anim">
      <div class="content-wrapper">
        <h2 class="section-title">เมนู</h2>
        <div class="option-grid">
          <button class="option-card" @click="showRegister = true">
            <div class="option-icon">📸</div>
            <div class="option-title">ลงทะเบียนรูป</div>
            <div class="option-sub">อัปโหลดรูปเพื่อเข้าระบบ</div>
          </button>
        </div>

        <!-- Login อยู่ล่างสุด -->
        <div class="divider-row" style="margin-top:32px;">
          <span class="divider-line"></span>
          <span class="divider-text">เข้าสู่ระบบ</span>
          <span class="divider-line"></span>
        </div>
        <div class="input-group">
          <label>เบอร์โทรศัพท์</label>
          <input v-model="phoneInput" type="tel" inputmode="numeric" maxlength="10" placeholder="เช่น 0812345678"
            class="custom-input" @input="phoneInput = phoneInput.replace(/\D/g, '').slice(0, 10)"
            @keyup.enter="loginWithPhone" />
        </div>
        <p v-if="loginError" style="color:#c62828;margin:0;">{{ loginError }}</p>
        <div class="btn-row">
          <button class="search-btn" @click="loginWithPhone" :disabled="loginLoading">
            <span v-if="loginLoading" class="spinner"></span>
            <span v-else>🔐</span>
            {{ loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
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
                <div v-for="item in entries" :key="item.pe_id" class="image-card">
                  <div class="card-img-wrap">
                    <img :src="apiBase + '/' + item.url_path" alt="image" class="card-img" loading="lazy" />
                  </div>
                  <div class="card-body">
                    <div class="card-creature">
                      {{ item.owner_name || 'ไม่ระบุชื่อ' }}
                    </div>
                    <div class="card-time">
                      {{ item.upload_timestamp }}
                    </div>
                    <button class="download-btn" :disabled="downloadingId === item.pe_id" @click="downloadImage(item)">
                      <span v-if="downloadingId === item.pe_id" class="spinner spinner-dl"></span>
                      <span v-else>⬇</span>
                      {{ downloadingId === item.pe_id ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด' }}
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="empty-state">
                <div class="empty-icon">{{ searchText.trim() === '' ? '✏️' : '🔍' }}</div>
                <p>{{ searchText.trim() === '' ? 'กรุณาพิมพ์คำค้นหา' : 'ไม่พบผลลัพธ์' }}</p>
                <p class="empty-hint">{{ searchText.trim() === '' ? 'ใส่ชื่อหรือเบอร์โทรแล้วกดค้นหา' :
                  'ลองเปลี่ยนคำค้นหา' }}</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ========== Option Entry Popup Modal ========== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showOptionModal" class="modal-overlay" @click.self="closeOptionModal">
          <div class="modal-container option-modal">
            <div class="modal-header">
              <h3 class="modal-title">🚪 เข้าสู่ตัวเลือก</h3>
              <button class="modal-close" @click="closeOptionModal">✕</button>
            </div>
            <div class="modal-body">
              <p>
                {{ optionTarget === 'upload'
                  ? 'คุณต้องการเข้าสู่หน้า ลงทะเบียนรูป Upload ใช่หรือไม่'
                  : 'คุณต้องการเข้าสู่หน้า เลือกดาวน์โหลดรูป ใช่หรือไม่' }}
              </p>
              <div class="btn-row">
                <button class="search-btn" @click="enterOption">
                  เข้าสู่หน้า
                </button>
                <button class="search-btn ghost-btn" @click="closeOptionModal">
                  ยกเลิก
                </button>
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
import RegisterView from './components/RegisterView.vue'

// ============================================================
// API Base URL – กำหนดค่าจาก vite.config.js เท่านั้น
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE
const apiBase = API_BASE
console.log('[App] API_BASE =', API_BASE)

// ============================================================
// Auth & State
// ============================================================
const phoneInput = ref('')
const loginLoading = ref(false)
const loginError = ref('')
const isLoggedIn = ref(Boolean(localStorage.getItem('token')))
const activeView = ref('menu')
const showOptionModal = ref(false)
const optionTarget = ref('upload')

const showRegister = ref(false)

function onRegistered({ name, phone }) {
  phoneInput.value = phone
  showRegister.value = false
  setTimeout(() => loginWithPhone(), 600)
}



// ============================================================
// Upload state
// ============================================================
const uploadOwnerName = ref('')
const uploadCreatureName = ref('')
const uploadType = ref('ground')
const uploadImageData = ref('')
const uploadPreview = ref('')
const uploadLoading = ref(false)
const uploadMessage = ref('')

// ============================================================
// Download / Search state
// ============================================================
const downloadingId = ref(null)
const isSplash = ref(true)
const entries = ref([])
const loading = ref(false)
const searched = ref(false)
const showModal = ref(false)
const latestImages = ref([])
const carouselTrack = ref(null)
const searchText = ref('')

// ============================================================
// Computed
// ============================================================
const duplicatedLatest = computed(() => {
  if (latestImages.value.length === 0) return []
  return [...latestImages.value, ...latestImages.value]
})

// ============================================================
// Helpers
// ============================================================
function getToken() {
  return localStorage.getItem('token') || ''
}

/** fetch พร้อม Authorization header; logout อัตโนมัติถ้า 401 */
async function authFetch(url, options = {}) {
  const token = getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (res.status === 401) {
    logout()
    throw new Error('UNAUTHORIZED')
  }
  return res
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ============================================================
// Auth – Login & Logout
// ============================================================
function logout() {
  localStorage.removeItem('token')
  isLoggedIn.value = false
  activeView.value = 'menu'
  showOptionModal.value = false
  optionTarget.value = 'upload'
  loginError.value = ''
  phoneInput.value = ''
  entries.value = []
  latestImages.value = []
}

async function loginWithPhone() {
  const phone = phoneInput.value.replace(/\D/g, '').slice(0, 10)
  phoneInput.value = phone
  if (phone.length !== 10) {
    loginError.value = 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก'
    return
  }
  loginLoading.value = true
  loginError.value = ''
  try {
    // ฟังก์ชันย่อย: ส่ง login request
    const doUserLogin = async () => {
      const res = await fetch(`${apiBase}/api/auth/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      let data = null
      try { data = await res.json() } catch (_) { data = null }
      return { res, data }
    }

    let { res, data } = await doUserLogin()

    // ถ้าไม่พบผู้ใช้ → สมัครอัตโนมัติ แล้ว login ใหม่
    if (res.status === 404) {
      const regRes = await fetch(`${apiBase}/api/auth/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pdpa: true })
      })
      let regData = null
      try { regData = await regRes.json() } catch (_) { regData = null }

      if (!regRes.ok || !regData?.ok) {
        loginError.value = regData?.error || 'สมัครสมาชิกไม่สำเร็จ'
        return
      }
      ; ({ res, data } = await doUserLogin())
    }

    if (!res.ok || !data?.ok || !data?.token) {
      loginError.value = data?.error || 'เข้าสู่ระบบไม่สำเร็จ'
      return
    }

    localStorage.setItem('token', data.token)
    localStorage.setItem('loginPhone', phone)
    isLoggedIn.value = true
    searchText.value = phone
    activeView.value = 'menu'
    await fetchLatest()
  } catch (_err) {
    loginError.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  } finally {
    loginLoading.value = false
  }
}

// ============================================================
// Option Modal
// ============================================================
function openOptionModal(target) {
  optionTarget.value = target
  showOptionModal.value = true
}

function closeOptionModal() {
  showOptionModal.value = false
}

function enterOption() {
  activeView.value = optionTarget.value
  showOptionModal.value = false
}

// ============================================================
// Upload – POST /api/capture_process → /api/approve
// ============================================================
async function onUploadFileChange(event) {
  const file = event?.target?.files?.[0]
  if (!file) return
  try {
    const dataUrl = await readFileAsDataUrl(file)
    uploadImageData.value = dataUrl
    uploadPreview.value = dataUrl
    uploadMessage.value = ''
  } catch (_err) {
    uploadMessage.value = 'อ่านไฟล์รูปไม่สำเร็จ'
  }
}

async function submitUpload() {
  if (!uploadOwnerName.value.trim()) { uploadMessage.value = 'กรุณากรอกชื่อเจ้าของรูป'; return }
  if (!uploadCreatureName.value.trim()) { uploadMessage.value = 'กรุณากรอกชื่อสัตว์'; return }
  if (!uploadImageData.value) { uploadMessage.value = 'กรุณาเลือกรูปภาพก่อน'; return }
  const phone = phoneInput.value.replace(/\D/g, '').slice(0, 10)
  if (phone.length !== 10) { uploadMessage.value = 'กรุณาเข้าสู่ระบบด้วยเบอร์โทร 10 หลัก'; return }

  uploadLoading.value = true
  uploadMessage.value = 'กำลังส่งรูปเข้าคิว...'

  try {
    // 1) ส่งรูปเข้า queue
    const captureRes = await fetch(`${apiBase}/api/capture_process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_data: uploadImageData.value,
        type: uploadType.value,
        drawer_name: uploadOwnerName.value.trim(),
        phone_number: phone,
        requester_name: uploadOwnerName.value.trim()
      })
    })
    const captureData = await captureRes.json()
    if (!captureRes.ok || !captureData?.ok || !captureData?.job_id) {
      uploadMessage.value = captureData?.error || 'ส่งรูปไม่สำเร็จ'
      return
    }

    const jobId = captureData.job_id
    const queuePos = Number(captureData?.queue_position || 0)
    const queueTotal = Number(captureData?.queue_total || 0)
    uploadMessage.value = queuePos > 0 ? `รอคิวประมวลผล ${queuePos}/${queueTotal || queuePos}` : 'กำลังประมวลผลรูป...'

    // 2) Poll queue_status จนกว่าจะ READY_FOR_REVIEW
    let ready = false
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 800))
      const statusRes = await fetch(`${apiBase}/api/queue_status/${encodeURIComponent(jobId)}`, { cache: 'no-store' })
      const statusData = await statusRes.json()
      if (!statusRes.ok) continue

      const qPos = Number(statusData?.queue_position || 0)
      const qTotal = Number(statusData?.queue_total || 0)
      if (statusData?.state === 'QUEUED' && qPos > 0) {
        uploadMessage.value = `รอคิวประมวลผล ${qPos}/${qTotal || qPos}`
      } else {
        uploadMessage.value = statusData?.message || 'กำลังประมวลผลรูป...'
      }

      if (statusData?.state === 'FAILED') {
        uploadMessage.value = statusData?.error || statusData?.message || 'ประมวลผลไม่สำเร็จ'
        return
      }
      if (statusData?.state === 'READY_FOR_REVIEW') {
        ready = true
        break
      }
    }

    if (!ready) {
      uploadMessage.value = 'หมดเวลารอการประมวลผล กรุณาลองใหม่'
      return
    }

    // 3) Approve → บันทึกรูปลง DB
    uploadMessage.value = 'กำลังบันทึกและอนุมัติ...'
    const approveRes = await fetch(`${apiBase}/api/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        type: uploadType.value,
        name: uploadCreatureName.value.trim(),
        drawer_name: uploadOwnerName.value.trim(),
        phone_number: phone
      })
    })
    const approveData = await approveRes.json()
    if (!approveRes.ok || !approveData?.ok) {
      uploadMessage.value = approveData?.error || 'อนุมัติไม่สำเร็จ'
      return
    }

    uploadMessage.value = 'ลงทะเบียนรูปสำเร็จแล้ว ✅'
    uploadImageData.value = ''
    uploadPreview.value = ''
    uploadCreatureName.value = ''
    await fetchLatest()
  } catch (_err) {
    uploadMessage.value = 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'
  } finally {
    uploadLoading.value = false
  }
}

// ============================================================
// Download – GET /api/download/<filename>
// ============================================================
async function downloadImage(item) {
  if (downloadingId.value) return
  downloadingId.value = item.pe_id
  try {
    const filename = item.url_path.split('/').pop()
    const url = `${apiBase}/api/download/${filename}`
    const res = await authFetch(url)

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

// ============================================================
// Auto Search – ค้นหารูปจากเบอร์ที่ login ไว้โดยอัตโนมัติ
// ============================================================
async function autoSearchMyImages() {
  // ใช้เบอร์จาก login
  const phone = searchText.value.trim() || localStorage.getItem('loginPhone') || phoneInput.value
  if (phone) {
    searchText.value = phone
  }
  await searchImages()
}

// ============================================================
// Search – GET /api/pictures?phone=... | ?owner=...
// ============================================================
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
    // ตรวจสอบว่าเป็นเบอร์โทรหรือชื่อ
    const isPhone = /^[0-9]+$/.test(keyword)
    if (isPhone) {
      params.set('phone', keyword)
    } else {
      params.set('owner', keyword)
    }

    const res = await authFetch(
      `${apiBase}/api/pictures?${params.toString()}`,
      { cache: 'no-store' }
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

// ============================================================
// Gallery – GET /api/gallery (latest images)
// ============================================================
async function fetchLatest() {
  if (!isLoggedIn.value) {
    latestImages.value = []
    return
  }
  try {
    const res = await authFetch(`${apiBase}/api/gallery`, { cache: 'no-store' })
    const data = await res.json()
    console.log('[App] Latest gallery:', data)
    if (data.ok && Array.isArray(data.pictures)) {
      latestImages.value = data.pictures
    }
  } catch (err) {
    console.error('Failed to fetch latest:', err)
  }
}

// ============================================================
// Lifecycle
// ============================================================
onMounted(() => {
  if (isLoggedIn.value) fetchLatest()
  setTimeout(() => {
    isSplash.value = false
  }, 1200)
})

onUnmounted(() => {
  // cleanup placeholder
})
</script>

<style>
/* นำเข้า CSS จากไฟล์แยก */
@import './app.css';

/* ── Register overlay ── */
.register-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: #f4f6f9;
  overflow-y: auto;
}

/* ── Divider row (หรือ) ── */
.divider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: #d9e0ec;
}

.divider-text {
  font-size: 0.82rem;
  color: #999;
  white-space: nowrap;
}

.register-entry-btn {
  font-size: 0.95rem;
}

/* ── Slide-up transition ── */
.slide-up-enter-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}

.slide-up-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}

.slide-up-enter-from {
  transform: translateY(40px);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>