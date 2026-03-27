---
layout: base.njk
title: "ATGeo: Places for ATProtocol"
wide: true
---

# ATGeo: Places for ATProtocol

ATGeo provides a `Place` lexicon for ATProtocol, and a lookup service for geographic venues that implements the lexicon.

{% mapSearch %}
<div class="map-layout">
{% mapDemo %}
{% placeDisplay %}
</div>

The ATGeo [data model](/place/) describes how points of interest are represented. The [Query API](/query-api/) provides search access to the venue databases. See [Usage](/usage/) for guidance on integrating the lexicon into your apps.
