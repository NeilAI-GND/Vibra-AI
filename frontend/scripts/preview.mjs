import { preview } from 'vite';
import path from 'node:path';

(async () => {
  try {
    const outDir = path.resolve(process.cwd(), 'dist');
    console.log('[Vite Programmatic Preview] Serving from:', outDir);
    const server = await preview({ preview: { port: process.env.PORT ? Number(process.env.PORT) : 4173 } });
    server.printUrls();
  } catch (err) {
    console.error('❌ Vite preview server failed:', err && (err.stack || err.message || err));
    process.exitCode = 1;
  }
})();