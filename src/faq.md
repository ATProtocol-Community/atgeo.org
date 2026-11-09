---
layout: base.njk
title: "FAQ"
---

# FAQ

## Why are latitude and longitude represented as strings?

The AT Protocol [data model](https://atproto.com/specs/data-model) does
not support floating-point numbers. The [Lexicon type
system](https://atproto.com/specs/lexicon) offers six primitive types
&mdash; `boolean`, `integer`, `string`, `bytes`, `cid-link`, and `blob`
&mdash; but no `float` or `double`.

The AT Protocol spec recommends encoding floats as strings or bytes to
ensure safe round-trip representation. ATGeo follows this guidance:
coordinates like `"37.776146"` are stored as strings that preserve
the exact decimal representation from the source data, with no risk
of silent precision loss from floating-point arithmetic.


## Why don't the tiles have a search parameter?

Because the server would then learn what you're looking for, and where. Instead you ask for the tiles covering a region and search them yourself. The [client SDKs](/sdk/) do the matching and ranking locally. The cost is that you need to know roughly where to look.

For when you don't, there's a separate keyword search, [`org.atgeo.searchPlaces`](/api/#org-atgeo-searchplaces): it takes the words the user typed and, optionally, a box in whole degrees, and returns at most 20 matches, most important first. That one does tell the server the keyword, which is why it's a separate call, the server keeps no log of it, and the SDK methods that use it have `Keyword` in their names. It never takes a point, so it learns nothing about where you are beyond a degree cell, if you send one.

## Why won't the API take my exact coordinates?

`getTiles` rejects any bounding box coordinate with more than two decimal places, with a `BboxTooPrecise` error. That's a 0.01&deg; grid, about 1.1 km at the equator. A box centered on a raw GPS fix would pinpoint a person to about ten meters however big the box was, so the server only lets you say "which grid cell". The check is on the text you sent, so `37.770` fails on its trailing zero. Snap your region outward to the grid before sending; the client SDKs do this for you. See [the API](/api/).

## Why do OSM ways show up as points?

An OpenStreetMap way or relation is a line or polygon, but ATGeo places have a location, not a geometry: the gazetteer reduces it to a single point. For the outline, follow the place's `origin` to the element on openstreetmap.org. See [OpenStreetMap](/osm/).
