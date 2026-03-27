---
layout: base.njk
title: "Query API"
---

# Query API

{% queryDemo %}

The ATGeo gazetteer provides an XRPC endpoint for searching geographic points of interest.

## Endpoint

Base URL: `https://places.atgeo.org/xrpc`

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

At least one of `latitude`/`longitude` or `q` should be provided.

#### Response

The response contains a `_query` object with request metadata and a `records` array:

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
      "uri": "https://gazetteer.social/org.atgeo.places.foursquare/4460d38bf964a5200a331fe3",
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
| `value` | object | The place record itself (see [Data Model](/place/)) |

