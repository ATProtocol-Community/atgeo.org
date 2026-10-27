// The map demo's search controls at phone and desktop widths. Needs a browser,
// so it skips where Playwright isn't installed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  chromium = null;
}

const css = readFileSync(fileURLToPath(new URL('../src/css/style.css', import.meta.url)), 'utf8');

// The controls src/js/map-demo.js builds inside #map-search; keep in step with it.
const html = (note) => `<!doctype html><style>${css}</style>
<div id="map-search" class="widget"><div class="map-search">
  <input type="text" placeholder="Search for places...">
  <select><option>Overture places</option></select>
  <button type="button" class="icon-btn"></button>
  <button type="button" class="icon-btn icon-btn-wide"></button>
  <span class="map-search-error"${note ? '' : ' hidden'}>${note}</span>
</div></div>`;

async function inputShare(width, note = '') {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.setContent(html(note));
    return await page.$eval('#map-search .map-search', (bar) => {
      const input = bar.querySelector('input').getBoundingClientRect().width;
      return input / bar.clientWidth;
    });
  } finally {
    await browser.close();
  }
}

test('the search input keeps most of the bar on a phone', { skip: !chromium && 'Playwright not installed' }, async () => {
  // At 390px the menu and buttons once squeezed the input to "Search fo".
  assert.ok(await inputShare(390) > 0.8);
});

test('the search input shares its row on a desktop', { skip: !chromium && 'Playwright not installed' }, async () => {
  const share = await inputShare(1280);
  assert.ok(share > 0.5 && share < 0.9);
});

test('a shown note leaves the input its width', { skip: !chromium && 'Playwright not installed' }, async () => {
  const note = 'No places found near here. Try zooming out or another dataset.';
  for (const width of [390, 768, 1280]) {
    assert.equal(await inputShare(width, note), await inputShare(width), `at ${width}px`);
  }
});
