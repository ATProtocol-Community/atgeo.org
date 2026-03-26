---
layout: base.njk
title: "ATGeo: Places for ATProtocol"

---

# ATGeo: Places for ATProtocol

ATGeo provides a `Place` lexicon for ATProtocol, and a lookup service for geographic points of interest that uses that lexicon.

<div class="map-layout">
{% mapDemo %}
{% placeDisplay %}
</div>

## Gazetteer

An ATGeo *Gazetteer* is just an XRPC lookup service that serves authoritative place data in ATGeo `Place` formatted JSON.

The **places.atgeo.org** gazetteer lookup service allows you to pull points of interest (PoIs) from either Foursquare Open Source Places or Overture Maps. OpenStreetMap and Who's on First are coming shortly.

The gazetteer service is built using Free Software and free data. The public server is community supported, so please go it easy on it, or consider building your own if your app takes off.

## Data model

Here's an example of a record from `org.atgeo.places.foursquare`:

```json
{
  "$type": "org.atgeo.place",
  "collection": "org.atgeo.places.foursquare",
  "rkey": "4460d38bf964a5200a331fe3",
  "names": [
    { "priority": 0, "text": "Alamo Square" }
  ],
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

<!-- TODO: explain how each field works -->

## Query model

The service endpoint at `https://places.atgeo.org/xrpc` provides an `org.atgeo.searchRecords` method, which lets you search for points of interest by geographic location and search string.

<!-- TODO: provide example query mixing lon, lat, and q -->

<!-- TODO: explain the structure of the results -->

{% queryDemo %}

## Never automatically store user locations, EVER

App developers cannot rely on users making informed decisions about location safety. Users often don't understand the stakes and don't take the time to figure it out, until it's too late. **App developers -- meaning YOU -- are responsible for the safety of YOUR users.**

Our key recommendation to location-based app developers is:

> **NEVER AUTOMATICALLY STORE THE EXACT LOCATION OF YOUR USERS**.

We cannot state this strongly enough. You *do not* know who might consume the records you create on your users' behalf, or which authoritarian actor might subpoena your service's database. You do not know who might attempt to track your users with harmful intent.

If your application reads GPS or location data from a client, never store the coordinates directly -- instead **use the data to provide a list of public locations that a user can select from**. That's what the ATGeo lookup service is for. If your app UX doesn't support that, then store an H3 grid cell at a very low granularity. This gives your users a measure of safety and plausible deniability when using your app.

## Using the Lexicon in your own apps

The ATGeo `Place` lexicon is designed to be _interoperable_, _composable_, _traceable_, and _extensible_.

### Interoperability

When ATProtocol applications use the same lexicon to reference and describe places, they can reuse each other's place data, and applications can build geographic views and connections based on feeds from other applications.

### Composability

The ATGeo `Place` lexicon is designed to function both as the description of a place, and as a reference to a place.

ATGeo lookup services, like _places.atgeo.org_, return JSON objects that can be incorporated directly into ATProtocol records without modification, because they follow the `org.atgeo.Place` lexicon definition and use the ATProtocol data model.

### Extensibility

The `Place` lexicon functions like an `interface` in Golang or duck-typing in Python: If application-specific location lexicons implement their place data using the same "shape", then ATGeo-aware applications across the ATmosphere can consume those records, without having to understand each and every lexicon.

### Traceability

There's a lot of place data outside the ATmosphere, like in OpenStreetMap or Foursquare. We call this *reference data*.

Every reference place record in ATGeo has a globally unique key that specifies where it came from, and what its unique ID was in the original dataset. This means that place records that originate from some off-protocol authority, like OpenStreetMap or Overture Maps, can be traced back to that origin, and changes tracked over time.

Composability and traceability combine to allow applications to safely publish records that discard place attributes they don't need. Other applications can recover the discarded attributes by looking up the record key in a gazetteer service, if needed, or by searching the original dataset.

## Known gaps & missing pieces

**Place categories** are hard. "What kind of place is it?" is a question that reaches deep into the heart of how humans organize ourselves socially and economically. People in different cultures think about and use places differently. Foursquare and Overture Maps each have over 1,000 place categories, and they're not exactly the same. OpenStreetMap's tagging structure is even more complex than that. Our answer right now is to punt and ask developers to lean into the details of whatever reference dataset they're adopting.

**Address geocoding** is outside the scope of ATGeo's PoI lookups. Free services like Nominatim do allow developers to geocode street addresses. The `community.lexicon.geo.address` lexicon provides a way to represent addresses in ATProtocol, and can be composed into `org.atgeo.Place` objects. One possible direction would be for ATGeo to host an ATProtcol-adapted version of Nominatim.

**Reverse geocoding** ("What city / province / country is this PoI located in?") is not a problem that ATGeo is trying to solve right now. Some datasets include this information with every PoI record; some systems like Who's on First approach this topic in detail. This is a solvable problem, though, so if you need reverse geocoding for your app, please speak up.

**Lines and polygons** are also not a focus for the ATGeo Lexicon at the moment. We could add complex geometries using raw GeoJSON or WKT, but the data would probably need to be stored on-protocol in blob format. Right now, it would be easier by far to just take the reference IDs returned by the gazetteer service and look them up in the original data source.

**Private places** get into questions about private data that the wider ATProtocol community is still trying to address. The `Place` lexicon allows you to specify places by name, while providing only a grid cell location or even no location at all. When publishing these kinds of records, users concerned about privacy and security will have to share physical locations out-of-band.

All of these gaps are fair game for future work if the community needs it.

**We'd like to ask app developers to articulate their use cases**, in order to triage what further problems the ATGeo working group should try to solve. We'd also like volunteers to help develop solutions.

## Help wanted

We need your help to refine and improve the ATGeo lexicon and services!!! Please join us on the [ATProtocol Community Discourse](https://discourse.atprotocol.community/tag/atgeo/32) under the _#atgeo_ topic. 

## Documentation

* [Foursquare Open Source Places](https://opensource.foursquare.com/os-places/)
* [Overture Maps](https://docs.overturemaps.org/)
* OpenStreetMap [data model](https://wiki.openstreetmap.org/wiki/Elements) and [map features](https://wiki.openstreetmap.org/wiki/Map_features)
