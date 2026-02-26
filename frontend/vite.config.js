import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://103.114.203.22:809", changeOrigin: true },
      "/outputs": { target: "http://103.114.203.22:809", changeOrigin: true },
      "/static/animations": { target: "http://103.114.203.22:809", changeOrigin: true },
      "/static/rmbg_temp.png": { target: "http://103.114.203.22:809", changeOrigin: true },
      "/static/forest_ambience.mp3": { target: "http://103.114.203.22:809", changeOrigin: true }
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
