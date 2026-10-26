---
layout: base.njk
title: "XRPC API"
---

# XRPC API

{% queryDemo %}

Pick a method, fill in its parameters and send it. For `getTiles` you can also run a search through the JavaScript client and see every request it makes, which is the point of the next section.

This page is the practical tour of the interface. The normative text is the [ATGeo spec](https://github.com/schuyler/garganorn/blob/main/docs/atgeo-spec.md), and where the two disagree, the spec wins. The interface is implemented in [Garganorn](https://github.com/schuyler/garganorn), and the public endpoint is hosted with the generous support of the [AT Protocol Community Fund](https://atprotocol.dev/community-fund/).

Base URL: `https://places.atgeo.org/xrpc`

If you're writing an app, you probably want an [SDK](/sdk/), which does everything on this page for you. If you're writing a client or your own gazetteer, read on.

## The safety principle

The server must never receive information precise enough to locate a person.

Everything unusual about this API follows from that one rule. There is no server-side search, so search terms, which reveal intent, never leave your device. There is no way to list or enumerate places. The only spatial question you can ask is coarse: which tiles cover this region, at a precision floor of roughly a kilometer. The only other question names a place you already know the identity of. Neither shape lets a query describe a point, so no query can resolve to a device's position.

The threat model and the reasoning are in [tile-privacy-design.md](https://github.com/schuyler/garganorn/blob/main/docs/tile-privacy-design.md).

## How queries work

1. Call `org.atgeo.getTiles` with a dataset (and optionally a collection) and a bounding box. The server returns a list of tile URLs.
2. Fetch every URL and concatenate the `records` arrays.
3. Deduplicate by `origin`, drop records of collections you didn't ask for, and match, rank and filter locally.

That merged set is the query result. The server never sees what you were looking for. There's no pagination, no server-side ranking and no partial-result protocol.

For a region too big for the regular tiles, the answer is a sample: see [the overview band](#the-overview-band).

To fetch a single place whose identity you already hold, call `org.atgeo.getPlace`. Prefer tiles you already have: `getPlace` tells the server exactly which place you're looking at, which is a sharper signal than the box `getTiles` sees. It exists for resolving a link someone shared, where you have an identity and no region.

## Identity

A place is named by an ATGeo URN, `urn:atgeo:{dataset}:{collection}:{id}`, for example `urn:atgeo:openstreetmap.org:way:123456`. Every place the gazetteer serves carries it as `value.origin`. The [Lexicon page](/place/) has the details: what the parts mean, how to compare them, and what happens when you copy a place into your own repo.

## Tilesets

A tileset is one build of one source: a directory of tiles, a manifest and a descriptor. It's served under a slug fixed when it was built. Garganorn builds three:

| Slug | Carries | Source |
|------|---------|--------|
| `overture-place` | `(overturemaps.org, place)` | [Overture Places](/overture/) |
| `osm` | `(openstreetmap.org, node)`, `way`, `relation` | [OpenStreetMap](/osm/) |
| `overture-division` | `(overturemaps.org, division)` | [Overture Divisions](/divisions/) |

A deployment may serve any subset; ask `describeService` which. A tileset can also *reference* a collection it doesn't carry: places include `within` relations that name divisions, so the place tilesets list `(overturemaps.org, division)` as a reference, and the division attribution applies to that data.

A tile can hold records of a collection you didn't ask for (all three OSM element types share the OSM tiles, for one), so `getTiles` returns tiles, not records of one collection.

The live data currently covers mostly the US east coast. The global build is pending a rebuild.

## Methods

All four are `GET /xrpc/{nsid}`, all described by lexicons, and none needs authentication. Responses may include keys not documented here; ignore keys you don't recognize.


### `org.atgeo.getTiles`

Which tiles cover a bounding box.

`GET https://places.atgeo.org/xrpc/org.atgeo.getTiles`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dataset` | string | Yes | A domain, like `openstreetmap.org` |
| `collection` | string | No | A collection, like `way`. Without it, the answer covers every tileset carrying the dataset; with it, every tileset carrying that collection |
| `bbox` | string | Yes | `west,south,east,north` in WGS84 decimal degrees, at most two decimal places each ([the precision floor](#the-precision-floor)) |

Either way the tiles may hold records of other collections. If you asked for a collection, keep the records whose `origin` starts with `urn:atgeo:{dataset}:{collection}:`. A record with no `origin` matches no collection.

A box can cross the antimeridian: `west > 0 > east` means it wraps across ±180°. Tiles that merely touch the box at an edge or corner count as covering it.

```
GET /xrpc/org.atgeo.getTiles?dataset=overturemaps.org&collection=place&bbox=-75.17,39.95,-75.16,39.96
```

```json
{
  "tiles": [
    "https://places.atgeo.org/tiles/overture-place/20261014T073433/032010/0320101032221211.json",
    "https://places.atgeo.org/tiles/overture-place/20261014T073433/032010/03201010322212131.json",
    "..."
  ]
}
```

(Fifteen tiles came back; the rest are trimmed.) `tiles` is a list of complete, opaque tile URLs in ascending string order. Fetch them all and merge. When the answer is the overview band instead of the regular tiles, the response also carries `"overview": true`; a regular answer omits the key.

| Error | Description |
|-------|-------------|
| `BboxTooPrecise` | A coordinate has more than two decimal places |
| `InvalidBbox` | Not four comma-separated finite numbers; a longitude outside [-180, 180] or latitude outside [-90, 90]; `south >= north`; or `west >= east` without the antimeridian form |
| `DatasetNotFound` | No tileset carries the dataset |
| `CollectionNotFound` | The dataset is served, but no tileset carries the collection |
| `BboxTooLarge` | The box covers more tiles than the budget and a selected tileset has no overview band. Ask for a smaller region |

Errors are listed in the order they're evaluated. A tileset with an overview band never raises `BboxTooLarge`.


### `org.atgeo.getPlace`

One place by identity.

`GET https://places.atgeo.org/xrpc/org.atgeo.getPlace`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uri` | string | Yes | The record's key: its `origin`, or its own `uri` when it has none. For everything Garganorn serves that's the origin, e.g. `urn:atgeo:openstreetmap.org:way:123456`. Pass it whole; the server takes it apart |

```
GET /xrpc/org.atgeo.getPlace?uri=urn:atgeo:overturemaps.org:place:00458f1e-2120-4557-9fa4-4f00d12fcd7a
```

```json
{
  "uri": "urn:atgeo:overturemaps.org:place:00458f1e-2120-4557-9fa4-4f00d12fcd7a",
  "url": "https://places.atgeo.org/overturemaps.org/place/00458f1e-2120-4557-9fa4-4f00d12fcd7a",
  "importance": 57,
  "value": {
    "$type": "org.atgeo.place",
    "origin": "urn:atgeo:overturemaps.org:place:00458f1e-2120-4557-9fa4-4f00d12fcd7a",
    "name": "Community Ventures",
    "locations": [ ... ],
    "variants": [],
    "attributes": { ... },
    "relations": { ... }
  },
  "attribution": [
    {
      "dataset": "overturemaps.org",
      "collection": "place",
      "release": "2026-08-19.0",
      "source": "https://overturemaps.org/",
      "licenses": ["..."],
      "attribution": "https://docs.overturemaps.org/attribution/"
    },
    "..."
  ]
}
```

It's the same `{uri, value}` shape as the AT Protocol's `getRecord`. `uri` echoes the key you asked for. `url` is the plain-HTTP address of the same view, `{public_base}/{dataset}/{collection}/{id}`, which returns this same document; `public_base` is the deployment's configured public URL, not whatever host the request arrived on. `importance` is beside the place, as in a tile, and absent when the place has none. `value` is the place, unmodified: exactly what the tile holds. `attribution` is the same array every tile of the place's tileset carries, so a place fetched by link has its notices with it. If more than one tileset carries the collection, the first one (in the deployment's configuration order) that holds the place answers.

| Error | Description |
|-------|-------------|
| `PlaceNotFound` | A URN the server doesn't serve, a collection it doesn't carry, a malformed `atgeo` URN, or a URI that isn't a URN at all |
| `InvalidRequest` | The `uri` is missing, or isn't a valid URI at all |


### `org.atgeo.describeService`

What this gazetteer serves.

`GET https://places.atgeo.org/xrpc/org.atgeo.describeService`

No parameters. Any you send are ignored (a cache-buster, say). It returns the deployment's `did:web` identifier, its tile budget and its tilesets. `did` is informational: nothing resolves a DID to a gazetteer yet, so if you have this answer you already knew the URL. `maxTiles` is the most regular tiles a `getTiles` answer may list before it falls back to [the overview band](#the-overview-band) or `BboxTooLarge`. It's informational too; tile zooms are adaptive, so you can't use it to predict how many tiles a box needs. The tileset list is authoritative: a dataset that isn't in it gets `DatasetNotFound` from `getTiles`.

```json
{
  "did": "did:web:places.atgeo.org",
  "maxTiles": 50,
  "tilesets": [
    { "slug": "overture-place", "collections": [{ "dataset": "overturemaps.org", "collection": "place" }] },
    { "slug": "overture-division", "collections": [{ "dataset": "overturemaps.org", "collection": "division" }] },
    { "slug": "osm", "collections": [
      { "dataset": "openstreetmap.org", "collection": "node" },
      { "dataset": "openstreetmap.org", "collection": "way" },
      { "dataset": "openstreetmap.org", "collection": "relation" }
    ] }
  ]
}
```

It has no errors of its own.


### `org.atgeo.describeTileset`

The descriptor for one tileset: what's in it, where, and under what terms.

`GET https://places.atgeo.org/xrpc/org.atgeo.describeTileset?slug=overture-place`, or `GET /tilesets/overture-place`. Both return the same document.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | Yes | The tileset's slug, from `describeService` |

```json
{
  "slug": "overture-place",
  "publishedAt": "2026-10-14T07:34:33Z",
  "extent": { "north": "52.482780", "south": "27.059126", "east": "-61.875000", "west": "-90.000000" },
  "overview": { "records": 10000 },
  "collections": [
    {
      "dataset": "overturemaps.org",
      "collection": "place",
      "release": "2026-08-19.0",
      "source": "https://overturemaps.org/",
      "licenses": [
        "https://cdla.dev/permissive-2-0/",
        "https://www.apache.org/licenses/LICENSE-2.0",
        "https://creativecommons.org/publicdomain/zero/1.0/legalcode"
      ],
      "attribution": "https://docs.overturemaps.org/attribution/",
      "recordCount": 7695058,
      "locationFormats": ["community.lexicon.location.geo", "community.lexicon.location.address"],
      "containmentTypes": ["country", "dependency", "region", "county", "locality", "macrohood", "neighborhood", "microhood"],
      "categories": [
        { "value": "restaurant", "count": 1812921 },
        { "value": "professional_services", "count": 1267482 },
        "..."
      ],
      "attributes": ["brand", "categories", "confidence", "emails", "id", "names", "phones", "socials", "sources", "version", "websites"]
    }
  ],
  "references": [
    {
      "dataset": "overturemaps.org",
      "collection": "division",
      "release": "2026-08-19.0",
      "source": "https://overturemaps.org/",
      "licenses": ["https://opendatacommons.org/licenses/odbl/1-0/", "https://creativecommons.org/licenses/by/4.0/legalcode"],
      "attribution": "https://docs.overturemaps.org/attribution/"
    }
  ]
}
```

`publishedAt` equals `publishedAt` in every tile. `extent` bounds the regular tiles. `overview` is present when the tileset has [an overview band](#the-overview-band); `records` is how many records the band actually holds. No `overview` means no band, so a box over the tile budget gets `BboxTooLarge`. Vocabularies (`categories`, `attributes`, `containmentTypes`) are observed, not closed. The field definitions are on the [Lexicon page](/place/#org-atgeo-defs). The descriptor describes one build, not a promise about the next.

| Error | Description |
|-------|-------------|
| `TilesetNotFound` | No tileset has that slug |


## The overview band

A tileset may carry a coarse band of tiles at zooms 1 through 5 alongside the regular ones. It holds the 10,000 records with the highest `importance`, ties broken by id. That's one cut, the same for every tileset: the division formula's [administrative floors](#importance) are what keep countries, dependencies and regions in it. A tileset's descriptor says whether it has a band, in `overview`.

`getTiles` uses the band as a fallback. It answers from the regular tiles first. If that would cover more than the tile budget (`describeService`'s `maxTiles`, 50 here) and every selected tileset has an overview band, it returns the overview tiles that intersect the box instead, with no budget applied, and sets `"overview": true`. The result is deliberately a sample of the region, not everything in it. A live example, a ten-degree box over the northeast:

```
GET /xrpc/org.atgeo.getTiles?dataset=openstreetmap.org&bbox=-80,35,-70,45
```

```json
{
  "overview": true,
  "tiles": [
    "https://places.atgeo.org/tiles/osm/20261014T075427/03022/03022.json",
    "https://places.atgeo.org/tiles/osm/20261014T075427/03023/03023.json",
    "https://places.atgeo.org/tiles/osm/20261014T075427/03200/03200.json",
    "https://places.atgeo.org/tiles/osm/20261014T075427/03201/03201.json"
  ]
}
```

Read the flag; don't infer anything from the length of a quadkey in a URL. The budget counts tiles across every tileset the request selects, so `dataset=overturemaps.org` with no collection selects both Overture tilesets and compares the combined count. If any selected tileset has no overview band, you get `BboxTooLarge` instead.


## The precision floor

Bounding-box coordinates carry at most two decimal places: a 0.01° grid, about 1.1 km at the equator. This is the safety principle made concrete. Without search terms, a box centred on a device's raw GPS fix would still locate the person to about ten meters however big the box is. Holding every coordinate to 0.01° limits what the server can extract to "which grid cell", not "which street corner".

The floor is enforced, not advised. The check is textual, on the string you sent: `37.770` fails on its trailing zero, and `1e2` is rejected outright. The server rejects rather than rounding, so a client that leaks precision hears about it:

```
GET /xrpc/org.atgeo.getTiles?dataset=openstreetmap.org&bbox=-75.171,39.95,-75.16,39.96
```

```json
{
  "error": "BboxTooPrecise",
  "message": "bbox coordinate has more than 2 decimal places; snap to 0.01° grid"
}
```

Clients snap *outward* before sending, so the grid box contains the region they care about, and keep the original box around for filtering results.

Refusal doesn't protect the coordinates in the refused request: the server has to receive a value to judge it. The guarantee is against sustained exposure. A leaking client is caught on its first request, not months later.

## Tiles

A tile is a set of place records associated with one quadkey cell (Web-Mercator quadkeys over WGS84, so every latitude is covered).

**Tile URLs are opaque.** Never construct one; take whole URLs from `getTiles` and fetch them as given. A tile URL is immutable. When a new build is published, the URLs change completely, which costs you nothing, because you ask `getTiles` again instead of remembering URLs. Old builds are eventually retired, so a hoarded URL will in time return 404. That's the penalty for remembering.

**Zoom and assignment.** The regular tiles exist at zooms 6 through 17. Each record goes in the coarsest tile holding no more than a per-build cap of records (1,000 by default; a division goes by its interior point), falling back to zoom 17 when nothing coarser qualifies. Dense areas get small tiles and sparse areas get big ones. Tiles at different zooms coexist in one tileset, so assume no particular zoom. Divisions are polygons and are also referenced from every tile their geometry overlaps. Records within a tile are in no meaningful order.

**Deduplicate by `origin`.** When you merge records from more than one tile, dedupe by `value.origin`, or by the record's `uri` for a record with no origin. Do this for every collection, unconditionally. A point record today lives in one regular tile plus possibly one overview tile, so duplicates are rare there; a division is referenced from every tile it overlaps, so there they're the norm. Every copy of a record is byte-identical, so it doesn't matter which one you keep.

**Transport.** Tiles are stored gzip-compressed and served as plain JSON at `{quadkey}.json`, with `Content-Type: application/json`. Compression on the wire is the ordinary `Accept-Encoding` negotiation; your HTTP library probably handles it.

**Caching.** Tiles are served with `Cache-Control: public, max-age=604800, immutable`: cache them for a week and never revalidate.

### The tile payload

A tile is one JSON object ([`org.atgeo.tilePayload`](/place/#org-atgeo-tilepayload)):

| Key | Description |
|-----|-------------|
| `publishedAt` | When the tileset was built (RFC 3339 UTC, seconds precision) |
| `attribution` | One entry per collection the tileset carries or references: `dataset`, `collection`, and where known `release`, `source`, `licenses`, `attribution` |
| `records` | Array of records |

`publishedAt` and `attribution` are the same in every tile of a tileset, so a consumer holding one tile has the notices for what's in it. They're build-scoped: a difference between tiles from different builds says nothing about how fresh the records are.

Each record has up to three keys: `value`, the place (an [`org.atgeo.place`](/place/)); `importance`, an integer 0 to 100, beside the place because it's a build parameter and not a property of the place; and `uri`, only for a record with no `origin`. Everything Garganorn serves has an origin. A trimmed tile from Philadelphia:

```json
{
  "publishedAt": "2026-10-14T07:34:33Z",
  "attribution": [
    {
      "dataset": "overturemaps.org",
      "collection": "place",
      "release": "2026-08-19.0",
      "source": "https://overturemaps.org/",
      "attribution": "https://docs.overturemaps.org/attribution/",
      "licenses": ["https://cdla.dev/permissive-2-0/", "..."]
    },
    { "dataset": "overturemaps.org", "collection": "division", "...": "..." }
  ],
  "records": [
    {
      "value": {
        "$type": "org.atgeo.place",
        "origin": "urn:atgeo:overturemaps.org:place:00458f1e-2120-4557-9fa4-4f00d12fcd7a",
        "name": "Community Ventures",
        "locations": [ ... ],
        "variants": [],
        "attributes": { ... },
        "relations": { ... }
      },
      "importance": 57
    },
    "..."
  ]
}
```

There's no version field. Lexicons evolve upgrade-only, so the rule that governs records governs tiles too: ignore keys you don't recognize.


## Importance

`importance` is an integer from 0 to 100 saying how much a place matters relative to other places. It blends how busy the place's surroundings are with how distinctive its category is (for a division, how many people live in it).

Scores are comparable across the tilesets one producer builds from one dataset. So Garganorn's `overture-place` and `overture-division` scores rank against each other, and a dataset-wide `overturemaps.org` search can rank places and divisions together. They're meaningless across producers and across datasets: an Overture place scoring 62 and an OSM place scoring 62 were scored against different corpora with different category vocabularies.

Garganorn computes it like this. For places (Overture places, and OSM nodes, ways and relations):

```
importance = round(60 * min(density / 10, 1) + 40 * min(idf / 18, 1))
```

where `density` is ln(1 + n) for n Overture places in the enclosing zoom-15 cell (Overture-derived even for OSM records, so both share one notion of "busy"), and `idf` is ln(N / n) over the source's named places, n being the places in the record's primary category. Rare categories score high, ubiquitous ones low.

For divisions, the administrative level sets a floor and a ceiling, and a 0-to-1 signal places the division between them:

```
importance = round(floor + (ceiling - floor) * s)

s = min(ln(1 + population) / 20, 1)                                      every subtype but locality
s = 0.6 * min(density / 10, 1) + 0.4 * min(ln(1 + population) / 20, 1)  locality
```

with `density` averaged over the zoom-15 cells the locality's bounding box touches. A division with no recorded population (and, for a locality, no density) sits at its floor.

| subtype | floor | ceiling |
|---|--:|--:|
| `country` | 90 | 100 |
| `dependency` | 85 | 100 |
| `region` | 80 | 100 |
| `county` | 40 | 79 |
| `localadmin` | 35 | 79 |
| `locality` | 30 | 79 |
| `borough` | 20 | 79 |
| `macrohood` | 15 | 79 |
| `neighborhood` | 10 | 79 |
| `microhood` | 5 | 79 |

Countries, dependencies and regions share the 80-to-100 range and everything below them tops out at 79, so the weakest region still outranks the densest city. That's what lets the overview band be a plain importance cut. The constants (10, 18, 20) and the floors and ceilings are producer parameters, not protocol; another gazetteer could pick differently.

## Containment levels

Each `relations.within` entry carries a division's Overture `subtype` as its `type`. The wire defines no vocabulary of its own, because administrative names and their nesting aren't universal. The *order* of the list carries the nesting: broadest first.

Garganorn orders by an internal level derived from the subtype alone, ties broken by id. Overture's own `admin_level` isn't used: in practice it's 96% NULL and ambiguous even within one subtype. The level is not emitted.

| Level | Subtype |
|------:|---------|
| 10 | `country` |
| 15 | `dependency` |
| 25 | `region` |
| 35 | `county` |
| 45 | `localadmin` |
| 50 | `locality` |
| 55 | `borough` |
| 60 | `macrohood` |
| 65 | `neighborhood` |
| 70 | `microhood` |

There's no level 0; continents are never emitted. `borough` is mapped but currently unpopulated, since Overture's present division data has none. A subtype outside this table fails the build, so no record ever carries an out-of-vocabulary type. Another producer may use a different vocabulary and order, so read `containmentTypes` from the tileset descriptor rather than assuming this table.

## Plain-HTTP routes

Some things are plain GETs:

| Route | Returns |
|-------|---------|
| `GET /tiles/{slug}/...` | A tile, as plain JSON. The URLs `getTiles` returns point here when the tileset's configured base URL does |
| `GET /tilesets/{slug}` | The same document as `describeTileset` |
| `GET /{dataset}/{collection}/{id}` | The same document as `getPlace` for `urn:atgeo:{dataset}:{collection}:{id}`. The first segment must contain a dot, since a dataset is a domain |
| `GET /{nsid}` | The lexicon document for that NSID |
| `GET /.well-known/did.json` | The server's DID document |
| `GET /health` | `{"status": "ok", "service": "garganorn"}` |

The DID document's `id` is the same `did:web` as `describeService`'s `did`. It advertises the tile service and nothing else; there's no personal data server behind this.

## Errors

**Over XRPC, every error is HTTP 400** with a body of `{"error": name, "message": text}`, per the AT Protocol convention. Branch on the `error` name, not the status: `PlaceNotFound` is a 400 here, not a 404. The XRPC layer adds a few errors no lexicon lists:

| Error | Status | When |
|-------|--------|------|
| `InvalidRequest` | 400 | A required parameter is missing, a parameter doesn't fit its lexicon, the NSID is malformed, or a request body isn't valid JSON |
| `UnsupportedMediaType` | 415 | A request body with a non-JSON `Content-Type` |
| `MethodNotAllowed` | 405 | An HTTP method the route doesn't take, with an `Allow` header |
| `MethodNotImplemented` | 501 | The NSID isn't one of the four methods the server implements, which includes every `com.atproto.*` method and a record lexicon such as `org.atgeo.place` |

**On the plain routes, a miss is HTTP 404** with a JSON body, never an HTML page (the spec's rule; see the note under [Headers](#headers-caching-and-cors) on where the live server still lags):

| Route | Miss | Error |
|-------|------|-------|
| `/{dataset}/{collection}/{id}` | Place not served, or a first segment with no dot | `PlaceNotFound` |
| `/tilesets/{slug}` | Unknown slug | `TilesetNotFound` |
| `/tiles/{slug}/...` | Unknown slug | `TilesetNotFound` |
| `/tiles/{slug}/...` | No such tile (including a path that doesn't end in `.json`, such as the on-disk `.json.gz` name, or tries to leave the tiles directory) | `TileNotFound` |
| `/{nsid}` | An NSID-shaped name that isn't a served lexicon | `LexiconNotFound` |
| anything else | No route matches, such as `/favicon.ico` or `/xrpc` | `NotFound` |

A wrong HTTP method on any route is 405 `MethodNotAllowed`. A 5xx is `InternalServerError` or the like, with a generic message; the details go to the server's log. A 5xx means the server broke, not that it refused you.

The status differs from XRPC on purpose: XRPC follows the AT Protocol's 400-for-everything, and a plain GET at an address that holds nothing is the ordinary web 404. The same split applies to a malformed identity: the `/{dataset}/{collection}/{id}` route answers a malformed URN with 404 `PlaceNotFound`, while `getPlace` answers a `uri` that isn't a URI at all with 400 `InvalidRequest`.

## Headers, caching and CORS

| Response | `Cache-Control` |
|----------|-----------------|
| A tile (`/tiles/{slug}/...`) | `public, max-age=604800, immutable` |
| `getTiles`, 200 only | `public, max-age=3600` |
| `describeService`, 200 only | `public, max-age=3600` |
| Anything else | None set |

(A CORS preflight `OPTIONS` to `getTiles` or `describeService` is a 200 and carries the hour as well.)

Tile URLs are immutable, so tiles get a week. `getTiles` and `describeService` change when a new build lands, so they get an hour, and a client learns of a new build within an hour of asking.

Every response, errors and tiles included, carries `Access-Control-Allow-Origin: *`, so browser pages on any origin can read it. Every response also carries `X-Content-Type-Options: nosniff`, since error messages can echo the request path and a browser shouldn't be allowed to guess that one is HTML. (The live server is a little behind the spec on that last one, and a plain-HTTP 404 may still be an HTML page.)

## Licensing

Each collection's licences and attribution page are in its `attribution` entry, in every tile and in its descriptor. Garganorn publishes:

| Collection | Licences | Attribution page |
|------------|----------|------------------|
| `(openstreetmap.org, node \| way \| relation)` | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright) |
| `(overturemaps.org, place)` | [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/), [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode) | [Overture attribution](https://docs.overturemaps.org/attribution/) |
| `(overturemaps.org, division)` | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) | [Overture attribution](https://docs.overturemaps.org/attribution/) |

The tile's `attribution` array is where the notices live. A licence's duties attach to conveying the dataset, not to a lone record, so a place copied out of a tile keeps its `origin` (whose dataset segment names the source) and carries no licence link; whoever copies it is the one conveying it. That's a design position, not legal advice.

## Use an SDK

Everything above is the wire contract. You probably want a [client SDK](/sdk/) instead: it snaps your box, fetches and merges the tiles, dedupes, matches and ranks, and handles the overview and the failures. The [spec](https://github.com/schuyler/garganorn/blob/main/docs/atgeo-spec.md) remains the normative source for all of it.
