// shadcn's framework detector expects a conventional Vite config file.
// Electron builds use electron.vite.config.ts; this mirrors the renderer setup.
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: {
      '@': resolve('src/renderer/src')
    }
  },
  plugins: [react(), tailwindcss()]
})
