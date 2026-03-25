# ATGeo: Places for ATProtocol

ATGeo provides a [place lexicon](#lexicon) for ATProtocol and a [lookup service](#gazetteer) for geographic points of interest that uses that lexicon.

[[ insert demo pushpin map and text lookup here ]]

[[ display place JSON here when place record loads ]]

## Gazetteer

An ATGeo *Gazetteer* is just an XRPC lookup service that serves authoritative place data in ATGeo `Place` formatted JSON.

The **places.atgeo.org** gazetteer lookup service allows you to pull points of interest from either Foursquare Open Source Places or Overture Maps. OpenStreetMap and Who’s on First are coming shortly.

The gazetteer service is built using Free Software and free data. The public server is community supported, so please go it easy on it, or consider building your own if your app takes off.


## Lexicon

The ATGeo `Place` lexicon is designed to be _interoperable_, _composable_, _traceable_, and _extensible_.

### Interoperability

When ATProtocol applications use the same lexicon to reference and describe places, they can reuse each other’s place data, and applications can build geographic views and connections based on feeds from other applications.

### Composability

The ATGeo `Place` lexicon is designed to function both as the description of a place, and as a reference to a place. 

ATGeo lookup services, like _places.atgeo.org_, return JSON objects that can be incorporated directly into ATProtocol records without modification, because they follow the `org.atgeo.Place` lexicon definition and use the ATProtocol data model.

### Extensibility

The `Place` lexicon functions like an `interface` in Golang or duck-typing in Python: If application-specific location lexicons implement their place data using the same “shape”, then ATGeo-aware applications across the ATmosphere can consume those records, without having to understand each and every lexicon.

### Traceability

There’s a lot of place data outside the ATmosphere, like in OpenStreetMap or Foursquare. We call this *reference data*.

Every reference place record in ATGeo has a globally unique key that specifies where it came from, and what its unique ID was in the original dataset. This means that place records that originate from some off-protocol authority, like OpenStreetMap or Overture Maps, can be traced back to that origin, and changes tracked over time.

Composability and traceability combine to allow applications to safely publish records that discard place attributes they don’t need. Other applications can recover the discarded attributes by looking up the record key in a gazetteer service, if needed, or by searching the original dataset.

## Data model

Here’s an example of a record from `org.atgeo.places.fsq`:

```
...
```

[[ explain how each field works ]]

## Query model

The service endpoint at `https://places.atgeo.org/xrpc` provides an `org.atgeo.places.searchRecords` method, which you to search for points of interest by geographic location and search string.

[[ provide example query mixing lon, lat, and q ]]

[[ explain the structure of the results ]]

## Contributions

We need your help to refine and improve the ATGeo lexicon. Please join us on [[ find the atproto community discourse server ]] under the _#atgeo_ tag.

## References

* [[ link to Foursquare Open Source Places documentation ]]
* [[ link to Overture Maps documentation ]]
* [[ link to OpenStreetMap Map Features page ]]