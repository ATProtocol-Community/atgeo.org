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
} from '../src/js/places.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const osm = fixture('osm-tile.json').records;
const overture = fixture('overture-place-tile.json').records;
const divisions = fixture('overture-division-tile.json').records;
const named = (records, name) => records.find((r) => r.value.name === name).value;

const PHILLY_VIEW = [-75.18, 39.94, -75.15, 39.96];

test('DATASETS offers the three served tilesets and maps to searchPlaces options', () => {
  assert.deepEqual(
    DATASETS.map((d) => d.id),
    ['overture-place', 'osm', 'overture-division'],
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
  assert.equal(placePoint({ locations: 'nope' }), null);
});

test('placePoint centres a bbox-only place on its overlap with the viewport', () => {
  // The US bbox spans almost every longitude; its raw centre is in France.
  const us = placePoint(named(divisions, 'United States'), PHILLY_VIEW);
  assert.ok(us.approximate);
  assert.ok(Math.abs(us.lon - -75.165) < 1e-9, `lon ${us.lon}`);
  assert.ok(Math.abs(us.lat - 39.95) < 1e-9, `lat ${us.lat}`);

  // Philadelphia (-75.280266..-74.955831, 39.867005..40.137959) contains the whole view too.
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

test('viewportBbox passes an ordinary view through', () => {
  assert.deepEqual(viewportBbox({ west: -75.2, south: 39.9, east: -75.1, north: 40 }), [-75.2, 39.9, -75.1, 40]);
});

test('viewportBbox wraps unwrapped MapLibre longitudes', () => {
  // Panned one world west: same place, longitudes shifted by 360.
  const v = viewportBbox({ west: -435.2, south: 39.9, east: -435.1, north: 40 });
  assert.ok(Math.abs(v[0] - -75.2) < 1e-9 && Math.abs(v[2] - -75.1) < 1e-9, String(v));
  // Straddling the antimeridian comes out west > east.
  const x = viewportBbox({ west: 170, south: -20, east: 190, north: -10 });
  assert.ok(Math.abs(x[0] - 170) < 1e-9 && Math.abs(x[2] - -170) < 1e-9, String(x));
  assert.ok(x[0] > x[2]);
});

test('viewportBbox covers the world when the view is wider than it', () => {
  assert.deepEqual(viewportBbox({ west: -250, south: -95, east: 200, north: 95 }), [-180, -90, 180, 90]);
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
  // "way" must not match a "wayside" collection
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

test('xrpcURL builds a query URL and leaves out empty parameters', () => {
  assert.equal(
    xrpcURL('https://places.atgeo.org', 'org.atgeo.getTiles', {
      dataset: 'openstreetmap.org',
      collection: '',
      bbox: '-75.17,39.95,-75.16,39.96',
    }),
    'https://places.atgeo.org/xrpc/org.atgeo.getTiles?dataset=openstreetmap.org&bbox=-75.17%2C39.95%2C-75.16%2C39.96',
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
