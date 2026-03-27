---
layout: base.njk
title: "OpenStreetMap"
---

# OpenStreetMap

Collection: `org.atgeo.places.osm`

ATGeo imports points of interest from [OpenStreetMap](https://www.openstreetmap.org/) (OSM), a collaborative mapping project with global coverage. OSM data is licensed under the [Open Data Commons Open Database License](https://opendatacommons.org/licenses/odbl/) (ODbL). See the OSM [data model](https://wiki.openstreetmap.org/wiki/Elements) and [map features](https://wiki.openstreetmap.org/wiki/Map_features) documentation for details.

## Example record

```json
{
  "$type": "org.atgeo.place",
  "collection": "org.atgeo.places.osm",
  "rkey": "node:6964627886",
  "name": "Alamo Square Park",
  "variants": [],
  "locations": [
    {
      "$type": "community.lexicon.location.geo",
      "latitude": "37.776343",
      "longitude": "-122.434766"
    }
  ],
  "attributes": {
    "tourism": "attraction",
    "opening_hours": "Mo-Su 05:00-12:00",
    "phone": "+1 415 218-0259",
    "website": "https://sfrecpark.org/",
    "wikidata": "Q118533801"
  }
}
```

## Record keys

OSM record keys (`rkey`) encode the element type and OSM ID, e.g. `node:6964627886` or `way:745183964`. This allows tracing any record back to its source element on openstreetmap.org.

## Attributes

Unlike Foursquare and Overture, which have fixed attribute schemas, OSM attributes are passed through directly from the source data's [tag](https://wiki.openstreetmap.org/wiki/Tags) system. Each record's attributes vary depending on what OSM contributors have tagged.

### Primary type tags

Every imported record has at least one tag that identifies what kind of place it is. These are checked in priority order:

`amenity`, `shop`, `tourism`, `leisure`, `healthcare`, `office`, `craft`, `club`, `emergency`, `diplomatic`, `historic`, `military`, `aeroway`, `railway`, `highway`, `waterway`, `natural`, `geological`, `man_made`, `building`, `boundary`, `landuse`, `place`, `power`

The first matching tag determines how the place is categorized in search results. For example, a record with `"amenity": "cafe"` is displayed as "Cafe"; one with `"tourism": "attraction"` as "Attraction". Values like `"yes"` are ignored for categorization.

See the OSM wiki's [map features](https://wiki.openstreetmap.org/wiki/Map_features) page for the full taxonomy of keys and values.

### Common metadata tags

These tags appear on many records when the data is available in OSM:

| Tag | Description |
|-----|-------------|
| `opening_hours` | Opening hours in [OSM format](https://wiki.openstreetmap.org/wiki/Key:opening_hours) |
| `phone` | Phone number |
| `website` | Website URL |
| `cuisine` | Cuisine type (for restaurants, cafes, etc.) |
| `wheelchair` | Wheelchair accessibility (`yes`, `no`, `limited`) |
| `wikidata` | Wikidata item ID (e.g., `Q118533801`) |

Other OSM tags present on the source element are also passed through. The full set of possible tags is documented on the [OSM wiki](https://wiki.openstreetmap.org/wiki/Map_features).

## Categories

OSM does not use a hierarchical category taxonomy. Instead, place types emerge from the combination of tag keys and values. A coffee shop is `amenity=cafe`; a park is `leisure=park`; a bookstore is `shop=books`. This is more granular and less uniform than the category systems used by Foursquare or Overture.

ATGeo preserves OSM's native tagging without mapping it to a universal taxonomy.
