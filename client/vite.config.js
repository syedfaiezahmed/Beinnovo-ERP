import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'charts';
            }
            if (id.includes('xlsx') || id.includes('jspdf') || id.includes('file-saver')) {
              return 'utils';
            }
            if (id.includes('react-icons')) {
              return 'icons';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
