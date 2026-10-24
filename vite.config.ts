import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { saathApiPlugin } from './server/vitePlugin'

const root = fileURLToPath(new URL('.', import.meta.url))
const previewHost = process.env.PREVIEW_HOST

export default defineConfig({
  plugins: [react(), tailwindcss(), saathApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: previewHost ? [previewHost] : [],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: previewHost ? [previewHost] : [],
  },
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts'],
    root,
  },
})
