import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: projectRoot,
  base: './',
  resolve: {
    alias: { '@': resolve(projectRoot, '../src/renderer/src') },
    dedupe: ['react', 'react-dom']
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        download: resolve(projectRoot, 'download.html'),
        preview: resolve(projectRoot, 'preview.html')
      }
    }
  }
})
