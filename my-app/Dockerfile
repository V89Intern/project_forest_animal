FROM node:20-alpine AS builder

WORKDIR /app/my-app

COPY my-app/package.json /app/my-app/package.json
COPY my-app/package-lock.json /app/my-app/package-lock.json
RUN npm ci

COPY my-app /app/my-app
ARG VITE_API_BASE=
ENV VITE_API_BASE=${VITE_API_BASE}
RUN chmod -R +x node_modules/.bin && npm run build

FROM nginx:1.27-alpine

COPY my-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/my-app/dist /usr/share/nginx/html

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
