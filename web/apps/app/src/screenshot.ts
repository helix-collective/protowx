// A screenshot for the feedback report: the page drawn from its own
// DOM, as a PNG.
//
// The browser's screen capture, getDisplayMedia, is only there in a
// secure context: https, or http on localhost. The page may be served
// over plain http from another host, where
// navigator.mediaDevices is undefined. modern-screenshot clones the
// DOM into an SVG and draws that on a canvas instead. It needs no
// permission and no prompt, so a press of the screenshot button is
// one frame and nothing else. The cost is fidelity: the frame is the
// page as the DOM describes it, not the pixels the browser drew.

import { domToBlob } from 'modern-screenshot';

/**
 * Whether a dialog is open on the page: the feedback dialog. It is
 * portalled to the body, outside the app's root, so a shot of the root
 * would leave it out.
 */
export function dialogOpen(doc: Document = document): boolean {
  return doc.querySelector('dialog[open]') !== null;
}

/**
 * The page as it is now, at the window's size, as a PNG. It draws the
 * app's root and not the body: a clone of the body comes out shifted by
 * the browser's default body margin.
 *
 * With `dialogs`, it draws the body, so the open dialogs are in the
 * shot: a dialog is portalled to the body, outside the root. The body's
 * margin is 0 in app.css; `dialogOpen` says when.
 */
export async function takeScreenshot(opts: { dialogs?: boolean } = {}): Promise<Blob> {
  const root = opts.dialogs ? document.body : (document.getElementById('root') ?? document.body);
  // The backdrop of each open dialog, in the order the clone meets them;
  // none for a dialog that is not modal, which has no backdrop.
  const backdrops = opts.dialogs ? [...document.querySelectorAll('dialog')].filter((d) => d.open).map(backdropOf) : [];
  const unseen = offScreen(root);
  // A table keeps its height in the clone, and would share the height of
  // the rows left out among the rows drawn. It is marked, and its clone
  // takes the height of the rows it holds.
  const tables = new Set<Element>();
  for (const n of unseen) {
    const t = n instanceof Element && n.parentElement !== null ? n.parentElement.closest('table') : null;
    if (t !== null) tables.add(t);
  }
  for (const t of tables) t.setAttribute(CUT, '');
  let open = 0;
  try {
    return await domToBlob(root, {
      type: 'image/png',
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.devicePixelRatio,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      // The style copied to each node's clone: every property but the
      // custom ones. See `drawnProperties`.
      includeStyleProperties: drawnProperties(),
      // A closed dialog draws nothing, and nor does a part past the
      // window's edge: cloning them only makes the shot slower.
      filter: (node) => !(node instanceof HTMLDialogElement && !node.open) && !unseen.has(node),
      onCloneEachNode: (cloned) => {
        showTextareaValue(cloned);
        if (cloned instanceof HTMLTableElement && cloned.hasAttribute(CUT)) fitTable(cloned);
        if (opts.dialogs && cloned instanceof HTMLDialogElement && cloned.hasAttribute('open')) {
          const backdrop = backdrops[open++];
          if (backdrop !== undefined) liftDialog(cloned, backdrop);
        }
      },
    });
  } finally {
    for (const t of tables) t.removeAttribute(CUT);
  }
}

/**
 * The properties a shot copies from each node's computed style: every
 * one but the custom properties. theme.css declares its tokens on the
 * root, so each node inherits each of them. The clone holds each computed value with its `var()`
 * already resolved, so a token draws nothing in it. Copying them is
 * most of a shot's time.
 */
export function drawnProperties(doc: Document = document): string[] {
  const style = getComputedStyle(doc.documentElement);
  const names: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (!name.startsWith('--')) names.push(name);
  }
  return names;
}

/** The mark on a table some of whose rows the shot leaves out. */
const CUT = 'data-shot-cut';

/** A table's clone, some rows left out: it and its row groups take the height of what they hold. */
function fitTable(t: HTMLTableElement): void {
  t.removeAttribute(CUT);
  for (const part of [t, ...t.tBodies, t.tHead, t.tFoot]) part?.style.setProperty('height', 'auto', 'important');
}

/**
 * The elements under `root` that lie wholly past the window's bottom or
 * right edge, measured once, before the clone. The flow puts them after
 * what is on screen, so leaving them out moves nothing that is drawn.
 * Each node the clone copies costs a read of its computed style.
 */
export function offScreen(root: Element): Set<Node> {
  const out = new Set<Node>();
  const walk = (el: Element) => {
    for (const child of el.children) {
      // A closed dialog is left out by the filter as a whole.
      if (child instanceof HTMLDialogElement && !child.open) continue;
      const r = child.getBoundingClientRect();
      const past = r.top >= window.innerHeight || r.left >= window.innerWidth;
      // A box of no size can hold what is drawn elsewhere: a portal's
      // wrapper sits under the root, and its dialog is in the top layer
      // or its menu is fixed. Its parts are measured one by one.
      if (past && r.width > 0 && r.height > 0 && child.querySelector('dialog[open]') === null) out.add(child);
      else walk(child);
    }
  };
  walk(root);
  return out;
}

/** A modal dialog's backdrop colour, which the clone has no top layer to draw; none for a dialog that is not modal. */
function backdropOf(d: HTMLDialogElement): string | undefined {
  return d.matches(':modal') ? getComputedStyle(d, '::backdrop').backgroundColor : undefined;
}

/**
 * A modal dialog in the clone: the browser drew it in the top layer, and
 * the clone has none, so the page's own stacked parts would be drawn over
 * it. It goes over them, and its backdrop is a shadow round it, so the
 * shot shows what the user saw.
 */
function liftDialog(d: HTMLDialogElement, backdrop: string): void {
  d.style.zIndex = '2147483647';
  const shadow = d.style.boxShadow && d.style.boxShadow !== 'none' ? `${d.style.boxShadow}, ` : '';
  d.style.boxShadow = `${shadow}0 0 0 100vmax ${backdrop}`;
}

/**
 * The library copies a field's value to its `value` attribute. That
 * shows an input's text, but a textarea draws its content and not the
 * attribute, so the notes would come out empty.
 */
function showTextareaValue(cloned: Node): void {
  if (cloned instanceof HTMLTextAreaElement) cloned.textContent = cloned.getAttribute('value') ?? '';
}

/** What the screenshot key reads from an event, so a test can build one by hand. */
export interface KeyLike {
  code: string;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * `Alt+Shift+S`, the screenshot key. It matches the physical key, `code`,
 * and not `key`: on macOS `Option+Shift+S` types `Í`.
 */
export function isScreenshotKey(ev: KeyLike): boolean {
  return ev.code === 'KeyS' && ev.altKey && ev.shiftKey && !ev.ctrlKey && !ev.metaKey;
}
