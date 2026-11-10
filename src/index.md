---
layout: base.njk
title: "ATGeo: Places for AT Protocol"
wide: true
---

# ATGeo: Places for AT Protocol

ATGeo provides a geographic place lexicon for [AT Protocol](https://atproto.com/) applications, and a venue lookup service that implements the lexicon.

{% mapSearch %}
<div class="map-layout">
{% mapDemo %}
{% placeDisplay %}
</div>

The map searches above run in your browser, using the JavaScript client; the gazetteer sees a coarse box and the place tiles it asks for. What you type stays in your browser unless the nearby search finds nothing. Then the demo sends it to the gazetteer, first with the box you're looking at snapped to whole degrees, and if that finds nothing, with no box at all. A spinner in the map's corner shows while that request is out. The data covers the whole world.

The ATGeo [lexicon](/place/) describes how points of interest are represented. The [XRPC API](/api/) returns the map tiles covering a region, so apps can search the venue databases themselves, and the [client SDKs](/sdk/) do that for you in JavaScript, Swift, Kotlin, Python and Rust. See [Usage](/usage/) for guidance on integrating the lexicon into your apps.
