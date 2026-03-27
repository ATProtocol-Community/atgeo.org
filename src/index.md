---
layout: base.njk
title: "ATGeo: Places for ATProtocol"
wide: true
---

# ATGeo: Places for ATProtocol

ATGeo provides a `Place` lexicon for ATProtocol, and a lookup service for geographic points of interest that uses that lexicon.

{% mapSearch %}
<div class="map-layout">
{% mapDemo %}
{% placeDisplay %}
</div>

The ATGeo [data model](/place/) defines how points of interest are represented. The [Query API](/query-api/) provides search access to the gazetteer. See [Usage](/usage/) for guidance on integrating the lexicon into your apps.
