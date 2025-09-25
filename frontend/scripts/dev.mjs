import { createServer } from 'vite';

(async () => {
  try {
    const server = await createServer({
      // Respect vite.config.
      configFile: 'vite.config.js'
    });
    await server.listen();
    server.printUrls();
  } catch (err) {
    console.error('❌ Vite dev server failed to start:', err && (err.stack || err.message || err));
    process.exitCode = 1;
  }
})();