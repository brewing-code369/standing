import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: process.env.API_PROXY ?? 'http://localhost:8787', changeOrigin: true } } },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
})
