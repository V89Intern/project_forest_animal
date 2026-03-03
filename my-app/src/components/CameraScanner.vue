<template>
  <div class="camera-overlay">
    <div class="camera-video-wrap">
      <video ref="videoEl" autoplay playsinline muted></video>
      <canvas ref="overlayCanvas"></canvas>
      <div v-if="showFlash" class="camera-flash"></div>
      <div v-if="processing" class="camera-processing">
        <div class="spinner-cam"></div>
        <p>กำลังจับภาพ...</p>
      </div>
    </div>

    <div class="camera-status-bar">
      <div :class="['camera-status-text', { detected: rectDetected }]">
        {{ statusText }}
      </div>
      <div v-if="countdown > 0" class="camera-countdown">{{ countdown }}</div>
    </div>

    <div class="camera-btn-row">
      <button class="camera-btn close" @click="close">✕ ปิดกล้อง</button>
      <button class="camera-btn capture" @click="manualCapture" :disabled="processing">
        📸 ถ่ายเลย
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['captured', 'close'])

// Refs
const videoEl = ref(null)
const overlayCanvas = ref(null)
const statusText = ref('กำลังเปิดกล้อง...')
const rectDetected = ref(false)
const countdown = ref(0)
const showFlash = ref(false)
const processing = ref(false)

let stream = null
let animFrameId = null
let stableCount = 0
const STABLE_THRESHOLD = 35  // ประมาณ 1 วินาที เพื่อให้มั่นใจว่าโฟกัสนิ่งพอ
let autoCapturing = false
let currentSharpness = 0

// ============================================================
// Camera
// ============================================================
async function startCamera() {
  try {
    // ตรวจสอบว่าเบราว์เซอร์รองรับ mediaDevices (ต้อง HTTPS หรือ localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      statusText.value = '⚠️ กล้องใช้ได้เฉพาะ HTTPS เท่านั้น\nกรุณาเปิดเว็บผ่าน https:// หรือ localhost'
      return
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    })
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      videoEl.value.onloadedmetadata = () => {
        videoEl.value.play()
        statusText.value = 'วางกระดาษให้เห็นกรอบสี่เหลี่ยม...'
        startDetection()
      }
    }
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      statusText.value = '⚠️ กรุณาอนุญาตให้เว็บใช้กล้อง ในการตั้งค่าเบราว์เซอร์'
    } else if (err.name === 'NotFoundError') {
      statusText.value = '⚠️ ไม่พบกล้อง กรุณาเชื่อมต่อกล้องแล้วลองใหม่'
    } else {
      statusText.value = '⚠️ เปิดกล้องไม่สำเร็จ: ' + (err.message || err)
    }
  }
}

function stopCamera() {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
}

function close() {
  stopCamera()
  emit('close')
}

// ============================================================
// Rectangle Detection (Pure Canvas)
// ============================================================
function startDetection() {
  const video = videoEl.value
  const canvas = overlayCanvas.value
  if (!video || !canvas) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  // Hidden canvas for image processing
  const workCanvas = document.createElement('canvas')
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true })

  // ฟังก์ชันคำนวณความคมชัด (Variance of Laplacian)
  function calculateSharpness(gray, width, height) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        // Laplacian filter: [0, 1, 0; 1, -4, 1; 0, 1, 0]
        const laplacian =
          gray[idx - width] +
          gray[idx - 1] -
          (4 * gray[idx]) +
          gray[idx + 1] +
          gray[idx + width];

        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    return variance;
  }

  function detect() {
    if (!video.videoWidth) {
      animFrameId = requestAnimationFrame(detect)
      return
    }

    // Sync canvas size
    const vw = video.videoWidth
    const vh = video.videoHeight
    canvas.width = vw
    canvas.height = vh

    // Work canvas at reduced resolution for speed
    const scale = 0.25
    const sw = Math.round(vw * scale)
    const sh = Math.round(vh * scale)
    workCanvas.width = sw
    workCanvas.height = sh

    // Draw scaled frame
    workCtx.drawImage(video, 0, 0, sw, sh)
    const imageData = workCtx.getImageData(0, 0, sw, sh)
    const data = imageData.data

    // Grayscale + Simple edge detection (Sobel-like)
    const gray = new Uint8Array(sw * sh)
    for (let i = 0; i < sw * sh; i++) {
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    }

    // คำนวณความคมชัดของภาพปัจจุบัน (Focus Check) ทุกๆ ภาพที่ประมวลผล
    currentSharpness = calculateSharpness(gray, sw, sh)
    const isFocused = currentSharpness > 200 // ค่ายิ่งมากยิ่งคม (เพิ่มเป็น 200 ให้ชัวร์ขึ้น)

    // Simple threshold to find edges
    const edges = new Uint8Array(sw * sh)
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const idx = y * sw + x
        const gx = Math.abs(gray[idx + 1] - gray[idx - 1])
        const gy = Math.abs(gray[idx + sw] - gray[idx - sw])
        edges[idx] = (gx + gy > 40) ? 255 : 0
      }
    }

    // Count edge pixels in border regions vs center to detect rectangle
    const borderSize = Math.round(Math.min(sw, sh) * 0.15)
    let topEdges = 0, bottomEdges = 0, leftEdges = 0, rightEdges = 0
    let totalBorderPixels = 0

    // Top border
    for (let y = borderSize; y < borderSize * 2; y++) {
      for (let x = borderSize; x < sw - borderSize; x++) {
        if (edges[y * sw + x]) topEdges++
        totalBorderPixels++
      }
    }
    // Bottom border
    for (let y = sh - borderSize * 2; y < sh - borderSize; y++) {
      for (let x = borderSize; x < sw - borderSize; x++) {
        if (edges[y * sw + x]) bottomEdges++
        totalBorderPixels++
      }
    }
    // Left border
    for (let y = borderSize * 2; y < sh - borderSize * 2; y++) {
      for (let x = borderSize; x < borderSize * 2; x++) {
        if (edges[y * sw + x]) leftEdges++
        totalBorderPixels++
      }
    }
    // Right border
    for (let y = borderSize * 2; y < sh - borderSize * 2; y++) {
      for (let x = sw - borderSize * 2; x < sw - borderSize; x++) {
        if (edges[y * sw + x]) rightEdges++
        totalBorderPixels++
      }
    }

    const minEdgeRatio = 0.12 // เพิ่มความเข้มงวดของขอบกระดาษ (จากเดิม 0.05)
    // ลด edgesPerSide ลงนิดหน่อยเพราะเราตรวจพื้นที่ขอบค่อนข้างหนา
    const edgesPerSide = totalBorderPixels / 4
    const hasTop = topEdges / edgesPerSide > minEdgeRatio
    const hasBottom = bottomEdges / edgesPerSide > minEdgeRatio
    const hasLeft = leftEdges / edgesPerSide > minEdgeRatio
    const hasRight = rightEdges / edgesPerSide > minEdgeRatio

    const sidesDetected = [hasTop, hasBottom, hasLeft, hasRight].filter(Boolean).length
    const isRect = sidesDetected >= 3

    // Draw overlay
    ctx.clearRect(0, 0, vw, vh)

    if (isRect) {
      // Draw green guide rectangle
      const margin = borderSize / scale
      ctx.strokeStyle = '#4caf50'
      ctx.lineWidth = 4
      ctx.setLineDash([12, 6])
      ctx.strokeRect(margin, margin, vw - margin * 2, vh - margin * 2)
      ctx.setLineDash([])

      // Corner marks
      const cornerLen = 30
      ctx.strokeStyle = '#4caf50'
      ctx.lineWidth = 5
      ctx.setLineDash([])
      drawCorner(ctx, margin, margin, cornerLen, 1, 1)
      drawCorner(ctx, vw - margin, margin, cornerLen, -1, 1)
      drawCorner(ctx, margin, vh - margin, cornerLen, 1, -1)
      drawCorner(ctx, vw - margin, vh - margin, cornerLen, -1, -1)
      if (!isFocused) {
        // ถ้ารูปเบลอ ให้หยุดนับถอยหลังไว้ก่อน
        statusText.value = '🔍 รอกล้องโฟกัสให้ชัด...'
        // ลบค่าความนิ่งเร็วขึ้นเพื่อไม่ให้หลุดถ่ายตอนเบลอ
        stableCount = Math.max(0, stableCount - 2);
        countdown.value = 0
      } else {
        // เจอกรอบและชัดเจน
        rectDetected.value = true
        stableCount++
      }

      if (stableCount >= STABLE_THRESHOLD && !autoCapturing) {
        statusText.value = '✅ เจอกรอบแล้ว! ชัดเจน! กำลังถ่ายอัตโนมัติ...'
        autoCapture()
      } else if (!autoCapturing && isFocused) {
        const remaining = STABLE_THRESHOLD - stableCount
        countdown.value = Math.ceil(remaining / (STABLE_THRESHOLD / 3))
        statusText.value = '📐 เจอกรอบสี่เหลี่ยม — ถือนิ่งๆ...'
      }
    } else {
      // Draw red guide
      ctx.strokeStyle = 'rgba(255,80,80,0.5)'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 8])
      const guideMargin = vw * 0.1
      ctx.strokeRect(guideMargin, guideMargin, vw - guideMargin * 2, vh - guideMargin * 2)
      ctx.setLineDash([])

      rectDetected.value = false
      stableCount = 0
      countdown.value = 0
      if (!autoCapturing) {
        statusText.value = '📷 วางกระดาษให้เห็นกรอบสี่เหลี่ยม...'
      }
    }

    animFrameId = requestAnimationFrame(detect)
  }

  animFrameId = requestAnimationFrame(detect)
}

function drawCorner(ctx, x, y, len, dx, dy) {
  ctx.beginPath()
  ctx.moveTo(x, y + len * dy)
  ctx.lineTo(x, y)
  ctx.lineTo(x + len * dx, y)
  ctx.stroke()
}

// ============================================================
// Capture
// ============================================================
async function autoCapture() {
  if (autoCapturing) return
  autoCapturing = true
  await doCapture()
}

async function manualCapture() {
  if (processing.value) return
  await doCapture()
}

async function doCapture() {
  processing.value = true
  showFlash.value = true
  setTimeout(() => { showFlash.value = false }, 400)

  const video = videoEl.value
  if (!video) {
    processing.value = false
    autoCapturing = false
    return
  }

  // Capture full resolution frame
  const captureCanvas = document.createElement('canvas')
  captureCanvas.width = video.videoWidth
  captureCanvas.height = video.videoHeight
  const ctx = captureCanvas.getContext('2d')
  ctx.drawImage(video, 0, 0)

  const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.85)

  // Stop camera
  stopCamera()

  // Emit captured image
  emit('captured', dataUrl)
  processing.value = false
  autoCapturing = false
}

// ============================================================
// Lifecycle
// ============================================================
onMounted(() => {
  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
})
</script>

<style scoped src="./CameraScanner.css"></style>
