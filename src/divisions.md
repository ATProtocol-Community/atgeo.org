---
layout: base.njk
title: "Overture Divisions"
---

# Overture Divisions

Divisions are the administrative areas from [Overture Maps](https://overturemaps.org/): countries, regions, counties, cities, neighborhoods. In ATGeo they do two jobs. They're places you can look up, and they're what [`relations.within`](/place/#within) points at when a record needs to say "what city is this in".

| | |
|---|---|
| Dataset | `overturemaps.org` |
| Collection | `division` |
| Tileset slug | `overture-division` |
| Location | a `community.lexicon.location.bbox` only |
| Licences | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) |
| Attribution | [Overture attribution](https://docs.overturemaps.org/attribution/) |

The `origin` is `urn:atgeo:overturemaps.org:division:{id}`, with Overture's GERS id (and the same caveat as [places](/overture/): Overture replaced all of its ids in release `2025-06-25.0`).

## Location

A division has a bounding box, not a point and not a polygon: `north`, `south`, `east`, `west`, as decimal strings. A box whose `west` is greater than its `east` crosses the antimeridian. The box is not the shape; a bounding box over a crescent-shaped city includes plenty of territory that isn't the city. Don't use it for point-in-polygon tests.

## Attributes

| Key | Notes |
|-----|-------|
| `subtype` | `country`, `dependency`, `region`, `county`, `localadmin`, `locality`, `macrohood`, `neighborhood`, `microhood` (`borough` is mapped but Overture has none right now) |
| `country` | ISO 3166-1 alpha-2 code |
| `region` | ISO 3166-2 code, e.g. `US-PA` |
| `wikidata` | Wikidata item id, when Overture has one |
| `population` | Always present. `0` means no population was recorded, not that nobody lives there |

`country`, `region` and `wikidata` are left out when the source doesn't have them. Names in other languages arrive as `variants`.

## Importance

Importance is 0 to 100, relative to other divisions. For most divisions it comes from population alone:

    importance = round(40 · min(ln(1 + population) / 20, 1))

so everything but a locality tops out at 40. A locality also gets the same "how busy are the surroundings" term that places use, so it can reach 100. The constants are the reference producer's choices, not protocol.

## Containment levels

`relations.within` on any record lists divisions **broadest first**: the order is the nesting, so you can take the last entry as the most specific and the first as the broadest. The wire carries each division's `subtype` as `type` and no numeric level. The gazetteer sorts by a level it derives from the subtype:

| level | subtype |
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

The numbers aren't emitted; they're just the sort order, spaced out so there's room to insert. Overture's own `admin_level` isn't used, since it's mostly empty and ambiguous within a subtype. Each collection's descriptor lists the types its records actually use as `containmentTypes`; read that rather than hardcoding this table. A different gazetteer could use a different vocabulary.

## The overview band

When a request covers too much ground for ordinary tiles, the server answers with a coarse sample instead (see the [API](/api/)). For divisions that sample holds the most important ones, and also every `country`, `region` and `dependency`, because an importance cut alone would be all cities.

## Example

Center City, a macrohood in Philadelphia, from a live tile (trimmed):

```json
{
  "value": {
    "$type": "org.atgeo.place",
    "origin": "urn:atgeo:overturemaps.org:division:407ce93b-dadf-49eb-b25b-6942e077c089",
    "name": "Center City",
    "locations": [
      {
        "$type": "community.lexicon.location.bbox",
        "north": "39.960094",
        "south": "39.939913",
        "east": "-75.133937",
        "west": "-75.187627"
      }
    ],
    "variants": [
      { "name": "Downtown Philadelphia", "type": "alternate", "language": "en" }
    ],
    "attributes": {
      "subtype": "macrohood",
      "country": "US",
      "region": "US-PA",
      "wikidata": "Q2739353",
      "population": 173284
    },
    "relations": {
      "within": [
        { "uri": "urn:atgeo:overturemaps.org:division:f39eb4af-5206-481b-b19e-bd784ded3f05", "name": "United States", "type": "country" },
        { "uri": "urn:atgeo:overturemaps.org:division:9b885f43-e59d-4249-b114-4d8853d66bfb", "name": "Pennsylvania", "type": "region" },
        { "uri": "urn:atgeo:overturemaps.org:division:1a04f6e5-dd95-4e67-b25d-777814f7c93f", "name": "Philadelphia County", "type": "county" },
        { "uri": "urn:atgeo:overturemaps.org:division:10ddec2b-285d-477a-a39b-bb3209735f9b", "name": "Philadelphia", "type": "locality" }
      ]
    }
  },
  "importance": 24
}
```

Divisions are polygons, so one division is referenced from every tile it overlaps. Deduplicate by `origin` when you merge tiles (the [client SDKs](/sdk/) do this for you).
