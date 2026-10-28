// What the configs of the regression suite share: the spec, the
// baseline path, the threshold, the viewport and the reports.
// playwright.config.ts is the local config, offline and connected;
// playwright.stack.config.ts, the stack config, reads the same.
// README.md beside this file is the page.

import type { PlaywrightTestConfig } from '@playwright/test';

// The config that plays each value of a scenario's `server`. A project's
// metadata names its config, and the spec skips a scenario of the other
// config with the task that plays it.
export type Config = 'local' | 'stack';

export const configOf = {
  offline: 'local',
  connected: 'local',
  stack: 'stack',
} as const satisfies Record<string, Config>;

export const taskOf: Record<Config, string> = {
  local: 'task web:regression',
  stack: 'task web:regression:stack',
};

export const base: PlaywrightTestConfig = {
  testDir: '.',
  testMatch: 'scenarios.spec.ts',
  outputDir: 'results',
  // A baseline is scenarios/<scenario>.json-snapshots/<server>/<shot>-linux.png:
  // the spec names each shot [`<scenario>.json-snapshots`, `<server>`, `<shot>.png`].
  snapshotPathTemplate: '{testDir}/scenarios/{arg}-{platform}{ext}',
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  // A red scenario is red; a retry would hide a flaky one.
  retries: 0,
  forbidOnly: true,
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 10,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
};
