---
layout: base.njk
title: "Foursquare"
---

# Foursquare

Collection: `org.atgeo.places.foursquare`

ATGeo imports points of interest from the [Foursquare Open Source Places](https://opensource.foursquare.com/os-places/) dataset, a freely available global PoI database.

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

## Example record

*Example record will be added once the API is available.*
