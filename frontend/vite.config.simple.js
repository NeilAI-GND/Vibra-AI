import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Simple static build config for direct Netlify upload
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for static hosting
  build: {
    outDir: '../netlify-build', // Build to root level for easy upload
    emptyOutDir: true,
    target: 'es2015', // Broader browser support
    minify: 'esbuild',
    sourcemap: false, // Reduce build size
    rollupOptions: {
      output: {
        // Simple file naming for static hosting
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks: undefined // Single bundle for simplicity
      }
    }
  },
  define: {
    // Environment variables for production
    'process.env.NODE_ENV': '"production"'
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})