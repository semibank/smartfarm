import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['mqtt']
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    }
  },
  server: {
    host: true,
    port: 5173,
    hmr: {
      overlay: true
    }
  }
})
