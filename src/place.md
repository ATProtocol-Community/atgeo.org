---
layout: base.njk
title: "Lexicon"
---

# Lexicon

`org.atgeo.place` is the record type for a geographic place: a name, one or more locations, and whatever the upstream dataset knows about it.

Three more lexicons ride along: [`org.atgeo.defs`](#org-atgeo-defs) (shared definitions), [`org.atgeo.tilePayload`](#org-atgeo-tilepayload) (what a tile file looks like) and the four query lexicons, which are documented on the [XRPC API](/api/) page.

## Fetching the lexicons

The gazetteer serves its own lexicons. `GET https://places.atgeo.org/{nsid}` returns the schema for that NSID:

```sh
curl https://places.atgeo.org/org.atgeo.place
curl https://places.atgeo.org/org.atgeo.defs
curl https://places.atgeo.org/org.atgeo.tilePayload
```

The schemas live in [`garganorn/lexicon/`](https://github.com/schuyler/garganorn/tree/main/garganorn/lexicon) and are the normative source. This page is the narrative around them.

## Example

A place from Overture, as served in a tile (the `sources` list is trimmed; everything else is as the server sent it):

```json
{
  "$type": "org.atgeo.place",
  "origin": "urn:atgeo:overturemaps.org:place:00458f1e-2120-4557-9fa4-4f00d12fcd7a",
  "name": "Community Ventures",
  "locations": [
    {
      "$type": "community.lexicon.location.geo",
      "latitude": "39.955755",
      "longitude": "-75.165169"
    },
    {
      "$type": "community.lexicon.location.address",
      "country": "US",
      "region": "PA",
      "locality": "Philadelphia",
      "street": "325 Chestnut St",
      "postalCode": "19106-2600"
    }
  ],
  "variants": [],
  "attributes": {
    "id": "00458f1e-2120-4557-9fa4-4f00d12fcd7a",
    "names": { "primary": "Community Ventures", "common": null, "rules": null },
    "categories": { "primary": "community_services_non_profits", "alternate": ["home_developer"] },
    "websites": ["http://www.community-ventures.org/"],
    "phones": ["+12155646004"],
    "confidence": "0.920",
    "sources": [ ... ]
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
}
```

Notice what's not in there: no importance score, and no record key. The score travels beside the place in a tile (see [`tileRecord`](#tilerecord)), and the identity is `origin`.

## `org.atgeo.place`

A record with `key: any`. Only `name` is required, since the lexicon has to accept places that people write themselves as well as ones the gazetteer serves. Records from the gazetteer carry everything below that their source has.

| Property | Type | Description |
|----------|------|-------------|
| `origin` | string (URI) | What the place describes. See [Identity](#origin-and-identity) |
| `name` | string, required | The primary display name. Up to 3000 characters |
| `locations` | array of union | Where the place is, in any available representation. See [Locations](#locations) |
| `variants` | array of `variant` | Alternate names, translations and other name variants |
| `attributes` | unknown | The dataset's own fields, passed through. See [Attributes](#attributes) |
| `updatedAt` | string (datetime) | The data provider's stated date for this place's data. Declared, not yet produced |
| `relations` | object | Related places: `within` and `sameAs`. See [Relations](#relations) |

Ignore properties you don't recognize. New ones may show up, and existing ones keep their meaning.


### Origin and identity

`origin` says what a place is a description *of*. For a place served by a gazetteer, it's an ATGeo URN:

```
urn:atgeo:{dataset}:{collection}:{id}
urn:atgeo:openstreetmap.org:way:123456
```

- **dataset** is the upstream publisher's domain: `openstreetmap.org`, `overturemaps.org`. No colons.
- **collection** is a sub-division the dataset defines. OSM has `node`, `way` and `relation`; Overture has `place` and `division`. No colons.
- **id** is the upstream's own identifier within that collection, and it's everything after the fourth colon. (Ids may themselves contain colons; the first four fields can't.)

Compare origins as exact strings. You can also match on a prefix you build yourself, such as `urn:atgeo:openstreetmap.org:way:` for every OSM way. Only a gazetteer serving the dataset takes a URN apart, and only to resolve it.

A URN is a name, not a location. It doesn't say which server has the place, and it doesn't carry the upstream release. Upstream ids are also only as stable as the upstream makes them: Overture replaced every id in release `2025-06-25.0`, so an id captured before that won't resolve against current data.

**Copying.** Gazetteer places are not repository records, so there's no `at://` URI for one. If you copy a place into your own repo, the copy keeps the gazetteer's URN as its `origin`, and the copy gets its own `at://` URI. If you copy a repo record that has no `origin`, the copy's `origin` is the source's `at://` URI. And a place with no `origin` at all is its own origin, identified by its `at://` URI. Copying and editing never change `origin`.


### Locations

`locations` is a union. Each element carries a `$type` naming one of four formats. A place can carry several at once, and a consumer should handle the union, not the subset that's served today.

Coordinates are decimal strings, not numbers: the AT Protocol data model has no floats. Parse them. (The [FAQ](/faq/) has the longer version.)

#### `community.lexicon.location.geo`

A WGS84 point. Served for every OSM element and every Overture place. An OSM way or relation gets a point too, not a geometry.

| Property | Type | Description |
|----------|------|-------------|
| `latitude` | string, required | Decimal degrees. South of the equator is negative |
| `longitude` | string, required | Decimal degrees. West of the prime meridian is negative |
| `altitude` | string | Metres above mean sea level |
| `name` | string | A name for the location |

#### `community.lexicon.location.address`

A street address. Overture places may carry one.

| Property | Type | Description |
|----------|------|-------------|
| `country` | string, required | ISO 3166 country code, preferably two letters |
| `region` | string | State, province or similar, e.g. `PA` |
| `locality` | string | City or town |
| `street` | string | Street address |
| `postalCode` | string | Postal or ZIP code |
| `name` | string | A name for the location |

#### `community.lexicon.location.bbox`

A bounding box. Division records carry one in place of a point.

| Property | Type | Description |
|----------|------|-------------|
| `west` | string, required | Western longitude, decimal degrees |
| `south` | string, required | Southern latitude |
| `east` | string, required | Eastern longitude |
| `north` | string, required | Northern latitude |
| `name` | string | A name for the box |

If `west` is greater than `east`, the box crosses the antimeridian.

#### `community.lexicon.location.hthree`

An [H3](https://h3geo.org/) cell. The lexicon declares it, but the gazetteer doesn't produce it yet. Its fields are in the `community.lexicon.location.hthree` schema; handle it if you see one, and don't expect to.

### Variants

`variants` holds alternate names. Each entry is a `variant`:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string, required | The variant name |
| `type` | string | What kind of variant. Known values: `official`, `alternate`, `short`, `colloquial`, `historical` |
| `language` | string (language tag) | The language of the name, when known |

`type` is a hint, and `knownValues` means the list is open: don't reject a value you haven't seen. For Overture records, variants come from the upstream's multilingual and rule-based names; for OSM, from the name tags (`name:{lang}`, `alt_name`, `official_name` and friends). The array may be empty.

### Attributes

`attributes` is the source's own vocabulary, passed through rather than homogenized. Its shape differs by collection, and each tileset's [descriptor](/api/#org-atgeo-describetileset) lists the keys its records may carry. The per-dataset pages say what to expect:

- [OpenStreetMap](/osm/): a filtered tag map, including the tag that made the element a place
- [Overture Places](/overture/): the upstream fields (`names`, `categories`, `websites`, `brand`, `sources` and so on)
- [Overture Divisions](/divisions/): `subtype`, `country`, `region`, `wikidata`, `population`

Other fractional values in `attributes` are strings too. The gazetteer emits no JSON floats.

### `updatedAt`

The data provider's stated date for the place's data, as an AT Protocol datetime. It's declared but not yet produced. Tolerate its absence now and its presence later.

### Relations

`relations` is an object keyed by relation type. Each type holds an array of `relation`:

| Property | Type | Description |
|----------|------|-------------|
| `uri` | string (URI), required | The related place's identity. Producers prefer an ATGeo URN, then an `at://` URI, then any other URI. Compare as exact strings |
| `name` | string | Display name of the related place |
| `type` | string | The related place's type in its own dataset's vocabulary, e.g. an Overture division subtype such as `region` |

#### `within`

The places that geographically contain this one, ordered **broadest first**. The gazetteer fills it with Overture divisions: `uri` is the division's URN, `type` its Overture subtype. The order carries the nesting, not the type names, so if you want to know which vocabulary is in play, read `containmentTypes` in the tileset descriptor. See [containment levels](/api/#containment-levels).

#### `sameAs`

Other URIs that name the same place. Declared, not yet produced.


## `org.atgeo.defs`

Shared definitions, used by the tileset descriptor and the tile payload.

### `collectionRef`

Names one collection of one dataset. Both fields are required.

| Property | Type | Description |
|----------|------|-------------|
| `dataset` | string | The upstream publisher's domain, e.g. `openstreetmap.org`. No colon |
| `collection` | string | A sub-division the dataset defines, e.g. `way`. No colon |

### `collectionAttribution`

Where one collection's data comes from and the terms it's under. `dataset` and `collection` are required; the rest appear where known.

| Property | Type | Description |
|----------|------|-------------|
| `dataset`, `collection` | string | As in `collectionRef` |
| `release` | string | The upstream's own version string: an Overture release id, or an OSM replication timestamp |
| `source` | string (URI) | URL of the upstream dataset |
| `licenses` | array of URIs | URLs of the text of every licence the collection's data is under |
| `attribution` | string (URI) | URL of the upstream's attribution or copyright page |

### `collectionInfo`

A collection that a tileset carries: everything in `collectionAttribution`, plus what's observed in this tileset. The vocabularies are observed, not closed: an absent value means no record in the tileset has it.

| Property | Type | Description |
|----------|------|-------------|
| `dataset`, `collection`, `release`, `source`, `licenses`, `attribution` | | As in `collectionAttribution` |
| `recordCount` | integer | Number of records |
| `locationFormats` | array of NSIDs | The `$type`s of the locations the records carry |
| `containmentTypes` | array of strings | The `type`s seen in the records' `within` relations, broadest first. Absent when records carry none |
| `categories` | array of `categoryCount` | Values of the records' primary category, with counts, descending |
| `attributes` | array of strings | Attribute keys the records may carry |

### `categoryCount`

| Property | Type | Description |
|----------|------|-------------|
| `value` | string, required | A category value, e.g. `amenity=cafe` in OSM or `cafe` in Overture |
| `count` | integer, required | Records with that value |

### `tileset`

A tileset descriptor, as returned by `describeTileset`. A collection appears in `collections` or `references`, never both. Values describe one build, not a promise about future builds.

| Property | Type | Description |
|----------|------|-------------|
| `slug` | string, required | The tileset's name, fixed when it's built: lowercase letters, digits and hyphens |
| `collections` | array of `collectionInfo`, required | The collections whose records the tileset carries |
| `publishedAt` | string (datetime) | When the tileset was created. Same as `publishedAt` in each of its tiles |
| `extent` | `community.lexicon.location.bbox` | Bounding box of the tileset's records |
| `references` | array of `collectionAttribution` | Collections the tileset doesn't carry but whose data its records include, such as the divisions named in a `within` relation |


## `org.atgeo.tilePayload`

What's inside a tile file.

### Envelope

| Property | Type | Description |
|----------|------|-------------|
| `records` | array of `tileRecord`, required | The tile's records |
| `publishedAt` | string (datetime) | When the tileset was created |
| `attribution` | array of `collectionAttribution` | One entry for every collection the tileset carries or references. The same list in every tile of the tileset, so one tile is enough to know what you've got and what licence it's under |


### `tileRecord`

| Property | Type | Description |
|----------|------|-------------|
| `value` | unknown, required | An `org.atgeo.place` record |
| `importance` | integer | The producer's score for this place among the tileset's records; larger sorts first. Beside the place, not in it |
| `uri` | string (URI) | The record's own URI, only for a record with no `origin` (an `at://` URI for a repo record). Records with an origin omit it |

A record is identified by `value.origin`, or by `uri` when the value has none. A record with neither can't be told apart from another. `importance` sits outside `value` because it's a build parameter, not a property of the place, so a place you copy out of a tile doesn't carry it. How it's computed is on the [API page](/api/#importance).

## The query lexicons

`org.atgeo.getTiles`, `org.atgeo.getPlace`, `org.atgeo.describeService` and `org.atgeo.describeTileset` are documented on the [XRPC API](/api/) page.
