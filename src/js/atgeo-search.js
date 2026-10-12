// Client-side place search: getCoverage for tile URLs, then match and rank tile records locally.

(function () {
  const COVERAGE_URL = 'https://places.atgeo.org/xrpc/org.atgeo.getCoverage';

  const COLLECTIONS = [
    { label: 'OSM', value: 'org.atgeo.places.osm' },
    { label: 'Overture', value: 'org.atgeo.places.overture.place' },
    { label: '4SQ', value: 'org.atgeo.places.foursquare', disabled: true },
  ];

  // Float error can only widen the box by 0.01, which is the safe direction.
  function snapBbox([w, s, e, n]) {
    const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));
    const lo = (v, lim) => (Math.floor(clamp(v, lim) * 100) / 100).toFixed(2);
    const hi = (v, lim) => (Math.ceil(clamp(v, lim) * 100) / 100).toFixed(2);
    return [lo(w, 180), lo(s, 85.06), hi(e, 180), hi(n, 85.06)].join(',');
  }

  function normalize(s) {
    return s
      .normalize('NFKD')
      .replace(/\p{Mn}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function nameTier(nq, name) {
    if (name === nq) return 0;
    if (name.startsWith(nq)) return 1;
    const nameTokens = name.split(' ');
    if (nq.split(' ').every((t) => nameTokens.some((nt) => nt.startsWith(t)))) return 2;
    if (name.includes(nq)) return 3;
    return Infinity;
  }

  function matchTier(nq, record) {
    const names = [record.value.name, ...(record.value.variants || []).map((v) => v.name)];
    const tier = Math.min(...names.filter(Boolean).map((n) => nameTier(nq, normalize(n))));
    return tier === Infinity ? null : tier;
  }

  function geoPoint(record) {
    const loc = (record.value.locations || []).find((l) => l.$type && l.$type.includes('geo'));
    if (!loc) return null;
    const lat = parseFloat(loc.latitude);
    const lon = parseFloat(loc.longitude);
    return Number.isNaN(lat) || Number.isNaN(lon) ? null : { lat, lon };
  }

  function haversine(a, b) {
    const rad = Math.PI / 180;
    const h =
      Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
    return 2 * Math.asin(Math.sqrt(h));
  }

  function rank(records, { q, bbox, center }) {
    const [w, s, e, n] = bbox;
    const nq = normalize(q || '');
    const c = { lon: center[0], lat: center[1] };
    const seen = new Set();
    const scored = [];
    for (const record of records) {
      const rkey = record.value.rkey;
      if (seen.has(rkey)) continue;
      seen.add(rkey);
      const p = geoPoint(record);
      if (!p || p.lon < w || p.lon > e || p.lat < s || p.lat > n) continue;
      let tier = 0;
      if (nq) {
        tier = matchTier(nq, record);
        if (tier === null) continue;
      }
      scored.push({ record, tier, importance: record.value.importance || 0, dist: haversine(c, p) });
    }
    scored.sort(
      (a, b) =>
        a.tier - b.tier ||
        b.importance - a.importance ||
        a.dist - b.dist ||
        (a.record.uri < b.record.uri ? -1 : a.record.uri > b.record.uri ? 1 : 0)
    );
    return scored.map((x) => x.record);
  }

  async function getCoverage(collection, bbox) {
    const resp = await fetch(`${COVERAGE_URL}?${new URLSearchParams({ collection, bbox })}`);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      const err = new Error(body.message || `HTTP ${resp.status}`);
      err.xrpc = body.error || `HTTP ${resp.status}`;
      throw err;
    }
    return resp.json();
  }

  async function fetchTiles(urls) {
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      })
    );
    const tiles = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    return {
      records: tiles.flatMap((t) => t.records),
      loaded: tiles.length,
      total: urls.length,
    };
  }

  async function search({ collection, bbox, q, limit }) {
    const { tiles } = await getCoverage(collection, snapBbox(bbox));
    const { records, loaded, total } = await fetchTiles(tiles);
    const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    return { records: rank(records, { q, bbox, center }).slice(0, limit), loaded, total };
  }

  window.AtgeoSearch = { COLLECTIONS, snapBbox, normalize, matchTier, rank, getCoverage, fetchTiles, search };
})();
