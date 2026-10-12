const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const overture = fixture('overture-tile.json');
const osm = fixture('osm-tile.json');
const all = [...overture.records, ...osm.records];

const ctx = { URL, URLSearchParams };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'atgeo-search.js'), 'utf8'),
  ctx,
);
const S = ctx.AtgeoSearch;

// Values cross the vm realm boundary; strict deepEqual compares prototypes.
const plain = (x) => JSON.parse(JSON.stringify(x));
const names = (records) => records.map((r) => r.value.name);
const byName = (n) => all.find((r) => r.value.name === n);

const OSM_VIEW = [-122.451, 37.77, -122.43, 37.788];
const OSM_CENTER = [-122.44, 37.78];
const OV_VIEW = [-122.442, 37.779, -122.437, 37.784];
const OV_CENTER = [-122.4395, 37.7815];

test('snapBbox floors mins and ceils maxes to 0.01 with two decimals', () => {
  assert.equal(S.snapBbox([-122.4194, 37.7749, -122.4, 37.78]), '-122.42,37.77,-122.40,37.78');
  assert.equal(S.snapBbox([1, 2, 3, 4]), '1.00,2.00,3.00,4.00');
});

test('snapBbox clamps to the web-mercator extent', () => {
  assert.equal(S.snapBbox([-200, -90, 200, 90]), '-180.00,-85.06,180.00,85.06');
});

test('normalize strips diacritics, folds case and compatibility forms, collapses whitespace', () => {
  assert.equal(S.normalize('Café'), 'cafe');
  assert.equal(S.normalize('  Bistro   La\tChaumière '), 'bistro la chaumiere');
  assert.equal(S.normalize('ＡＢＣ ﬁsh'), 'abc fish');
});

test('matchTier grades exact, prefix, token-prefix and substring', () => {
  const popeyes = byName('Popeyes');
  const choice = byName('Choice Medical Group');
  assert.equal(S.matchTier('popeyes', popeyes), 0);
  assert.equal(S.matchTier('pop', popeyes), 1);
  assert.equal(S.matchTier('med gr', choice), 2);
  assert.equal(S.matchTier('edical', choice), 3);
});

test('matchTier matches variant names', () => {
  const popeyes = byName('Popeyes');
  assert.equal(S.matchTier('popeyes louisiana kitchen', popeyes), 0);
  assert.equal(S.matchTier('louisiana', popeyes), 2);
  assert.equal(S.matchTier('m·a·c', byName('MAC Cosmetics')), 0);
});

test('rank orders by tier before importance, and drops non-matches', () => {
  const ranked = S.rank(all, { q: 'ch', bbox: OSM_VIEW, center: OSM_CENTER });
  // Choice Medical Group: prefix (59); Chaumière: token-prefix (46);
  // Popeyes: substring of its variant "Popeyes Louisiana Kitchen" (53).
  assert.deepEqual(plain(names(ranked)), [
    'Choice Medical Group',
    'Bistro La Chaumière',
    'Popeyes',
  ]);
});

test('rank matches regardless of diacritics, case and spacing', () => {
  const ranked = S.rank(all, { q: 'CAFE', bbox: OSM_VIEW, center: OSM_CENTER });
  assert.deepEqual(plain(names(ranked)), ['Cafe Réveille', 'Café 2238']);
  const spaced = S.rank(all, { q: 'cafe   REVEILLE', bbox: OSM_VIEW, center: OSM_CENTER });
  assert.deepEqual(plain(names(spaced)), ['Cafe Réveille']);
});

test('rank breaks ties on distance to the centre', () => {
  const nearCreditUnion = S.rank(all, { q: 'fi', bbox: OSM_VIEW, center: [-122.447, 37.787] });
  assert.deepEqual(plain(names(nearCreditUnion)), [
    'Firecrawl',
    'San Francisco Fire Credit Union',
    "'N Motion Fitness",
    'Effin Relax',
  ]);
  const nearNMotion = S.rank(all, { q: 'fi', bbox: OSM_VIEW, center: [-122.45, 37.773] });
  assert.deepEqual(plain(names(nearNMotion)), [
    'Firecrawl',
    "'N Motion Fitness",
    'San Francisco Fire Credit Union',
    'Effin Relax',
  ]);
});

test('rank with empty q orders by importance, then distance, then uri', () => {
  const ranked = S.rank(overture.records, { q: '', bbox: OV_VIEW, center: OV_CENTER });
  // The 60s: four share the nearer location (ordered by uri), then Ross
  // and Bañez share the farther one (uri again). Nishimoto and Azure Dental
  // share a location, so uri puts Nishimoto first although Azure sorts
  // first by name.
  assert.deepEqual(plain(names(ranked)), [
    'Mollie Goodman, Np',
    'Samantha Langer',
    'Dr. Beverly L. Bolinger, Md',
    'Peter Peng-boon Yeo, Md',
    'Jennifer Ross Md',
    'Mary Ann Bañez, M.d.',
    'Arab Talk Radio',
    'Late Bloomers San Francisco',
    'Choice Medical Group',
    'Divisadero Heights Cleaners',
    'UPS Access Point location',
    'MAC Cosmetics',
    'Pearl Market',
    'Nove Device',
    'Nishimoto Physical Therapy Svc',
    'Azure Dental',
    'Café 2238',
  ]);
});

test('rank treats missing importance as zero', () => {
  const noImportance = structuredClone(byName('Arab Talk Radio'));
  noImportance.uri += '-x';
  noImportance.value.rkey += '-x';
  delete noImportance.value.importance;
  const ranked = S.rank([...overture.records, noImportance], {
    q: '',
    bbox: OV_VIEW,
    center: OV_CENTER,
  });
  assert.equal(ranked.length, 18);
  assert.equal(ranked[17].uri, noImportance.uri);
});

test('rank dedupes by value.rkey', () => {
  const dupe = structuredClone(overture.records[0]);
  dupe.uri = dupe.uri.replace('https://places.atgeo.org', 'https://example.org');
  const ranked = S.rank([...overture.records, dupe, ...overture.records], {
    q: '',
    bbox: OV_VIEW,
    center: OV_CENTER,
  });
  assert.equal(ranked.length, 17);
  assert.equal(new Set(ranked.map((r) => r.value.rkey)).size, 17);
});

test('rank filters to the unsnapped bbox using string coordinates', () => {
  // East edge -122.4390 excludes MAC Cosmetics (-122.438850) and Nove Device
  // (-122.438065); the snapped edge (-122.43) would include them.
  const bbox = [-122.441, 37.779, -122.439, 37.784];
  const ranked = S.rank(overture.records, { q: '', bbox, center: [-122.44, 37.7815] });
  assert.deepEqual(plain(names(ranked)), [
    'Mollie Goodman, Np',
    'Samantha Langer',
    'Dr. Beverly L. Bolinger, Md',
    'Peter Peng-boon Yeo, Md',
    'Jennifer Ross Md',
    'Mary Ann Bañez, M.d.',
    'Arab Talk Radio',
    'Late Bloomers San Francisco',
    'Choice Medical Group',
    'Divisadero Heights Cleaners',
    'Pearl Market',
    'Nishimoto Physical Therapy Svc',
    'Azure Dental',
    'Café 2238',
  ]);
  assert.equal(typeof overture.records[0].value.locations[0].latitude, 'string');
});

test('rank drops records without a geo location', () => {
  const addressOnly = structuredClone(byName('Arab Talk Radio'));
  addressOnly.uri += '-a';
  addressOnly.value.rkey += '-a';
  addressOnly.value.locations = addressOnly.value.locations.filter((l) => !l.$type.includes('geo'));
  addressOnly.value.locations.push({ $type: 'community.lexicon.location.address', country: 'US' });
  const empty = structuredClone(addressOnly);
  empty.uri += 'b';
  empty.value.rkey += 'b';
  empty.value.locations = [];
  const ranked = S.rank([...overture.records, addressOnly, empty], {
    q: '',
    bbox: OV_VIEW,
    center: OV_CENTER,
  });
  assert.equal(ranked.length, 17);
});

const COVERAGE = 'https://places.atgeo.org/xrpc/org.atgeo.getCoverage';
const TILE_A = 'https://places.atgeo.org/tiles/overture/a.json';
const TILE_B = 'https://places.atgeo.org/tiles/overture/b.json';
const respond = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function stubFetch(handlers) {
  const calls = [];
  ctx.fetch = async (url) => {
    calls.push(String(url));
    const h = handlers[String(url).split('?')[0]];
    if (!h) throw new Error(`unexpected fetch ${url}`);
    return h(String(url));
  };
  return calls;
}

const SEARCH_BBOX = [-122.4405, 37.7795, -122.438, 37.784];

test('search calls getCoverage with the snapped bbox, fetches tiles, ranks and limits', async () => {
  const calls = stubFetch({
    [COVERAGE]: () => respond({ tiles: [TILE_A, TILE_B] }),
    [TILE_A]: () => respond(overture),
    [TILE_B]: () => respond(osm),
  });
  const collection = 'org.atgeo.places.overture.place';
  const result = await S.search({ collection, bbox: SEARCH_BBOX, q: '', limit: 3 });

  const cov = new URL(calls[0]);
  assert.equal(cov.origin + cov.pathname, COVERAGE);
  assert.equal(cov.searchParams.get('collection'), collection);
  assert.equal(cov.searchParams.get('bbox'), '-122.45,37.77,-122.43,37.79');
  assert.deepEqual(plain(calls.slice(1).sort()), [TILE_A, TILE_B]);

  assert.equal(result.loaded, 2);
  assert.equal(result.total, 2);
  // Ross and Bañez (60), then Arab Talk Radio, the nearest of the 59s to the
  // centre of the unsnapped bbox.
  assert.deepEqual(plain(names(result.records)), [
    'Jennifer Ross Md',
    'Mary Ann Bañez, M.d.',
    'Arab Talk Radio',
  ]);
});

test('search degrades when a tile fails', async () => {
  stubFetch({
    [COVERAGE]: () => respond({ tiles: [TILE_A, TILE_B] }),
    [TILE_A]: () => respond(overture),
    [TILE_B]: () => {
      throw new Error('network down');
    },
  });
  const result = await S.search({
    collection: 'org.atgeo.places.overture.place',
    bbox: SEARCH_BBOX,
    q: '',
    limit: 20,
  });
  assert.equal(result.loaded, 1);
  assert.equal(result.total, 2);
  assert.equal(result.records.length, 12);
  assert.ok(!names(result.records).includes('Laundré'));
});

test('search rejects with err.xrpc when getCoverage returns an XRPC error', async () => {
  stubFetch({
    [COVERAGE]: () => respond({ error: 'BboxTooLarge', message: 'too many tiles' }, 400),
  });
  await assert.rejects(
    S.search({ collection: 'org.atgeo.places.osm', bbox: [-123, 37, -122, 38], q: 'x', limit: 12 }),
    (err) => err.xrpc === 'BboxTooLarge',
  );
});

test('COLLECTIONS lists OSM and Overture enabled and Foursquare disabled', () => {
  const byValue = Object.fromEntries(plain(S.COLLECTIONS).map((c) => [c.value, c]));
  assert.equal(byValue['org.atgeo.places.osm'].label, 'OSM');
  assert.ok(!byValue['org.atgeo.places.osm'].disabled);
  assert.equal(byValue['org.atgeo.places.overture.place'].label, 'Overture');
  assert.ok(!byValue['org.atgeo.places.overture.place'].disabled);
  assert.equal(byValue['org.atgeo.places.foursquare'].label, '4SQ');
  assert.equal(byValue['org.atgeo.places.foursquare'].disabled, true);
});
