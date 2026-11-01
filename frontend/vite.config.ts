/** Vite config: React plugin, dev server on :5173 with /api proxied to the FastAPI backend. */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
});
