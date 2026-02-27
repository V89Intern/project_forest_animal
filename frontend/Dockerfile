FROM node:20-alpine AS builder

WORKDIR /app/frontend

COPY frontend/package.json /app/frontend/package.json
COPY frontend/package-lock.json /app/frontend/package-lock.json
RUN npm install

COPY frontend /app/frontend
RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# SSL certificates will be mounted as volume from ./ssl/
RUN mkdir -p /etc/nginx/ssl

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
