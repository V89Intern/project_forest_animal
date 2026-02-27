FROM nginx:1.27-alpine

COPY backend-proxy/nginx.conf /etc/nginx/conf.d/default.conf

# SSL certs mounted via docker-compose volume (certbot/conf)
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
