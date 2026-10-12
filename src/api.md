---
layout: base.njk
title: "XRPC API"
---

# XRPC API

{% queryDemo %}

The ATGeo gazetteer provides an XRPC API for finding the map tiles that cover a region, and for retrieving individual geographic points of interest.

## Endpoint

Base URL: `https://places.atgeo.org/xrpc`

The `org.atgeo` query lexicon is implemented in [Garganorn](https://github.com/schuyler/garganorn). The public endpoint is hosted with the generous support of the [AT Protocol Community Fund](https://atprotocol.dev/community-fund/).

## Lexicon

`goat lex resolve org.atgeo.place` will retrieve the `place` lexicon. You can also fetch the [latest version](https://places.atgeo.org/org.atgeo.place) from the API service itself.

## Methods

### `org.atgeo.getCoverage`

Full URL: `https://places.atgeo.org/xrpc/org.atgeo.getCoverage`

Returns the URLs of the [tiles](#tiles) that cover a bounding box. There is no text search parameter, on purpose: the server never learns what you're looking for. See [Searching](#searching).

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Source collection (e.g., `org.atgeo.places.osm`, `org.atgeo.places.overture.place`) |
| `bbox` | string | Yes | Bounding box as `west,south,east,north` in WGS84 decimal degrees |

Each `bbox` coordinate may carry at most two decimal places, which is a 0.01° grid, or about 1.1 km at the equator. The service rejects finer coordinates rather than quietly rounding them, so a client that leaks precision hears about it. The check is textual: `37.770` fails on its trailing zero. Snap your box outward to the grid before sending it, and keep the original box around for filtering the results.

The point of the grid is that the server can only learn which neighborhood you're looking at, not which block you're standing on.

#### Response

```json
{
  "tiles": [
    "https://places.atgeo.org/tiles/osm/20260820T215239/02/02.json.gz"
  ]
}
```

`tiles` is a sorted list of complete, opaque tile URLs. Fetch them all and merge the records; filtering and ordering are up to you. Responses are cacheable for one hour (`Cache-Control: public, max-age=3600`), which is how long it takes a client to notice a new data release.

A box can cross the antimeridian: `west > 0 > east` means it wraps across ±180°.

#### Errors

Errors come back with a non-200 status and a body like `{"error": "BboxTooPrecise", "message": "..."}`.

| Error | Description |
|-------|-------------|
| `BboxTooPrecise` | A bbox coordinate has more than two decimal places |
| `InvalidBbox` | The bbox must be four comma-separated numbers with west < east and south < north (unless it crosses the antimeridian) |
| `CollectionNotFound` | The collection is unknown or not currently served |
| `BboxTooLarge` | The box covers more than 50 tiles (the default limit); ask for a smaller region |

---

### `com.atproto.repo.getRecord`

Full URL: `https://places.atgeo.org/xrpc/com.atproto.repo.getRecord`

Get a single record from the gazetteer. Does not require authentication.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo` | string | Yes | The handle or DID of the repository (e.g. `places.atgeo.org`) |
| `collection` | string | Yes | The NSID of the record collection (e.g. `org.atgeo.places.overture.place`) |
| `rkey` | string | Yes | The record key |
| `cid` | string | No | The CID of a specific version of the record |

#### Response

The `_query` field is a server diagnostic and is not defined in the lexicon.

```json
{
  "_query": {
    "elapsed_ms": 237,
    "parameters": { ... }
  },
  "importance": 53,
  "license": "https://docs.overturemaps.org/attribution/",
  "source": "https://overturemaps.org/",
  "uri": "https://places.atgeo.org/org.atgeo.places.overture.place/00640064-05db-499a-92ed-1b65751d2d04",
  "value": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `uri` | string | The canonical URI for the record |
| `source` | string | URL of the upstream dataset |
| `license` | string | URL of the upstream dataset's license |
| `importance` | integer | 0-100 ranking score, relative to other places in the same collection. Present when the record has one; it is lifted out of `value` into the response |
| `value` | object | The place record (see [Data Model](/place/)) |

No `cid` is returned, not even as `null`.

#### Errors

| Error | Description |
|-------|-------------|
| `RecordNotFound` | No record exists with the given collection and rkey |
| `CollectionNotFound` | The specified collection does not exist on the server |

## Record URIs

Record URIs returned by the API (e.g. `https://places.atgeo.org/org.atgeo.places.overture.place/00640064-05db-499a-92ed-1b65751d2d04`) are direct references to the resource. A GET request to a record URI returns the bare `org.atgeo.place` record without the XRPC response envelope:

```json
{
    "$type": "org.atgeo.place",
    "name": "Farallon Medical Alliance, Llc.",
    "rkey": "00640064-05db-499a-92ed-1b65751d2d04",
    "locations": [ ... ],
    "attributes": { ... }
}
```

These URIs follow the pattern `https://{host}/{collection}/{rkey}`.

## Tiles

A tile is a JSON file holding the place records for one quadkey cell. Tiles come in different sizes, from zoom 6 to zoom 17: a record lands in the coarsest tile that holds no more than 1,000 records, so dense areas get small tiles and sparse areas get big ones. A zoomed-out box may therefore return a single coarse tile. Don't assume any particular zoom.

**Tile URLs are opaque.** Don't construct them; get them from `getCoverage`. A tile URL is immutable, so tiles are served with `Cache-Control: public, max-age=604800, immutable`: cache them for a week and never revalidate. When a new data release is published the URLs change completely, so ask `getCoverage` again instead of remembering URLs. Old releases are eventually retired, and a hoarded URL will in time return 404.

**Transport.** Tiles are `application/json`, compressed according to your `Accept-Encoding` (your HTTP library probably handles this for you). They carry `Access-Control-Allow-Origin: *`, so browser pages on any origin can fetch them. So can `getCoverage` responses.

**Deduplicate by `rkey`.** When you merge records from more than one tile in the same collection, dedupe by `rkey`. Most collections currently put each record in exactly one tile, but that's a property of the current build, not a promise.

### Payload

A tile is one JSON object:

| Key | Description |
|-----|-------------|
| `collection` | The collection the tile belongs to |
| `source` | URL of the upstream dataset |
| `license` | URL of the upstream dataset's license |
| `generated_at` | When the data release was generated (RFC 3339, UTC). Every tile in a release has the same value |
| `records` | Array of records |

Each element of `records` is `{"uri", "cid", "value"}`. The `uri` is a [record URI](#record-uris), `cid` is currently `null`, and `value` is an `org.atgeo.place` record as described in the [Data Model](/place/), with `name`, `importance`, `locations`, `variants`, `attributes` and `relations`. For example, from an Overture tile (`attributes` and `relations` elided):

```json
{
  "uri": "https://places.atgeo.org/org.atgeo.places.overture.place/00640064-05db-499a-92ed-1b65751d2d04",
  "cid": null,
  "value": {
    "$type": "org.atgeo.place",
    "rkey": "00640064-05db-499a-92ed-1b65751d2d04",
    "name": "Farallon Medical Alliance, Llc.",
    "importance": 53,
    "locations": [
      {
        "$type": "community.lexicon.location.geo",
        "latitude": "37.781157",
        "longitude": "-122.421387"
      },
      { "$type": "community.lexicon.location.address", ... }
    ],
    "variants": [],
    "attributes": { ... },
    "relations": { ... }
  }
}
```

Coordinates are strings; see the [FAQ](/faq/) for why. Ignore keys you don't recognize: new ones may appear, and existing ones keep their meaning.

## Searching

There is no server-side text search. The server can't rank results it never sees a query for, and it shouldn't see the query in the first place. Instead, a client asks `getCoverage` for the tiles covering the region it cares about, fetches them, and matches names locally.

The [map demo](/) on the home page does exactly this:

1. Snap the viewport outward to the 0.01° grid and call `getCoverage`.
2. Fetch the tiles, merge the records, dedupe by `rkey`, and drop anything outside the original viewport.
3. Normalize the query and each name (Unicode NFKD, strip combining marks, case fold, collapse whitespace) and compare it against the record's `name` and each of its `variants`.
4. Match in tiers: exact, prefix, token-prefix (every query token is a prefix of some name token), then substring. No fuzziness, so typos won't match.
5. Rank by tier, then `importance` (higher first), then distance from the center of the viewport, then `uri`. With an empty query, rank by `importance` and then distance.

The limits come from the tile budget. In a dense city, 50 tiles covers a modest area, so a wide search gets `BboxTooLarge` and the answer is to zoom in.

The matching and ranking rules are specified in the [Garganorn client SDK notes](https://github.com/schuyler/garganorn/blob/main/docs/atgeo-client-sdk.md). The tile format is specified in the [ATGeo spec](https://github.com/schuyler/garganorn/blob/main/docs/atgeo-spec.md).
