import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend must never call :8081/:8082 directly — it only ever talks to
// our own Unified API, proxied here to avoid dealing with CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
