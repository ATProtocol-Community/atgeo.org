---
layout: base.njk
title: "Usage"
---

# Usage

## Gazetteer API

An ATGeo *Gazetteer* is an XRPC lookup service that serves authoritative place data in ATGeo `Place` formatted JSON.

The **places.atgeo.org** gazetteer lookup service allows you to pull points of interest (PoIs) from Foursquare Open Source Places, Overture Maps, and OpenStreetMap. Who's on First is coming shortly.

The gazetteer service is built using Free Software and Free Data. The public server is community supported, so please go it easy on it, or consider [deploying your own](https://github.com/schuyler/garganorn/) if your app takes off.

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


