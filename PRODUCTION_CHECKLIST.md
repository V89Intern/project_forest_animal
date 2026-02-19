# Production Hardening Checklist

Checklist นี้ใช้สำหรับเตรียมระบบ `Digital Magic Forest` ก่อนขึ้นใช้งานจริง

## 1) Environment & Config

- [ ] แยก environment ชัดเจน: `dev`, `staging`, `prod`
- [ ] กำหนดค่า `FLASK_DEBUG=0` ใน production
- [ ] ตั้งค่า `VITE_API_BASE` ให้ชี้ backend production จริง
- [ ] เก็บค่า sensitive ใน env/secret manager เท่านั้น (ไม่ hardcode ใน repo)

## 2) Security

- [ ] เปิดใช้งาน HTTPS (ผ่าน reverse proxy หรือ cloud LB)
- [ ] จำกัด CORS ให้เฉพาะ domain ที่อนุญาต
- [ ] ปิด endpoint/debug behavior ที่ไม่จำเป็นใน production
- [ ] ตั้ง request size limit สำหรับ endpoint ที่รับรูปภาพ

## 3) Docker & Deployment

- [ ] รันผ่าน `docker compose up --build -d` โดยไม่มี error
- [ ] ตรวจ `docker compose ps` ว่า service `backend` และ `frontend` เป็น `Up`
- [ ] ตั้ง restart policy (`unless-stopped`) แล้ว
- [ ] ใช้ image version/tag ที่ trace ได้ (ไม่ใช้ latest ลอย)

## 4) Health & Monitoring

- [ ] Health endpoint (`/health`) ตอบกลับปกติ
- [ ] มีการเก็บ logs ของ `backend` และ `frontend` แบบต่อเนื่อง
- [ ] ตั้ง alert ขั้นพื้นฐาน (service down, 5xx error สูงผิดปกติ)
- [ ] ตรวจเวลา sync ของ server/container ให้ถูกต้อง

## 5) Data & Persistence

- [ ] ยืนยัน volume สำหรับไฟล์ runtime (`outputs`, `static/animations`) ทำงานถูกต้อง
- [ ] มี backup plan สำหรับไฟล์สำคัญ (รายวัน/รายสัปดาห์)
- [ ] ทดสอบ restore backup แล้วใช้งานต่อได้จริง
- [ ] มีนโยบายลบไฟล์เก่า (retention) เพื่อลดการโตของ storage

## 6) Runtime Stability

- [ ] ทดสอบ flow ต่อเนื่องขั้นต่ำ 30-60 นาทีโดยไม่ restart service
- [ ] ทดสอบ concurrent operator actions แบบพื้นฐาน
- [ ] ตรวจว่า frontend reconnect ได้เมื่อ backend restart
- [ ] ตรวจ memory/cpu ไม่พุ่งผิดปกติระหว่างใช้งานจริง

## 7) Functional Smoke Test

- [ ] Operator เปิดกล้องได้
- [ ] Capture + Process สำเร็จ
- [ ] Detected type จาก QR ถูกต้อง (`sky/ground/water`)
- [ ] Approve แล้วไฟล์เข้า `static/animations`
- [ ] Forest spawn สัตว์ใหม่ได้และมี cinematic overlay
- [ ] Active entities อัปเดตถูกต้อง
- [ ] Clear forest ทำงานครบทั้ง backend และ frontend

## 8) Rollback Plan

- [ ] มีวิธี rollback เวอร์ชันล่าสุดที่ชัดเจน
- [ ] ทดสอบ rollback อย่างน้อย 1 ครั้งก่อน go-live
- [ ] มีคนรับผิดชอบ on-call ช่วงเปิดใช้งานจริง

## Go-Live Gate

ขึ้น production ได้เมื่อ:

- [ ] Checklist ทุกหัวข้อ critical ผ่าน
- [ ] Smoke test ผ่านครบ
- [ ] ทีมตกลง release window และ rollback owner ชัดเจน
