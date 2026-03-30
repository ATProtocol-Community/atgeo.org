---
layout: base.njk
title: "XRPC API"
---

# XRPC API

{% queryDemo %}

The ATGeo gazetteer provides an XRPC API for searching and retrieving geographic points of interest.

## Endpoint

Base URL: `https://places.atgeo.org/xrpc`

The `org.atgeo` query lexicon is implemented in [Garganorn](https://github.com/schuyler/garganorn). The public endpoint is hosted with the generous support of the [AT Protocol Community Fund](https://atprotocol.dev/community-fund/).

## Lexicon

`goat lex resolve org.atgeo.place` will retrieve the `place` lexicon. You can also fetch the [latest version](https://places.atgeo.org/org.atgeo.place) from the API service itself.

## Methods

### `org.atgeo.searchRecords`

Full URL: `https://places.atgeo.org/xrpc/org.atgeo.searchRecords`

Search for places by location and/or text query.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | Yes | Source collection to search (e.g., `org.atgeo.places.foursquare`, `org.atgeo.places.overture`) |
| `latitude` | number | No | Latitude of the search center |
| `longitude` | number | No | Longitude of the search center |
| `q` | string | No | Text search query (place name, address, etc.) |
| `limit` | integer | No | Maximum number of results to return |
| `bbox` | string | No | Bounding box as `west,south,east,north` in WGS84 decimal degrees |
| `cursor` | string | No | Pagination cursor from a previous response |

At least one of `latitude`/`longitude`, `bbox`, or `q` must be provided.

#### Response

The response contains a `_query` object with request metadata and a `records` array:

The `_query` field is a server diagnostic and is not defined in the lexicon.

```json
{
  "_query": {
    "elapsed_ms": 94,
    "parameters": { ... }
  },
  "records": [
    {
      "$type": "org.atgeo.searchRecords#record",
      "distance_m": 14,
      "uri": "https://places.atgeo.org/org.atgeo.places.foursquare/4460d38bf964a5200a331fe3",
      "value": { ... }
    }
  ]
}
```

Each record in the `records` array contains:

| Field | Type | Description |
|-------|------|-------------|
| `$type` | string | Always `"org.atgeo.searchRecords#record"` |
| `distance_m` | number | Distance in meters from the search center (when lat/lon provided) |
| `uri` | string | Canonical URI for the place record |
| `cid` | string | Content hash of the record (defined in the lexicon but not currently returned by the server) |
| `value` | object | The place record itself (see [Data Model](/place/)) |

A `cursor` string may also be present for paginating through additional results.

#### Errors

| Error | Description |
|-------|-------------|
| `InvalidQuery` | Either `q`, `bbox`, or `latitude`/`longitude` must be provided |
| `InvalidBbox` | The bbox parameter must be four comma-separated numbers with xmin < xmax and ymin < ymax |
| `InvalidCoordinates` | Latitude and/or longitude coordinates are invalid |
| `InvalidLimit` | The limit parameter must be a positive integer |
| `InvalidCursor` | The cursor parameter is invalid or expired |
| `CollectionNotFound` | The specified collection does not exist on the server |

---

### `com.atproto.repo.getRecord`

Full URL: `https://places.atgeo.org/xrpc/com.atproto.repo.getRecord`

Get a single record from the gazetteer. Does not require authentication.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo` | string | Yes | The handle or DID of the repository (e.g. `places.atgeo.org`) |
| `collection` | string | Yes | The NSID of the record collection (e.g. `org.atgeo.places.foursquare`) |
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
  "uri": "https://places.atgeo.org/org.atgeo.places.foursquare/4460d38bf964a5200a331fe3",
  "value": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `uri` | string | The canonical URI for the record |
| `cid` | string | Content hash of the record (defined in the lexicon but not currently returned) |
| `value` | object | The place record (see [Data Model](/place/)) |

#### Errors

| Error | Description |
|-------|-------------|
| `RecordNotFound` | No record exists with the given collection and rkey |
| `CollectionNotFound` | The specified collection does not exist on the server |

## Record URIs

Record URIs returned by the API (e.g. `https://places.atgeo.org/org.atgeo.places.foursquare/4460d38bf964a5200a331fe3`) are direct references to the resource. A GET request to a record URI returns the bare `org.atgeo.place` record without the XRPC response envelope:

```json
{
    "$type": "org.atgeo.place",
    "name": "Alamo Square",
    "collection": "org.atgeo.places.foursquare",
    "rkey": "4460d38bf964a5200a331fe3",
    "locations": [ ... ],
    "attributes": { ... }
}
```

These URIs follow the pattern `https://{host}/{collection}/{rkey}`.

