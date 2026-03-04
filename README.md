# Digital Magic Forest

ระบบสแกนภาพวาดสัตว์ -> ลบพื้นหลัง -> อนุมัติ -> แสดงในฉากป่า 3D แบบ realtime

อัปเดตล่าสุด: 2026-03-04 (สรุปสถานะโค้ดและการใช้งานจริง)

## TL;DR

- Deployment ปัจจุบันใช้ `backend` + `my-app` (Vue) ผ่าน `docker-compose.yml`
- ไฟล์สัตว์ที่ใช้งานจริงเป็น PNG ใน `static/animations/`
- การ "อนิเมชันสัตว์" ทำที่ frontend runtime (Three.js sprite motion) ไม่ได้ใช้ `backend/animation_worker.py`
- `backend/sheets_service.py` ยังไม่มีจุดเรียกใช้ในระบบหลัก

## สถาปัตยกรรมปัจจุบัน

### Runtime ที่ใช้งานจริง (ตาม `docker-compose.yml`)

- `backend` (Flask API, CV pipeline, queue, PostgreSQL integration)
- `myapp` (Vue frontend ที่เรียก API backend)

### โค้ดอีกชุดที่ยังอยู่ใน repo

- `frontend/` (React + Three.js)
  - ใช้สำหรับ flow/operator-forest อีกชุด
  - ไม่ได้ถูกผูกเข้า compose ปัจจุบัน

## Tech Stack

### Backend

- Python 3.10
- Flask + Flask-CORS
- PostgreSQL (`psycopg2`)
- JWT (`PyJWT`)
- OpenCV + NumPy
- rembg + onnxruntime

### Frontend

- Runtime ปัจจุบัน: Vue 3 + Vite (`my-app/`)
- ชุดแยกใน repo: React 18 + Three.js (`frontend/`)

### Infrastructure

- Docker Compose
- Nginx (ใน container frontend)
- โฟลเดอร์ runtime data: `outputs/`, `static/animations/`

## Pipeline

### Capture/Approve Pipeline (Backend)

1. ผู้ใช้ส่งภาพผ่าน `POST /api/capture_process`
2. Backend เข้า queue (`Queue_Job`) และ worker ประมวลผลภาพด้วย `scanner_module.py`
3. ได้ preview ที่ `static/rmbg_temp.png`
4. อนุมัติผ่าน `POST /api/approve`
5. Backend ย้ายไฟล์ไป `static/animations/<type>_<timestamp>_<id>.png`

### Forest Render Pipeline (Frontend)

1. Frontend เรียก `GET /api/latest_animals`
2. โหลดไฟล์ PNG จาก `static/animations/`
3. สร้าง sprite ใน Three.js scene
4. ใส่ motion ตามประเภทสัตว์ (`sky`/`water`/`ground`)
5. ส่ง heartbeat กลับผ่าน `POST /api/forest_state`

## Scanner Module Pipeline + Models

อ้างอิงไฟล์: `backend/scanner_module.py`

### Pipeline ใน `scanner_module.py`

1. รับภาพเข้ามา (`process_provided_frame` หรือ `capture_and_process_single_frame`)
2. หา document contour (กระดาษ) ด้วย OpenCV (`find_document_contour`)
3. ทำ perspective transform ให้เป็นมุมตรง (`four_point_transform`)
4. crop ขอบกระดาษออกบางส่วน
5. ปรับคุณภาพสี/แสง (`enhance_image_color`)
6. พยายามจับคู่ template (`_match_template`) ด้วย SIFT + FLANN
7. ถ้า template match สำเร็จ ใช้ mask จาก template แล้วถมรู (`_fill_alpha_holes`)
8. ถ้า match ไม่สำเร็จ ใช้ rembg ลบพื้นหลัง (`remove(...)`) แล้ว post-process alpha
9. บันทึกผลเป็น PNG โปร่งใส (`save_processed_image`)

### Model / Algorithm ที่ใช้

- Background removal model (ใช้งานจริง): `birefnet-general`
  - เรียกผ่าน `new_session("birefnet-general")`
- Feature matching: SIFT (`cv2.SIFT_create`) + FLANN (`cv2.FlannBasedMatcher`)

### หมายเหตุ

- ในไฟล์มี comment เก่าที่พูดถึง `u2net` แต่โค้ด runtime ปัจจุบันเรียก `birefnet-general`

## "ใครเป็นคนสร้าง Animation ของสัตว์?"

### สิ่งที่ backend สร้าง

- สร้างไฟล์ภาพ PNG โปร่งใสจาก pipeline (`scanner_module.py`)
- ย้ายไฟล์สุดท้ายไป `static/animations/` ตอน approve (`backend/app.py`)

### สิ่งที่ frontend ทำ

- โหลด PNG จาก `/static/animations/...`
- ทำการเคลื่อนไหว (บิน/ว่าย/กระโดด), spawn effect, cinematic overlay ใน runtime
- โค้ดหลักอยู่ที่:
  - `frontend/src/lib/forestScene.js`
  - `frontend/src/components/CinematicSpawnOverlay.jsx`

### สรุป

- `backend/animation_worker.py` (ซึ่งตั้งใจทำ GIF ผ่าน `animated_drawings`) ยังไม่ถูกเรียกใช้ใน flow ปัจจุบัน

## โครงสร้างที่ควรรู้

- `backend/app.py`:
  - API ทั้งหมด
  - queue worker + pipeline state
  - approve/move file + DB log
- `backend/scanner_module.py`:
  - warp/crop/enhance/remove background
  - template matching + fallback rembg
- `backend/db.py`:
  - PostgreSQL pool/query helpers
- `backend/auth.py`:
  - JWT + decorators
- `backend/init.sql`:
  - schema และ seed ข้อมูลเริ่มต้น
- `my-app/src/app.vue`:
  - Vue portal หลัก (register/login/search/download)
- `frontend/src/lib/forestScene.js`:
  - Three.js scene + animal motion runtime

## API หลักที่ใช้งานบ่อย

- `GET /health` - health check
- `POST /api/capture_process` - ส่งรูปเข้าคิวประมวลผล
- `GET /api/queue_status/<job_id>` - ดูสถานะงาน
- `POST /api/approve` - อนุมัติและย้ายไฟล์เข้า `static/animations`
- `GET /api/latest_animals` - ดึงรายการสัตว์ล่าสุด
- `GET /api/pipeline_status` - สถานะ pipeline/queue ปัจจุบัน
- `POST /api/forest_state` - heartbeat จาก forest
- `POST /api/clear_forest` - ล้างไฟล์สัตว์ทั้งหมด

## การรันระบบ

### Docker Compose (แนะนำ)

```bash
docker compose up --build -d
docker compose logs -f
docker compose down
```

ค่า default port ใน compose:

- `myapp`: `http://localhost:3128`
- `backend`: `http://localhost:809`

### Local Dev (Backend)

```bash
pip install -r backend/requirements.txt
python -m backend.app
```

### Local Dev (Vue my-app)

```bash
cd my-app
npm ci
npm run dev
```

### Local Dev (React frontend ชุดแยก)

```bash
cd frontend
npm ci
npm run dev
```

`frontend/.env.example`

```bash
VITE_API_BASE=http://127.0.0.1:5000
```

## สรุปสถานะไฟล์ที่ "ยังไม่ถูกใช้งาน" (จากการตรวจ reference)

### ไม่ถูกเรียกจาก flow หลัก

- `backend/sheets_service.py`
- `backend/animation_worker.py`

### ไม่ถูกอ้างอิงใน repo ปัจจุบัน

- `ssl/selfsigned.pfx`
- `my-app/src/assets/vue.svg`
- `my-app/public/vite.svg`

### ไม่ได้ถูกใช้งานใน compose ปัจจุบัน

- ทั้งโฟลเดอร์ `frontend/` (runtime ปัจจุบันใช้ `my-app`)
- ทั้งโฟลเดอร์ `backend-proxy/`

## หมายเหตุเรื่อง SSL

- `frontend/nginx.conf` อ้างอิง `selfsigned.crt` และ `selfsigned.key`
- `selfsigned.pfx` เป็น PKCS#12 (cert+key รวมไฟล์เดียว) แต่ในระบบนี้ยังไม่ถูกเรียกใช้

## ข้อควรระวัง

- `init-letsencrypt.sh` อ้างถึง `certbot` service แต่ `docker-compose.yml` ปัจจุบันยังไม่มี service นี้
- ก่อนลบไฟล์ที่ระบุว่า unused ควรเช็กว่าทีมไม่ได้ใช้สคริปต์/manual flow นอก compose

## เอกสารประกอบ

- `PRODUCTION_CHECKLIST.md` - เช็กลิสต์ก่อนขึ้น production
