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
use atgeo::{AtgeoClient, Region, SearchOptions};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), atgeo::Error> {
    let atgeo = AtgeoClient::new();

    let result = atgeo
        .search_places(
            Region::circle(39.9526, -75.1652, 1000.0), // radius in meters
            SearchOptions::new().text("Starbux"),
        )
        .await?;

    for hit in &result.places {
        println!("{} {:.0} {:?} {:?}", hit.name().unwrap_or("-"), hit.distance, hit.score, hit.origin);
    }
    Ok(())
}
```

The example needs `tokio` (with `macros` and `rt`) in your own dependencies; the crate doesn't depend on Tokio, though its default transport needs a Tokio runtime. The blocking client is the same without `.await`:

```rust
use atgeo::{Region, SearchOptions, blocking::AtgeoClient};

fn main() -> Result<(), atgeo::Error> {
    let atgeo = AtgeoClient::new();
    let result = atgeo.search_places(Region::circle(39.9526, -75.1652, 1000.0), SearchOptions::new().text("Starbux"))?;
    println!("{} places", result.places.len());
    Ok(())
}
```

The public server has a limited dataset for now, mostly the US east coast, so a search elsewhere may come back empty.

## Constructing a client

```rust
let atgeo = AtgeoClient::with_transport(ReqwestTransport::new())
    .server("http://localhost:8000")
    .cache_budget_bytes(10 * 1024 * 1024);
```

| Builder method | Default | Meaning |
|---|---|---|
| `with_transport(t)` | `ReqwestTransport::new()` | Constructor taking your transport. |
| `.server(url)` | `https://places.atgeo.org` | Base URL. |
| `.cache_budget_bytes(n)` | 50 MiB | Cap on the in-memory tile cache. |
| `.clock(...)` | the wall clock | What the caches expire by; for tests. |

A client is `Send + Sync` whenever its transport is. Make one and share it, by reference or in an `Arc`. The async transport is the trait `atgeo::HttpTransport` (one `async fn get(&self, url: &str) -> Result<HttpResponse, BoxError>`; the future must be `Send`). The blocking client takes `atgeo::blocking::HttpTransport`, the same without `async`. Both default transports cap a decoded body at 32 MiB (`max_body_bytes`), time out connections after 10 s and stalled reads after 30 s, and send no `Referer` or `Accept-Language`.

## The calls

The async client's methods are `async`; the blocking client's are the same without it. All return `Result<_, atgeo::Error>`.

### `search_places(region, options) -> SearchResult`

Regions: `Region::circle(lat, lon, radius)` (metres), `Region::bbox(min_lon, min_lat, max_lon, max_lat)` (degrees). A `Region` isn't checked when built; `search_places` rejects an invalid one before any request.

`SearchOptions::new()` takes `.text(..)`, `.dataset(..)`, `.collection(..)` and `.sort(..)` (`SortMode::Fused`, `Distance` or `Similarity`).

`SearchResult` has `places`, `complete`, `overview`, `tiles` and `tile_failures`. Each `SearchHit` has `origin: Option<String>`, `place: Place`, `importance: Option<i64>`, `distance: f64`, `score: Option<f64>`, plus `name()` and `location()`. `Place` is `Arc<serde_json::Map<String, serde_json::Value>>`: shared, not copied, so `(*hit.place).clone()` gives you one of your own. The result types are `#[non_exhaustive]`; you can't build one with a struct literal.

### `get_place(origin) -> PlaceRecord`

Returns `origin`, `place` and `importance`, with the same `name()` and `location()`. Cache first, then the server.

### `describe_service() -> ServiceDescription` and `describe_tileset(slug) -> Tileset`

The first is cached for an hour, the second isn't. Fields are `Option`s (except lists the lexicon requires, which are `Vec`s); a field the server drops or retypes comes back `None` or empty.

## Concurrency

The async client spawns nothing and has no runtime of its own: a search runs inside the future you poll, with at most eight tile requests in flight. Drop the future to cancel it. Parsing and ranking run on whichever thread polls it, which is real work on a big area (the spec measured 12 ms to parse a 2 MB tile). If your executor can't afford that, call the blocking client from `tokio::task::spawn_blocking`. The blocking client uses scoped threads (eight at most for tiles) and has no cancellation beyond the transport's timeouts.

## Errors

`atgeo::Error` is one enum:

- `Error::Atgeo(AtgeoError)`: a non-2xx from the server, with `code` (or `HttpError`), `message` and `status`.
- `Error::Decoding(DecodingError)`: a 2xx body that isn't JSON or has nothing usable in it.
- `Error::Transport(BoxError)`: no response arrived. `downcast_ref::<reqwest::Error>()` reaches the transport's own error.
- `Error::InvalidArgument(ArgumentError)`: an invalid region, `Similarity` without text, or a `server` that isn't an http(s) URL or has credentials. Found before any request.

`Display` says what went wrong at its own level; walk `source()` for the cause. A `TileFailure` has `url`, `kind` (`Refused`, `Status`, `Decode`, `Transport`), `status: Option<u16>` and `error: Option<Arc<atgeo::Error>>`. Failures are equal when their `url`, `kind` and `status` are.

## Conformance

Differences are on malformed input only. Number literals that overflow a double (`1e400`) are a parse error here and Infinity in the reference; nesting deeper than 127 levels is a parse error; place keys come back sorted rather than in served order; and coordinate strings are parsed strictly, so `" 1.5"` and `1.5abc` are no location. See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-rs/blob/main/CONFORMANCE.md).

## Full reference

The [Rust README](https://github.com/schuyler/atgeo-sdk-rs#readme) has the rest, including transports in detail, cache memory costs and the end-to-end example.
