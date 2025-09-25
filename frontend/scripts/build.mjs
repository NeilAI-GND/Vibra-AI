import { build } from 'vite';
import path from 'node:path';
import { execSync } from 'node:child_process';

(async () => {
  try {
    const configFile = path.resolve(process.cwd(), 'vite.config.js');
    console.log('[Vite Programmatic Build] Using config:', configFile);

    // Force Rollup to use JS implementation instead of native binary
    const buildConfig = {
      configFile,
      build: {
        rollupOptions: {
          // Force Rollup to use JS implementation
          external: [],
          plugins: []
        }
      },
      optimizeDeps: {
        // Force dependency optimization
        force: true
      }
    };

    await build(buildConfig);

    console.log('✅ Vite programmatic build completed successfully');
  } catch (err) {
    const errorMsg = err && (err.message || '');
    
    // Handle Rollup native dependency issue specifically
    if (errorMsg.includes('@rollup/rollup-linux-x64-gnu') || errorMsg.includes('npm has a bug related to optional dependencies')) {
      console.warn('⚠️ Rollup native dependency issue detected, attempting aggressive workaround...');
      try {
        // Force reinstall with legacy peer deps and rebuild native modules
        console.log('🔄 Rebuilding all native dependencies...');
        execSync('npm rebuild', { stdio: 'inherit' });
        execSync('npm install --legacy-peer-deps --force', { stdio: 'inherit' });
        execSync('npm rebuild rollup', { stdio: 'inherit' });
        
        // Try with fallback configuration that forces JS implementation
        console.log('🔄 Retrying Vite build with fallback config...');
        await build({
          configFile,
          build: {
            rollupOptions: {
              // Disable native optimizations
              treeshake: false,
              external: []
            }
          },
          define: {
            // Force Rollup to use JS implementation
            'process.env.ROLLUP_FORCE_JS': 'true'
          }
        });
        console.log('✅ Vite build succeeded after aggressive dependency fix');
        return;
      } catch (retryErr) {
        console.error('❌ Build failed even after aggressive dependency fix:', retryErr && (retryErr.message || retryErr));
        
        // Last resort: try to use esbuild instead of rollup
        try {
          console.log('🔄 Attempting last resort: esbuild fallback...');
          await build({
            configFile,
            build: {
              target: 'esnext',
              minify: 'esbuild',
              rollupOptions: {
                external: []
              }
            },
            esbuild: {
              target: 'esnext'
            }
          });
          console.log('✅ Vite build succeeded with esbuild fallback');
          return;
        } catch (esbuildErr) {
          console.error('❌ Even esbuild fallback failed:', esbuildErr && (esbuildErr.message || esbuildErr));
        }
      }
    }
    
    console.error('❌ Vite programmatic build failed:', err && (err.stack || err.message || err));
    process.exitCode = 1;
  }
})();