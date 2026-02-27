#!/bin/bash
# สั่งรันบน server เพื่อสร้าง self-signed SSL certificate
# ใช้ครั้งเดียวก่อน docker-compose up

SERVER_IP="103.114.203.22"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/selfsigned.key \
  -out ssl/selfsigned.crt \
  -subj "/C=TH/ST=Bangkok/L=Bangkok/O=ForestAnimal/CN=${SERVER_IP}" \
  -addext "subjectAltName=IP:${SERVER_IP}"

echo "✅ SSL certificate created:"
echo "   ssl/selfsigned.crt"
echo "   ssl/selfsigned.key"
