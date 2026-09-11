/**
 * Root vitest config. Node is the default environment (API tests use
 * app.inject and don't need a DOM); .tsx tests under tests/ get jsdom
 * since they render React components.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
  },
});
