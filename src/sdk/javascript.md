---
layout: base.njk
title: "JavaScript SDK"
permalink: /sdk/javascript/
---

# JavaScript SDK

`@atgeo/client` is a TypeScript/ESM client that searches ATGeo places without telling the server what you searched for. The methods that do send the server a keyword have `Keyword` in their names. It's the reference implementation: the other SDKs are ports of it.

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
  collection: "place",
  region: { lat: 39.9526, lon: -75.1652, radius: 1000 }, // meters
  text: "Starbux",
});

for (const { origin, name, distance, score } of places) {
  console.log(name, Math.round(distance), score?.toFixed(2), origin);
}

// show this wherever you show the places
console.log(attribution.map((a) => a.attribution ?? `${a.dataset}/${a.collection}`));
```

Misspellings are fine. `searchNearby` never sends your text to the server. For a place that isn't nearby, `searchByKeyword` does, and says so in its name:

```ts
const found = await atgeo.searchByKeyword({ dataset: "overturemaps.org", keyword: "Liberty Bell" });
console.log(found.places.map((p) => p.name), found.disclosed); // { keyword: true, region: null }
```

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
| `dataset` | Required, e.g. `"openstreetmap.org"`. No default. |
| `collection` | Optional, e.g. `"way"`. |
| `text` | Optional. Matched against `name` and `variants[].name`, on the device. |
| `sort` | `"fused"` (default), `"distance"` or `"similarity"` (needs `text`). |
| `signal` | Aborts the search. |

The result is `{ places, complete, overview, tiles: { fetched, failed }, tileFailures, attribution, disclosed }`. Each hit in `places` is `{ via: "tiles", origin, collection, name, location, place, importance, distance, score }`; `origin`, `collection`, `name`, `importance` and `score` can be `null`. Each `tileFailures` entry is `{ url, kind, status?, error }`. `disclosed.keyword` is always `false` here.

### `searchByKeyword(options): Promise<KeywordSearchResult>`

| Option | Meaning |
|---|---|
| `dataset` | Required. |
| `collection` | Optional. |
| `keyword` | Required. **Sent to the server**, exactly as given. |
| `region` | Optional. `{ bbox: [...] }` only, never a circle; sent snapped outward to whole degrees. |
| `signal` | Aborts the search. |

The result is `{ places, attribution, disclosed }`, in the server's order (most important first, at most 20). Each hit is `{ via: "keyword", origin, collection, name, location, place, importance }`: no `distance` and no `score`. It isn't cached. A keyword with no word of two or more characters rejects with the server's `KeywordRequired`.

### `searchNearbyThenByKeyword(options): Promise<FallbackSearchResult>`

The options of `searchNearby`, with `keyword` in place of `text`, plus a required `keywordRegion`: `"degree"` sends the nearby region's whole-degree box with the keyword, `"none"` sends no region. It runs `searchNearby` first. If some nearby hit matches the keyword word for word, that's the answer and the keyword stays on the device. Otherwise it calls `searchByKeyword` and puts the keyword hits first, then the nearby hits, without duplicates. Each hit's `via` says where it came from, and `disclosed` says whether the keyword went out. If the server refuses the keyword as too short (`KeywordRequired`), you get the nearby result, with `disclosed.keyword` true. Any other failed keyword request rejects the call and the nearby results are lost, though the keyword may have reached the server.

### `autocompleteByKeyword(options): KeywordAutocomplete`

```ts
const field = atgeo.autocompleteByKeyword({ dataset: "overturemaps.org" });
input.addEventListener("input", async () => {
  try {
    show((await field.searchByKeyword(input.value)).places);
  } catch (e) {
    if ((e as Error).name !== "AbortError") throw e; // superseded by a later keystroke
  }
});
```

Takes `dataset`, `collection?` and `region?`, and returns an object whose `searchByKeyword(keyword, { signal }?)` behaves like `searchByKeyword`. Each call aborts the previous one on the same autocompleter, which rejects with an `AbortError`. Make one per text field. Input the server would refuse (`a`, a single character) makes no request and resolves an empty result. **Every other string goes to the server as typed, prefixes included.** Debouncing is up to you.

### `getPlace({ origin }): Promise<PlaceRecord>`

Returns `{ origin, place, name, location, importance, attribution }`. Answered from a cached tile if one holds the place; otherwise a request to `org.atgeo.getPlace`. A keyword search caches nothing, so for a keyword hit this usually goes to the network.

### `describeService(): Promise<ServiceDescription>`

`{ did?, maxTiles?, tilesets: [{ slug?, collections: [{ dataset?, collection? }] }] }`. Cached for an hour. `maxTiles` is the server's tile budget, for information only.

### `describeTileset(slug): Promise<Tileset>`

The tileset's descriptor: collections (with licences, attribution, record counts and so on), `publishedAt`, `extent`, `references`, and `overview` (`{ records? }`) when it has an overview band. Not cached. Both describe calls read leniently: a missing or wrong-typed field is absent, not an error.

## Frozen, shared places

`hit.place` is the very object the tile cache holds, so the client freezes it. Assigning to `hit.place.name` throws a `TypeError` in strict mode (ES modules are strict) and silently does nothing in sloppy mode.

The freeze is shallow. Nested objects and arrays (`locations`, `variants`, `attributes`) are shared with the cache and *not* frozen, so `hit.place.variants.push(...)` works and corrupts what the next search sees. Don't. Copy first:

```js
const mine = structuredClone(hit.place); // deep copy, safe to change
const top = { ...hit.place };            // shallow: nested values still shared
```

TypeScript still types `place` as a mutable object, so the compiler won't warn you. The runtime will.

## Errors

- `AtgeoError`: a non-2xx from the server. Has `code`, a message and the HTTP `status`. Codes are the server's (`PlaceNotFound`, `BboxTooLarge`, `KeywordRequired`, ...), or `HttpError` when there was no error body.
- `DecodingError`: a 2xx with nothing usable in it. A body that isn't JSON at all rejects with the `SyntaxError` from `JSON.parse` instead.
- `BodyTooLargeError` (over `maxBodyBytes`) and a `TimeoutError` `DOMException` (past `requestTimeoutMs`) reject unwrapped. They are not `AtgeoError`s, even on a non-2xx. For a tile, either is a failed tile of kind `transport`.
- `TypeError`, thrown synchronously before any request, for a missing `dataset`, an invalid region, `sort: "similarity"` without text, a `keyword` that isn't a string, a circle given to `searchByKeyword`, or a `keywordRegion` that isn't `"none"` or `"degree"`. An autocompleter's `searchByKeyword` is async, so it rejects with the `TypeError` for a non-string keyword instead of throwing.
- An autocompleter's call that a newer call superseded rejects with an `AbortError` `DOMException`. Ignore it.
- A failed `getTiles` rejects the search; a failed tile doesn't (see [tile failures](/sdk/#tile-failures)).
- Aborting rejects with your signal's reason. A call answered entirely from cache completes normally even with an already-aborted signal. A request whose signal has already aborted is never handed to `fetch`.

## Conformance

The TypeScript source is the reference, so there's no `CONFORMANCE.md` here; the other ports list their differences against it. The language-neutral fixtures and the [port contract](https://github.com/schuyler/atgeo-sdk-js/blob/main/docs/port-contract.md) live in this repo.

## Full reference

The [JavaScript README](https://github.com/schuyler/atgeo-sdk-js#readme) covers everything above in more depth, including the privacy rules for the keyword methods, attribution, `disclosed`, abort-signal edge cases, places that appear in more than one tile, and running against your own garganorn.
