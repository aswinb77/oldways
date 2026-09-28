import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Inlines small assets (< 25KB, including piece PNGs & SVGs) as data URIs directly into bundle
    assetsInlineLimit: 25600,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('peerjs')) return 'vendor-peerjs'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('react')) return 'vendor-react'
          }
        },
      },
    },
  },
})
