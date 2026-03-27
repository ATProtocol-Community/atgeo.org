---
layout: base.njk
title: "Known Gaps"
---

# Known gaps & missing pieces

**Search result ranking** from the **places.atgeo.org** gazetteer service can be iffy. Known issue, work-in-progress. Generally, the search results have been optimized to make the service usable as a local venue data source.

**Data quality** will vary by source. Foursquare's data quality is pretty sketchy and hasn't been updated since late 2025. OpenStreetMap is fairly comprehensive and kept up-to-date by a large army of volunteers, but the cadence of updates is highly variable. Overture Maps is a free dataset that is managed by a corporate consortium on a monthly schedule, but its quality may be somewhere in between that of OSM and Foursquare.

**Place categories** are hard. "What kind of place is it?" is a question that reaches deep into the heart of how humans organize ourselves socially and economically. People in different cultures think about and use places differently. Foursquare and Overture Maps each have over 1,000 place categories, and they're not exactly the same. OpenStreetMap's tagging structure is even more complex than that. Our answer right now is to punt and ask developers to lean into the details of whatever reference dataset they're adopting.

**Address geocoding** is outside the scope of ATGeo's PoI lookups. Free services like Nominatim do allow developers to geocode street addresses. The `community.lexicon.geo.address` lexicon provides a way to represent addresses in ATProtocol, and can be composed into `org.atgeo.Place` objects. One possible direction would be for ATGeo to host an ATProtcol-adapted version of Nominatim.

**Reverse geocoding** ("What city / province / country is this PoI located in?") is not a problem that ATGeo is trying to solve right now. Some datasets include this information with every PoI record; some systems like Who's on First approach this topic in detail. This is a solvable problem, though, so if you need reverse geocoding for your app, please speak up.

**Lines and polygons** are also not a focus for the ATGeo Lexicon at the moment. We could add complex geometries using raw GeoJSON or WKT, but the data would probably need to be stored on-protocol in blob format. Right now, it would be easier by far to just take the reference IDs returned by the gazetteer service and look them up in the original data source.

**Private places** get into questions about private data that the wider ATProtocol community is still trying to address. The `Place` lexicon allows you to specify places by name, while providing only a grid cell location or even no location at all. When publishing these kinds of records, users concerned about privacy and security will have to share physical locations out-of-band.

All of these gaps are fair game for future work if the community needs it.

**We'd like to ask app developers to articulate their use cases**, in order to triage what further problems the ATGeo working group should try to solve. We'd also like volunteers to help develop solutions.
