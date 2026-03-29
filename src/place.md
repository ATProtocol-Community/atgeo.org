---
layout: base.njk
title: "Lexicon"
---

# Lexicon

The `place` lexicon is ATGeo's core data structure for representing geographic places in the ATProtocol ecosystem.

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

An array of alternate names for the place. Each variant has the following fields:

- `name` (string, required) — The variant name text.
- `type` (string, optional) — The kind of variant: `official`, `alternate`, `short`, or `colloquial`.
- `language` (string, optional) — The language of the name, as a language code.

May be empty.

### `locations`

Array of location objects, each identified by a `$type` field. A place record can contain multiple location representations simultaneously.

#### `community.lexicon.location.geo`

Geographic coordinates.
- `latitude` (string) — Decimal latitude.
- `longitude` (string) — Decimal longitude.

#### `community.lexicon.location.hthree`

An [H3](https://h3geo.org/) hexagonal grid cell.
- `value` (string) — The H3-encoded cell index.
- `name` (string, optional) — A name for the location.

#### `community.lexicon.location.address`

Postal address.
- `country` (string) — ISO 3166-1 alpha-2 country code.
- `locality` (string) — City or town.
- `postalCode` (string) — Postal or ZIP code.
- `region` (string) — State, province, or region code.
- `street` (string) — Street address.

#### `community.lexicon.location.bbox`

A bounding box.
- `west` (string) — Western longitude.
- `south` (string) — Southern latitude.
- `east` (string) — Eastern longitude.
- `north` (string) — Northern latitude.

### `attributes`

An object containing source-specific fields. The structure varies by `collection`. See the data source pages for details:
- [Foursquare](/foursquare/)
- [Overture](/overture/)
- [OSM](/osm/)

### `relations`

An object describing relationships to other place records. Contains two optional arrays:

#### `within`

Administrative regions that geographically contain this place, ordered by level ascending. Each entry has:

- `rkey` (string) — Collection-qualified record key (e.g. `org.atgeo.places.wof:85922583`).
- `name` (string, optional) — Display name of the containing region.
- `level` (integer, optional) — Administrative hierarchy level (0 = continent, 10 = country, 25 = region, 50 = locality).

#### `same_as`

Records in other collections or datasets that represent the same place. Each entry has the same fields as `within`.
