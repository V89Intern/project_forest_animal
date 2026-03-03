<template>
    <div class="reg-page">
        <!-- Header -->
        <div class="reg-header">
            <h2 class="reg-title">📸 ลงทะเบียนรูป</h2>
            <p class="reg-sub">เลือกรูปภาพพร้อมกรอกข้อมูลเพื่อลงทะเบียน</p>
        </div>

        <div class="reg-body">

            <!-- ===== อัปโหลดรูป ===== -->
            <div class="upload-section">
                <!-- ยังไม่เลือกรูป -->
                <div v-if="!imagePreview" class="upload-choice">
                    <div class="upload-drop-zone" @click="showCamera = true">
                        <div class="upload-icon">📷</div>
                        <p class="upload-text">เปิดกล้องสแกน</p>
                        <p class="upload-hint">* วางกระดาษ แล้วถ่ายอัตโนมัติ *</p>
                    </div>
                    <div class="upload-drop-zone upload-alt" @click="triggerFilePicker">
                        <div class="upload-icon">📁</div>
                        <p class="upload-text">เลือกจากคลังรูป</p>
                        <p class="upload-hint">* เลือกรูปที่ถ่ายไว้แล้ว *</p>
                    </div>
                </div>

                <!-- preview รูปที่เลือก -->
                <div v-else class="preview-box">
                    <img :src="imagePreview" alt="preview" class="preview-img" />
                    <div class="preview-btn-row">
                        <button class="change-btn" @click="showCamera = true">📷 สแกนใหม่</button>
                        <button class="change-btn" @click="triggerFilePicker">📁 เลือกไฟล์</button>
                    </div>
                </div>

                <input ref="fileInputEl" type="file" accept="image/*" capture="environment" class="hidden-input"
                    @change="onFileSelected" />
            </div>

            <!-- ===== Camera Scanner Overlay ===== -->
            <CameraScanner v-if="showCamera" @captured="onCameraCaptured" @close="showCamera = false" />

            <!-- ===== ฟอร์ม ===== -->
            <div class="reg-form">
                <!-- ชื่อเล่น -->
                <div class="input-group">
                    <label>ชื่อเล่น <span class="req">*</span></label>
                    <input v-model="nickname" type="text" class="custom-input" placeholder="เช่น น้องมิว"
                        maxlength="30" />
                </div>

                <!-- เบอร์โทร -->
                <div class="input-group">
                    <label>เบอร์โทรศัพท์ <span class="req">*</span></label>
                    <input v-model="phone" type="tel" inputmode="numeric" class="custom-input"
                        placeholder="เช่น 0812345678" maxlength="10"
                        @input="phone = phone.replace(/\D/g, '').slice(0, 10)" />
                    <span v-if="phone && phone.length < 10" class="field-hint">ต้องการ 10 หลัก (ปัจจุบัน {{ phone.length
                        }} หลัก)</span>
                </div>
                <div class="input-group">
                    <label>ประเภทสัตว์ <span class="req">*</span></label>
                    <div class="type-btn-group">
                        <button type="button" :class="['type-btn', { 'active sky': creatureType === 'sky' }]"
                            @click="creatureType = 'sky'">🦅 Sky</button>
                        <button type="button" :class="['type-btn', { 'active ground': creatureType === 'ground' }]"
                            @click="creatureType = 'ground'">🦁 Ground</button>
                        <button type="button" :class="['type-btn', { 'active water': creatureType === 'water' }]"
                            @click="creatureType = 'water'">🐬 Water</button>
                    </div>
                </div>

                <!-- PDPA checkbox -->
                <div class="pdpa-row" @click="showPdpa = true">
                    <div :class="['pdpa-check-box', { checked: pdpaAccepted }]">
                        <span v-if="pdpaAccepted">✓</span>
                    </div>
                    <span class="pdpa-text">
                        ข้าพเจ้ายินยอมตาม
                        <span class="pdpa-link">นโยบายความเป็นส่วนตัว (PDPA)</span>
                    </span>
                </div>

                <!-- ===== สถานะคิว ===== -->
                <div v-if="queueInfo.show" class="queue-box">
                    <div class="queue-spinner-row">
                        <span class="spinner-queue"></span>
                        <span class="queue-label">{{ queueInfo.message }}</span>
                    </div>
                    <div v-if="queueInfo.position > 0" class="queue-detail">
                        <div class="queue-bar-bg">
                            <div class="queue-bar-fill" :style="{ width: queueBarPercent + '%' }"></div>
                        </div>
                        <span class="queue-pos">คิวที่ {{ queueInfo.position }} / {{ queueInfo.total }}</span>
                    </div>
                </div>

                <!-- ข้อความสถานะ -->
                <p v-if="statusMsg && !queueInfo.show" :class="['status-msg', statusType]">{{ statusMsg }}</p>

                <!-- ปุ่ม -->
                <div class="btn-row">
                    <button class="search-btn" @click="submitRegister" :disabled="submitting || !canSubmit">
                        <span v-if="submitting" class="spinner"></span>
                        <span v-else>✅</span>
                        {{ submitting ? 'กำลังดำเนินการ...' : 'ลงทะเบียน' }}
                    </button>
                    <button class="search-btn ghost-btn" @click="$emit('back')" :disabled="submitting">
                        กลับ
                    </button>
                </div>
            </div>
        </div>

        <!-- PDPA Modal -->
        <PdpaModal v-model:show="showPdpa" @accept="pdpaAccepted = true" />
    </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import PdpaModal from './PdpaModal.vue'
import CameraScanner from './CameraScanner.vue'

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps({
    apiBase: { type: String, required: true }
})

const emit = defineEmits(['back', 'registered'])

// ============================================================
// File upload
// ============================================================
const fileInputEl = ref(null)
const imageFile = ref(null)      // File object
const imagePreview = ref('')     // data URL preview
const imageDataUrl = ref('')     // data URL สำหรับส่ง API
const showCamera = ref(false)    // เปิด/ปิดกล้องสแกน

function triggerFilePicker() {
    fileInputEl.value?.click()
}

function onCameraCaptured(dataUrl) {
    showCamera.value = false
    imagePreview.value = dataUrl
    imageDataUrl.value = dataUrl
    statusMsg.value = '📸 ถ่ายจากกล้องเรียบร้อย!'
    statusType.value = 'success'
}

function onFileSelected(e) {
    const file = e.target?.files?.[0]
    if (!file) return

    // ตรวจขนาดเพิ่มให้มือถือ (15 MB)
    if (file.size > 15 * 1024 * 1024) {
        statusMsg.value = 'ไฟล์ใหญ่เกินไป (สูงสุด 15 MB)'
        statusType.value = 'error'
        return
    }

    imageFile.value = file
    statusMsg.value = 'กำลังเตรียมรูปภาพ...'
    statusType.value = '' // reset

    if (!file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
            imagePreview.value = reader.result
            imageDataUrl.value = reader.result
            statusMsg.value = ''
        }
        reader.readAsDataURL(file)
        e.target.value = ''
        return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        try {
            let { width, height } = img
            const MAX_SIZE = 1600

            if (width > height && width > MAX_SIZE) {
                height = Math.round((height * MAX_SIZE) / width)
                width = MAX_SIZE
            } else if (height > MAX_SIZE) {
                width = Math.round((width * MAX_SIZE) / height)
                height = MAX_SIZE
            }

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')

            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
            imagePreview.value = dataUrl
            imageDataUrl.value = dataUrl
            statusMsg.value = ''
        } catch (err) {
            statusMsg.value = 'ลดขนาดรูปไม่สำเร็จ: ' + err.message
            statusType.value = 'error'
        }
    }
    img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        statusMsg.value = 'บราวเซอร์ไม่รองรับรูปนี้ (อาจเป็น HEIC) กรุณาใช้ไฟล์ JPG/PNG'
        statusType.value = 'error'
    }
    img.src = objectUrl

    // reset file input เพื่อให้เลือกไฟล์ซ้ำได้
    e.target.value = ''
}

// ============================================================
// Form
// ============================================================
const nickname = ref('')
const phone = ref('')
const creatureType = ref('')
const pdpaAccepted = ref(false)
const showPdpa = ref(false)
const submitting = ref(false)
const statusMsg = ref('')
const statusType = ref('') // 'success' | 'error'
const validTypes = ['sky', 'ground', 'water']
const normalizedType = computed(() => creatureType.value.trim().toLowerCase())
const isTypeValid = computed(() => validTypes.includes(normalizedType.value))

// Queue info
const queueInfo = reactive({
    show: false,
    position: 0,
    total: 0,
    message: ''
})

const canSubmit = computed(() =>
    imagePreview.value &&
    nickname.value.trim().length >= 2 &&
    phone.value.length === 10 &&
    isTypeValid.value &&
    pdpaAccepted.value
)

const queueBarPercent = computed(() => {
    if (queueInfo.total <= 0 || queueInfo.position <= 0) return 0
    return Math.max(5, Math.round(((queueInfo.total - queueInfo.position + 1) / queueInfo.total) * 100))
})

// ============================================================
// Submit → POST /api/capture_process → poll → /api/approve
// ============================================================
async function submitRegister() {
    if (!canSubmit.value) {
        const errors = []
        if (!imagePreview.value) errors.push('เลือกรูป')
        if (nickname.value.trim().length < 2) errors.push('ชื่อเล่น (อย่างน้อย 2 ตัวอักษร)')
        if (phone.value.length !== 10) errors.push('เบอร์โทร 10 หลัก')
        if (!isTypeValid.value) errors.push('type (sky/ground/water)')
        if (!pdpaAccepted.value) errors.push('ยอมรับ PDPA')
        statusMsg.value = 'กรุณากรอกข้อมูลให้ครบ: ' + errors.join(', ')
        statusType.value = 'error'
        return
    }

    submitting.value = true
    statusMsg.value = ''
    queueInfo.show = false

    try {
        // 1) ส่งรูปเข้า queue
        queueInfo.show = true
        queueInfo.message = 'กำลังส่งรูปเข้าคิว...'
        queueInfo.position = 0
        queueInfo.total = 0

        const token = localStorage.getItem('token') || '';
        const captureRes = await fetch(`${props.apiBase}/api/capture_process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                image_data: imageDataUrl.value,
                type: normalizedType.value,
                drawer_name: nickname.value.trim(),
                phone_number: phone.value,
                requester_name: nickname.value.trim()
            })
        })
        const captureData = await captureRes.json()

        if (!captureRes.ok || !captureData?.ok || !captureData?.job_id) {
            queueInfo.show = false
            statusMsg.value = captureData?.error || 'ส่งรูปไม่สำเร็จ'
            statusType.value = 'error'
            return
        }

        const jobId = captureData.job_id
        queueInfo.position = Number(captureData?.queue_position || 0)
        queueInfo.total = Number(captureData?.queue_total || 0)

        if (queueInfo.position > 0) {
            queueInfo.message = `อยู่ในคิวที่ ${queueInfo.position} จากทั้งหมด ${queueInfo.total} คิว`
        } else {
            queueInfo.message = 'กำลังประมวลผลรูป...'
        }

        // 2) Poll queue_status จนกว่าจะ READY_FOR_REVIEW
        let ready = false
        for (let i = 0; i < 300; i++) {
            await new Promise((r) => setTimeout(r, 800))
            try {
                const token = localStorage.getItem('token') || '';
                const statusRes = await fetch(`${props.apiBase}/api/queue_status/${encodeURIComponent(jobId)}`, {
                    cache: 'no-store',
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                })
                const statusData = await statusRes.json()
                if (!statusRes.ok) continue

                const qPos = Number(statusData?.queue_position || 0)
                const qTotal = Number(statusData?.queue_total || 0)

                if (statusData?.state === 'QUEUED' && qPos > 0) {
                    queueInfo.position = qPos
                    queueInfo.total = qTotal
                    queueInfo.message = `อยู่ในคิวที่ ${qPos} จากทั้งหมด ${qTotal} คิว`
                } else if (statusData?.state === 'PROCESSING') {
                    queueInfo.position = 0
                    queueInfo.total = 0
                    queueInfo.message = statusData?.message || 'กำลังประมวลผลรูป...'
                }

                if (statusData?.state === 'FAILED') {
                    queueInfo.show = false
                    // แปลง error เป็นภาษาไทย
                    const rawErr = statusData?.error || statusData?.message || ''
                    if (rawErr.includes('No document contour detected')) {
                        statusMsg.value = '⚠️ ตรวจไม่พบขอบกระดาษในรูป\nกรุณาถ่ายรูปใหม่ โดยวางกระดาษบนพื้นสีเข้มให้เห็นขอบกระดาษชัดเจนทั้ง 4 ด้าน'
                    } else {
                        statusMsg.value = rawErr || 'ประมวลผลไม่สำเร็จ'
                    }
                    statusType.value = 'error'
                    return
                }
                if (statusData?.state === 'READY_FOR_REVIEW') {
                    ready = true
                    break
                }
            } catch (_) { /* retry */ }
        }

        if (!ready) {
            queueInfo.show = false
            statusMsg.value = 'หมดเวลารอการประมวลผล กรุณาลองใหม่'
            statusType.value = 'error'
            return
        }

        // 3) Approve → บันทึก
        queueInfo.message = 'กำลังบันทึกข้อมูล...'
        queueInfo.position = 0

        const approveRes = await fetch(`${props.apiBase}/api/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                job_id: jobId,
                type: normalizedType.value,
                name: nickname.value.trim(),
                drawer_name: nickname.value.trim(),
                phone_number: phone.value
            })
        })
        const approveData = await approveRes.json()

        queueInfo.show = false

        if (!approveRes.ok || !approveData?.ok) {
            statusMsg.value = approveData?.error || 'บันทึกไม่สำเร็จ'
            statusType.value = 'error'
            return
        }

        statusMsg.value = 'ลงทะเบียนสำเร็จแล้ว! 🎉'
        statusType.value = 'success'
        emit('registered', { name: nickname.value, phone: phone.value, type: normalizedType.value })

        // รีเซ็ตฟอร์ม
        setTimeout(() => {
            nickname.value = ''
            phone.value = ''
            creatureType.value = ''
            pdpaAccepted.value = false
            imagePreview.value = ''
            imageDataUrl.value = ''
            imageFile.value = null
            statusMsg.value = ''
        }, 3000)

    } catch (_err) {
        queueInfo.show = false
        statusMsg.value = 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: ' + (_err.message || String(_err))
        statusType.value = 'error'
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped src="./RegisterView.css"></style>
