<template>
  <div class="app-container">
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
        <div style="display:flex;justify-content:flex-end;">
          <button class="search-btn" style="max-width:140px;padding:10px 14px;" @click="logout">
            ออกจากระบบ
          </button>
        </div>

        <h2 class="section-title">เมนูผู้ใช้งาน</h2>

        <div v-if="activeView === 'menu'" class="option-grid">
          <button class="option-card" @click="openOptionModal('upload')">
            <div class="option-icon">📤</div>
            <div class="option-title">ลงทะเบียนรูป Upload</div>
            <div class="option-sub">อัปโหลดรูปเพื่อเข้าระบบ</div>
          </button>
          <button class="option-card" @click="openOptionModal('download')">
            <div class="option-icon">🖼️</div>
            <div class="option-title">เลือกดาวน์โหลดรูป</div>
            <div class="option-sub">ค้นหาและดาวน์โหลดรูปของคุณ</div>
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
            <button class="search-btn ghost-btn" @click="activeView = 'menu'">
              กลับเมนู
            </button>
          </div>
        </div>
      </div>
    </main>

    <main v-else-if="!isSplash" class="main-content fade-up-anim">
      <div class="content-wrapper">
        <h2 class="section-title">เข้าสู่ระบบด้วยเบอร์โทรศัพท์</h2>
        <div class="input-group">
          <label>เบอร์โทรศัพท์</label>
          <input
            v-model="phoneInput"
            type="tel"
            inputmode="numeric"
            maxlength="10"
            placeholder="เช่น 0812345678"
            class="custom-input"
            @input="phoneInput = phoneInput.replace(/\D/g, '').slice(0, 10)"
            @keyup.enter="loginWithPhone"
          />
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
                <div class="empty-icon">{{ searchText.trim() === '' ? '✏️' : '🔍' }}</div>
                <p>{{ searchText.trim() === '' ? 'กรุณาพิมพ์คำค้นหา' : 'ไม่พบผลลัพธ์' }}</p>
                <p class="empty-hint">{{ searchText.trim() === '' ? 'ใส่ชื่อหรือเบอร์โทรแล้วกดค้นหา' : 'ลองเปลี่ยนคำค้นหา' }}</p>
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

// const API_BASE = import.meta.env.VITE_API_BASE || ''
const API_BASE = "http://localhost:5000" // กำหนดค่าเริ่มต้นเป็น localhost ใช้สำหรับทดสอบในเครื่องถ้าไม่มีการตั้งค่า VITE_API_BASE ใน .env จะใช้ค่านี้แทน
const apiBase = API_BASE
console.log('API_BASE =', API_BASE)

const phoneInput = ref('')
const loginLoading = ref(false)
const loginError = ref('')
const isLoggedIn = ref(Boolean(localStorage.getItem('token')))
const activeView = ref('menu')
const showOptionModal = ref(false)
const optionTarget = ref('upload')

const uploadOwnerName = ref('')
const uploadCreatureName = ref('')
const uploadType = ref('ground')
const uploadImageData = ref('')
const uploadPreview = ref('')
const uploadLoading = ref(false)
const uploadMessage = ref('')

const downloadingId = ref(null)
function getToken() {
  return localStorage.getItem('token') || ''
}

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

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
    const doUserLogin = async () => {
      const res = await fetch(`${apiBase}/api/auth/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      let data = null
      try {
        data = await res.json()
      } catch (_err) {
        data = null
      }
      return { res, data }
    }

    let { res, data } = await doUserLogin()

    // ถ้าไม่พบผู้ใช้ในฐานข้อมูล ให้สมัครสมาชิกอัตโนมัติ แล้วลอง login ใหม่
    if (res.status === 404) {
      const regRes = await fetch(`${apiBase}/api/auth/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pdpa: true })
      })
      let regData = null
      try {
        regData = await regRes.json()
      } catch (_err) {
        regData = null
      }

      if (!regRes.ok || !regData?.ok) {
        loginError.value = regData?.error || 'สมัครสมาชิกไม่สำเร็จ'
        return
      }

      ;({ res, data } = await doUserLogin())
    }

    if (!res.ok || !data?.ok || !data?.token) {
      loginError.value = data?.error || 'เข้าสู่ระบบไม่สำเร็จ'
      return
    }

    localStorage.setItem('token', data.token)
    isLoggedIn.value = true
    activeView.value = 'menu'
    await fetchLatest()
  } catch (_err) {
    loginError.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  } finally {
    loginLoading.value = false
  }
}

async function submitUpload() {
  if (!uploadOwnerName.value.trim()) {
    uploadMessage.value = 'กรุณากรอกชื่อเจ้าของรูป'
    return
  }
  if (!uploadCreatureName.value.trim()) {
    uploadMessage.value = 'กรุณากรอกชื่อสัตว์'
    return
  }
  if (!uploadImageData.value) {
    uploadMessage.value = 'กรุณาเลือกรูปภาพก่อน'
    return
  }
  const phone = phoneInput.value.replace(/\D/g, '').slice(0, 10)
  if (phone.length !== 10) {
    uploadMessage.value = 'กรุณาเข้าสู่ระบบด้วยเบอร์โทร 10 หลัก'
    return
  }

  uploadLoading.value = true
  uploadMessage.value = 'กำลังส่งรูปเข้าคิว...'

  try {
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

    uploadMessage.value = 'ลงทะเบียนรูปสำเร็จแล้ว'
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

async function downloadImage(item) {
  if (downloadingId.value) return
  downloadingId.value = item.pe_id
  try {
    //ดึงชื่อไฟล์จาก url_path
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


const isSplash = ref(true)
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

    const res = await authFetch(
      `${apiBase}/api/pictures?${params.toString()}`,
      {
        cache: 'no-store'
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
  if (!isLoggedIn.value) {
    latestImages.value = []
    return
  }
  try {
    const res = await authFetch(`${apiBase}/api/gallery`, { cache: 'no-store' })

    const data = await res.json()
    console.log("Latest:", data)

    if (data.ok && Array.isArray(data.pictures)) {
      latestImages.value = data.pictures
    }

  } catch (err) {
    console.error('Failed to fetch latest:', err)
  }
}

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

.ghost-btn {
  background: #ffffff;
  color: #1e3c72;
  border: 1px solid #c8d6f3;
  box-shadow: none;
}

.panel-card {
  background: #fff;
  border: 1px solid #e8eaf0;
  border-radius: 16px;
  padding: 16px;
}

.panel-title {
  margin-top: 0;
  margin-bottom: 14px;
  color: #1e3c72;
}

.option-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.option-card {
  border: 1px solid #d9e4ff;
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}

.option-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(30, 60, 114, 0.12);
}

.option-icon {
  font-size: 1.4rem;
  margin-bottom: 6px;
}

.option-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1e3c72;
}

.option-sub {
  font-size: 0.82rem;
  color: #6b7280;
  margin-top: 4px;
}

.upload-preview-wrap {
  margin-top: 10px;
  width: 100%;
  border: 1px dashed #bfd0f4;
  border-radius: 12px;
  padding: 10px;
  background: #f8fbff;
}

.upload-preview {
  width: 100%;
  max-height: 260px;
  object-fit: contain;
}

.upload-message {
  margin-top: 10px;
  margin-bottom: 0;
  color: #1e3c72;
  font-size: 0.9rem;
  font-weight: 600;
}

.option-modal {
  max-width: 560px;
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
  .option-grid {
    grid-template-columns: 1fr;
  }

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
