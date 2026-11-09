---
layout: base.njk
title: "Rust SDK"
permalink: /sdk/rust/
---

# Rust SDK

`atgeo` is a Rust client that searches ATGeo places without telling the server what you searched for. It's a port of the [TypeScript reference](/sdk/javascript/) and behaves the same way: same requests on the wire, same filtering, scoring and ranking.

There's an async client that runs on any executor, and a blocking one for code without an executor. Both have the same methods and return the same results.

**Full reference: the [README on GitHub](https://github.com/schuyler/atgeo-sdk-rs#readme).** This page is the quickstart. For concepts shared by every SDK, see [Client SDKs](/sdk/).

## Install

Not on crates.io yet. Depend on the repository, pinned to a commit:

```toml
[dependencies]
atgeo = { git = "https://github.com/schuyler/atgeo-sdk-rs", rev = "<commit-sha>" }
```

Pin a full SHA, not a branch: breaking changes land on `main`.

### Features

| Feature | Default | What it adds |
|---|---|---|
| `reqwest` | yes | `ReqwestTransport`, the async client's default transport. Needs a Tokio runtime. |
| `blocking` | no | `blocking::AtgeoClient` and `blocking::HttpTransport`, for a transport of your own |
| `ureq` | no | `blocking::UreqTransport`, the blocking client's default transport; turns on `blocking` |
| `serde` | no | `Serialize` and `Deserialize` on the data types |

So `default-features = false, features = ["ureq"]` is the blocking client with no async stack at all. TLS is rustls with the operating system's root certificates; nothing pulls in OpenSSL.

### Minimum Rust version

Rust 1.85 or later (edition 2024). Through reqwest, a current lockfile can pick `icu_*` crates that need a newer Rust and break the build on 1.85. Cargo's MSRV-aware resolver fixes that; edition 2024 turns it on. An edition-2021 app on 1.85 to 1.87 needs `resolver = "3"` in its `Cargo.toml`, then a fresh `cargo update`.

## Synopsis

```rust
use atgeo::{AtgeoClient, NearbyOptions, Region};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), atgeo::Error> {
    let atgeo = AtgeoClient::new();

    let result = atgeo
        .search_nearby(
            Region::circle(39.9526, -75.1652, 1000.0), // radius in meters
            NearbyOptions::new("overturemaps.org").text("Starbux"),
        )
        .await?;

    for hit in &result.places {
        println!("{} {:.0} {:?} {:?}", hit.name().unwrap_or("-"), hit.distance, hit.score, hit.origin);
    }

    // show this wherever you show the places
    for a in &result.attribution {
        println!("{}", a.attribution.clone().unwrap_or(format!("{}/{}", a.dataset, a.collection)));
    }
    Ok(())
}
```

The example needs `tokio` (with `macros` and `rt`) in your own dependencies; the crate doesn't depend on Tokio, though its default transport needs a Tokio runtime. The blocking client, behind the `ureq` feature, is the same without `.await`:

```rust
use atgeo::{NearbyOptions, Region, blocking::AtgeoClient};

fn main() -> Result<(), atgeo::Error> {
    let atgeo = AtgeoClient::new();
    let result = atgeo.search_nearby(Region::circle(39.9526, -75.1652, 1000.0), NearbyOptions::new("overturemaps.org").text("Starbux"))?;
    println!("{} places", result.places.len());
    Ok(())
}
```

Misspellings are fine. `search_nearby` never sends your text to the server. For a place that isn't nearby, `search_by_keyword` does, and says so in its name:

```rust
use atgeo::KeywordOptions;

let found = atgeo.search_by_keyword("Liberty Bell", KeywordOptions::new("overturemaps.org")).await?;
println!("{:?}", found.disclosed); // Disclosure { keyword: true, region: None }
```

Check `result.complete` and `result.overview` too; see [Client SDKs](/sdk/#overview-versus-complete).

## Constructing a client

```rust
let atgeo = AtgeoClient::with_transport(ReqwestTransport::new())
    .server("http://localhost:8000")
    .cache_budget_bytes(10 * 1024 * 1024);
```

| Builder method | Default | Meaning |
|---|---|---|
| `.server(url)` | `https://places.atgeo.org` | Base URL. |
| `.cache_budget_bytes(n)` | 50 MiB | Cap on the in-memory tile cache. |
| `.clock(...)` | the wall clock | What the caches expire by; for tests. |

A client is `Send + Sync` whenever its transport is. Make one and share it, by reference or in an `Arc`. The async transport is the trait `atgeo::HttpTransport` (one `async fn get(&self, url: &str) -> Result<HttpResponse, BoxError>`; the future must be `Send`). The blocking client takes `atgeo::blocking::HttpTransport`, the same without `async`. Both default transports cap a decoded body at 32 MiB (`max_body_bytes`), time out connections after 10 s and stalled reads after 30 s, and send no `Referer` or `Accept-Language`.

## The calls

The async client's methods are `async`; the blocking client's are the same without it. All return `Result<_, atgeo::Error>`.

### `search_nearby(region, options) -> NearbySearchResult`

Regions: `Region::circle(lat, lon, radius)` (meters), `Region::bbox(west, south, east, north)` (degrees). A `Region` isn't checked when built; `search_nearby` rejects an invalid one before any request.

`NearbyOptions::new(dataset)` takes the required dataset (e.g. `"openstreetmap.org"`; no default) and these setters:

| Setter | Meaning |
|---|---|
| `.text(..)` | Optional. Matched against `name` and `variants[].name`, on the device. |
| `.collection(..)` | Optional, e.g. `"way"`. |
| `.sort(..)` | `SortMode::Fused` (default), `Distance` or `Similarity` (needs text). |

`NearbySearchResult` has `places`, `complete`, `overview`, `tiles`, `tile_failures`, `attribution` and `disclosed`. Each `NearbyHit` has `origin: Option<String>`, `collection: Option<CollectionKey>`, `place: Place`, `importance: Option<i64>`, `distance: f64` and `score: Option<f64>`, plus `name()`, `location()` and `via()` (`"tiles"`). `disclosed.keyword` is always `false` here. `Place` is `Arc<serde_json::Map<String, serde_json::Value>>`: shared, not copied, so `(*hit.place).clone()` gives you one of your own. The result types are `#[non_exhaustive]`; you can't build one with a struct literal.

### `search_by_keyword(keyword, options) -> KeywordSearchResult`

`KeywordOptions::new(dataset)` takes an optional `.collection(..)` and an optional `.region(KeywordRegion::new(west, south, east, north))`. The keyword is **sent to the server**, exactly as given. A region is a box only, never a circle, and goes out snapped outward to whole degrees.

The result is `places`, `attribution` and `disclosed`, in the server's order (most important first, at most 20). Each `KeywordHit` has `origin`, `collection`, `place` and `importance`, plus `name()`, `location()` and `via()` (`"keyword"`): no `distance` and no `score`. It isn't cached. A keyword with no word of two or more characters is sent anyway, and comes back as `Error::Atgeo` with code `KeywordRequired`.

### `search_nearby_then_by_keyword(region, options) -> FallbackSearchResult`

`FallbackOptions::new(dataset, keyword, keyword_region)` takes the keyword and a required `KeywordRegionMode`: `Degree` sends the nearby region's whole-degree box with the keyword, `None` sends no region. `.collection(..)` and `.sort(..)` work as for a nearby search. It runs a nearby search first. If some nearby hit matches the keyword word for word, that's the answer and the keyword stays on the device. Otherwise it sends the keyword and puts the keyword hits first, then the nearby hits, without duplicates. Each is a `FallbackHit::Nearby` or `FallbackHit::Keyword`; `hit.via()` says which. `disclosed` says whether the keyword went out. If the server refuses the keyword as too short (`KeywordRequired`), you get the nearby result, with `disclosed.keyword` true. Any other failed keyword request fails the call and the nearby results are lost, though the keyword may have reached the server.

### `autocomplete_by_keyword(options) -> KeywordAutocomplete` (async client only)

```rust
let field = atgeo.autocomplete_by_keyword(KeywordOptions::new("overturemaps.org"))?;

// on each change to the text field:
match field.search_by_keyword(&text).await {
    Ok(found) => show(&found.places),
    Err(atgeo::Error::Superseded) => {} // a later keystroke replaced this call
    Err(e) => return Err(e),
}
```

Takes the same `KeywordOptions` as `search_by_keyword`, and returns an object whose `search_by_keyword(keyword)` behaves like it. Make one per text field. Each call supersedes the previous one on the same autocompleter, which resolves to `Error::Superseded`. Ignore it. Input the server would refuse (`a`, a single character) makes no request and resolves an empty result. **Every other string goes to the server as typed, prefixes included.** Debouncing is up to you. If the server refuses a keyword that passed that check (`KeywordRequired`), the call resolves empty with `disclosed.keyword` true, and `disclosed.region` `1` if the autocompleter has a region, else `None`. There's no autocompleter in the blocking client, since a blocking call can't be cancelled in flight.

### `get_place(origin) -> PlaceRecord`

Returns `origin`, `place`, `importance` and `attribution`, with the same `name()` and `location()`. Answered from a cached tile if one holds the place; otherwise a request to `org.atgeo.getPlace`. A keyword search caches nothing, so for a keyword hit this usually goes to the network.

### `describe_service() -> ServiceDescription` and `describe_tileset(slug) -> Tileset`

The first is cached for an hour, the second isn't. Fields are `Option`s (except lists the lexicon requires, which are `Vec`s); a field the server drops or retypes comes back `None` or empty.

## Attribution and `disclosed`

Every search result has an `attribution` list: the credit owed for the data the search used, one `Attribution` per `(dataset, collection)`, with `licenses` and the `attribution` URL (the upstream's attribution or copyright page) when the server gave them. Show it wherever you show the places. `get_place` returns the place's own list. Each hit's `collection` says which entry it came from.

Every search result also has `disclosed`, a `Disclosure { keyword, region }` that says what the server learned during that call. `keyword` is true if the keyword was sent. `region` is the grid, in degrees, of the finest region sent (`0.01` for a tile search, `1` for a keyword search with a box), or `None` if none was.

## Keyword methods and privacy

A method whose name contains `keyword` may send the keyword to the server; no other method sends your text. The server's own search index matches it, so these methods can find a place anywhere in the dataset, not just in the tiles you hold. The cost is that the server is told what you typed. `search_nearby` tells it a 0.01 degree cell and nothing about your text.

The server keeps no log of what it receives; that is garganorn's design. An operator who chose to could still record the keyword along with the time and your address, and a hostile one could. Whether that's acceptable for a feature is your app's decision. A region goes out only as whole degrees, about 111 km of latitude, and `disclosed` reports what each call sent.

An autocompleter sends one request per qualifying prefix. Debouncing reduces how many go out; the autocompleter doesn't debounce, so that choice is yours. The [Client SDKs](/sdk/#what-goes-on-the-wire) page lists everything each call sends.

## Concurrency

The async client spawns nothing and has no runtime of its own: a search runs inside the future you poll, with at most eight tile requests in flight. Drop the future to cancel it. Parsing and ranking run on whichever thread polls it, which is real work on a big area (the spec measured 12 ms to parse a 2 MB tile). If your executor can't afford that, call the blocking client from `tokio::task::spawn_blocking`. The blocking client uses scoped threads (eight at most for tiles) and has no cancellation beyond the transport's timeouts.

## Errors

`atgeo::Error` is one enum:

- `Error::Atgeo(AtgeoError)`: a non-2xx from the server, with `code`, `message` and `status`. Codes are the server's (`PlaceNotFound`, `BboxTooLarge`, `KeywordRequired`, ...), or `HttpError` if there was no error body.
- `Error::Decoding(DecodingError)`: a 2xx body that isn't JSON or has nothing usable in it.
- `Error::Transport(BoxError)`: no response arrived. `downcast_ref::<reqwest::Error>()` reaches the transport's own error.
- `Error::Superseded`: an autocompleter call that a later call replaced. Ignore it.
- `Error::InvalidArgument(ArgumentError)`: an invalid region (a `KeywordRegion` included), `Similarity` without text (or, for the fallback, a keyword that normalizes to nothing), or a `server` that isn't an http(s) URL or has credentials. Found before any request.

`Display` says what went wrong at its own level; walk `source()` for the cause. A failed `getTiles` request fails the search. A failed tile doesn't (see [tile failures](/sdk/#tile-failures)). A `TileFailure` has `url`, `kind` (`Refused`, `Status`, `Decode`, `Transport`), `status: Option<u16>` and `error: Option<Arc<atgeo::Error>>`. Failures are equal when their `url`, `kind` and `status` are.

## Conformance

Differences are on malformed input only. Number literals that overflow a double (`1e400`) are a parse error here and Infinity in the reference; nesting deeper than 127 levels is a parse error; place keys come back sorted rather than in served order; and coordinate strings are parsed strictly, so `" 1.5"` and `1.5abc` are no location. See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-rs/blob/main/CONFORMANCE.md).

## Full reference

The [Rust README](https://github.com/schuyler/atgeo-sdk-rs#readme) has the rest, including transports in detail, cache memory costs and the end-to-end example.
