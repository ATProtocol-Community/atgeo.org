---
layout: base.njk
title: "Overture Places"
---

# Overture Places

The [Overture Maps](https://overturemaps.org/) places theme is a monthly-published merge of several upstream datasets into businesses, landmarks and other points of interest (tens of millions worldwide; the live build has about 7.7 million so far, because it only covers the eastern part of North America). places.atgeo.org serves it as a collection.

| | |
|---|---|
| Dataset | `overturemaps.org` |
| Collection | `place` |
| Tileset slug | `overture-place` |
| Locations | a `geo` point, plus an `address` when Overture has one |
| Licences | [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/), [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode) |
| Attribution | [Overture attribution](https://docs.overturemaps.org/attribution/) |

The tile and the tileset descriptor both say which Overture release they were built from (`release`, e.g. `2026-08-19.0`).

## Identity

The `origin` is `urn:atgeo:overturemaps.org:place:{id}`, where the id is Overture's [GERS](https://docs.overturemaps.org/gers/) id.

One caveat: upstream ids are only as stable as the upstream makes them. Overture replaced every GERS id in release `2025-06-25.0`, so an id you saved before that date won't resolve against current data. If you've stored old ids, they're now just strings.

## Attributes

`attributes` carries Overture's own fields, passed through. Fields that Overture doesn't have for a place are left out, so don't assume any of these exist. What the live server sends today:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | The GERS id again |
| `names` | object | `primary`, plus `common` (language to name) and `rules`, which are `null` when there's nothing there |
| `categories` | object | `primary` (e.g. `nutritionist`), and `alternate`, a list |
| `brand` | object | `names` and `wikidata`, mostly nulls for independents |
| `confidence` | string | Overture's confidence that the place exists, 0 to 1, as a decimal string (`"0.920"`) |
| `websites`, `socials`, `emails`, `phones` | string[] | Contact details |
| `version` | integer | The record's version in Overture |
| `sources` | object[] | Where each piece of the record came from |

Numbers with fractions are strings because the AT Protocol data model has no floats (see the [FAQ](/faq/)). Integers like `version` stay integers.

Each `sources` entry names the upstream `dataset` (live records show, among others, `meta`, `Microsoft`, `Foursquare`, `BrightQuery`, `AllThePlaces`, and Overture's own `Overture` and `Overture-signals`), the `record_id` in that dataset, the `property` it supplied, its `license`, `update_time`, `confidence`, and a few more provenance fields (`provider`, `resource`, `version`, `between`). Overture is a merge, and this is where it tells you what it merged. Foursquare is one of Overture's contributors; ATGeo itself no longer serves Foursquare directly.

The `categories` values in the tileset descriptor are Overture's primary categories, such as `restaurant` or `beauty_salon`, with counts.

## Addresses

When Overture has an address, the place gets a second location, `community.lexicon.location.address`, alongside the point: `country`, `region`, `locality`, `street` and `postalCode`. Every place here has the point; the address is there when Overture has one. Look at `$type` rather than position.

## Variants

`variants` come from Overture's multilingual `names.common` and its rule-based names (short, official and so on). Many places have none.

## Containment and importance

`relations.within` lists the [Overture Divisions](/divisions/) containing the place, broadest first. `importance` (0 to 100) is computed per tileset from how busy the surroundings are and how rare the category is, and it only means something relative to other `overture-place` records. It rides beside the record in a tile, not inside it. The [API page](/api/) has the formula.

## Example

A real record from a live tile in Center City, Philadelphia (trimmed):

```json
{
  "value": {
    "$type": "org.atgeo.place",
    "origin": "urn:atgeo:overturemaps.org:place:012a5d0a-e233-447f-99e8-7d835ca61296",
    "name": "Hleap Nutrition",
    "locations": [
      {
        "$type": "community.lexicon.location.geo",
        "latitude": "39.955658",
        "longitude": "-75.169613"
      },
      {
        "$type": "community.lexicon.location.address",
        "country": "US",
        "region": "PA",
        "locality": "Philadelphia",
        "street": "100 N 18th St suite 300",
        "postalCode": "19103"
      }
    ],
    "variants": [],
    "attributes": {
      "id": "012a5d0a-e233-447f-99e8-7d835ca61296",
      "names": { "primary": "Hleap Nutrition", "common": null, "rules": null },
      "categories": {
        "primary": "nutritionist",
        "alternate": ["naturopathic_holistic", "health_and_medical"]
      },
      "websites": ["https://www.hleapnutrition.com"],
      "phones": ["+12158218705"],
      "brand": { "wikidata": null, "names": { "primary": null, "common": null, "rules": null } },
      "confidence": "0.920",
      "version": 9,
      "sources": [
        {
          "dataset": "meta",
          "license": "CDLA-Permissive-2.0",
          "record_id": "112831242678436",
          "update_time": "2026-08-10T00:00:00.000Z",
          ...
        },
        ...
      ]
    },
    "relations": {
      "within": [
        { "uri": "urn:atgeo:overturemaps.org:division:f39eb4af-5206-481b-b19e-bd784ded3f05", "name": "United States", "type": "country" },
        ...
      ]
    }
  },
  "importance": 60
}
```

(The `...` marks trimmed content; the real record is valid JSON without them. `socials` and `emails` were also dropped from the example.)
