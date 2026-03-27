---
layout: base.njk
title: "Overture"
---

# Overture

Collection: `org.atgeo.places.overture`

ATGeo imports points of interest from the [Overture Maps](https://docs.overturemaps.org/) places dataset, an open data project providing freely available global map data. The places theme is licensed under the [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/) license. See the Overture [attribution documentation](https://docs.overturemaps.org/attribution/) for details.

## Example record

```json
{
  "$type": "org.atgeo.place",
  "collection": "org.atgeo.places.overture",
  "rkey": "ef44c6c0-470d-4cfd-929e-54d64775dfd7",
  "name": "CoffeeShop",
  "variants": [],
  "locations": [
    {
      "$type": "community.lexicon.location.geo",
      "latitude": "37.747057",
      "longitude": "-122.418816"
    },
    {
      "$type": "community.lexicon.location.address",
      "country": "US",
      "locality": "San Francisco",
      "postalCode": "94110-4503",
      "region": "CA",
      "street": "3139 Mission St"
    }
  ],
  "attributes": {
    "id": "ef44c6c0-470d-4cfd-929e-54d64775dfd7",
    "categories": {
      "primary": "coffee_shop",
      "alternate": ["cafe", "bakery"]
    },
    "names": {
      "primary": "CoffeeShop",
      "common": null,
      "rules": null
    },
    "brand": {
      "names": {
        "primary": null,
        "common": null,
        "rules": null
      },
      "wikidata": null
    },
    "confidence": "0.982",
    "phones": ["+14153683802"],
    "emails": ["w@subscribecoffeeshop.com"],
    "websites": ["http://www.subscribecoffeeshop.com/"],
    "socials": ["https://www.facebook.com/269421059827722"],
    "sources": [
      {
        "dataset": "meta",
        "record_id": "269421059827722",
        "confidence": 0.939,
        "license": "CDLA-Permissive-2.0",
        "property": "",
        "update_time": "2026-03-09T00:00:00.000Z"
      }
    ],
    "version": 7
  }
}
```

## Attributes

The following fields appear in the `attributes` object of Overture place records:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Overture's unique place identifier |
| `categories` | object | Place categories (see below) |
| `names` | object | Overture name variants (see below) |
| `brand` | object | Brand information: `names` (with `primary`, `common`, `rules`) and `wikidata` ID |
| `confidence` | string | Overture's confidence score for the record (0–1) |
| `phones` | string[] | Phone numbers |
| `emails` | string[] | Email addresses |
| `websites` | string[] | Website URLs |
| `socials` | string[] | Social media profile URLs |
| `sources` | object[] | Provenance information (see below) |
| `version` | integer | Record version number |

### `categories`

| Field | Type | Description |
|-------|------|-------------|
| `primary` | string | Primary category (e.g., `"coffee_shop"`, `"community_services_non_profits"`) |
| `alternate` | string[] | Additional categories (e.g., `["cafe", "bakery"]`) |

### `names`

| Field | Type | Description |
|-------|------|-------------|
| `primary` | string | Primary name in the Overture dataset |
| `common` | object | Common name translations (may be null) |
| `rules` | object | Name rules/variants (may be null) |

Note: The top-level `name` field in the Place record holds the primary name. The `attributes.names` object contains Overture's own name metadata.

### `sources`

Each entry in the `sources` array describes where the data came from:

| Field | Type | Description |
|-------|------|-------------|
| `dataset` | string | Source dataset (e.g., `"meta"`, `"Overture"`) |
| `record_id` | string | ID in the source dataset |
| `confidence` | number | Source-level confidence score |
| `license` | string | Data license (e.g., `"CDLA-Permissive-2.0"`) |
| `property` | string | Which property this source applies to |
| `update_time` | string | When the source data was last updated (ISO 8601) |
