---
layout: base.njk
title: "OpenStreetMap"
---

# OpenStreetMap

[OpenStreetMap](https://www.openstreetmap.org/) (OSM) is the collaborative world map, and places.atgeo.org serves the named points of interest from it.

| | |
|---|---|
| Dataset | `openstreetmap.org` |
| Collections | `node`, `way`, `relation` |
| Tileset slug | `osm` |
| Location | a `community.lexicon.location.geo` point |
| Licence | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Attribution | [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright) |

## Identity

An OSM place's `origin` is a [URN](/place/): `urn:atgeo:openstreetmap.org:{collection}:{id}`, where the collection is the OSM element type and the id is the OSM element id.

```
urn:atgeo:openstreetmap.org:node:10076153317
urn:atgeo:openstreetmap.org:way:1099888891
```

To get to the element on openstreetmap.org, put the collection and id in the path: [openstreetmap.org/node/10076153317](https://www.openstreetmap.org/node/10076153317). To get the ATGeo record, `getPlace` takes the URN, or you can fetch `https://places.atgeo.org/openstreetmap.org/node/10076153317` over plain HTTP. See the [API](/api/).

## Ways and relations are points too

A `way` or `relation` is a polygon or a line in OSM. Here it's a point: the gazetteer reduces it to a single `geo` location. There's no geometry in the record. If you need the outline, follow the `origin` back to OSM. (This is why a park or a building shows up as a pin and not a shape.)

## Attributes

`attributes` is a filtered map of the element's OSM [tags](https://wiki.openstreetmap.org/wiki/Tags), passed through as-is. Tags are free-form, so what you get depends on what mappers wrote down. The import keeps:

- the tag that made the element a place (`amenity`, `shop`, `tourism`, `leisure`, and so on),
- the name family: `name:*`, `alt_name`, `old_name`, `official_name`, `short_name`, `loc_name`, `int_name`,
- `cuisine`, `sport`, `religion`, `denomination`,
- `opening_hours`, `phone`, `website`, `wikidata`, `wheelchair`, `internet_access`,
- `addr:street`, `addr:housenumber`, `addr:city`, `addr:postcode`, `addr:country`.

Everything else is dropped. Only named elements are imported, and a few catch-all values (`amenity=...` types that aren't places, `shop=yes`, `shop=vacant`, and the like) are skipped.

The [tileset descriptor](/api/) lists the tag keys a collection's records may carry.

### The primary category

Each place has one primary category, chosen by the first of these keys the element has, in this order:

`amenity`, `shop`, `tourism`, `leisure`, `office`, `craft`, `healthcare`, `historic`, `natural`, `man_made`, `aeroway`, `railway`, `public_transport`, `place`, `boundary`, `waterway`, `power`, `landuse`, `highway`, `barrier`, `emergency`, `telecom`, `building`

That key and its value stay in `attributes`, and `describeTileset` reports categories in the form `key=value`: `amenity=cafe`, `leisure=park`, `shop=books`. OSM has no category hierarchy and we don't invent one. See the OSM [map features](https://wiki.openstreetmap.org/wiki/Map_features) page for the vocabulary.

## Variants

`variants` come from the name tags: `name:{lang}`, `alt_name`, `official_name`, `short_name`, `loc_name`, `old_name`. Each gets a `type` (`alternate`, `official`, `short`, `colloquial` or `historical`) and, when the tag's language code is valid, a `language`.

## Containment

`relations.within` lists the administrative areas the place sits in, from [Overture Divisions](/divisions/), broadest first. Those names come from Overture, not OSM, so the Overture attribution applies to OSM tiles as well. The `osm` tileset lists `(overturemaps.org, division)` as a *reference* collection and the tile carries its licences.

## Licensing

OSM data is ODbL, and the ODbL has conditions about attribution and share-alike. Every tile carries an `attribution` array with the licence and the attribution page for each collection in it. If you show OSM-derived places, show the credit. If you copy a place out of a tile, it keeps its `origin`, which says where it came from, but not a licence notice: that's yours to supply when you pass the data along. This is a design choice, not legal advice.

## Example

A real record, from a live tile near Philadelphia City Hall (trimmed):

```json
{
  "value": {
    "$type": "org.atgeo.place",
    "origin": "urn:atgeo:openstreetmap.org:node:10076153317",
    "name": "Dilworth Park Café",
    "locations": [
      {
        "$type": "community.lexicon.location.geo",
        "latitude": "39.953206",
        "longitude": "-75.164376"
      }
    ],
    "variants": [],
    "attributes": {
      "addr:city": "Philadelphia",
      "addr:housenumber": "1400",
      "addr:postcode": "19107",
      "addr:street": "John F. Kennedy Boulevard",
      "opening_hours": "Mo-Fr 07:00-19:00; Sa-Su 10:00-18:00",
      "phone": "+1 215-972-0111",
      "amenity": "cafe"
    },
    "relations": {
      "within": [
        { "uri": "urn:atgeo:overturemaps.org:division:f39eb4af-5206-481b-b19e-bd784ded3f05", "name": "United States", "type": "country" },
        { "uri": "urn:atgeo:overturemaps.org:division:9b885f43-e59d-4249-b114-4d8853d66bfb", "name": "Pennsylvania", "type": "region" },
        { "uri": "urn:atgeo:overturemaps.org:division:1a04f6e5-dd95-4e67-b25d-777814f7c93f", "name": "Philadelphia County", "type": "county" },
        { "uri": "urn:atgeo:overturemaps.org:division:10ddec2b-285d-477a-a39b-bb3209735f9b", "name": "Philadelphia", "type": "locality" },
        { "uri": "urn:atgeo:overturemaps.org:division:407ce93b-dadf-49eb-b25b-6942e077c089", "name": "Center City", "type": "macrohood" }
      ]
    }
  },
  "importance": 57
}
```

`importance` sits beside the record in the tile, not inside it; it's a property of this gazetteer's build, not of the place.
