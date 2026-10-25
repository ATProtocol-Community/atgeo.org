---
layout: base.njk
title: "Roadmap"
---

# Roadmap

What's shipped, and what's still open. The backend's [planned features](https://github.com/schuyler/garganorn/blob/main/docs/planned-features.md) and the [client SDK design notes](https://github.com/schuyler/garganorn/blob/main/docs/atgeo-client-sdk.md) have the long versions.

## Shipped

- **[Client SDKs](/sdk/)** in JavaScript, Swift, Kotlin, Python and Rust. They're pre-release, installed from GitHub, but they exist.
- **Fuzzy search, on the client.** The server has no text search and never sees what you typed. The SDK fetches the tiles for your region and matches and ranks them locally.
- **Variants and multilingual names.** `variants` carry alternate, official, short, colloquial and historical names, with a language when known.
- **Licences and attribution in every tile.** Each collection's licences and attribution page ride in the tile payload.
- **Containment.** `relations.within` answers "what city is this in?" from [Overture Divisions](/divisions/), broadest first.
- **The overview band.** A coarse sample of the most important places for very large regions, so zooming out doesn't mean an error.

Foursquare was dropped as a direct source. (Overture still contains Foursquare data, so it's not entirely gone.)

## Still open

**Coverage** is mostly the US east coast for now. The global build is waiting on a rebuild. Until then, a search outside the covered area comes back thin or empty.

**Concordance** (`sameAs`) would link records in different datasets that describe the same place and ease dataset lock-in. The lexicon has room for it; nothing produces it yet.

**`updatedAt`** is declared in the lexicon, and nothing fills it in.

**H3 locations** (`hthree`) are declared in the lexicon and not produced.

**Discovery.** A client can ask a server it already knows what it serves, but nothing helps it find a gazetteer to ask: no lookup by DID, and no service announcement records.

**A write path.** The SDKs only read. Writing a check-in needs a check-in lexicon, which nobody has drafted. The read SDK shouldn't grow a write path shaped around a guess.

**A spatial AppView** that finds `place` objects in AT Protocol feeds, indexes them and lets you search them. Still the next logical step.

**Who's on First** was planned as a source and isn't one.

**Search ranking** is young. It happens in the SDKs now, with fuzzy matching weighed against importance and distance, and the weights are expected to change as people try it on real apps.

**Address geocoding** is out of scope. Use something like Nominatim. The `community.lexicon.location.address` lexicon can carry an address in a `Place` record.

**Lines and polygons** aren't in the lexicon. An OSM way or relation is reduced to a point; if you need the shape, follow the `origin` back to the source.

## Gaps we don't know how to close

**User-generated places** are necessary to 90% of AT Protocol apps. Letting users create places means moderation, and not just content moderation, but ground truthing. When you figure out how to solve this, please let us know!

**Private places** raise questions about private data that the wider AT Protocol community is still working on. The `Place` lexicon lets you give a name with a coarse grid cell or no location at all. People who publish records like that will have to share physical locations out-of-band.

**Data quality** varies by source. OpenStreetMap is comprehensive and kept up by a large army of volunteers, but the cadence of updates varies a lot. Overture is a merge of several datasets released monthly, and its quality varies with whichever contributor supplied a given place.

**Place categories** are hard. "What kind of place is it?" reaches deep into how humans organize themselves, and different cultures think about places differently. Overture has about 2,000 categories (1,984 in the current build), and OSM's tagging is more complex than that. Our answer for now is to punt: we pass through each source's own vocabulary and ask developers to lean into the details of the one they pick.

## User safety

The right way to store a user's location is never to do so automatically, but to let people *select* a place from a list or a map. That is now doable: the API only accepts coordinates on a coarse grid (see [the FAQ](/faq/)), and the client SDKs snap your location to that grid for you, so a precise location never leaves the device. The old "we need venue lookup SDKs" item is done. What's left is for app developers to use them, and to never store a user's exact position. See [Usage](/usage/).

## ATGeo Is People

All of these gaps are fair game for [future work](/help/) if the community needs it.

**We'd like to ask app developers to articulate their use cases**, in order to triage what further problems the ATGeo working group should try to solve. We'd also like volunteers to help develop solutions.
