// Display helpers for the demos. Search itself is @atgeo/client's job; this module only
// turns its hits into things a map and a list can show. No network, no DOM.

export const DATASETS = [
  { id: 'overture-place', label: 'Overture places', dataset: 'overturemaps.org', collection: 'place' },
  { id: 'osm', label: 'OpenStreetMap', dataset: 'openstreetmap.org' },
  { id: 'overture-division', label: 'Overture divisions', dataset: 'overturemaps.org', collection: 'division' },
];

// The dataset/collection options searchPlaces takes for one of DATASETS.
export function searchOptions(id) {
  const d = DATASETS.find((d) => d.id === id);
  if (!d) throw new TypeError(`unknown dataset choice: ${id}`);
  return d.collection ? { dataset: d.dataset, collection: d.collection } : { dataset: d.dataset };
}

const GEO = 'community.lexicon.location.geo';
const BBOX = 'community.lexicon.location.bbox';

function num(s) {
  if (typeof s !== 'string' || s.trim() === '') return NaN;
  return Number(s);
}

// Longitudes already in range pass through untouched, so no float noise creeps in.
function wrapLon(x) {
  if (x >= -180 && x <= 180) return x;
  return (((x + 180) % 360) + 360) % 360 - 180;
}

const clampLat = (y) => Math.max(-90, Math.min(90, y));

// MapLibre's LngLatBounds as a bbox the SDK accepts. MapLibre's longitudes are unwrapped
// (world copies), so they can run past ±180; a view crossing the antimeridian comes out
// with minLon > maxLon, which the SDK reads as crossing.
export function viewportBbox(bounds) {
  const w = bounds.getWest();
  const e = bounds.getEast();
  const s = clampLat(bounds.getSouth());
  const n = clampLat(bounds.getNorth());
  if (e - w >= 360) return [-180, s, 180, n];
  return [wrapLon(w), s, wrapLon(e), n];
}

// A {lat, lon} to put a marker at, or null.
//
// A geo point is used as is. A place with only a bbox (a division, say) gets the centre of
// the part of its box inside the viewport, marked approximate: a country's box can span
// the globe, and its raw centre lands somewhere unhelpful (the United States' is in France).
// The overlap is computed in the viewport's unwrapped frame, so a viewport or a box that
// crosses the antimeridian still yields one centre inside the viewport.
export function placePoint(place, viewport) {
  const locations = Array.isArray(place?.locations) ? place.locations : [];

  for (const loc of locations) {
    if (loc?.$type !== GEO) continue;
    const lat = num(loc.latitude);
    const lon = num(loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  for (const loc of locations) {
    if (loc?.$type !== BBOX) continue;
    const [pW, pS, pE0, pN] = [loc.west, loc.south, loc.east, loc.north].map(num);
    if (![pW, pS, pE0, pN].every(Number.isFinite)) continue;
    const pE = pE0 >= pW ? pE0 : pE0 + 360;

    if (!viewport) {
      return { lat: (pS + pN) / 2, lon: wrapLon((pW + pE) / 2), approximate: true };
    }

    const [vW, vS, vE0, vN] = viewport;
    const vE = vE0 >= vW ? vE0 : vE0 + 360;
    const lo = Math.max(pS, vS);
    const hi = Math.min(pN, vN);
    if (lo > hi) return null;

    let west = Infinity;
    let east = -Infinity;
    for (const shift of [-360, 0, 360]) {
      const a = Math.max(pW + shift, vW);
      const b = Math.min(pE + shift, vE);
      if (a <= b) {
        west = Math.min(west, a);
        east = Math.max(east, b);
      }
    }
    if (west > east) return null;
    return { lat: (lo + hi) / 2, lon: wrapLon((west + east) / 2), approximate: true };
  }

  return null;
}

// Priority order of garganorn's OSM primary category (sql/_osm_category_case.sql).
const OSM_KEYS = [
  'amenity', 'shop', 'tourism', 'leisure', 'office', 'craft', 'healthcare', 'historic',
  'natural', 'man_made', 'aeroway', 'railway', 'public_transport', 'place', 'boundary',
  'waterway', 'power', 'landuse', 'highway', 'barrier', 'emergency', 'telecom', 'building',
];

const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// A short "what kind of place" label in the dataset's own vocabulary, or null. The
// vocabulary is chosen by origin prefix; the URN is never taken apart.
export function placeCategory(place, origin) {
  const attrs = place?.attributes;
  if (typeof origin !== 'string' || !attrs || typeof attrs !== 'object') return null;

  if (origin.startsWith('urn:atgeo:openstreetmap.org:')) {
    for (const key of OSM_KEYS) {
      const val = attrs[key];
      if (typeof val === 'string' && val !== '') return titleCase(val === 'yes' ? key : val);
    }
    return null;
  }
  if (origin.startsWith('urn:atgeo:overturemaps.org:place:')) {
    const primary = attrs.categories?.primary;
    return typeof primary === 'string' && primary ? titleCase(primary) : null;
  }
  if (origin.startsWith('urn:atgeo:overturemaps.org:division:')) {
    return typeof attrs.subtype === 'string' && attrs.subtype ? titleCase(attrs.subtype) : null;
  }
  return null;
}

// Names of the places containing this one, broadest first, as the gazetteer orders them.
export function withinNames(place) {
  const within = place?.relations?.within;
  if (!Array.isArray(within)) return [];
  return within.filter((w) => typeof w?.name === 'string' && w.name).map((w) => w.name);
}

// The element's page on openstreetmap.org, for an OSM origin; otherwise null.
export function upstreamLink(origin) {
  if (typeof origin !== 'string') return null;
  for (const type of ['node', 'way', 'relation']) {
    const prefix = `urn:atgeo:openstreetmap.org:${type}:`;
    if (origin.startsWith(prefix)) {
      const id = origin.slice(prefix.length);
      return /^[0-9]+$/.test(id) ? `https://www.openstreetmap.org/${type}/${id}` : null;
    }
  }
  return null;
}

export function xrpcURL(server, nsid, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return `${server}/xrpc/${nsid}${qs ? `?${qs}` : ''}`;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function highlightJson(json) {
  const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (match.startsWith('"')) {
        return match.endsWith(':')
          ? `<span class="json-key">${match}</span>`
          : `<span class="json-string">${match}</span>`;
      }
      if (/^(true|false|null)$/.test(match)) return `<span class="json-bool">${match}</span>`;
      return `<span class="json-number">${match}</span>`;
    },
  );
}
