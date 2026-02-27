<template>
  <Teleport to="body">
    <Transition name="modal">
      <div class="bgpicker-overlay" @click.self="$emit('close')">
        <div class="bgpicker-container">

          <!-- Header -->
          <div class="bgpicker-header">
            <h3 class="bgpicker-title">🎨 เลือก Background ก่อนดาวน์โหลด</h3>
            <button class="bgpicker-close" @click="$emit('close')">✕</button>
          </div>

          <!-- Body -->
          <div class="bgpicker-body">

            <!-- Left: Background selector -->
            <div class="bgpicker-left">
              <div class="type-badge" :class="animalType">
                {{ typeLabel }}
              </div>
              <p class="bg-instruction">เลือก Background:</p>

              <div v-if="availableBackgrounds.length === 0" class="no-bg-hint">
                ⚠️ ยังไม่มีรูป Background<br>
                <small>วางรูปไว้ที่:<br><code>public/backgrounds/{{ animalType }}/</code></small>
              </div>

              <div v-else class="bg-list">
                <div v-for="(bg, idx) in availableBackgrounds" :key="idx" class="bg-thumb-wrap"
                  :class="{ selected: selectedBgIndex === idx }" @click="selectBackground(idx)">
                  <img :src="bg.url" :alt="bg.name" class="bg-thumb" />
                  <div class="bg-thumb-label">{{ bg.name }}</div>
                </div>
              </div>

              <!-- No background option -->
              <div class="bg-thumb-wrap none-option" :class="{ selected: selectedBgIndex === -1 }"
                @click="selectBackground(-1)">
                <div class="bg-none-preview">
                  <span>🚫</span>
                </div>
                <div class="bg-thumb-label">ไม่ใช้ Background</div>
              </div>
            </div>

            <!-- Right: Canvas Preview -->
            <div class="bgpicker-right">
              <p class="bg-instruction">Preview:</p>
              <div class="canvas-wrap">
                <canvas ref="previewCanvas" class="preview-canvas" />
                <div v-if="compositing" class="canvas-loading">
                  <span class="spinner spinner-lg"></span>
                </div>
              </div>

              <div class="bgpicker-actions">
                <button class="dl-btn" :disabled="compositing" @click="doDownload">
                  <span v-if="compositing" class="spinner spinner-sm"></span>
                  <span v-else>⬇</span>
                  {{ compositing ? 'กำลังเตรียม...' : 'ดาวน์โหลด' }}
                </button>
                <button class="dl-btn ghost-btn" @click="$emit('close')">
                  ยกเลิก
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
  apiBase: { type: String, required: true },
})
const emit = defineEmits(['close'])

// ─── Canvas A4 dimensions (landscape, 96dpi → 1123×794) ──────────────────────
const A4_W = 1123
const A4_H = 794

// ─── Detect animal type from url_path ────────────────────────────────────────
const animalType = computed(() => {
  const path = String(props.item?.url_path || props.item?.filename || '')
  const name = path.split('/').pop().toLowerCase()
  if (name.startsWith('sky')) return 'sky'
  if (name.startsWith('water')) return 'water'
  return 'ground'
})

const typeLabel = computed(() => {
  const map = { sky: '🦅 Sky', ground: '🦁 Ground', water: '🐬 Water' }
  return map[animalType.value] || animalType.value
})

// ─── Background list — scanned from known filenames ──────────────────────────
// ลองโหลดไฟล์ 1–10 แต่ละ type ถ้าโหลดได้ก็เพิ่มเข้า list
const availableBackgrounds = ref([])
const selectedBgIndex = ref(0)

async function probeBackgrounds(type) {
  const candidates = []
  // รองรับทั้ง jpg, jpeg, png, webp
  const exts = ['jpg', 'jpeg', 'png', 'webp']
  for (let i = 1; i <= 20; i++) {
    // รองรับทั้ง 2 รูปแบบชื่อไฟล์: "1.jpg" และ "ground_1.jpg"
    const namePatterns = [`${i}`, `${type}_${i}`]
    let found = false
    for (const namePart of namePatterns) {
      for (const ext of exts) {
        const url = `/backgrounds/${type}/${namePart}.${ext}`
        const ok = await imageExists(url)
        if (ok) {
          candidates.push({ name: `Background ${i}`, url })
          found = true
          break
        }
      }
      if (found) break
    }
  }
  return candidates
}

function imageExists(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

// ─── Canvas compositing ───────────────────────────────────────────────────────
const previewCanvas = ref(null)
const compositing = ref(false)

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const isLocal = src.startsWith('/') || src.startsWith(window.location.origin)
    if (!isLocal) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function drawPreview() {
  const canvas = previewCanvas.value
  if (!canvas) return
  canvas.width = A4_W
  canvas.height = A4_H
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, A4_W, A4_H)

  compositing.value = true
  try {
    // 1) วาด background (ถ้ามี)
    if (selectedBgIndex.value >= 0 && availableBackgrounds.value[selectedBgIndex.value]) {
      const bgUrl = availableBackgrounds.value[selectedBgIndex.value].url
      try {
        const bgImg = await loadImage(bgUrl)
        ctx.drawImage(bgImg, 0, 0, A4_W, A4_H)
      } catch {
        // background load failed — วาดสี fallback
        ctx.fillStyle = '#e8f4e8'
        ctx.fillRect(0, 0, A4_W, A4_H)
      }
    } else {
      // ไม่มี background → ใส่ checkerboard แสดงว่าโปร่งใส
      drawCheckerboard(ctx, A4_W, A4_H)
    }

    // 2) โหลดรูปสัตว์จาก backend
    let animalUrl = props.item.url_path
    if (animalUrl && animalUrl.startsWith('/') && props.apiBase) {
      // เผื่อว่า apiBase มี slash ต่อท้ายหรือไม่
      animalUrl = props.apiBase.replace(/\/+$/, '') + animalUrl
    }
    try {
      const animalImg = await loadImage(animalUrl)
      // วางสัตว์ตรงกลาง ขนาดไม่เกิน 80% ของ canvas
      const maxW = A4_W * 0.8
      const maxH = A4_H * 0.8
      const scale = Math.min(maxW / animalImg.width, maxH / animalImg.height, 1)
      const dw = animalImg.width * scale
      const dh = animalImg.height * scale
      const dx = (A4_W - dw) / 2
      const dy = (A4_H - dh) / 2
      ctx.drawImage(animalImg, dx, dy, dw, dh)
    } catch {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('โหลดรูปสัตว์ไม่สำเร็จ', A4_W / 2, A4_H / 2)
    }
  } finally {
    compositing.value = false
  }
}

function drawCheckerboard(ctx, w, h) {
  const size = 20
  for (let x = 0; x < w; x += size) {
    for (let y = 0; y < h; y += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#d0d0d0' : '#ffffff'
      ctx.fillRect(x, y, size, size)
    }
  }
}

function selectBackground(idx) {
  selectedBgIndex.value = idx
}

watch(selectedBgIndex, () => drawPreview())

// ─── Download ─────────────────────────────────────────────────────────────────
async function doDownload() {
  await drawPreview()
  const canvas = previewCanvas.value
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const baseName = String(props.item.url_path || '').split('/').pop().replace(/\.[^.]+$/, '')
    const bgSuffix = selectedBgIndex.value >= 0 ? '_with_bg' : '_no_bg'
    a.href = url
    a.download = `${baseName}${bgSuffix}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  availableBackgrounds.value = await probeBackgrounds(animalType.value)
  selectedBgIndex.value = availableBackgrounds.value.length > 0 ? 0 : -1
  await drawPreview()
})
</script>

<style scoped src="./BackgroundPickerModal.css"></style>
