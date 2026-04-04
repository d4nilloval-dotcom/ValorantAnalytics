import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
// NOTA: Las llamadas a Riot API pasan por proxy-server.cjs (puerto 3001)
// para evitar el bloqueo CORS del navegador. No se necesita proxy en Vite.
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
