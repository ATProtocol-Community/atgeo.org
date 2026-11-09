---
layout: base.njk
title: "Client SDKs"
permalink: /sdk/
---

# Client SDKs

The ATGeo client SDKs search places on the device, so the server never learns what you searched for or where you are, exactly. The few methods that do tell the server a keyword have `Keyword` in their names.

The [home page](/) map runs on the JavaScript SDK. There are five SDKs: JavaScript/TypeScript (the reference), Swift, Kotlin, Python and Rust. All of them are pre-release.

## Why an SDK

A server that can search can log what you typed. So the gazetteer's main way of finding places is *tiles*: static files of places. A client asks which tiles cover an area, downloads them, and does the matching, filtering and ranking itself.

That's a fair bit of work: snapping regions to a grid, fetching tiles eight at a time, de-duplicating, fuzzy matching, ranking, caching, crediting the data. The SDKs do it for you.

Tiles need a region, though. You can't find "Kyoto" in tiles without knowing roughly where Kyoto is. For that, the [XRPC API](/api/) also has a keyword search, `org.atgeo.searchPlaces`, which does tell the server what you typed. The SDKs keep the two apart by name: **a method whose name contains `Keyword` may send your search text to the server, and no other method does.** The option that carries text is `text` where it never leaves the device and `keyword` where it may.

The calls:

- `searchNearby` finds places in a region, optionally matching some text. Text never leaves the device.
- `searchByKeyword` asks the server for places whose name matches a keyword, optionally within a whole-degree box.
- `searchNearbyThenByKeyword` searches nearby first, and sends the keyword only if nothing nearby matches it word for word.
- `autocompleteByKeyword` makes a search-as-you-type helper for one text field.
- `getPlace` fetches one place by its `origin`.
- `describeService` and `describeTileset` are pass-throughs for finding out what a server holds.

| What you call | What happens on the wire |
|---|---|
| `searchNearby` | `org.atgeo.getTiles`, then one GET per tile |
| `searchByKeyword` | one `org.atgeo.searchPlaces`, with the keyword |
| `searchNearbyThenByKeyword` | what `searchNearby` sends, then, only if there's no solid nearby hit, what `searchByKeyword` sends |
| `autocompleteByKeyword` | one `org.atgeo.searchPlaces` per call whose input could be accepted, prefixes included |
| `getPlace` | nothing if the tile is cached, else `org.atgeo.getPlace` |
| `describeService` | `org.atgeo.describeService` (cached for an hour) |
| `describeTileset` | `org.atgeo.describeTileset` (not cached) |

The client does no quadkey math. Tile URLs are opaque; the server works out which tiles cover a box.

## The five SDKs

| Language | Repository | Runs on | Nearby | Keyword | `getPlace` |
|---|---|---|---|---|---|
| [JavaScript / TypeScript](/sdk/javascript/) | [atgeo-sdk-js](https://github.com/schuyler/atgeo-sdk-js) | Evergreen browsers, Node 20+, workers | `searchNearby` | `searchByKeyword`, `searchNearbyThenByKeyword`, `autocompleteByKeyword` | `getPlace` |
| [Swift](/sdk/swift/) | [atgeo-sdk-swift](https://github.com/schuyler/atgeo-sdk-swift) | iOS 15, macOS 12, tvOS 15, watchOS 8, visionOS 1, Linux; Swift 6 | `searchNearby` | `searchByKeyword`, `searchNearbyThenByKeyword`, `autocompleteByKeyword` | `getPlace(origin:)` |
| [Kotlin](/sdk/kotlin/) | [atgeo-sdk-kotlin](https://github.com/schuyler/atgeo-sdk-kotlin) | JVM 11+, Android API 24+ | `searchNearby` | `searchByKeyword`, `searchNearbyThenByKeyword`, `autocompleteByKeyword` | `getPlace` |
| [Python](/sdk/python/) | [atgeo-sdk-python](https://github.com/schuyler/atgeo-sdk-python) | Python 3.11+ | `search_nearby` | `search_by_keyword`, `search_nearby_then_by_keyword`, `autocomplete_by_keyword` (async client) | `get_place` |
| [Rust](/sdk/rust/) | [atgeo-sdk-rs](https://github.com/schuyler/atgeo-sdk-rs) | Rust 1.85+ (edition 2024) | `search_nearby` | `search_by_keyword`, `search_nearby_then_by_keyword`, `autocomplete_by_keyword` (async client) | `get_place` |

Every SDK also has `describeService` and `describeTileset` (`describe_service` and `describe_tileset` in Python and Rust).

The TypeScript client is the reference. The other four are ports: they share its fixtures and its [port contract](https://github.com/schuyler/atgeo-sdk-js/blob/main/docs/port-contract.md), and are meant to return the same places in the same order for the same server answers. Each port has a `CONFORMANCE.md` listing the margins where it differs, nearly all of them about malformed data that a compliant server never sends.

## Status

Pre-release. None of the SDKs is on a package registry (npm, PyPI, crates.io, Maven Central); each stays unpublished until beta testing ends. Install from GitHub, **pinned to a full commit SHA**, not a branch. The API is still changing, and breaking changes land on `main`. Each language page has the install snippet; replace `<commit-sha>` with a commit you've tested.

## One dataset per search

Every search names a dataset, and can narrow it to a collection. There is no default dataset: leaving it out is an argument error, before any request.

| `dataset` | `collection` | What is searched |
|---|---|---|
| given | absent | the whole dataset, every collection together |
| given | given | that collection |

`dataset: "openstreetmap.org"` alone returns nodes, ways and relations in one list, which is usually what you want from OSM, since the element type is an accident of how the mapper drew it. `dataset: "overturemaps.org"` alone returns places and divisions together. A collection-filtered search keeps only records whose `origin` starts with `urn:atgeo:{dataset}:{collection}:`.

There is no merged ranking across datasets. `importance` is comparable across one dataset's tilesets (Overture places rank against Overture divisions) but not across datasets: an Overture place scoring 62 and an OSM place scoring 62 aren't equally important. If you want both, make two calls and decide how to interleave them. See [Overture Places](/overture/), [Overture Divisions](/divisions/) and [OpenStreetMap](/osm/) for what each dataset holds.

## Regions

`searchNearby` requires a region, and it's one of:

- a **circle**: centre latitude and longitude, plus a radius in meters;
- a **bounding box**: `[minLon, minLat, maxLon, maxLat]` in degrees.

A box with `minLon > maxLon` crosses the antimeridian. The client sends two `getTiles` calls, one for each side, and merges the tiles. Invalid regions (non-finite or out-of-range coordinates, `minLat > maxLat`, a negative radius) are rejected before any request.

Results are filtered back to *your* region, not the snapped one: a point place is kept if it's inside, a place with only a bounding box is kept if the box touches the region, and a circle means the circle, not its enclosing square. A tight region in a sparse area can come back empty even though the client holds good places a couple of kilometers off. That's a feature of predictability, but watch for it in testing.

`searchByKeyword`'s region is optional and is a bounding box only, never a circle: a circle invites the device's own position as its centre. It goes out snapped outward to whole degrees, so `[-122.42, 37.77, -122.41, 37.78]` is sent as `-123,37,-122,38`. Without a region, the whole dataset is searched.

## Matching and sorting

With text, `searchNearby` sorts hits into two tiers before anything else. A place is tier 1 when every word of the text begins a word of one of its names (its own or a variant), ignoring case, accents and apostrophes, with other punctuation splitting words: `mcdonalds` finds `McDonald's`, `st louis` finds `St. Louis`, and `qu` finds `Bar & Grill at the Old Quarry`. Everything else is tier 2, a fuzzy match, scored with Jaro-Winkler. A tier-1 hit is always kept; a tier-2 hit is kept only if it scores at least 0.8, which keeps typos (`starbux` finds `Starbucks`) and drops near-random matches. Tier 1 comes first in every sort mode.

| Mode | Order, within each tier |
|---|---|
| `fused` (default) | text similarity, best first; near-ties broken by importance, then distance. With no text: importance, then distance. |
| `distance` | nearest first; then the smaller place (so the most specific place containing the centre leads), then importance, then similarity. |
| `similarity` | text similarity, then distance. Requires text. |

Ties on everything fall back to `origin`, so the order is deterministic.

The server's keyword search matches the same word-prefix way, but not fuzzily (`starbux` finds nothing there), and ranks by importance alone, at most 20 places. The SDK keeps the server's order.

## What a hit has

| Field | Meaning |
|---|---|
| `via` | `tiles` for a hit from `searchNearby`, `keyword` for one from the server's keyword search. |
| `origin` | The place's identity, a URN like `urn:atgeo:{dataset}:{collection}:{id}`. May be absent on records from other producers. Pass it to `getPlace`. |
| `collection` | The `{ dataset, collection }` the place's data comes from, matched against the attribution, or none. |
| `name` | The place's `name`, when it's a string. |
| `location` | Where the place is: a point (`lat`, `lon`) and a box (`south`, `west`, `north`, `east`), each or both possibly absent. |
| `place` | The place record, exactly as served. See the [Lexicon](/place/). |
| `importance` | An integer rank relative to its dataset, or none. |
| `distance` | Nearby hits only. Metres from the region's centre to the nearest point of the place; 0 if the place contains the centre. |
| `score` | Nearby hits only. Text similarity, 0 to 1; none if you gave no text. |

A keyword hit has no `distance` or `score`: the server ranks by neither, and you can work out a distance from `location` yourself.

## Attribution

Every search result carries an `attribution` list: the credit owed for the data the search used, one entry per `(dataset, collection)`, sorted, with its licences and the URL of the upstream's attribution or copyright page. If you show a place, show the credit its data requires. It covers every tile the search used, not just the places that survived filtering, and includes the divisions a place's `within` names. `getPlace` returns the place's own `attribution` list too.

## Disclosure

Every search result carries `disclosed = { keyword, region }`, a report of what the server learned during that one call. `keyword` is true if the keyword was sent. `region` is the grid, in degrees, of the finest region sent: `0.01` for a tile search, `1` for a keyword search with a box, none if no region went out (a nearby search answered entirely from cache, say). For `searchNearby`, `keyword` is always false. For `searchNearbyThenByKeyword`, it tells you which way the call went.

## Overview versus complete

A nearby search result has two flags that mean different things:

- `overview` is `true` when the region was too big for the server's tile budget, and the server answered with its coarse overview tiles instead: only the most important places (the top 10,000 by importance per tileset). The results are a sample, not everything in the region. With text, fuzzy (tier-2) matches are dropped from an overview answer, since the coarse set can't hold the place you meant. Show "zoom in for more".
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

**`searchNearby`:**

- `getTiles` with the bounding box snapped *outward* to a 0.01 degree grid (about 1 km), the dataset, and the collection if there is one. A search that crosses the antimeridian sends two.
- GETs for the tile URLs exactly as the server named them, minus any already cached.

Not on the wire: your search text, in any form, and your precise region or location. Those are used only on the device, for filtering, ranking and distance. Snapping hides where in a ~1 km cell you are; it doesn't hide the cell.

**`searchByKeyword`** sends the keyword exactly as you passed it, in one `searchPlaces` request with the dataset, the collection if any, and the box only if you gave one, snapped outward to whole degrees.

**`searchNearbyThenByKeyword`** sends what `searchNearby` sends. It then sends the keyword only if no nearby hit is tier 1 and the keyword could pass the server's two-character rule, and then it sends what `searchByKeyword` sends: with the nearby region's whole-degree box if you asked for `keywordRegion: "degree"`, with no region for `"none"`. You must pick one; there's no default.

**`autocompleteByKeyword`** sends what `searchByKeyword` sends, for every string that could be accepted, prefixes included. The server keeps no log of what it's sent, but a hostile operator could record what it receives. Debouncing reduces how many prefixes go out, and it's your app's choice; the SDKs don't do it for you.

**Other calls.** `describeService` and `describeTileset` send a request only if you call them. `getPlace` on a cache miss sends the `origin` you asked for. That's a sharper signal than a tile fetch: it tells the server which place you're looking at. It's meant for resolving a shared link, and the cache is checked first so that tapping a nearby result doesn't hit the network.

The server also sees your IP address and whatever headers your HTTP stack adds (the Swift, Kotlin, Python and Rust default transports keep these generic; in a browser, the JavaScript client's requests carry the browser's own), and it can tell which tiles you've fetched. The SDKs send no telemetry.

## Caching

Tile URLs are immutable, so tiles cache in memory until evicted, least recently used first, up to 50 MiB by default. `getTiles` answers and the service description are held for an hour. Nothing is persisted; a new client starts cold. Search a region twice, or change only the text or sort, and the second search makes no requests. Keyword calls aren't cached: each is one request.

If you want a disk cache, supply a transport that has one. There's no `prefetch` method either: a no-text search of a big region is already a warm-up.

## Errors

The server's error codes come through as the `code` on the SDK's error type, alongside the HTTP `status`, so you can tell a refused request (4xx) from a failed one (5xx). The list is open. The ones you'll see:

| Code | From | Meaning |
|---|---|---|
| `BboxTooLarge` | `getTiles` | Over the tile budget and no overview band to fall back on. Ask for less. |
| `DatasetNotFound` | `getTiles`, `searchPlaces` | No tileset carries that dataset. |
| `CollectionNotFound` | `getTiles`, `searchPlaces` | The dataset exists, but not that collection. |
| `KeywordRequired` | `searchPlaces` | No word of the keyword is two or more characters long. `searchByKeyword` passes it through; the fallback and autocomplete skip such keywords, or treat the refusal as no answer. |
| `PlaceNotFound` | `getPlace` | No place with that origin. |
| `TilesetNotFound` | `describeTileset` | No tileset with that slug. |
| `InvalidRequest` | any | A malformed parameter, or a keyword over 256 bytes. |
| `HttpError` | any | A non-2xx without a parseable error body (usually a proxy or CDN). |

A 2xx body with nothing usable in it raises a separate decoding error. Bad arguments (no dataset, an invalid region, a circle given to `searchByKeyword`, `similarity` sort without text) fail before any request, with the language's usual argument error. An autocompleter's call that a newer call replaced ends with a cancellation (or, in Rust, `Superseded`) that you ignore. Each language page has the details.

## What's deliberately absent

- **A point or distance for keyword search.** The keyword search takes a whole-degree box at most, and ranks by importance, never by how near you are.
- **Fuzzy matching on the server.** Typo tolerance happens only in `searchNearby`, on the device.
- **Writing.** No check-ins, no posting records. There's no lexicon for it yet.
- **Discovery by DID or handle.** You pass a server URL; the default is `https://places.atgeo.org`.
- **Version negotiation.** Ignore keys you don't recognise; that's the whole forward-compatibility story.
- **Cross-dataset ranking,** for the reason above.
- **Restricting tile URLs.** The client refuses non-http(s) URLs and URLs with credentials, and nothing more. A compromised server could point a client elsewhere. None of the SDKs restricts this yet.

## Where to go next

Each SDK's README is its full reference; the language pages here are quickstarts. The design rationale lives in the garganorn repo's [client SDK doc](https://github.com/schuyler/garganorn/blob/main/docs/atgeo-client-sdk.md), and the exact behaviour in the [port contract](https://github.com/schuyler/atgeo-sdk-js/blob/main/docs/port-contract.md). Using the public server? Be kind to it, or [run your own](https://github.com/schuyler/garganorn).
