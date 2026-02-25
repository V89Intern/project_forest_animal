import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api":                       { target: "http://192.168.1.6:5000", changeOrigin: true },
      "/outputs":                   { target: "http://192.168.1.6:5000", changeOrigin: true },
      "/static/animations":         { target: "http://192.168.1.6:5000", changeOrigin: true },
      "/static/rmbg_temp.png":      { target: "http://192.168.1.6:5000", changeOrigin: true },
      "/static/forest_ambience.mp3":{ target: "http://192.168.1.6:5000", changeOrigin: true }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
