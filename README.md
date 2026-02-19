# Digital Magic Forest

ระบบ Interactive Installation สำหรับสแกนภาพวาด, ลบพื้นหลัง, อนุมัติผ่านหน้า Operator และ Spawn สัตว์เข้าโลกป่า 3D บนเว็บ

## สรุปสั้นๆ

- ผู้ใช้งานสแกนภาพจากหน้า Operator -> Backend ทำ QR + Warp + RMBG
- ตรวจภาพตัวอย่าง (preview) แล้วกด Approve
- ไฟล์ถูกย้ายไป `static/animations`
- หน้า Forest ตรวจไฟล์ใหม่แล้ว Spawn สัตว์แบบ Cinematic

## ภาพรวมระบบ

โปรเจกต์ถูกแยกเป็น 2 ส่วนสำหรับ deploy:

- `backend/` บริการ Flask API (pipeline + endpoint)
- `frontend/` React SPA (Vite) สำหรับ build/deploy แยก

เส้นทางหลักของหน้าเว็บ:
- `/operator` สำหรับควบคุม Capture/Review/Approve
- `/forest` สำหรับแสดงผลสัตว์ในฉาก 3D แบบเรียลไทม์

## Tech Stack

- Backend
  - Python 3.10+ (แนะนำ 3.10)
  - Flask
  - Flask-CORS
- Scanner / CV Pipeline
  - OpenCV (`cv2`)
  - pyzbar (อ่าน QR)
  - rembg (ลบพื้นหลัง)
  - NumPy
- Frontend
  - React 18 (Vite + JSX)
  - React Router
  - Three.js (ฉาก Forest)
  - Tailwind CSS CDN (สไตล์หน้า Launcher/Operator)

## โครงสร้างโปรเจกต์

- `backend/app.py`  
  Flask API, สถานะ pipeline, และการเสิร์ฟไฟล์ runtime

- `backend/scanner_module.py`  
  ตรรกะ scanner (QR detection, contour detection, perspective warp, RMBG)

- `backend/requirements.txt`  
  dependency ของ backend

- `frontend/`  
  React project (Vite) สำหรับ build ฝั่งหน้าเว็บ

- `frontend/src/main.jsx`  
  entry ของ React + route (`/operator`, `/forest`)

- `frontend/src/lib/api.js`  
  API service รวมสำหรับเรียก Flask endpoint

- `frontend/src/lib/forestScene.js`  
  Three.js scene initializer

- `frontend/dist/`  
  output หลัง build สำหรับ deploy

- `static/animations/`  
  ไฟล์ที่ approve แล้วและให้ Forest นำไปแสดงผล

- `static/rmbg_temp.png`  
  preview ล่าสุดก่อน approve

- `outputs/`  
  ไฟล์ภาพที่ผ่านการสแกน (`{type}_{timestamp}.png`)

- `outputs/rmbg/`  
  ประวัติไฟล์ preview

## ลำดับการทำงาน (Pipeline)

1. Operator เปิดกล้อง (`getUserMedia`)
2. กด `Capture + Process`
3. Frontend ส่ง snapshot (`image_data`) ไป `POST /api/capture_process`
4. Backend ประมวลผล:
   - ตรวจ type จาก QR (`sky` / `ground` / `water`)
   - หา contour ของกระดาษ
   - ทำ perspective warp
   - ลบพื้นหลังด้วย RMBG
   - บันทึกลง `outputs/`
   - เขียน preview ไป `static/rmbg_temp.png`
5. Operator ตรวจภาพและกด `Approve & Spawn`
6. Backend ย้ายไฟล์ไป `static/animations/{type}_{timestamp}.png`
7. Frontend ฝั่ง Forest poll `GET /api/latest_animals`
8. แสดง cinematic overlay 3 วินาที
9. Three.js Spawn สัตว์เข้า scene
10. Forest รายงานสถานะ entity กลับผ่าน `POST /api/forest_state`

## API Endpoints

### หน้าและ Health

- `GET /` -> ข้อมูล service ในรูปแบบ JSON
- `GET /health` -> health check

### API หลัก

- `GET /api/latest_animals`  
  ส่งคืนรายการไฟล์ล่าสุดจาก `static/animations`

- `GET /api/pipeline_status`  
  ส่งคืนสถานะ pipeline, progress, message, detected type, preview URL, active entity count

- `POST /api/capture_process`  
  เริ่ม process จากภาพ snapshot
  - Request JSON:
    - `image_data` (base64 data URL จาก canvas)

- `POST /api/approve`  
  อนุมัติ preview และย้ายไฟล์ไปโฟลเดอร์ animation
  - Request JSON:
    - `type`: `ground` | `sky` | `water`
    - `name` (optional)

- `POST /api/clear_forest`  
  ล้างไฟล์ทั้งหมดใน `static/animations`

- `POST /api/forest_state`  
  รับ heartbeat จากหน้า Forest พร้อมรายการไฟล์ที่ render อยู่จริง
  - Request JSON:
    - `rendered`: `string[]`

- `POST /api/kill`  
  เคลียร์ active entities ฝั่ง backend (legacy)

## ตรรกะ Active Entities

ตัวนับ `active_entities` ในหน้า Operator ใช้ข้อมูลจาก:

- จำนวนที่ Forest รายงานผ่าน `/api/forest_state` เมื่อ heartbeat ยังใหม่
- fallback เป็นจำนวนในหน่วยความจำ backend เมื่อ Forest ไม่ออนไลน์

## รายละเอียด Scanner Module

`backend/scanner_module.py` มี 2 โหมด:

- Standalone mode (`python backend/scanner_module.py`)
  - เปิด UI กล้อง
  - กด `s` เพื่อสแกน/ประมวลผล
  - กด `q` เพื่อออก

- API mode (เรียกผ่าน Flask)
  - `process_provided_frame(...)` สำหรับภาพ snapshot จาก browser
  - `capture_and_process_single_frame(...)` สำหรับ fallback จับภาพจาก webcam โดยตรง

ลำดับการตรวจ type จาก QR:

1. ตรวจตรงจาก `DEFAULT_QR_MAPPING`
2. fallback ค้น keyword ในข้อความ QR (`sky`, `ground`, `water`)
3. ถ้าไม่พบ -> `unknown`

## วิธีรัน (Local)

### 1) ติดตั้ง dependency ฝั่ง Backend

```bash
pip install -r backend/requirements.txt
```

### 2) ติดตั้ง dependency ฝั่ง Frontend

```bash
cd frontend
npm install
```

### 3) Build Frontend

```bash
cd frontend
npm run build
```

### 4) รัน Backend

```bash
python -m backend.app
```

### 5) เปิดใช้งาน

- API: `http://localhost:5000/`
- Health: `http://localhost:5000/health`
- Frontend (dev): `http://localhost:5173/operator` และ `http://localhost:5173/forest`

## วิธีรันด้วย Docker Compose (Backend + Frontend)

### Build และเปิด service

```bash
docker compose up --build -d
```

### เปิดใช้งาน

- Frontend: `http://localhost:5173/`
- Backend API: `http://localhost:5000/`
- Health: `http://localhost:5000/health`

### ดู log

```bash
docker compose logs -f
```

### ปิด service

```bash
docker compose down
```

## Frontend Dev Mode (ทางเลือก)

รัน Flask API:

```bash
python -m backend.app
```

รัน React dev server:

```bash
cd frontend
npm run dev
```

ถ้าจำเป็น ให้สร้าง `frontend/.env` จาก `frontend/.env.example` และตั้งค่า:

```bash
VITE_API_BASE=http://127.0.0.1:5000
```

## Troubleshooting

- `Processing failed: Cannot read from webcam`
  - flow ปัจจุบันพยายามหลีกเลี่ยงการ lock กล้องซ้ำ โดยส่ง snapshot จาก browser ไป backend
  - ตรวจสิทธิ์กล้องในเบราว์เซอร์

- `No document contour detected`
  - เพิ่มความต่างสีระหว่างกระดาษกับพื้นหลัง
  - จัดกระดาษให้เห็นครบขอบชัดเจน

- กด Approve แล้วไม่เห็น Spawn ใน Forest
  - ตรวจว่าหน้า `/forest` เปิดอยู่
  - ตรวจว่ามีไฟล์ใน `static/animations`
  - ตรวจ network/console ของ `/api/latest_animals`

- Active entities เป็น 0 ตลอด
  - ตรวจว่า Forest ส่ง heartbeat ผ่าน `/api/forest_state`
  - ถ้า Forest offline ระบบจะ fallback เป็นค่าฝั่ง backend

## หมายเหตุ

- แนะนำ Python 3.10 เพื่อความเข้ากันได้ของ animation ecosystem
- ข้อมูลสัตว์เป็น file-based (`static/animations`) และตัวนับใน memory จะ reset เมื่อ restart backend
- โครงสร้างถูกแยก Backend/Frontend เพื่อ deploy แยกกันได้
- `backend/app.py` บังคับ MIME ของไฟล์ `.js/.mjs/.css` เพื่อหลีกเลี่ยงปัญหา module MIME ใน browser

## Operations

- เช็กลิสต์ก่อนขึ้น production: `PRODUCTION_CHECKLIST.md`
- Docker ใช้ 2 container (`backend`, `frontend`) ผ่าน `docker-compose.yml`
- ถ้าต้องเข้าถึง webcam ตรงจาก host (โดยเฉพาะ Windows) มักรันแบบ local จะง่ายกว่า Docker
