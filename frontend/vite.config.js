import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "https://bmj.v89tech.com", changeOrigin: true },
      "/outputs": { target: "https://bmj.v89tech.com", changeOrigin: true },
      "/static/animations": { target: "https://bmj.v89tech.com", changeOrigin: true },
      "/static/rmbg_temp.png": { target: "https://bmj.v89tech.com", changeOrigin: true },
      "/static/forest_ambience.mp3": { target: "https://bmj.v89tech.com", changeOrigin: true }
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
