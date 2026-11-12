---
layout: base.njk
title: "News"
permalink: /news/
eleventyExcludeFromCollections: true
---

# News

Updates on the lexicon, the gazetteer and the SDKs. Subscribe with the [Atom feed](/feed.xml).

{% unless collections.news %}
Nothing here yet.
{% endunless %}
{% for post in collections.news | reverse %}
## [{{ post.data.title | escape }}]({{ post.url }})

<p class="post-meta"><time datetime="{{ post.date | isoDate }}">{{ post.date | displayDate }}</time></p>

{% if post.data.summary %}{{ post.data.summary }}{% endif %}

{% endfor %}
