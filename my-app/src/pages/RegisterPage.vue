<template>
    <div class="register-wrapper">
        <div class="register-hero">
            <div class="register-hero-icon">📋</div>
            <h2 class="register-title">MyApp — ลงทะเบียน</h2>
            <p class="register-subtitle">กรอกข้อมูลและอัปโหลดรูปที่มี QR Code</p>
        </div>

        <!-- ── Success ── -->
        <div v-if="registerSuccess" class="success-card">
            <div class="success-icon">🎉</div>
            <h3>ลงทะเบียนสำเร็จ!</h3>
            <p>{{ registerSuccessMsg }}</p>
            <button class="btn-primary" style="margin-top:14px" @click="resetRegister">+ ลงทะเบียนใหม่</button>
        </div>

        <!-- ── Form ── -->
        <form v-else class="register-form" @submit.prevent="submitRegister">

            <!-- Name -->
            <div class="input-group">
                <label>👤 ชื่อ-นามสกุล <span class="required">*</span></label>
                <input v-model="regName" type="text" placeholder="กรอกชื่อ-นามสกุล..." class="custom-input"
                    :class="{ 'input-error': regErrors.name }" maxlength="100" />
                <p v-if="regErrors.name" class="field-error">{{ regErrors.name }}</p>
            </div>

            <!-- Phone -->
            <div class="input-group">
                <label>📱 เบอร์โทรศัพท์ <span class="required">*</span></label>
                <input v-model="regPhone" type="tel" placeholder="0XX-XXX-XXXX" class="custom-input"
                    :class="{ 'input-error': regErrors.phone }" maxlength="20" />
                <p v-if="regErrors.phone" class="field-error">{{ regErrors.phone }}</p>
            </div>

            <!-- Image Upload -->
            <div class="input-group">
                <label>📷 รูปภาพ (ต้องมี QR Code) <span class="required">*</span></label>

                <div class="upload-zone" :class="{
                    'uz--drag': isDragging,
                    'uz--error': regErrors.image,
                    'uz--ok': qrDetected === true,
                    'uz--checking': qrChecking,
                }" @click="triggerFileInput" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false"
                    @drop.prevent="onDrop">
                    <!-- Preview -->
                    <template v-if="imagePreview">
                        <img :src="imagePreview" class="upload-preview" alt="preview" />
                        <div class="qr-overlay">
                            <span v-if="qrChecking" class="qr-badge qr--checking">
                                <span class="spinner spinner-sm"></span> กำลังตรวจสอบ QR...
                            </span>
                            <span v-else-if="qrDetected === true" class="qr-badge qr--ok">✅ พบ QR Code!</span>
                            <span v-else-if="qrDetected === false" class="qr-badge qr--fail">❌ ไม่พบ QR Code</span>
                        </div>
                        <button type="button" class="upload-remove" @click.stop="removeImage">✕</button>
                    </template>

                    <!-- Placeholder -->
                    <template v-else>
                        <div class="upload-placeholder">
                            <span class="upload-icon">📤</span>
                            <p class="upload-text">คลิกหรือลากไฟล์มาวางที่นี่</p>
                            <p class="upload-hint">JPG, PNG, WEBP · ต้องมี QR Code ในรูป</p>
                        </div>
                    </template>
                </div>

                <input ref="fileInput" type="file" accept="image/*" class="hidden-input" @change="onFileChange" />
                <p v-if="regErrors.image" class="field-error">{{ regErrors.image }}</p>
                <p v-if="!qrSupported" class="field-warn">
                    ⚠️ Browser นี้ไม่รองรับการตรวจสอบ QR Code อัตโนมัติ — กรุณาตรวจสอบเองว่ารูปมี QR Code
                </p>
            </div>

            <!-- PDPA -->
            <div class="pdpa-box" :class="{ 'pdpa-box--error': regErrors.pdpa }">
                <label class="pdpa-label">
                    <input v-model="regPdpa" type="checkbox" class="pdpa-checkbox" id="pdpa-check" />
                    <span class="pdpa-custom-box">
                        <span v-if="regPdpa" class="pdpa-tick">✓</span>
                    </span>
                    <span class="pdpa-text">
                        ฉันยอมรับ
                        <button type="button" class="pdpa-link" @click.prevent="showPdpa = true">
                            นโยบายความเป็นส่วนตัว (PDPA)
                        </button>
                        และยินยอมให้เก็บรวบรวมข้อมูลส่วนบุคคล
                    </span>
                </label>
                <p v-if="regErrors.pdpa" class="field-error">{{ regErrors.pdpa }}</p>
            </div>

            <!-- Submit -->
            <div class="btn-row">
                <button type="submit" class="btn-primary"
                    :disabled="regLoading || (qrDetected === false && qrSupported)">
                    <span v-if="regLoading" class="spinner"></span>
                    <span v-else>✅</span>
                    {{ regLoading ? 'กำลังบันทึก...' : 'ลงทะเบียน' }}
                </button>
            </div>

            <p v-if="regErrors.submit" class="submit-error">⚠️ {{ regErrors.submit }}</p>
        </form>

        <!-- PDPA Modal -->
        <PdpaModal v-model:show="showPdpa" @accept="regPdpa = true" @reject="regPdpa = false" />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import PdpaModal from '../components/PdpaModal.vue'

const API_BASE = import.meta.env.VITE_API_BASE || ''
const apiBase = API_BASE.replace(/\/+$/, '')

// ─── Form state ───────────────────────────────────────────────────────────────
const regName = ref('')
const regPhone = ref('')
const regPdpa = ref(false)
const regLoading = ref(false)
const regErrors = ref({})
const registerSuccess = ref(false)
const registerSuccessMsg = ref('')
const showPdpa = ref(false)

// ─── Image upload ─────────────────────────────────────────────────────────────
const fileInput = ref(null)
const imageFile = ref(null)
const imagePreview = ref(null)
const isDragging = ref(false)

// ─── QR detection ─────────────────────────────────────────────────────────────
const qrChecking = ref(false)
const qrDetected = ref(null)   // null | true | false
const qrSupported = ref(true)

function triggerFileInput() { fileInput.value?.click() }

function removeImage() {
    imageFile.value = null
    imagePreview.value = null
    qrDetected.value = null
    qrChecking.value = false
    if (fileInput.value) fileInput.value.value = ''
    regErrors.value.image = ''
}

async function onFileChange(e) {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
}

async function onDrop(e) {
    isDragging.value = false
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) await processFile(file)
}

async function processFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        regErrors.value.image = 'ขนาดไฟล์ต้องไม่เกิน 10 MB'
        return
    }
    regErrors.value.image = ''
    imageFile.value = file
    imagePreview.value = URL.createObjectURL(file)
    qrDetected.value = null
    await detectQR(file)
}

async function detectQR(file) {
    if (!('BarcodeDetector' in window)) {
        qrSupported.value = false
        return
    }
    qrChecking.value = true
    qrDetected.value = null
    try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const bitmap = await createImageBitmap(file)
        const codes = await detector.detect(bitmap)
        bitmap.close()
        qrDetected.value = codes.length > 0
        regErrors.value.image = qrDetected.value
            ? ''
            : 'ไม่พบ QR Code ในรูปภาพ — กรุณาอัปโหลดรูปที่มี QR Code'
    } catch (err) {
        console.warn('BarcodeDetector error:', err)
        qrDetected.value = null
        qrSupported.value = false
    } finally {
        qrChecking.value = false
    }
}

// ─── Validation & Submit ──────────────────────────────────────────────────────
function validateRegister() {
    const e = {}
    if (!regName.value.trim()) e.name = 'กรุณากรอกชื่อ-นามสกุล'
    if (!regPhone.value.trim()) e.phone = 'กรุณากรอกเบอร์โทรศัพท์'
    else if (!/^[0-9\-+\s()]{8,20}$/.test(regPhone.value.trim()))
        e.phone = 'รูปแบบเบอร์โทรไม่ถูกต้อง'
    if (!imageFile.value)
        e.image = 'กรุณาอัปโหลดรูปภาพ'
    else if (qrSupported.value && qrDetected.value === false)
        e.image = 'ไม่พบ QR Code ในรูปภาพ — กรุณาอัปโหลดรูปที่มี QR Code'
    if (!regPdpa.value) e.pdpa = 'กรุณายอมรับนโยบายความเป็นส่วนตัว (PDPA)'
    return e
}

async function submitRegister() {
    regErrors.value = validateRegister()
    if (Object.keys(regErrors.value).length > 0) return

    regLoading.value = true
    try {
        const fd = new FormData()
        fd.append('name', regName.value.trim())
        fd.append('phone', regPhone.value.trim())
        fd.append('pdpa', 'true')
        fd.append('image', imageFile.value)

        const res = await fetch(`${apiBase}/api/register`, { method: 'POST', body: fd })
        const data = await res.json()

        if (data.ok) {
            registerSuccess.value = true
            registerSuccessMsg.value = data.message || 'ลงทะเบียนสำเร็จ!'
        } else {
            regErrors.value.submit = data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
        }
    } catch (err) {
        console.error('Register failed:', err)
        regErrors.value.submit = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่'
    } finally {
        regLoading.value = false
    }
}

function resetRegister() {
    regName.value = ''
    regPhone.value = ''
    regPdpa.value = false
    imageFile.value = null
    if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
    qrDetected.value = null
    qrChecking.value = false
    regErrors.value = {}
    registerSuccess.value = false
    registerSuccessMsg.value = ''
    if (fileInput.value) fileInput.value.value = ''
}
</script>

<style scoped>
* {
    box-sizing: border-box;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.register-wrapper {
    max-width: 560px;
    margin: 0 auto;
    padding: 28px 20px 52px;
    display: flex;
    flex-direction: column;
    gap: 18px;
}

/* ── Hero ── */
.register-hero {
    text-align: center;
    padding-bottom: 4px;
}

.register-hero-icon {
    font-size: 2.8rem;
    margin-bottom: 8px;
}

.register-title {
    font-size: 1.45rem;
    font-weight: 800;
    color: #1e3c72;
    margin: 0 0 6px;
}

.register-subtitle {
    font-size: 0.86rem;
    color: #777;
    margin: 0;
}

/* ── Form ── */
.register-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

/* ── Input ── */
.input-group {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.input-group label {
    font-size: 0.88rem;
    font-weight: 600;
    color: #444;
    margin-left: 4px;
}

.required {
    color: #e53e3e;
    margin-left: 2px;
}

.custom-input {
    width: 100%;
    padding: 14px 17px;
    border-radius: 13px;
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

.custom-input.input-error {
    border-color: #e53e3e;
}

/* ── Error / Warn ── */
.field-error {
    font-size: 0.78rem;
    color: #e53e3e;
    margin: 3px 0 0 5px;
}

.field-warn {
    font-size: 0.78rem;
    color: #d97706;
    background: #fffbeb;
    border-radius: 8px;
    padding: 6px 10px;
    margin: 4px 0 0;
}

.submit-error {
    font-size: 0.84rem;
    color: #e53e3e;
    text-align: center;
    padding: 7px 12px;
    background: #fff5f5;
    border-radius: 10px;
}

/* ── Upload Zone ── */
.upload-zone {
    position: relative;
    width: 100%;
    min-height: 200px;
    border: 2px dashed #c8cfd8;
    border-radius: 15px;
    background: #fafbfc;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.25s;
}

.upload-zone:hover {
    border-color: #2a5298;
    background: #f0f4fc;
}

.uz--drag {
    border-color: #2a5298;
    background: #e8f0fe;
}

.uz--error {
    border-color: #e53e3e;
}

.uz--ok {
    border-color: #38a169;
    background: #f0fff4;
}

.uz--checking {
    border-color: #d97706;
    background: #fffbeb;
}

.upload-placeholder {
    text-align: center;
    padding: 20px;
    pointer-events: none;
}

.upload-icon {
    font-size: 2.4rem;
    display: block;
    margin-bottom: 10px;
}

.upload-text {
    font-size: 0.93rem;
    font-weight: 600;
    color: #555;
    margin: 0 0 5px;
}

.upload-hint {
    font-size: 0.78rem;
    color: #999;
    margin: 0;
}

.upload-preview {
    width: 100%;
    height: 220px;
    object-fit: contain;
    display: block;
    background: #f0f2f5;
}

.upload-remove {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.52);
    border: none;
    color: #fff;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 2;
}

.upload-remove:hover {
    background: rgba(0, 0, 0, 0.72);
}

.qr-overlay {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
}

.qr-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 30px;
    font-size: 0.8rem;
    font-weight: 700;
    backdrop-filter: blur(5px);
    white-space: nowrap;
}

.qr--checking {
    background: rgba(217, 119, 6, 0.85);
    color: #fff;
}

.qr--ok {
    background: rgba(56, 161, 105, 0.9);
    color: #fff;
}

.qr--fail {
    background: rgba(229, 62, 62, 0.9);
    color: #fff;
}

.hidden-input {
    display: none;
}

/* ── Spinner ── */
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
    width: 12px;
    height: 12px;
    border-width: 2px;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── PDPA box ── */
.pdpa-box {
    background: #f8f9ff;
    border: 1.5px solid #d8e0f0;
    border-radius: 13px;
    padding: 15px;
    transition: border-color 0.2s;
}

.pdpa-box--error {
    border-color: #e53e3e;
    background: #fff5f5;
}

.pdpa-label {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    cursor: pointer;
}

.pdpa-checkbox {
    display: none;
}

.pdpa-custom-box {
    flex-shrink: 0;
    width: 21px;
    height: 21px;
    border: 2px solid #2a5298;
    border-radius: 5px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
    transition: background 0.2s, border-color 0.2s;
}

.pdpa-label:has(.pdpa-checkbox:checked) .pdpa-custom-box {
    background: #2a5298;
    border-color: #2a5298;
}

.pdpa-tick {
    color: #fff;
    font-size: 0.82rem;
    font-weight: 800;
}

.pdpa-text {
    font-size: 0.86rem;
    color: #444;
    line-height: 1.55;
}

.pdpa-link {
    background: none;
    border: none;
    color: #2a5298;
    font-size: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
}

.pdpa-link:hover {
    color: #1e3c72;
}

/* ── Buttons ── */
.btn-row {
    display: flex;
}

.btn-primary {
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

.btn-primary:active:not(:disabled) {
    transform: scale(0.96);
}

.btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.btn-primary:hover:not(:disabled) {
    opacity: 0.9;
}

/* ── Success ── */
.success-card {
    background: linear-gradient(135deg, #f0fff4, #e6ffed);
    border: 2px solid #68d391;
    border-radius: 18px;
    padding: 34px 24px;
    text-align: center;
}

.success-icon {
    font-size: 3.4rem;
    margin-bottom: 12px;
}

.success-card h3 {
    font-size: 1.35rem;
    font-weight: 800;
    color: #276749;
    margin: 0 0 8px;
}

.success-card p {
    font-size: 0.92rem;
    color: #2f855a;
    margin: 0;
}

/* ── Mobile ── */
@media (max-width: 600px) {
    .register-wrapper {
        padding: 20px 14px 44px;
        gap: 15px;
    }

    .register-hero-icon {
        font-size: 2.2rem;
    }

    .register-title {
        font-size: 1.2rem;
    }

    .custom-input {
        font-size: 16px;
        padding: 13px 15px;
        border-radius: 11px;
    }

    .input-group label {
        font-size: 0.83rem;
    }

    .upload-zone {
        min-height: 175px;
        border-radius: 12px;
    }

    .upload-preview {
        height: 175px;
    }

    .upload-icon {
        font-size: 2rem;
    }

    .upload-text {
        font-size: 0.85rem;
    }

    .pdpa-box {
        padding: 13px;
    }

    .pdpa-text {
        font-size: 0.82rem;
    }

    .btn-primary {
        padding: 15px;
        font-size: 0.96rem;
        min-height: 52px;
    }

    .success-card {
        padding: 26px 16px;
    }

    .success-icon {
        font-size: 2.8rem;
    }
}

@media (max-width: 400px) {
    .register-wrapper {
        padding: 16px 12px 36px;
    }

    .custom-input {
        font-size: 16px;
        padding: 12px 13px;
    }

    .upload-zone {
        min-height: 155px;
    }

    .upload-preview {
        height: 155px;
    }
}
</style>
