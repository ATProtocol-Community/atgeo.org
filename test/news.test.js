// The news section builds, lists itself in the nav, and publishes a feed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'atgeo-site-'));
execFileSync(join(root, 'node_modules/.bin/eleventy'), [`--output=${out}`], { cwd: root, stdio: 'pipe' });

test('news index exists and is linked from the nav and the feed is discoverable', () => {
  assert.ok(existsSync(join(out, 'news/index.html')));
  const home = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(home, /<a href="\/news\/">News<\/a>/);
  assert.match(home, /<link rel="alternate" type="application\/atom\+xml"[^>]*href="\/feed\.xml"/);
});

test('feed is an Atom document and never lists the index page as an entry', () => {
  const feed = readFileSync(join(out, 'feed.xml'), 'utf8');
  assert.match(feed, /^<\?xml version="1\.0" encoding="utf-8"\?>\s*<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.doesNotMatch(feed, /<id>https:\/\/atgeo\.org\/news\/<\/id>\s*<updated>[^<]*<\/updated>\s*<content/);
});
