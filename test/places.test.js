import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DATASETS,
  searchOptions,
  placePoint,
  viewportBbox,
  placeCategory,
  withinNames,
  upstreamLink,
  xrpcURL,
  escapeHtml,
  highlightJson,
  hitMarkerPoint,
  hitBox,
  boundsOf,
  widenSearch,
} from '../src/js/places.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const osm = fixture('osm-tile.json').records;
const overture = fixture('overture-place-tile.json').records;
const divisions = fixture('overture-division-tile.json').records;
const named = (records, name) => records.find((r) => r.value.name === name).value;

const PHILLY_VIEW = [-75.18, 39.94, -75.15, 39.96];

// Shaped like MapLibre's LngLatBounds: corners only through methods.
const bounds = (west, south, east, north) => ({
  _sw: { lng: west, lat: south },
  _ne: { lng: east, lat: north },
  getWest() { return this._sw.lng; },
  getSouth() { return this._sw.lat; },
  getEast() { return this._ne.lng; },
  getNorth() { return this._ne.lat; },
});

test('DATASETS offers the three served tilesets and maps to searchNearby options', () => {
  assert.deepEqual(
    DATASETS.map((d) => d.id),
    ['osm', 'overture-place', 'overture-division'],
  );
  assert.deepEqual(searchOptions('overture-place'), { dataset: 'overturemaps.org', collection: 'place' });
  assert.deepEqual(searchOptions('osm'), { dataset: 'openstreetmap.org' });
  assert.deepEqual(searchOptions('overture-division'), { dataset: 'overturemaps.org', collection: 'division' });
  assert.throws(() => searchOptions('foursquare'));
});

test('placePoint reads a geo location and parses its strings', () => {
  const p = placePoint(named(osm, 'Swann Memorial Fountain'));
  assert.equal(p.lat, 39.957937);
  assert.equal(p.lon, -75.170592);
  assert.ok(!p.approximate);
});

test('placePoint takes the geo location even when an address comes first', () => {
  const place = {
    name: 'x',
    locations: [
      { $type: 'community.lexicon.location.address', locality: 'Philadelphia' },
      { $type: 'community.lexicon.location.geo', latitude: '39.95', longitude: '-75.16' },
    ],
  };
  assert.deepEqual(placePoint(place), { lat: 39.95, lon: -75.16 });
});

test('placePoint ignores look-alike $types and unparseable coordinates', () => {
  assert.equal(
    placePoint({ locations: [{ $type: 'community.lexicon.location.geocoded', latitude: '1', longitude: '2' }] }),
    null,
  );
  assert.equal(
    placePoint({ locations: [{ $type: 'community.lexicon.location.geo', latitude: 'north', longitude: '2' }] }),
    null,
  );
  assert.equal(placePoint({}), null);
  // An unusable point doesn't hide a usable one after it.
  assert.deepEqual(
    placePoint({
      locations: [
        { $type: 'community.lexicon.location.geo', latitude: '', longitude: '2' },
        { $type: 'community.lexicon.location.geo', latitude: '1', longitude: '2' },
      ],
    }),
    { lat: 1, lon: 2 },
  );
  assert.equal(
    placePoint({ locations: [{ $type: 'community.lexicon.location.bbox', west: null, south: '1', east: '2', north: '3' }] }),
    null,
  );
  assert.equal(placePoint({ locations: 'nope' }), null);
});

test('placePoint centres a bbox-only place on its overlap with the viewport', () => {
  // The US bbox spans almost every longitude; its raw centre is in France.
  const us = placePoint(named(divisions, 'United States'), PHILLY_VIEW);
  assert.ok(us.approximate);
  assert.ok(Math.abs(us.lon - -75.165) < 1e-9, `lon ${us.lon}`);
  assert.ok(Math.abs(us.lat - 39.95) < 1e-9, `lat ${us.lat}`);

  // Philadelphia (-75.280266..-74.955831, 39.867005..40.137959) overlaps the view's east part.
  const phl = placePoint(named(divisions, 'Philadelphia'), [-75.3, 39.9, -75.2, 40.0]);
  assert.ok(Math.abs(phl.lon - (-75.280266 + -75.2) / 2) < 1e-9);
  assert.ok(Math.abs(phl.lat - 39.95) < 1e-9);
});

test('placePoint without a viewport uses the bbox centre', () => {
  const pa = placePoint(named(divisions, 'Pennsylvania'));
  assert.ok(pa.approximate);
  assert.ok(Math.abs(pa.lon - (-80.521091 + -74.689672) / 2) < 1e-9);
  assert.ok(Math.abs(pa.lat - (42.516133 + 39.719766) / 2) < 1e-9);
});

test('placePoint returns null when a bbox misses the viewport', () => {
  const pa = named(divisions, 'Pennsylvania');
  assert.equal(placePoint(pa, [10, 10, 11, 11]), null);
  // Longitude miss only: same latitudes, just east of Pennsylvania.
  assert.equal(placePoint(pa, [-74.5, 40, -74.4, 40.1]), null);
  // Latitude miss only: same longitudes, north of the US box.
  assert.equal(placePoint(named(divisions, 'United States'), [-75.2, 75, -75.1, 76]), null);
});

test('placePoint handles antimeridian-crossing boxes', () => {
  const fiji = {
    locations: [{ $type: 'community.lexicon.location.bbox', west: '177', south: '-19', east: '-179', north: '-16' }],
  };
  // Unclipped centre is at 179, not at -1.
  const c = placePoint(fiji);
  assert.ok(Math.abs(c.lon - 179) < 1e-9, `lon ${c.lon}`);
  assert.ok(Math.abs(c.lat - -17.5) < 1e-9);
  // A viewport on the west side of ±180 sees only the -180..-179 sliver.
  const west = placePoint(fiji, [-179.9, -18, -179.5, -17]);
  assert.ok(Math.abs(west.lon - -179.7) < 1e-9, `lon ${west.lon}`);
  // A crossing viewport and a crossing box.
  const both = placePoint(fiji, [178, -18, -179.5, -17]);
  assert.ok(Math.abs(both.lon - 179.25) < 1e-9, `lon ${both.lon}`);
});

test('placePoint keeps world-spanning boxes inside a crossing viewport', () => {
  // A Pacific view from viewportBbox; the US and Russia boxes overlap it on both sides.
  const view = [100, 0, -60, 70];
  const us = placePoint(named(divisions, 'United States'), view);
  assert.ok(Math.abs(us.lon - -160) < 1e-9, `lon ${us.lon}`);
  assert.ok(Math.abs(us.lat - (18.910694 + 70) / 2) < 1e-9, `lat ${us.lat}`);
  const russia = {
    locations: [{ $type: 'community.lexicon.location.bbox', west: '-180', south: '41.18', east: '180', north: '81.86' }],
  };
  const ru = placePoint(russia, view);
  assert.ok(Math.abs(ru.lon - -160) < 1e-9, `lon ${ru.lon}`);
  assert.ok(Math.abs(ru.lat - (41.18 + 70) / 2) < 1e-9, `lat ${ru.lat}`);
});

const near = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

test('viewportBbox passes an ordinary view through', () => {
  const v = viewportBbox(bounds(-75.2, 39.9, -75.1, 40));
  assert.ok(near(v, [-75.2, 39.9, -75.1, 40]), String(v));
});

test('viewportBbox wraps unwrapped MapLibre longitudes', () => {
  // Panned one world west: same place, longitudes shifted by 360.
  const far = viewportBbox(bounds(-795.2, 39.9, -795.1, 40));
  assert.ok(Math.abs(far[0] - -75.2) < 1e-9 && Math.abs(far[2] - -75.1) < 1e-9, String(far));
  const v = viewportBbox(bounds(-435.2, 39.9, -435.1, 40));
  assert.ok(Math.abs(v[0] - -75.2) < 1e-9 && Math.abs(v[2] - -75.1) < 1e-9, String(v));
  // Straddling the antimeridian comes out west > east.
  const x = viewportBbox(bounds(170, -20, 190, -10));
  assert.ok(Math.abs(x[0] - 170) < 1e-9 && Math.abs(x[2] - -170) < 1e-9, String(x));
  assert.ok(x[0] > x[2]);
});

test('viewportBbox covers the world when the view is wider than it', () => {
  assert.deepEqual(viewportBbox(bounds(-250, -95, 200, 95)), [-180, -90, 180, 90]);
  // Latitude is clamped even when the longitudes fit.
  const v = viewportBbox(bounds(-75.2, -91, -75.1, 91));
  assert.ok(near(v, [-75.2, -90, -75.1, 90]), String(v));
});

test('placeCategory reads OSM tags in garganorn priority order', () => {
  const fountain = named(osm, 'Swann Memorial Fountain');
  assert.equal(placeCategory(fountain, fountain.origin), 'Fountain');
  const barber = named(osm, 'Barber on 24th');
  assert.equal(placeCategory(barber, barber.origin), 'Hairdresser');
  const hall = named(osm, 'Disque Hall');
  assert.equal(placeCategory(hall, hall.origin), 'University');
  // amenity outranks shop; underscores become spaces
  const both = { origin: 'urn:atgeo:openstreetmap.org:node:1', attributes: { shop: 'books', amenity: 'ice_cream' } };
  assert.equal(placeCategory(both, both.origin), 'Ice Cream');
  // "yes" says only that the key applies
  const yes = { origin: 'urn:atgeo:openstreetmap.org:way:1', attributes: { building: 'yes' } };
  assert.equal(placeCategory(yes, yes.origin), 'Building');
});

// Priority order of garganorn/sql/_osm_category_case.sql.
const OSM_KEYS = [
  'amenity', 'shop', 'tourism', 'leisure', 'office', 'craft', 'healthcare', 'historic',
  'natural', 'man_made', 'aeroway', 'railway', 'public_transport', 'place', 'boundary',
  'waterway', 'power', 'landuse', 'highway', 'barrier', 'emergency', 'telecom', 'building',
];

test('placeCategory follows the whole OSM priority list', () => {
  const origin = 'urn:atgeo:openstreetmap.org:node:1';
  OSM_KEYS.forEach((key, i) => {
    assert.equal(placeCategory({ attributes: { [key]: 'x_y' } }, origin), 'X Y', key);
    if (i + 1 < OSM_KEYS.length) {
      const attributes = { [OSM_KEYS[i + 1]]: 'loser', [key]: 'winner' };
      assert.equal(placeCategory({ attributes }, origin), 'Winner', `${key} before ${OSM_KEYS[i + 1]}`);
    }
  });
  // Tags outside the list don't count.
  assert.equal(placeCategory({ attributes: { club: 'chess', name: 'x' } }, origin), null);
});

test('placeCategory reads Overture place and division vocabularies', () => {
  const museum = named(overture, 'Disney 100 Exhibition');
  assert.equal(placeCategory(museum, museum.origin), 'Museum');
  const fin = named(overture, 'Starboard Capital Markets');
  assert.equal(placeCategory(fin, fin.origin), 'Financial Service');
  const phl = named(divisions, 'Philadelphia');
  assert.equal(placeCategory(phl, phl.origin), 'Locality');
});

test('placeCategory is null for unknown origins or missing attributes', () => {
  assert.equal(placeCategory({ attributes: { amenity: 'cafe' } }, 'at://did:plc:x/org.atgeo.place/1'), null);
  assert.equal(placeCategory({ attributes: { amenity: 'cafe' } }, null), null);
  assert.equal(placeCategory({}, 'urn:atgeo:openstreetmap.org:node:1'), null);
  assert.equal(placeCategory({ attributes: {} }, 'urn:atgeo:overturemaps.org:place:x'), null);
  assert.equal(placeCategory({ attributes: { categories: null } }, 'urn:atgeo:overturemaps.org:place:x'), null);
  assert.equal(placeCategory({ attributes: {} }, 'urn:atgeo:overturemaps.org:division:x'), null);
  // "division" must not match a "divisionx" collection
  assert.equal(placeCategory({ attributes: { subtype: 'x' } }, 'urn:atgeo:overturemaps.org:divisionx:1'), null);
});

test('withinNames lists containing places broadest first, as served', () => {
  assert.deepEqual(withinNames(named(divisions, 'Philadelphia')), [
    'United States',
    'Pennsylvania',
    'Philadelphia County',
  ]);
  assert.deepEqual(withinNames({}), []);
  assert.deepEqual(withinNames({ relations: { within: [{ uri: 'urn:x' }, { name: 'A' }] } }), ['A']);
});

test('upstreamLink points OSM origins at openstreetmap.org', () => {
  assert.equal(
    upstreamLink('urn:atgeo:openstreetmap.org:node:1015369635'),
    'https://www.openstreetmap.org/node/1015369635',
  );
  assert.equal(upstreamLink('urn:atgeo:openstreetmap.org:way:100400089'), 'https://www.openstreetmap.org/way/100400089');
  assert.equal(
    upstreamLink('urn:atgeo:openstreetmap.org:relation:11010096'),
    'https://www.openstreetmap.org/relation/11010096',
  );
  assert.equal(upstreamLink('urn:atgeo:openstreetmap.org:changeset:1'), null);
  assert.equal(upstreamLink('urn:atgeo:overturemaps.org:place:abc'), null);
  assert.equal(upstreamLink(null), null);
});

test('xrpcURL builds a query URL, dropping undefined and null but keeping empty strings', () => {
  assert.equal(
    xrpcURL('https://places.atgeo.org', 'org.atgeo.getTiles', {
      dataset: 'openstreetmap.org',
      collection: '',
      slug: undefined,
      uri: null,
      bbox: '-75.17,39.95,-75.16,39.96',
    }),
    'https://places.atgeo.org/xrpc/org.atgeo.getTiles?dataset=openstreetmap.org&collection=&bbox=-75.17%2C39.95%2C-75.16%2C39.96',
  );
  // The query demo shows the request as typed: an empty q is sent, and the server answers KeywordRequired.
  assert.equal(
    xrpcURL('https://places.atgeo.org', 'org.atgeo.searchPlaces', { ...searchOptions('osm'), q: '' }),
    'https://places.atgeo.org/xrpc/org.atgeo.searchPlaces?dataset=openstreetmap.org&q=',
  );
  assert.equal(
    xrpcURL('https://places.atgeo.org', 'org.atgeo.describeService', {}),
    'https://places.atgeo.org/xrpc/org.atgeo.describeService',
  );
  assert.equal(
    xrpcURL('https://places.atgeo.org', 'org.atgeo.getPlace', { uri: 'urn:atgeo:openstreetmap.org:node:1' }),
    'https://places.atgeo.org/xrpc/org.atgeo.getPlace?uri=urn%3Aatgeo%3Aopenstreetmap.org%3Anode%3A1',
  );
});

test('escapeHtml and highlightJson never let markup through', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  const html = highlightJson(JSON.stringify({ name: '<script>alert(1)</script>', n: 1, ok: true }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('<span class="json-key">&quot;name&quot;:</span>') || html.includes('<span class="json-key">"name":</span>'));
  assert.ok(html.includes('<span class="json-number">1</span>'));
  assert.ok(html.includes('<span class="json-bool">true</span>'));
});

// widenSearch / hit geometry

const pointHit = (lat, lon) => ({ name: 'p', location: { point: { lat, lon }, bbox: null } });
const bboxHit = (south, west, north, east) => ({
  name: 'b',
  location: { point: null, bbox: { south, west, north, east } },
});

test('hitMarkerPoint returns the point as is', () => {
  assert.deepEqual(hitMarkerPoint(pointHit(37.7, -122.4)), { lat: 37.7, lon: -122.4 });
});

test('hitMarkerPoint centres a bbox and marks it approximate', () => {
  assert.deepEqual(hitMarkerPoint(bboxHit(10, 20, 14, 30)), { lat: 12, lon: 25, approximate: true });
});

test('hitMarkerPoint centres a bbox crossing the antimeridian', () => {
  assert.deepEqual(hitMarkerPoint(bboxHit(-18, 178, -16, -176)), { lat: -17, lon: -179, approximate: true });
});

test('hitMarkerPoint is null with neither point nor bbox', () => {
  assert.equal(hitMarkerPoint({ name: null, location: { point: null, bbox: null } }), null);
});

test('hitBox treats a point as a zero-size box', () => {
  assert.deepEqual(hitBox(pointHit(37.7, -122.4)), [-122.4, 37.7, -122.4, 37.7]);
});

test('hitBox returns a bbox as given', () => {
  assert.deepEqual(hitBox(bboxHit(10, 20, 14, 30)), [20, 10, 30, 14]);
});

test('hitBox keeps a crossing bbox as given', () => {
  assert.deepEqual(hitBox(bboxHit(-18, 178, -16, -176)), [178, -18, -176, -16]);
});

test('hitBox is null for undefined or neither point nor bbox', () => {
  assert.equal(hitBox(undefined), null);
  assert.equal(hitBox({ name: null, location: { point: null, bbox: null } }), null);
});

test('boundsOf covers two boxes', () => {
  assert.deepEqual(boundsOf([[0, 0, 10, 10], [5, -5, 20, 8]]), [0, -5, 20, 10]);
});

test('boundsOf keeps boxes either side of the antimeridian narrow', () => {
  assert.deepEqual(boundsOf([[179, 0, 179.5, 1], [-179.5, 0, -179, 1]]), [179, 0, 181, 1]);
});

test('boundsOf keeps a crossing viewport plus a hit box east of it narrow', () => {
  assert.deepEqual(
    boundsOf([[178, -18, -179.5, -17], [-178, -17.8, -177.9, -17.7]]),
    [178, -18, 182.1, -17],
  );
});

test('boundsOf ignores nulls', () => {
  assert.deepEqual(boundsOf([null, [1, 2, 3, 4], null]), [1, 2, 3, 4]);
});

test('boundsOf of nothing is null', () => {
  assert.equal(boundsOf([]), null);
});

const REGION = [-122.5, 37.7, -122.4, 37.8];
const VIEWPORT = [-123, 37, -122, 38];
const OPTIONS = { dataset: 'overture.places' };
const HIT = pointHit(37.77, -122.43);

const fakeClient = (script) => {
  const calls = [];
  const step = (name) => async (args) => {
    calls.push([name, args]);
    const next = script[name].shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return {
    calls,
    searchNearby: step('searchNearby'),
    searchByKeyword: step('searchByKeyword'),
  };
};
const failure = (code) => Object.assign(new Error(code), { code });
const keyword = (places) => ({ places });
const nearby = (places, extra = {}) => ({ places, overview: false, expanded: false, ...extra });
const widen = (client, extra = {}) =>
  widenSearch({
    atgeo: client,
    region: REGION,
    viewport: VIEWPORT,
    text: 'alamo',
    options: OPTIONS,
    isStale: () => false,
    ...extra,
  });

test('widenSearch stage 1 sends expand, text, the region bbox and options', async () => {
  const client = fakeClient({ searchNearby: [nearby([HIT])] });
  await widen(client);
  assert.deepEqual(client.calls, [
    ['searchNearby', { region: { bbox: REGION }, text: 'alamo', expand: true, ...OPTIONS }],
  ]);
});

test('widenSearch stops at stage 1 on hits', async () => {
  const result = nearby([HIT]);
  const client = fakeClient({ searchNearby: [result] });
  const outcome = await widen(client);
  assert.deepEqual(outcome, { stage: 1, hits: [HIT], result });
  assert.equal(client.calls.length, 1);
});

test('widenSearch falls to stage 2 with the viewport bbox and stops on hits', async () => {
  const client = fakeClient({ searchNearby: [nearby([])], searchByKeyword: [keyword([HIT])] });
  const outcome = await widen(client);
  assert.equal(outcome.stage, 2);
  assert.deepEqual(outcome.hits, [HIT]);
  assert.deepEqual(client.calls[1], [
    'searchByKeyword',
    { keyword: 'alamo', region: { bbox: VIEWPORT }, ...OPTIONS },
  ]);
  assert.equal(client.calls.length, 2);
});

test('widenSearch falls to stage 3 with no region when stage 2 is empty', async () => {
  const client = fakeClient({ searchNearby: [nearby([])], searchByKeyword: [keyword([]), keyword([HIT])] });
  const outcome = await widen(client);
  assert.equal(outcome.stage, 3);
  assert.deepEqual(outcome.hits, [HIT]);
  assert.deepEqual(client.calls[2], ['searchByKeyword', { keyword: 'alamo', ...OPTIONS }]);
  assert.equal(client.calls.length, 3);
});

test('widenSearch falls through an empty overview result', async () => {
  const client = fakeClient({
    searchNearby: [nearby([], { overview: true })],
    searchByKeyword: [keyword([HIT])],
  });
  const outcome = await widen(client);
  assert.equal(outcome.stage, 2);
});

test('widenSearch falls through BboxTooLarge with a null result', async () => {
  const client = fakeClient({ searchNearby: [failure('BboxTooLarge')], searchByKeyword: [keyword([HIT])] });
  const outcome = await widen(client);
  assert.equal(outcome.stage, 2);
  assert.equal(outcome.result, null);
});

test('widenSearch propagates another stage 1 error', async () => {
  const client = fakeClient({ searchNearby: [failure('Boom')] });
  await assert.rejects(widen(client), { code: 'Boom' });
});

test('widenSearch ends at stage 2 on KeywordRequired without calling stage 3', async () => {
  const client = fakeClient({ searchNearby: [nearby([])], searchByKeyword: [failure('KeywordRequired')] });
  const outcome = await widen(client);
  assert.equal(outcome.stage, 2);
  assert.deepEqual(outcome.hits, []);
  assert.equal(client.calls.length, 2);
});

test('widenSearch propagates another stage 2 error', async () => {
  const client = fakeClient({ searchNearby: [nearby([])], searchByKeyword: [failure('Boom')] });
  await assert.rejects(widen(client), { code: 'Boom' });
});

test('widenSearch returns null when stale after stage 1, with no further calls', async () => {
  const client = fakeClient({ searchNearby: [nearby([])], searchByKeyword: [keyword([HIT])] });
  assert.equal(await widen(client, { isStale: () => true }), null);
  assert.equal(client.calls.length, 1);
});

test('widenSearch returns null when stale after stage 2, with no further calls', async () => {
  const client = fakeClient({ searchNearby: [nearby([])], searchByKeyword: [keyword([]), keyword([HIT])] });
  let awaited = 0;
  const wrapped = {
    searchNearby: async (a) => { awaited++; return client.searchNearby(a); },
    searchByKeyword: async (a) => { awaited++; return client.searchByKeyword(a); },
  };
  assert.equal(await widen(wrapped, { isStale: () => awaited >= 2 }), null);
  assert.equal(client.calls.length, 2);
});

test('widenSearch returns an expanded result as stage 1', async () => {
  const result = nearby([HIT], { expanded: true });
  const outcome = await widen(fakeClient({ searchNearby: [result] }));
  assert.equal(outcome.stage, 1);
  assert.equal(outcome.result, result);
});
