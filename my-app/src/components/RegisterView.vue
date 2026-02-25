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
                <div v-if="!imagePreview" class="upload-drop-zone" @click="triggerFilePicker">
                    <div class="upload-icon">📤</div>
                    <p class="upload-text">กดเพื่อเลือกรูปภาพ</p>
                    <p class="upload-hint">รองรับ JPG, PNG (สูงสุด 10 MB)</p>
                </div>

                <!-- preview รูปที่เลือก -->
                <div v-else class="preview-box">
                    <img :src="imagePreview" alt="preview" class="preview-img" />
                    <button class="change-btn" @click="triggerFilePicker">🔄 เปลี่ยนรูป</button>
                </div>

                <input ref="fileInputEl" type="file" accept="image/*" capture="environment" class="hidden-input"
                    @change="onFileSelected" />
            </div>

            <!-- ===== ฟอร์ม ===== -->
            <div class="reg-form">
                <!-- ชื่อเล่น -->
                <div class="input-group">
                    <label>ชื่อเล่น <span class="req">*</span></label>
                    <input v-model="nickname" type="text" class="custom-input" placeholder="เช่น น้องมิว"
                        maxlength="50" />
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

function triggerFilePicker() {
    fileInputEl.value?.click()
}

function onFileSelected(e) {
    const file = e.target?.files?.[0]
    if (!file) return

    // ตรวจขนาด (10 MB)
    if (file.size > 10 * 1024 * 1024) {
        statusMsg.value = 'ไฟล์ใหญ่เกินไป (สูงสุด 10 MB)'
        statusType.value = 'error'
        return
    }

    imageFile.value = file
    statusMsg.value = ''

    const reader = new FileReader()
    reader.onload = () => {
        imagePreview.value = reader.result
        imageDataUrl.value = reader.result
    }
    reader.readAsDataURL(file)

    // reset file input เพื่อให้เลือกไฟล์ซ้ำได้
    e.target.value = ''
}

// ============================================================
// Form
// ============================================================
const nickname = ref('')
const phone = ref('')
const pdpaAccepted = ref(false)
const showPdpa = ref(false)
const submitting = ref(false)
const statusMsg = ref('')
const statusType = ref('') // 'success' | 'error'

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

        const captureRes = await fetch(`${props.apiBase}/api/capture_process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_data: imageDataUrl.value,
                type: 'ground',
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
                const statusRes = await fetch(`${props.apiBase}/api/queue_status/${encodeURIComponent(jobId)}`, { cache: 'no-store' })
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: jobId,
                type: 'ground',
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
        emit('registered', { name: nickname.value, phone: phone.value })

        // รีเซ็ตฟอร์ม
        setTimeout(() => {
            nickname.value = ''
            phone.value = ''
            pdpaAccepted.value = false
            imagePreview.value = ''
            imageDataUrl.value = ''
            imageFile.value = null
            statusMsg.value = ''
        }, 3000)

    } catch (_err) {
        queueInfo.show = false
        statusMsg.value = 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'
        statusType.value = 'error'
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.reg-page {
    display: flex;
    flex-direction: column;
    min-height: 100%;
}

/* ── Header ── */
.reg-header {
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    padding: 20px 24px;
    text-align: center;
    color: #fff;
}

.reg-title {
    margin: 0 0 4px;
    font-size: 1.3rem;
    font-weight: 800;
}

.reg-sub {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.85;
}

/* ── Body ── */
.reg-body {
    flex: 1;
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* ── Upload zone ── */
.upload-section {
    width: 100%;
}

.hidden-input {
    display: none;
}

.upload-drop-zone {
    width: 100%;
    aspect-ratio: 4/3;
    border: 2px dashed #b0c4de;
    border-radius: 16px;
    background: #f0f5fc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: border-color 0.25s, background 0.25s;
}

.upload-drop-zone:hover {
    border-color: #2a5298;
    background: #e8effa;
}

.upload-icon {
    font-size: 2.8rem;
}

.upload-text {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #2a5298;
}

.upload-hint {
    margin: 0;
    font-size: 0.78rem;
    color: #999;
}

/* ── Preview ── */
.preview-box {
    position: relative;
    width: 100%;
}

.preview-img {
    width: 100%;
    aspect-ratio: 4/3;
    object-fit: cover;
    border-radius: 16px;
    border: 2px solid #2a5298;
    display: block;
}

.change-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.change-btn:hover {
    background: rgba(0, 0, 0, 0.75);
}

/* ── Form ── */
.reg-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.input-group label {
    font-size: 0.88rem;
    font-weight: 600;
    color: #555;
    margin-left: 4px;
}

.req {
    color: #e53e3e;
}

.custom-input {
    width: 100%;
    padding: 14px 18px;
    border-radius: 14px;
    border: 1px solid #e1e1e1;
    background: #fff;
    font-size: 1rem;
    color: #333;
    outline: none;
    transition: border-color 0.25s, box-shadow 0.25s;
}

.custom-input:focus {
    border-color: #2a5298;
    box-shadow: 0 0 0 3px rgba(42, 82, 152, 0.1);
}

.field-hint {
    font-size: 0.76rem;
    color: #e57a00;
    margin-left: 4px;
}

/* ── PDPA ── */
.pdpa-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid #e0e7ff;
    background: #f5f7ff;
    transition: background 0.2s;
    user-select: none;
}

.pdpa-row:hover {
    background: #eef1ff;
}

.pdpa-check-box {
    min-width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid #2a5298;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 700;
    color: #2a5298;
    transition: background 0.2s;
    flex-shrink: 0;
    margin-top: 1px;
}

.pdpa-check-box.checked {
    background: #2a5298;
    color: #fff;
}

.pdpa-text {
    font-size: 0.85rem;
    color: #444;
    line-height: 1.5;
}

.pdpa-link {
    color: #2a5298;
    font-weight: 600;
    text-decoration: underline;
}

/* ── Queue box ── */
.queue-box {
    background: #eef3ff;
    border: 1px solid #c8d8f8;
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.queue-spinner-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.spinner-queue {
    width: 20px;
    height: 20px;
    border: 2.5px solid rgba(42, 82, 152, 0.2);
    border-top-color: #2a5298;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
    flex-shrink: 0;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.queue-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e3c72;
}

.queue-detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.queue-bar-bg {
    width: 100%;
    height: 8px;
    border-radius: 10px;
    background: #d4dfef;
    overflow: hidden;
}

.queue-bar-fill {
    height: 100%;
    border-radius: 10px;
    background: linear-gradient(90deg, #2a5298, #4a90d9);
    transition: width 0.5s ease;
}

.queue-pos {
    font-size: 0.78rem;
    color: #555;
    text-align: right;
}

/* ── Status ── */
.status-msg {
    margin: 0;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 600;
}

.status-msg.success {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
}

.status-msg.error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
}

/* ── Buttons ── */
.btn-row {
    display: flex;
    gap: 10px;
    margin-top: 4px;
}

.search-btn {
    flex: 1;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 14px;
    font-size: 0.95rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(42, 82, 152, 0.25);
    transition: transform 0.15s, opacity 0.2s;
}

.search-btn:active:not(:disabled) {
    transform: scale(0.96);
}

.search-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
}

.ghost-btn {
    background: #fff;
    color: #1e3c72;
    border: 1.5px solid #c8d6f3;
    box-shadow: none;
}

.spinner {
    width: 15px;
    height: 15px;
    border: 2.5px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}

/* ── Responsive ── */
@media (max-width: 480px) {
    .reg-body {
        padding: 16px 14px;
    }

    .reg-title {
        font-size: 1.1rem;
    }
}
</style>
