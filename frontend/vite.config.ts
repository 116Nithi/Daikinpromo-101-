import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    // Proxy backend routes so the SPA can use same-origin fetch in dev.
    // Production deploys serve the built SPA from the backend (or behind Nginx)
    // so the same paths just work without a proxy.
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
      '/webhook': 'http://localhost:3000',
    },
  },
})
