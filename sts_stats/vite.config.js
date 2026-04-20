import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/sts_stats/dist/',  // This matches your homepage setting
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})