---
layout: base.njk
title: "JavaScript SDK"
permalink: /sdk/javascript/
---

# JavaScript SDK

`@atgeo/client` is a TypeScript/ESM client that searches ATGeo places on the device. The tile search never tells the server what you searched for; the calls that do send a keyword have `Keyword` in their names. It's the reference implementation: the other SDKs are ports of it.

It runs in evergreen browsers, Node 20 or later, and workers, and has no runtime dependencies. The map on this site's [home page](/) uses it.

**Full reference: the [README on GitHub](https://github.com/schuyler/atgeo-sdk-js#readme).** This page is the quickstart. For concepts shared by every SDK (regions, sorting, overview answers, privacy), see [Client SDKs](/sdk/).

## Install

Not on npm yet. Install from GitHub, pinned to a commit:

```sh
npm install github:schuyler/atgeo-sdk-js#<commit-sha>
```

npm runs the `prepare` script on a git install, which builds `dist/`. Pin a full SHA rather than a branch: breaking changes land on `main`.

## Synopsis

```ts
import { AtgeoClient } from "@atgeo/client";

const atgeo = new AtgeoClient();

const { places, complete, attribution } = await atgeo.searchNearby({
  dataset: "overturemaps.org",
  region: { lat: 39.9526, lon: -75.1652, radius: 1000 }, // meters
  text: "Starbux",
});

for (const { origin, name, distance, score } of places) {
  console.log(name, Math.round(distance), score?.toFixed(2), origin);
}

// show this wherever you show the places
console.log(attribution.map((a) => a.attribution ?? `${a.dataset}/${a.collection}`));
```

Misspellings are fine. The public server has a limited dataset for now, mostly the US east coast, so a search elsewhere may come back empty.

## Constructing a client

```ts
const atgeo = new AtgeoClient({
  server: "http://localhost:8000",
  fetch: myFetch,
  cacheBudgetBytes: 10 * 1024 * 1024,
  maxBodyBytes: 8 * 1024 * 1024,
  requestTimeoutMs: 15_000,
});
```

| Option | Default | Meaning |
|---|---|---|
| `server` | `https://places.atgeo.org` | Base URL for XRPC calls. |
| `fetch` | the global `fetch` | For tests, proxies, or runtimes where you supply your own. |
| `cacheBudgetBytes` | 50 MiB | Cap on the in-memory tile cache. |
| `maxBodyBytes` | 32 MiB | Cap on a response body, counted after gzip is undone. |
| `requestTimeoutMs` | 30 000 | How long one request may take, send to last byte. |

The tile URLs come from the server, and a small gzip body can decode to gigabytes, hence the two limits. The largest tiles places.atgeo.org serves are about 2 MB. Both must be positive integers or the constructor throws a `TypeError`; there's no way to turn them off, so pass a large number. They apply to every request, including ones made through your own `fetch`.

## The calls

Every call that touches the network takes an optional `signal` (`AbortSignal`).

### `searchNearby(options): Promise<NearbySearchResult>`

| Option | Meaning |
|---|---|
| `region` | Required. `{ lat, lon, radius }` (meters) or `{ bbox: [minLon, minLat, maxLon, maxLat] }`. |
| `text` | Optional. Fuzzy-matched against `name` and `variants[].name`. |
| `dataset` | Required, with no default, e.g. `"openstreetmap.org"` or `"overturemaps.org"`. |
| `collection` | Optional, e.g. `"way"`. |
| `sort` | `"fused"` (default), `"distance"` or `"similarity"` (needs `text`). |
| `expand` | Optional, default `false`. With `text`, if no place in `region` has a word match, answers with the places in the whole tile coverage instead, if those hold a word match. If they hold none either, you get the region's answer and `expanded: false`. |
| `signal` | Aborts the search. |

The result is `{ places, expanded, complete, overview, tiles: { fetched, failed }, tileFailures, attribution, disclosed }`. Each `tileFailures` entry is `{ url, kind, status?, error }`.

- `expanded` is `true` when `expand` replaced the region's places with those of the whole tile coverage. The client has already downloaded those tiles, so this makes no request and sends nothing more. `distance` still measures from the region's centre, so it says how far out each hit is.
- `attribution` lists who you owe credit for the data the search used, one `{ dataset, collection, attribution?, licenses?, release?, source? }` per collection. Show it wherever you show the places.
- `disclosed` is `{ keyword, region }`, what the server learned from the call. For `searchNearby`, `keyword` is always `false` and `region` is `0.01` (the grid, in degrees, of the box it sent) or `null` if the cache answered everything.

Each hit in `places` is `{ via: "tiles", origin, collection, place, importance, name, location, distance, score }`. `origin`, `collection`, `importance`, `name` and `score` can be `null`. `name` is the place's name when it's a string. `location` is `{ point, bbox }`: `point` is `{ lat, lon }` or `null`, `bbox` is `{ south, west, north, east }` or `null`, and `west > east` means the box crosses the antimeridian.

### `searchByKeyword(options): Promise<KeywordSearchResult>`

Asks the server to find places by name, so **the keyword goes to the server**, exactly as you passed it, which is why the name says so. `result.disclosed` reports it: `{ keyword: true, region: 1 }` with a region, `{ keyword: true, region: null }` without.

| Option | Meaning |
|---|---|
| `dataset` | Required, as for `searchNearby`. |
| `collection` | Optional, as for `searchNearby`. |
| `keyword` | Required. A place matches when every word of the keyword begins a word of one of its names. It isn't fuzzy: `Starbux` finds nothing. At least one word must be two or more characters long, or the server answers `KeywordRequired`. |
| `region` | Optional. `{ bbox: [west, south, east, north] }`, never a circle. It's snapped outward to whole degrees before it's sent, so the server learns nothing finer than a degree of it. With no region, the whole world is searched. |
| `signal` | Aborts the search. |

The result is `{ places, attribution, disclosed }`, with `places` in the server's order, most notable first. Each hit is `{ via: "keyword", origin, collection, place, importance, name, location }`: a nearby hit without `distance` and `score`.

### `getPlace({ origin }): Promise<PlaceRecord>`

Returns `{ origin, place, importance }`. Answered from a cached tile if one holds the place; otherwise a request to `org.atgeo.getPlace`.

### `describeService(): Promise<ServiceDescription>`

`{ did?, tilesets: [{ slug?, collections: [{ dataset?, collection? }] }] }`. Cached for an hour.

### `describeTileset(slug): Promise<Tileset>`

The tileset's descriptor: collections (with licences, attribution, record counts and so on), `publishedAt`, `extent`, `references`. Not cached. Both describe calls read leniently: a missing or wrong-typed field is absent, not an error.

## Frozen, shared places

A nearby hit's `place` is the very object the tile cache holds, so the client freezes it. A keyword hit's `place` is frozen too, but it comes from the server's answer, not the cache. Assigning to `hit.place.name` throws a `TypeError` in strict mode (ES modules are strict) and silently does nothing in sloppy mode.

The freeze is shallow. On a nearby hit, nested objects and arrays (`locations`, `variants`, `attributes`) are shared with the cache and *not* frozen, so `hit.place.variants.push(...)` works and corrupts what the next search sees. Don't. Copy first:

```js
const mine = structuredClone(hit.place); // deep copy, safe to change
const top = { ...hit.place };            // shallow: nested values still shared
```

TypeScript still types `place` as a mutable object, so the compiler won't warn you. The runtime will.

## Errors

- `AtgeoError`: a non-2xx from the server. Has `code`, a message and the HTTP `status`. Codes are the server's (`PlaceNotFound`, `BboxTooLarge`, ...), or `HttpError` when there was no error body.
- `DecodingError`: a 2xx with nothing usable in it. A body that isn't JSON at all rejects with the `SyntaxError` from `JSON.parse` instead.
- `BodyTooLargeError` (over `maxBodyBytes`) and a `TimeoutError` `DOMException` (past `requestTimeoutMs`) reject unwrapped. They are not `AtgeoError`s, even on a non-2xx. For a tile, either is a failed tile of kind `transport`.
- `TypeError`, thrown synchronously before any request, for an invalid region, a missing `dataset`, or `sort: "similarity"` without text. `searchByKeyword` throws it for a missing `dataset`, a `keyword` that isn't a string, and a `region` that isn't a valid bbox.
- A failed `getTiles` rejects the search; a failed tile doesn't (see [tile failures](/sdk/#tile-failures)).
- Aborting rejects with your signal's reason. A call answered entirely from cache completes normally even with an already-aborted signal.

## Conformance

The TypeScript source is the reference, so there's no `CONFORMANCE.md` here; the other ports list their differences against it. The language-neutral fixtures and the [port contract](https://github.com/schuyler/atgeo-sdk-js/blob/main/docs/port-contract.md) live in this repo.

## Full reference

The [JavaScript README](https://github.com/schuyler/atgeo-sdk-js#readme) covers everything above in more depth, including abort-signal edge cases, places that appear in more than one tile, and running against your own garganorn.
