// The regression suite's local config: the offline and connected
// projects, each on a bff that serves dist/ on a fixed loopback port.
// README.md beside this file is the page; base.ts holds what this config
// shares with the stack config of plan phase 6.
//
//   task web:regression                          every scenario
//   task web:regression -- crud                  one scenario, by its name
//   task web:regression -- --project connected   one project
//   task web:regression -- --update-snapshots    rewrite the baselines
//
// REGRESSION_URL, when set, is the page of the offline project, and the
// config starts no server and has no connected project. It plays an
// offline scenario against `task web:dev` while its feature is built.

import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { base } from './base';

const devURL = process.env.REGRESSION_URL;

// The connected server's store and reports: a fresh directory for each
// run, so the run starts from the three seeded calculations. The main
// process clears it; a worker loads this file too, and leaves it.
// REGRESSION_DIR names another, to read a report after a run.
export const runDir = process.env.REGRESSION_DIR ?? join(tmpdir(), 'protowx-regression');
if (!devURL && process.env.TEST_WORKER_INDEX === undefined) {
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(join(runDir, 'bugs'), { recursive: true });
}

// One bff per project. --myw-url '' turns the dictation off, so a
// service that runs on this machine does not change the page.
const bff = (port: number, flags: string) => ({
  command: `go run ../../services/bff --dir ../apps/app/dist --addr 127.0.0.1:${port} --myw-url '' ${flags}`,
  url: `http://127.0.0.1:${port}/index.html`,
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  ...base,
  workers: 4,
  projects: [
    {
      name: 'offline',
      // Every scenario is in one spec file, so its tests spread over the
      // workers only when the project is fully parallel. Each test has
      // its own page, and so its own wasm engine and memory store.
      fullyParallel: true,
      // The stack's scenarios are listed here too, and skipped with the
      // task that plays them.
      grep: [/@offline/, /@stack/],
      metadata: { config: 'local' },
      use: { baseURL: devURL ?? 'http://127.0.0.1:8098' },
    },
    ...(devURL
      ? []
      : [
          {
            name: 'connected',
            // One engine and one store behind the page: the scenarios
            // take turns, in the order of their names.
            workers: 1,
            grep: /@connected/,
            metadata: { config: 'local' },
            use: { baseURL: 'http://127.0.0.1:8099' },
          },
        ]),
  ],
  webServer: devURL
    ? undefined
    : [
        bff(8098, "--api=false --bugs ''"),
        bff(8099, `--api --store ${join(runDir, 'calculations.json')} --bugs ${join(runDir, 'bugs')}`),
      ],
});
