// One test per scenario and server, scenarios/<name>.json. The steps
// play through player.mjs. README.md beside this file is the step table.
//
// A scenario's `server` is one server or a list of them; it is played
// once on each. A test's title ends in [<name>] and its server, so
// `task web:regression -- <name>` greps for it. Its tag is its server:
// @offline, @connected or @stack. Each project of a config greps for
// its own tag; the local config also lists the stack's scenarios, and
// skips them with the task that plays them.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { configOf, taskOf } from './base';
import { play, settle } from './player.mjs';

type Server = keyof typeof configOf;

interface Scenario {
  title: string;
  server?: Server | Server[];
  url?: string;
  todo?: string;
  steps?: object[];
}

const dir = join(__dirname, 'scenarios');

// The page hides each caret and stops each animation that a shot could
// catch half-way. reducedMotion turns the transitions off; this rule is
// for any that does not ask for it.
const still = `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
}`;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const name = file.replace(/\.json$/, '');
  const scenario = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Scenario;
  const servers: Server[] = scenario.server === undefined ? ['offline'] : Array.isArray(scenario.server) ? scenario.server : [scenario.server];

  for (const server of servers) {
    const title = `${scenario.todo !== undefined ? 'todo: ' : ''}${scenario.title} [${name}] ${server}`;
    test(title, { tag: `@${server}` }, async ({ page }) => {
      const config = configOf[server];
      test.skip(scenario.todo !== undefined, `todo: ${scenario.todo}`);
      test.skip(test.info().project.metadata.config !== config, `the ${config} config: ${taskOf[config]}`);

      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto(scenario.url ?? (server === 'offline' ? '/?offline' : '/'));
      await page.locator('[data-term=bar]').waitFor();
      // The engine has answered its first list: the rows are drawn.
      await page.locator('[data-term=row]').first().waitFor();
      await page.addStyleTag({ content: still });
      await page.evaluate(() => document.fonts.ready);
      await settle(page);

      await play(page, scenario.steps ?? [], {
        shot: async (shot: string, target: Locator | Page) => {
          const path = [`${name}.json-snapshots`, server, `${shot}.png`];
          if ('goto' in target) await expect(target).toHaveScreenshot(path);
          else await expect(target).toHaveScreenshot(path);
        },
        see: async (locator: Locator, want: { count?: number; text?: string }) => {
          if (want.count !== undefined) await expect(locator).toHaveCount(want.count);
          else if (want.text !== undefined) await expect(locator).toHaveText(want.text);
          else await expect(locator).toBeVisible();
        },
        root: __dirname,
      });

      expect(errors, 'the page threw').toEqual([]);
    });
  }
}
