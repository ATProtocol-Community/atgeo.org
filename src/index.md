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

The map searches above run in your browser, using the JavaScript client. They search the place tiles first, and the gazetteer only sees a coarse box and the tiles it asks for. If nothing there matches what you typed, or the map is zoomed out too far for a tile search, the map asks the server instead, sending the text; a note on the map says when it does. The data is mostly the US east coast for now.

The ATGeo [lexicon](/place/) describes how points of interest are represented. The [XRPC API](/api/) returns the map tiles covering a region, so apps can search the venue databases themselves, and the [client SDKs](/sdk/) do that for you in JavaScript, Swift, Kotlin, Python and Rust. See [Usage](/usage/) for guidance on integrating the lexicon into your apps.
