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

// Grid snapping as the SDK does it (0.01°, outward, never empty), so a box this returns is one the
// SDK sends on unchanged. Values within EPSILON of a grid line count as on it.
const EPSILON = 1e-9;
const snapDown = (x) => {
  const r = Math.round(x * 100);
  return Math.abs(x * 100 - r) < EPSILON ? r : Math.floor(x * 100);
};
const snapUp = (x) => {
  const r = Math.round(x * 100);
  return Math.abs(x * 100 - r) < EPSILON ? r : Math.ceil(x * 100);
};

function snapSpan(min, max, limit) {
  let lo = Math.max(snapDown(min), -limit * 100);
  let hi = Math.min(snapUp(max), limit * 100);
  if (lo === hi) {
    if (hi < limit * 100) hi++;
    else lo--;
  }
  return [lo / 100, hi / 100];
}

// [west, south, east, north] snapped outward to the 0.01° grid. Not for a box across the antimeridian.
export function snapBox([w, s, e, n]) {
  const [west, east] = snapSpan(w, e, 180);
  const [south, north] = snapSpan(s, n, 90);
  return [west, south, east, north];
}

// The bbox parameter getTiles takes.
export function bboxParam(box) {
  return box.map((v) => v.toFixed(2)).join(',');
}

const sameBox = (a, b) => a.every((v, i) => v === b[i]);

// Boxes around the viewport's centre, each half the span of the last, snapped to the grid: the
// smaller regions to try when the view is over the tile budget. Repeats that snapping produces at
// small spans are dropped, so each is a different, smaller region. None for a view across the
// antimeridian.
export function centralBoxes(viewport, steps = 4) {
  const [w, s, e, n] = viewport;
  if (w > e) return [];
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const seen = [snapBox(viewport)];
  const boxes = [];
  for (let k = 1; k <= steps; k++) {
    const hw = (e - w) / 2 ** (k + 1);
    const hh = (n - s) / 2 ** (k + 1);
    const box = snapBox([cx - hw, cy - hh, cx + hw, cy + hh]);
    if (seen.some((b) => sameBox(b, box))) continue;
    seen.push(box);
    boxes.push(box);
  }
  return boxes;
}

// Whether a getTiles answer is regular tiles (true) or over the budget (false: the overview band,
// or BboxTooLarge). Anything else isn't an answer to judge by, and throws.
export function fitsBudget(status, body) {
  if (status === 400 && body?.error === 'BboxTooLarge') return false;
  if (status < 200 || status > 299 || !body || typeof body !== 'object' || !Array.isArray(body.tiles)) {
    throw new Error(`unusable getTiles answer (HTTP ${status})`);
  }
  return !body.overview;
}

// The region to search for a viewport: { box: null } to search the view itself, or { box } for the
// first central box whose regular tiles fit the budget. probe(bboxParam) resolves true when they fit.
// A view that fits, a view across the antimeridian, no box that fits, a failed probe, or a search
// superseded mid-way (isCurrent() false) all give { box: null }: search the view, as before.
export async function findSearchableBox(viewport, probe, { steps = 4, isCurrent = () => true } = {}) {
  if (viewport[0] > viewport[2]) return { box: null };
  const boxes = centralBoxes(viewport, steps);
  try {
    if (await probe(bboxParam(snapBox(viewport)))) return { box: null };
    for (const box of boxes) {
      if (!isCurrent()) return { box: null };
      if (await probe(bboxParam(box))) return { box };
    }
  } catch {
    // A probe that can't answer never holds up the search.
  }
  return { box: null };
}

// "~N km": the box's longer side, for telling people how much ground a search covered.
export function boxLabel([w, s, e, n]) {
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const km = Math.max((e - w) * 111.32 * Math.cos(midLat), (n - s) * 110.57);
  return `~${km >= 1 ? Math.round(km) : km.toFixed(1)} km`;
}

// The note for a search that covered a central box in place of the whole view.
export function boxNote(box) {
  return `Searched the central ${boxLabel(box)}; zoom in or pan to search elsewhere`;
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
