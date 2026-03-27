---
layout: base.njk
title: "Foursquare"
---

# Foursquare

Collection: `org.atgeo.places.foursquare`

ATGeo imports points of interest from the [Foursquare Open Source Places](https://opensource.foursquare.com/os-places/) dataset, a freely available global PoI database. The dataset is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0). See the Foursquare [data documentation](https://docs.foursquare.com/data-products/docs/fsq-places-open-source) for details.

## Example record

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
    "placemaker_url": "https://foursquare.com/placemakers/review-place/4460d38bf964a5200a331fe3",
    "date_created": "2006-05-09",
    "date_refreshed": "2025-09-07"
  }
}
```

## Attributes

The following fields appear in the `attributes` object of Foursquare place records:

| Field | Type | Description |
|-------|------|-------------|
| `fsq_place_id` | string | Foursquare's unique place identifier |
| `fsq_category_ids` | string[] | Foursquare category IDs assigned to the place |
| `fsq_category_labels` | string[] | Human-readable category labels (e.g., "Landmarks and Outdoors > Park") |
| `tel` | string | Phone number, if available |
| `website` | string | Website URL, if available |
| `email` | string | Email address, if available |
| `facebook_id` | string | Facebook page ID, if available |
| `instagram` | string | Instagram handle, if available |
| `twitter` | string | Twitter handle, if available |
| `placemaker_url` | string | Link to the Foursquare Placemaker review page |
| `admin_region` | string | Administrative region, if available |
| `po_box` | string | PO box, if available |
| `post_town` | string | Post town, if available |
| `date_created` | string | Date the place was first added (ISO 8601) |
| `date_refreshed` | string | Date the record was last refreshed from Foursquare (ISO 8601) |

## Categories

Foursquare uses a hierarchical category taxonomy with over 1,000 categories. Categories are represented as path-style labels (e.g., "Landmarks and Outdoors > Park > Dog Park"). The `fsq_category_ids` field contains Foursquare's internal identifiers; `fsq_category_labels` contains the corresponding human-readable paths.

ATGeo preserves Foursquare's native categories without mapping them to a universal taxonomy.
