import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// ⚡ API_BASE hardcode ที่นี่ที่เดียว — ต้องการเปลี่ยน IP แก้ตรงนี้
export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify('http://103.114.203.22:809'),
  },
  server: {
    port: 89,
    host: true, // Allow LAN access
  },
})
