import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Railway-specific Vite config that avoids Rollup native binaries
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild', // Use esbuild instead of Rollup for minification
    rollupOptions: {
      // Disable native optimizations that cause issues on Railway
      treeshake: false,
      external: [],
      output: {
        manualChunks: undefined // Disable chunk splitting that uses native binaries
      }
    }
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      target: 'esnext'
    }
  },
  define: {
    // Force Rollup to use JS implementation
    'process.env.ROLLUP_FORCE_JS': 'true'
  },
  server: {
    host: '0.0.0.0',
    port: process.env.PORT || 3000
  }
})