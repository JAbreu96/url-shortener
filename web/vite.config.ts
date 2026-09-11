/**
 * Vite config for the React UI. Dev server proxies /urls to the Fastify
 * API on :3000 so the SPA can hit relative paths in both dev and prod.
 * Production build output goes to web/dist, served by src/app.ts.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/urls": "http://localhost:3000",
    },
  },
});
