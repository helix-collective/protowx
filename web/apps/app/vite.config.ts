import { defineConfig, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';

// requestLog logs each request the dev server answers: the method, the
// URL, the status and the time. A 404 for a route that only bff has,
// such as /api/calc, is then in the terminal and not only in the
// browser.
function requestLog(): Plugin {
  return {
    name: 'protowx:request-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const start = performance.now();
        res.on('finish', () => {
          const ms = (performance.now() - start).toFixed(0);
          const line = `${req.method} ${req.url} ${res.statusCode} ${ms}ms`;
          if (res.statusCode >= 400) server.config.logger.warn(line, { timestamp: true });
          else server.config.logger.info(line, { timestamp: true });
        });
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [solid(), requestLog()],
  // Keep the log: Vite clears the terminal at start by default.
  clearScreen: false,
  logLevel: 'info',
  // The engine worker is a module worker with a wasm asset beside it.
  worker: { format: 'es' },
  build: { target: 'esnext' },
});
