---
layout: base.njk
title: "Client SDKs"
permalink: /sdk/
---

# Client SDKs

The ATGeo client SDKs search places on the device, so the server never learns what you searched for or where you are, exactly.

The [home page](/) map runs on the JavaScript SDK. There are five SDKs: JavaScript/TypeScript (the reference), Swift, Kotlin, Python and Rust. All of them are pre-release.

## Why an SDK

The [XRPC API](/api/) has no search endpoint, on purpose. A server that can search can log what you typed. Instead, the gazetteer serves *tiles*: static files of places. A client asks which tiles cover an area, downloads them, and does the matching, filtering and ranking itself.

That's a fair bit of work: snapping regions to a grid, fetching tiles eight at a time, de-duplicating, fuzzy matching, ranking, caching. The SDKs do it for you, and they give you two main calls:

- `searchPlaces` finds places in a region, optionally matching some text.
- `getPlace` fetches one place by its `origin`.

Plus two pass-throughs for finding out what a server holds: `describeService` and `describeTileset`.

| What you call | What happens on the wire |
|---|---|
| `searchPlaces` | `org.atgeo.getTiles`, then one GET per tile |
| `getPlace` | nothing if the tile is cached, else `org.atgeo.getPlace` |
| `describeService` | `org.atgeo.describeService` (cached for an hour) |
| `describeTileset` | `org.atgeo.describeTileset` (not cached) |

The client does no quadkey math. Tile URLs are opaque; the server works out which tiles cover a box.

## The five SDKs

| Language | Repository | Runs on | `searchPlaces` | `getPlace` | `describeService` | `describeTileset` |
|---|---|---|---|---|---|---|
| [JavaScript / TypeScript](/sdk/javascript/) | [atgeo-sdk-js](https://github.com/schuyler/atgeo-sdk-js) | Evergreen browsers, Node 20+, workers | `searchPlaces` | `getPlace` | `describeService` | `describeTileset` |
| [Swift](/sdk/swift/) | [atgeo-sdk-swift](https://github.com/schuyler/atgeo-sdk-swift) | iOS 15, macOS 12, tvOS 15, watchOS 8, visionOS 1, Linux; Swift 6 | `searchPlaces` | `place(origin:)` | `describeService` | `describeTileset` |
| [Kotlin](/sdk/kotlin/) | [atgeo-sdk-kotlin](https://github.com/schuyler/atgeo-sdk-kotlin) | JVM 11+, Android API 24+ | `searchPlaces` | `getPlace` | `describeService` | `describeTileset` |
| [Python](/sdk/python/) | [atgeo-sdk-python](https://github.com/schuyler/atgeo-sdk-python) | Python 3.11+ | `search_places` | `get_place` | `describe_service` | `describe_tileset` |
| [Rust](/sdk/rust/) | [atgeo-sdk-rs](https://github.com/schuyler/atgeo-sdk-rs) | Rust 1.85+ (edition 2024) | `search_places` | `get_place` | `describe_service` | `describe_tileset` |

The TypeScript client is the reference. The other four are ports: they share its fixtures and its [port contract](https://github.com/schuyler/atgeo-sdk-js/blob/main/docs/port-contract.md), and are meant to return the same places in the same order for the same server answers. Each port has a `CONFORMANCE.md` listing the margins where it differs, nearly all of them about malformed data that a compliant server never sends.

## Status

Pre-release. None of the SDKs is on a package registry (npm, PyPI, crates.io, Maven Central); each stays unpublished until beta testing ends. Install from GitHub, **pinned to a full commit SHA**, not a branch. The API is still changing, and breaking changes land on `main`. Each language page has the install snippet; replace `<commit-sha>` with a commit you've tested.

## One dataset per search

A search covers one dataset, optionally narrowed to a collection:

| `dataset` | `collection` | What is searched |
|---|---|---|
| absent | absent | `overturemaps.org` / `place` |
| absent | given | `overturemaps.org` / that collection |
| given | absent | the whole dataset, every collection together |
| given | given | that collection |

So the default is Overture places. `dataset: "openstreetmap.org"` alone returns nodes, ways and relations in one list, which is usually what you want from OSM, since the element type is an accident of how the mapper drew it. A collection-filtered search keeps only records whose `origin` starts with `urn:atgeo:{dataset}:{collection}:`.

There is no merged ranking across datasets. `importance` is comparable across one dataset's tilesets (Overture places rank against Overture divisions) but not across datasets: an Overture place scoring 62 and an OSM place scoring 62 aren't equally important. If you want both, make two calls and decide how to interleave them. See [Overture Places](/overture/), [Overture Divisions](/divisions/) and [OpenStreetMap](/osm/) for what each dataset holds.

## Regions

A region is required, and it's one of:

- a **circle**: centre latitude and longitude, plus a radius in meters;
- a **bounding box**: `[minLon, minLat, maxLon, maxLat]` in degrees.

A box with `minLon > maxLon` crosses the antimeridian. The client sends two `getTiles` calls, one for each side, and merges the tiles. Invalid regions (non-finite or out-of-range coordinates, `minLat > maxLat`, a negative radius) are rejected before any request.

Results are filtered back to *your* region, not the snapped one: a point place is kept if it's inside, a place with only a bounding box is kept if the box touches the region, and a circle means the circle, not its enclosing square. A tight region in a sparse area can come back empty even though the client holds good places a couple of kilometers off. That's a feature of predictability, but watch for it in testing.

You cannot search "Kyoto" without knowing roughly where Kyoto is. Tiles don't work like a geocoder.

## Sorting

| Mode | Order |
|---|---|
| `fused` (default) | text similarity, best first; near-ties broken by importance, then distance. With no text: importance, then distance. |
| `distance` | nearest first; then the smaller place (so the most specific place containing the centre leads), then importance, then similarity. Text still filters poor matches. |
| `similarity` | text similarity, then distance. Requires text. |

Matching is fuzzy: names (and name variants) are normalized, scored against the query with Jaro-Winkler, and anything under 0.6 is dropped. Ties on everything fall back to `origin`, so the order is deterministic.

## What a hit has

Each hit in `places` carries:

| Field | Meaning |
|---|---|
| `origin` | The place's identity, a URN like `urn:atgeo:{dataset}:{collection}:{id}`. May be absent on records from other producers. Pass it to `getPlace`. |
| `place` | The place record, exactly as served. See the [Lexicon](/place/). |
| `importance` | An integer rank relative to its tileset, or none. |
| `distance` | Metres from the region's centre to the nearest point of the place; 0 if the place contains the centre. |
| `score` | Text similarity, 0 to 1; none if you gave no text. |

The Kotlin, Python and Rust SDKs also give hits `name` and `location` helpers; JavaScript and Swift expose `place` as served.

## Overview versus complete

A search result has two flags that mean different things:

- `overview` is `true` when the region was too big for the server's tile budget, and the server answered with its coarse overview tiles instead: only the most important places (the top 10,000 by importance per tileset; for divisions, that keeps the countries, regions and dependencies). The results are a sample, not everything in the region. Show "zoom in for more".
- `complete` is `false` when any tile failed to load. The results are partial.

They're independent. `overview: true, complete: true` is a perfectly good answer. If you want the full set, search a smaller region. For a deeper look, see [the overview band](/api/#the-overview-band) in the XRPC docs.

## Tile failures

A failed tile doesn't fail the search. It's skipped, counted, and listed in `tileFailures` (`tile_failures` in the snake-case SDKs), each with its URL, a `kind` and an error:

| `kind` | What happened |
|---|---|
| `refused` | The tile URL wasn't an absolute http(s) URL, or carried credentials. No request was made. |
| `status` | The tile answered with a non-2xx status (also recorded). |
| `decode` | A 2xx whose body isn't a tile. |
| `transport` | The fetch itself failed: network error, timeout, a body over the size cap. |

There are no retries. A failed `getTiles` request is different: with no tile list there's nothing to degrade, so the search fails.

## What goes on the wire

- `getTiles` with the bounding box snapped *outward* to a 0.01 degree grid (about 1 km), the dataset, and the collection if there is one. A search that crosses the antimeridian sends two.
- GETs for the tile URLs exactly as the server named them, minus any already cached.
- `describeService` and `describeTileset`, only if you call them.
- `getPlace` on a cache miss, sending the `origin` you asked for.

Not on the wire: your search text, in any form, and your precise region or location. Those are used only on the device, for filtering, ranking and distance. The server does see your IP address and whatever headers your HTTP stack adds (the Swift, Kotlin, Python and Rust default transports keep these generic; in a browser, the JavaScript client's requests carry the browser's own), and it can tell which tiles you've fetched. Snapping hides where in a ~1 km cell you are; it doesn't hide the cell. The SDKs send no telemetry.

`getPlace` on a cache miss is a sharper signal than a tile fetch: it tells the server which place you're looking at. It's meant for resolving a shared link, and the cache is checked first so that tapping a search result doesn't hit the network.

## Caching

Tile URLs are immutable, so tiles cache in memory until evicted, least recently used first, up to 50 MiB by default. `getTiles` answers and the service description are held for an hour. Nothing is persisted; a new client starts cold. Search a region twice, or change only the text or sort, and the second search makes no requests.

If you want a disk cache, supply a transport that has one. There's no `prefetch` method either: a no-text search of a big region is already a warm-up.

## Errors

The server's error codes come through as the `code` on the SDK's error type, alongside the HTTP `status`, so you can tell a refused request (4xx) from a failed one (5xx). The list is open. The ones you'll see:

| Code | From | Meaning |
|---|---|---|
| `BboxTooLarge` | `getTiles` | Over the tile budget and no overview band to fall back on. Ask for less. |
| `DatasetNotFound` | `getTiles` | No tileset carries that dataset. |
| `CollectionNotFound` | `getTiles` | The dataset exists, but not that collection. |
| `PlaceNotFound` | `getPlace` | No place with that origin. |
| `TilesetNotFound` | `describeTileset` | No tileset with that slug. |
| `InvalidRequest` | any | A malformed parameter. |
| `HttpError` | any | A non-2xx without a parseable error body (usually a proxy or CDN). |

A 2xx body with nothing usable in it raises a separate decoding error. Bad arguments (an invalid region, `similarity` sort without text) fail before any request, with the language's usual argument error. Each language page has the details.

## What's deliberately absent

- **Region-less search.** A region is required.
- **Writing.** No check-ins, no posting records. There's no lexicon for it yet.
- **Discovery by DID or handle.** You pass a server URL; the default is `https://places.atgeo.org`.
- **Version negotiation.** Ignore keys you don't recognise; that's the whole forward-compatibility story.
- **Cross-dataset ranking,** for the reason above.
- **Restricting tile URLs.** The client refuses non-http(s) URLs and URLs with credentials, and nothing more. A compromised server could point a client elsewhere. None of the SDKs restricts this yet.

## Where to go next

Each SDK's README is its full reference; the language pages here are quickstarts. The design rationale lives in the garganorn repo's [client SDK doc](https://github.com/schuyler/garganorn/blob/main/docs/atgeo-client-sdk.md), and the exact behaviour in the [port contract](https://github.com/schuyler/atgeo-sdk-js/blob/main/docs/port-contract.md). Using the public server, mostly the US east coast for now? Be kind to it, or [run your own](https://github.com/schuyler/garganorn).
