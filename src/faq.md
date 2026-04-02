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

