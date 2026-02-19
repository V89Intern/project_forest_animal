<template>
  <div class="app-container">
    <header 
      :class="['header', 
        { 'header-splash': isSplash }, 
        { 'header-ready': !isSplash && !isFolded },
        { 'header-folded': !isSplash && isFolded }
      ]"
    >
      <div :class="['logo', { 'logo-folded': !isSplash && isFolded }]">
        <span class="logo-icon">✨</span> LOGO
      </div>
    </header>

    <main v-if="!isSplash" class="main-content fade-up-anim">
      <div class="content-wrapper">
        <h2 class="section-title">กรอกข้อมูลเพื่อดำเนินการ</h2>
        
        <div class="input-group">
          <label>ค้นหา</label>
          <input type="text" placeholder="พิมพ์คำค้นหา..." class="custom-input" />
        </div>

        <div class="input-group">
          <label>ชื่อของคุณ</label>
          <input type="text" placeholder="ระบุชื่อของคุณ..." class="custom-input" />
        </div>

        <button class="scan-btn" @click="startScan">
          <span class="btn-icon">📷</span> สแกนด้วยกล้อง
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// สร้าง State สำหรับ Splash Screen (เริ่มต้นให้เป็น true เพื่อโชว์เต็มจอ)
const isSplash = ref(true)
const isFolded = ref(false)

const handleScroll = () => {
  // จะให้พับโลโก้ได้ ก็ต่อเมื่อพ้นหน้า Splash Screen ไปแล้วเท่านั้น
  if (!isSplash.value) {
    isFolded.value = window.scrollY > 10
  }
}

const startScan = () => {
  alert('เปิดกล้อง')
}

onMounted(() => {
  // ตั้งเวลา 1.2 วินาที (1200 ms) 
  setTimeout(() => {
    isSplash.value = false // ปิดหน้า Splash ให้โลโก้หดลงและโชว์หน้าค้นหา
  }, 1200)

  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
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

/* สถานะที่ 3: เมื่อผู้ใช้ไถนิ้วเลื่อนหน้าจอ */
.header-folded {
  height: 70px;
  background: rgba(30, 60, 114, 0.98);
  flex-direction: row;
}

.logo {
  color: #ffffff;
  font-size: 3.5rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.6s ease-in-out;
}

.logo-folded {
  font-size: 1.5rem;
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
  font-size: 1rem;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
}

.custom-input:focus {
  border-color: #2a5298;
  box-shadow: 0 4px 15px rgba(42, 82, 152, 0.15);
}

.scan-btn {
  margin-top: 20px;
  background: linear-gradient(135deg, #ff512f 0%, #dd2476 100%);
  color: white;
  border: none;
  border-radius: 16px;
  padding: 18px;
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(221, 36, 118, 0.3);
  transition: transform 0.2s;
}

.scan-btn:active {
  transform: scale(0.96);
}
</style>