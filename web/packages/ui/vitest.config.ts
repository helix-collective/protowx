// The ui package's tests run in a browser, and only there. jsdom has no
// layout engine, so a box has no size and every control would stay put;
// a token of theme.css would not be in effect either. Tests are
// `*.browser.tsx`. The browser is the flake's playwright-driver.browsers,
// to which the npm `playwright` is pinned.
import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    name: 'ui',
    include: ['test/**/*.browser.tsx'],
    // Real CSS, not class names: the point of this project is that the
    // stylesheet is in effect.
    css: true,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
});
