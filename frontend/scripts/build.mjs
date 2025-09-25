import { build } from 'vite';
import path from 'node:path';

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
    console.error('❌ Vite programmatic build failed:', err && (err.stack || err.message || err));
    process.exitCode = 1;
  }
})();