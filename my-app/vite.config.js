import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(
      process.env.VITE_API_BASE !== undefined
        ? process.env.VITE_API_BASE
        : 'http://192.168.1.4:5000'
    ),
  },
  server: {
    port: 89,
    host: true, // Allow LAN access
  },
})
