import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// ⚡ API_BASE อ่านจาก env var VITE_API_BASE
// - Production (Docker):  VITE_API_BASE=""  → API calls ใช้ /api/... (proxy ผ่าน nginx)
// - Dev local:            proxy ด้านล่างจะส่งต่อไป bmj.v89tech.com
export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE ?? ''),
  },
  server: {
    port: 89,
    host: true,
    proxy: {
      '/api':     { target: 'https://bmj.v89tech.com', changeOrigin: true },
      '/static':  { target: 'https://bmj.v89tech.com', changeOrigin: true },
      '/outputs': { target: 'https://bmj.v89tech.com', changeOrigin: true },
    },
  },
})
