import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/** Backend used by the dev server proxy (npm run dev → /api → FastAPI). */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  server: {
    // Same origin for the browser: no CORS, and SSE streams pass through.
    proxy: { '/api': { target: BACKEND_URL, changeOrigin: true } },
  },
  build: {
    // the report chunk (charts library) is loaded only when a report is opened
    chunkSizeWarningLimit: 1000,
  },
  preview: {
    proxy: { '/api': { target: BACKEND_URL, changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
