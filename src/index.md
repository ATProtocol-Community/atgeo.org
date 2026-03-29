---
layout: base.njk
title: "ATGeo: Places for ATProtocol"
wide: true
---

# ATGeo: Places for ATProtocol

ATGeo provides a geographic place lexicon for ATProtocol, and a venue lookup service that implements the lexicon.

{% mapSearch %}
<div class="map-layout">
{% mapDemo %}
{% placeDisplay %}
</div>

The ATGeo [data model](/place/) describes how points of interest are represented. The [XRPC API](/api/) provides search access to the venue databases. See [Usage](/usage/) for guidance on integrating the lexicon into your apps.
