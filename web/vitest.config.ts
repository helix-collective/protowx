import { defineConfig } from 'vitest/config';

// One project per member: client in node against the real wasm, ui in
// a browser, the app in node. Each member's vitest.config.ts says how.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
