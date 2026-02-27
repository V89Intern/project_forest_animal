#!/bin/bash
# =============================================================
#  init-letsencrypt.sh — รันบน server: bash init-letsencrypt.sh
# =============================================================

set -e

DOMAIN_APP="mj.v89tech.com"    # Vue frontend
DOMAIN_API="bmj.v89tech.com"   # Backend API
EMAIL="admin@v89tech.com"
STAGING=0   # ตั้งเป็น 1 เพื่อทดสอบก่อน

STAGING_ARG=""
[ "${STAGING}" = "1" ] && STAGING_ARG="--staging" && echo "⚠️  STAGING MODE"

# ── Step 1: สร้าง directories (ใช้ sudo เพราะ Docker volume เป็น root) ──
echo "### สร้าง directories..."
sudo mkdir -p ./certbot/conf/live/${DOMAIN_APP}
sudo mkdir -p ./certbot/conf/live/${DOMAIN_API}
sudo mkdir -p ./certbot/www

# ── Step 2: สร้าง dummy certs ด้วย alpine (มี openssl ในตัว) ──────────
echo "### สร้าง dummy certificates..."
for DOMAIN in "$DOMAIN_APP" "$DOMAIN_API"; do
  sudo docker run --rm \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    alpine sh -c "
      apk add --no-cache openssl -q 2>/dev/null;
      openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
        -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
        -out    /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
        -subj '/CN=${DOMAIN}' 2>/dev/null;
      echo 'dummy cert: ${DOMAIN}'
    "
done

# ── Step 3: Build + Start nginx ──────────────────────────────
echo "### Build และ start myapp (nginx)..."
docker-compose up -d --build myapp
echo "### รอ nginx พร้อม (5 วินาที)..."
sleep 5

# ── Step 4: ขอ cert จริง mj.v89tech.com ─────────────────────
echo "### ขอ certificate: ${DOMAIN_APP}..."
docker-compose run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  ${STAGING_ARG} \
  --email ${EMAIL} --agree-tos --no-eff-email \
  -d ${DOMAIN_APP}

# ── Step 5: ขอ cert จริง bmj.v89tech.com ─────────────────────
echo "### ขอ certificate: ${DOMAIN_API}..."
docker-compose run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  ${STAGING_ARG} \
  --email ${EMAIL} --agree-tos --no-eff-email \
  -d ${DOMAIN_API}

# ── Step 6: Start ทุก service + Reload nginx ──────────────────
echo "### Start ทุก service..."
docker-compose up -d --build
sleep 3
docker-compose exec myapp nginx -s reload

echo ""
echo "============================================="
echo "  ✅ SSL Certificates สำเร็จ!"
echo "  🌐 App: https://${DOMAIN_APP}"
echo "  🔧 API: https://${DOMAIN_API}"
echo "  📅 Auto-renewal: ทุก 12h โดย certbot"
echo "============================================="
