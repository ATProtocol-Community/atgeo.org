---
layout: base.njk
title: "Data Model"
---

# Data Model

The Place schema is ATGeo's core data structure for representing geographic points of interest in the ATProtocol ecosystem.

## Example

The following JSON example (from the Foursquare collection):

```json
{
  "$type": "org.atgeo.place",
  "collection": "org.atgeo.places.foursquare",
  "rkey": "4460d38bf964a5200a331fe3",
  "name": "Alamo Square",
  "variants": [],
  "locations": [
    {
      "$type": "community.lexicon.location.geo",
      "latitude": "37.776146",
      "longitude": "-122.433898"
    },
    {
      "$type": "community.lexicon.location.address",
      "country": "US",
      "locality": "San Francisco",
      "postalCode": "94117",
      "region": "CA",
      "street": "Steiner St"
    }
  ],
  "attributes": {
    "fsq_place_id": "4460d38bf964a5200a331fe3",
    "fsq_category_ids": [
      "4bf58dd8d48988d163941735",
      "4bf58dd8d48988d1e7941735",
      "4bf58dd8d48988d1e5941735"
    ],
    "fsq_category_labels": [
      "Landmarks and Outdoors > Park",
      "Landmarks and Outdoors > Park > Playground",
      "Landmarks and Outdoors > Park > Dog Park"
    ],
    "tel": "(415) 831-2700",
    "website": "http://sfrecpark.org/alamo-square",
    "date_created": "2006-05-09",
    "date_refreshed": "2025-09-07"
  }
}
```

## Field reference

### `$type`

Always `"org.atgeo.place"`. Identifies the record as an ATGeo Place.

### `collection`

The source collection this record belongs to (e.g., `org.atgeo.places.foursquare`, `org.atgeo.places.overture`). Determines which attributes are present and how they should be interpreted.

### `rkey`

A unique record key within the collection. For reference data, this is typically the identifier from the original dataset. The combination of `collection` and `rkey` forms a globally unique identifier for the place.

### `name`

The primary name of the place (string).

### `variants`

An array of alternate names or spellings for the place. May be empty.

### `locations`

Array of location objects, each identified by a `$type` field. A place record can contain multiple location representations simultaneously.

#### `community.lexicon.location.geo`

Geographic coordinates.
- `latitude` (string) — Decimal latitude.
- `longitude` (string) — Decimal longitude.

#### `community.lexicon.location.address`

Postal address.
- `country` (string) — ISO 3166-1 alpha-2 country code.
- `locality` (string) — City or town.
- `postalCode` (string) — Postal or ZIP code.
- `region` (string) — State, province, or region code.
- `street` (string) — Street address.

### `attributes`

An object containing source-specific fields. The structure varies by `collection`. See the data source pages for details:
- [Foursquare](/foursquare/)
- [Overture](/overture/)
- [OSM](/osm/)
