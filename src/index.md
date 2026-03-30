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

The ATGeo [data model](/place/) describes how points of interest are represented. The [XRPC API](/api/) provides search access to the venue databases. See [Usage](/usage/) for guidance on integrating the lexicon into your apps.
