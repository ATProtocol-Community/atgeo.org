// Guards against the site drifting back to the retired wire contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(md|njk|js)$/.test(e.name) ? [p] : [];
  });
}

// Terms from the retired contract, and the files allowed to mention each.
const STALE = [
  { term: /getCoverage/i, allow: [] },
  { term: /com\.atproto\.repo\.getRecord/i, allow: [] },
  { term: /org\.atgeo\.places\./i, allow: [] },
  { term: /\brkey\b/i, allow: [] },
  { term: /generated_at/i, allow: [] },
  { term: /fsq_/i, allow: [] },
  { term: /same_as/i, allow: [] },
  // Overture names Foursquare among its upstream sources.
  { term: /foursquare/i, allow: ['known-gaps.md', 'overture.md'] },
];

test('no page or script uses the retired contract', () => {
  const hits = [];
  for (const file of walk(src)) {
    const rel = relative(src, file);
    const text = readFileSync(file, 'utf8');
    for (const { term, allow } of STALE) {
      if (allow.includes(rel)) continue;
      const m = text.match(term);
      if (m) hits.push(`${rel}: ${m[0]}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('every nav item has a source page', () => {
  const layout = readFileSync(join(src, '_includes', 'base.njk'), 'utf8');
  const urls = [...layout.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(urls.length >= 10, `found ${urls.length} nav urls`);
  const missing = urls.filter((url) => {
    const base = url.replace(/^\/|\/$/g, '');
    if (base === '') return !existsSync(join(src, 'index.md'));
    return ![`${base}.md`, `${base}/index.md`].some((f) => existsSync(join(src, f)));
  });
  assert.deepEqual(missing, []);
});

test('the nav lists the SDK pages and no Foursquare page', () => {
  const layout = readFileSync(join(src, '_includes', 'base.njk'), 'utf8');
  for (const url of ['/sdk/', '/sdk/javascript/', '/sdk/swift/', '/sdk/kotlin/', '/sdk/python/', '/sdk/rust/', '/divisions/']) {
    assert.ok(layout.includes(`"${url}"`), `nav lacks ${url}`);
  }
  assert.ok(!existsSync(join(src, 'foursquare.md')));
});

test('the old hand-rolled search client is gone', () => {
  assert.ok(!existsSync(join(src, 'js', 'atgeo-search.js')));
});
