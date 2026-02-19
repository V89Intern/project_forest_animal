import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5000",
      "/outputs": "http://127.0.0.1:5000",
      "/static/animations": "http://127.0.0.1:5000",
      "/static/rmbg_temp.png": "http://127.0.0.1:5000",
      "/static/forest_ambience.mp3": "http://127.0.0.1:5000"
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
