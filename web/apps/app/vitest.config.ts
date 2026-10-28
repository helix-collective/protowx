import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

// The app's own logic in node: the mode, the server's config, the
// recording and the report. A test renders a recording built by hand,
// so none of it needs a browser. The components' tests are in
// packages/ui, in a browser.
export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    name: 'app',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    server: {
      deps: {
        inline: [/solid-js/],
      },
    },
  },
});
