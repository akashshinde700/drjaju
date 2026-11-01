import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
       host: true, // 👈 ADD THIS
    allowedHosts: ['drjaju.com', '72.60.206.56', 'localhost', '.e2b.app'], // 👈 ADD THIS
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
    preview: { // 👈 ALSO ADD THIS (important for build preview)
    host: true,
    allowedHosts: ['drjaju.com', '72.60.206.56', 'localhost', '.e2b.app','www.drjaju.com']
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // setupFiles removed: ./tests/setup.js did not exist and broke vitest startup
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        '*.config.ts'
      ]
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React vendor - always needed
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Axios - small, always needed for API calls
          if (id.includes('node_modules/axios')) {
            return 'utils-vendor';
          }
          // Sentry - large, loaded async in main.jsx
          if (id.includes('node_modules/@sentry')) {
            return 'sentry';
          }
          // UI components - small, used across pages
          if (id.includes('node_modules/react-icons')) {
            return 'ui-vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios']
  }
})
