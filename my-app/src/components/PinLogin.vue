<template>
    <div class="pin-page">
        <div class="pin-card">

            <!-- Icon + Title -->
            <div class="pin-logo">🌲</div>
            <h1 class="pin-title">Digital Magic Forest</h1>
            <p class="pin-subtitle">กรุณาใส่ PIN 6 หลักเพื่อเข้าสู่ระบบ</p>

            <!-- PIN Boxes -->
            <div class="pin-fields" @paste.prevent="onPaste">
                <input v-for="(_, i) in digits" :key="i" :ref="el => { inputRefs[i] = el }" v-model="digits[i]"
                    type="text" inputmode="numeric" maxlength="1" autocomplete="off"
                    :class="['pin-box', { 'pin-box--filled': digits[i], 'pin-box--error': hasError }]"
                    :disabled="loading" @input="onInput(i, $event)" @keydown="onKeydown(i, $event)" />
            </div>

            <!-- Error -->
            <Transition name="shake">
                <p v-if="errorMsg" class="pin-error">{{ errorMsg }}</p>
            </Transition>

            <!-- Loading -->
            <div v-if="loading" class="pin-loading">
                <span class="spinner"></span>
                <span>กำลังตรวจสอบ...</span>
            </div>

            <!-- Numpad (mobile-friendly) -->
            <div class="numpad">
                <button v-for="n in numpadKeys" :key="n" class="numpad-btn"
                    :class="{ 'numpad-del': n === '⌫', 'numpad-0': n === '0' }" :disabled="loading"
                    @click="numpadPress(n)">{{ n }}</button>
            </div>

            <!-- Submit -->
            <button class="pin-submit" :disabled="loading || digits.some(d => d === '')"
                @click="submit(digits.join(''))">
                <span v-if="loading" class="spinner"></span>
                <span v-else>🔓</span>
                เข้าสู่ระบบ
            </button>

            <p class="pin-hint">ติดต่อผู้ดูแลระบบหากยังไม่มี PIN</p>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['login'])

/* ── Mock users (PIN → name) ─────────────────────────────────────────────── */
const MOCK_PINS = {
    '173925': 'Not',
    '294017': 'Tong',
    '346708': 'Naming',
}

/* ── State ─────────────────────────────────────────────────────────────────── */
const digits = ref(['', '', '', '', '', ''])
const inputRefs = ref([])
const loading = ref(false)
const errorMsg = ref('')
const hasError = ref(false)

const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']

onMounted(() => inputRefs.value[0]?.focus())

/* ── Handlers ──────────────────────────────────────────────────────────────── */
function onInput(i, e) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    digits.value[i] = char
    e.target.value = char
    errorMsg.value = ''
    hasError.value = false

    if (char && i < 5) inputRefs.value[i + 1]?.focus()
    if (char && i === 5 && digits.value.every(d => d)) submit(digits.value.join(''))
}

function onKeydown(i, e) {
    if (e.key === 'Backspace' && !digits.value[i] && i > 0) {
        inputRefs.value[i - 1]?.focus()
    }
    if (e.key === 'Enter') {
        const pin = digits.value.join('')
        if (pin.length === 6) submit(pin)
    }
}

function onPaste(e) {
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    digits.value = next
    if (pasted.length === 6) {
        submit(pasted)
    } else {
        inputRefs.value[pasted.length]?.focus()
    }
}

function numpadPress(key) {
    if (key === '✓') {
        const pin = digits.value.join('')
        if (pin.length === 6) submit(pin)
        return
    }
    if (key === '⌫') {
        // Find last filled slot and clear it
        for (let i = 5; i >= 0; i--) {
            if (digits.value[i]) {
                digits.value[i] = ''
                inputRefs.value[i]?.focus()
                break
            }
        }
        errorMsg.value = ''
        hasError.value = false
        return
    }
    // Number key — fill next empty slot
    const nextEmpty = digits.value.findIndex(d => d === '')
    if (nextEmpty === -1) return
    digits.value[nextEmpty] = key
    if (nextEmpty < 5) inputRefs.value[nextEmpty + 1]?.focus()
    if (nextEmpty === 5 && digits.value.every(d => d)) submit(digits.value.join(''))
}

/* ── Submit (mock) ────────────────────────────────────────────────────────── */
async function submit(pin) {
    loading.value = true
    errorMsg.value = ''
    hasError.value = false

    // Simulate network delay
    await new Promise(r => setTimeout(r, 600))

    const name = MOCK_PINS[pin]
    if (name) {
        const user = { pin, name }
        sessionStorage.setItem('myapp_user', JSON.stringify(user))
        emit('login', user)
    } else {
        errorMsg.value = 'PIN ไม่ถูกต้อง กรุณาลองใหม่'
        hasError.value = true
        digits.value = ['', '', '', '', '', '']
        loading.value = false
        setTimeout(() => inputRefs.value[0]?.focus(), 50)
        return
    }
    loading.value = false
}
</script>

<style scoped>
/* ── Page ── */
.pin-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f2044 0%, #1e3c72 50%, #2a5298 100%);
    padding: 16px;
}

/* ── Card ── */
.pin-card {
    background: rgba(255, 255, 255, 0.97);
    border-radius: 24px;
    padding: 40px 32px 32px;
    width: 100%;
    max-width: 380px;
    text-align: center;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.35);
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(32px) scale(0.96);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* ── Logo / Title ── */
.pin-logo {
    font-size: 3rem;
    margin-bottom: 12px;
}

.pin-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: #1e3c72;
    margin: 0 0 6px;
    letter-spacing: -0.5px;
}

.pin-subtitle {
    font-size: 0.85rem;
    color: #888;
    margin: 0 0 28px;
}

/* ── PIN Fields ── */
.pin-fields {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-bottom: 14px;
}

.pin-box {
    width: 46px;
    height: 56px;
    border: 2px solid #d1d5db;
    border-radius: 12px;
    text-align: center;
    font-size: 1.6rem;
    font-weight: 800;
    color: #1e3c72;
    background: #f9fafb;
    outline: none;
    transition: all 0.2s;
    caret-color: transparent;
}

.pin-box:focus {
    border-color: #2a5298;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(42, 82, 152, 0.15);
}

.pin-box--filled {
    border-color: #2a5298;
    background: #eef2ff;
}

.pin-box--error {
    border-color: #ef4444;
    background: #fff5f5;
    animation: shake 0.4s ease;
}

.pin-box:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

@keyframes shake {

    0%,
    100% {
        transform: translateX(0);
    }

    20% {
        transform: translateX(-6px);
    }

    40% {
        transform: translateX(6px);
    }

    60% {
        transform: translateX(-4px);
    }

    80% {
        transform: translateX(4px);
    }
}

/* ── Error ── */
.pin-error {
    font-size: 0.82rem;
    color: #ef4444;
    background: #fff5f5;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    padding: 6px 12px;
    margin: 4px 0 12px;
}

/* ── Loading ── */
.pin-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.84rem;
    color: #666;
    margin-bottom: 12px;
}

.spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2.5px solid rgba(42, 82, 152, 0.25);
    border-top-color: #2a5298;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Numpad ── */
.numpad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 16px 0;
}

.numpad-btn {
    height: 52px;
    border: none;
    border-radius: 12px;
    background: #f3f4f6;
    color: #1e3c72;
    font-size: 1.15rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    -webkit-tap-highlight-color: transparent;
}

.numpad-btn:hover:not(:disabled) {
    background: #e0e7ff;
}

.numpad-btn:active:not(:disabled) {
    transform: scale(0.93);
    background: #c7d2fe;
}

.numpad-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.numpad-del {
    background: #fee2e2;
    color: #dc2626;
}

.numpad-del:hover:not(:disabled) {
    background: #fca5a5;
}

/* ✓ confirm button */
.numpad-btn:last-child {
    background: linear-gradient(135deg, #1e3c72, #2a5298);
    color: #fff;
}

.numpad-btn:last-child:hover:not(:disabled) {
    opacity: 0.88;
}

/* ── Submit ── */
.pin-submit {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 8px 20px rgba(42, 82, 152, 0.3);
    transition: opacity 0.2s, transform 0.15s;
    min-height: 50px;
    margin-top: 4px;
}

.pin-submit:active:not(:disabled) {
    transform: scale(0.97);
}

.pin-submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

/* ── Hint ── */
.pin-hint {
    font-size: 0.74rem;
    color: #aaa;
    margin-top: 16px;
}

/* ── Mobile ── */
@media (max-width: 400px) {
    .pin-card {
        padding: 30px 18px 24px;
        border-radius: 18px;
    }

    .pin-box {
        width: 40px;
        height: 50px;
        font-size: 1.4rem;
        border-radius: 10px;
    }

    .numpad-btn {
        height: 48px;
        font-size: 1.05rem;
    }

    .pin-fields {
        gap: 7px;
    }

    .numpad {
        gap: 8px;
    }
}
</style>
