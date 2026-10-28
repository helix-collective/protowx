// The step player: one step language for the regression suite and any
// script that drives the page, such as the user manual's screenshots.
// README.md beside this file is the step table.
//
//   import { settle, play } from './player.mjs';
//   await play(page, steps, { shot, see });
//
// The player drives a Playwright page and nothing else. It imports no
// Playwright module, so a plain playwright script and the regression
// runner (@playwright/test) share it. Each caller gives what differs
// between them in opts:
//
//   shot(name, target)        a `shot` step; target is a locator or the page
//   see(locator, {count, text})  a `see` step; it throws when the check fails
//   root                      the directory an `upload` step's file is from
//
// A new step kind is added here, and given a row in README.md.

import { resolve } from 'node:path';

/**
 * Wait for the page to settle after a step: network idle, then 250 ms.
 * @param {import('playwright').Page} page
 */
export async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(250);
}

/**
 * Play the steps in order. Each step settles the page after it.
 * @param {import('playwright').Page} page
 * @param {object[]} steps
 * @param {{
 *   shot?: (name: string, target: import('playwright').Locator | import('playwright').Page) => Promise<unknown>,
 *   see?: (locator: import('playwright').Locator, want: { count?: number, text?: string }) => Promise<unknown>,
 *   root?: string,
 * }} [opts]
 */
export async function play(page, steps, opts = {}) {
  for (const step of steps) await playStep(page, step, opts);
}

async function playStep(page, step, opts) {
  const loc = (sel) => page.locator(sel).nth(step.nth ?? 0);
  if (step.click !== undefined) {
    await loc(step.click).click();
  } else if (step.dblclick !== undefined) {
    await loc(step.dblclick).dblclick();
  } else if (step.select !== undefined) {
    await loc(step.select).selectOption(step.value);
  } else if (step.hover !== undefined) {
    await loc(step.hover).hover();
  } else if (step.key !== undefined) {
    await page.keyboard.press(step.key);
  } else if (step.type !== undefined) {
    // Into a field, the text lands as one input, so the page answers
    // the whole text and not each prefix of it.
    if (step.into !== undefined) await loc(step.into).fill(step.type);
    else await page.keyboard.type(step.type);
  } else if (step.upload !== undefined) {
    // A file set on a file input, as a pick in the browser's picker
    // would; the path is from opts.root, the regression directory.
    if (opts.root === undefined) throw new Error(`an upload step, and the caller gave no root: ${JSON.stringify(step)}`);
    await loc(step.upload).setInputFiles(resolve(opts.root, step.file));
  } else if (step.wait !== undefined) {
    if (typeof step.wait === 'number') await page.waitForTimeout(step.wait);
    else await page.locator(step.wait).first().waitFor({ state: 'visible' });
  } else if (step.see !== undefined) {
    if (opts.see === undefined) throw new Error(`a see step, and the caller gave no see: ${JSON.stringify(step)}`);
    // A count counts every match, so nth does not apply to it.
    const target = step.count !== undefined ? page.locator(step.see) : loc(step.see);
    await opts.see(target, { count: step.count, text: step.text });
  } else if (step.shot !== undefined) {
    if (opts.shot === undefined) throw new Error(`a shot step, and the caller gave no shot: ${JSON.stringify(step)}`);
    // A whole-page shot moves the mouse to the corner first, so no
    // hover highlight is in the picture.
    if (step.of === undefined) await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await opts.shot(step.shot, step.of !== undefined ? loc(step.of) : page);
  } else {
    throw new Error(`a step with no action: ${JSON.stringify(step)}`);
  }
  await settle(page);
}
