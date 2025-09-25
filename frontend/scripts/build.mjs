import { build } from 'vite';
import path from 'node:path';
import { execSync } from 'node:child_process';

(async () => {
  try {
    const configFile = path.resolve(process.cwd(), 'vite.config.js');
    console.log('[Vite Programmatic Build] Using config:', configFile);

    await build({
      configFile,
      // Keep default mode unless Vercel sets NODE_ENV
      // You can override via env: MODE=production npm run build
    });

    console.log('✅ Vite programmatic build completed successfully');
  } catch (err) {
    const errorMsg = err && (err.message || '');
    
    // Handle Rollup native dependency issue specifically
    if (errorMsg.includes('@rollup/rollup-linux-x64-gnu') || errorMsg.includes('npm has a bug related to optional dependencies')) {
      console.warn('⚠️ Rollup native dependency issue detected, attempting workaround...');
      try {
        // Force reinstall with legacy peer deps to handle optional dependencies
        console.log('🔄 Reinstalling dependencies with legacy peer deps...');
        execSync('npm install --legacy-peer-deps --force', { stdio: 'inherit' });
        
        // Retry the build
        console.log('🔄 Retrying Vite build...');
        await build({ configFile });
        console.log('✅ Vite build succeeded after dependency fix');
        return;
      } catch (retryErr) {
        console.error('❌ Build failed even after dependency fix:', retryErr && (retryErr.message || retryErr));
      }
    }
    
    console.error('❌ Vite programmatic build failed:', err && (err.stack || err.message || err));
    process.exitCode = 1;
  }
})();