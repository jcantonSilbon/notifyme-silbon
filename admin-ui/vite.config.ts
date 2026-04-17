import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: {
    outDir: '../dist/admin',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/admin/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  define: {
    // VITE_ADMIN_TOKEN is baked into the bundle at build time
    // Set this in Vercel environment variables
    'import.meta.env.VITE_ADMIN_TOKEN': JSON.stringify(process.env.VITE_ADMIN_TOKEN ?? ''),
  },
})
