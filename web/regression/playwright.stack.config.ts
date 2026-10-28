// The regression suite's stack config: the stack project, on the bff
// image of deploy/compose, with no tailnet. README.md beside this file
// is the page; base.ts holds what this config shares with
// playwright.config.ts.
//
//   task web:regression:stack                        every stack scenario
//   task web:regression:stack -- crud                one scenario, by its name
//   task web:regression:stack -- --update-snapshots  rewrite the baselines
//
// The webServer is task compose:regression-up, which builds the image
// and starts deploy/compose/compose.regression.yaml as the project
// protowx-regression. It returns when bff answers; the command then
// sleeps, since Playwright reads an exit as a server that died.
// Playwright does not stop the container: task web:regression:stack
// runs task compose:regression-down after, on green and on red.

import { defineConfig } from '@playwright/test';
import { base } from './base';

export default defineConfig({
  ...base,
  workers: 1,
  projects: [
    {
      name: 'stack',
      // One engine behind the page: the scenarios take turns. The local
      // config lists the stack's scenarios too, and skips them.
      workers: 1,
      grep: /@stack/,
      metadata: { config: 'stack' },
      use: { baseURL: 'http://127.0.0.1:8094' },
    },
  ],
  webServer: {
    command: 'task --dir ../.. compose:regression-up && exec sleep infinity',
    url: 'http://127.0.0.1:8094/api/config',
    reuseExistingServer: false,
    // A cold build is many minutes: the nix shell, whisper.cpp from
    // source, the Go build and dist/.
    timeout: 1_800_000,
  },
});
