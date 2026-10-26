---
layout: base.njk
title: "Swift SDK"
permalink: /sdk/swift/
---

# Swift SDK

`Atgeo` is a Swift client that searches ATGeo places without telling the server what you searched for. It's a port of the [TypeScript reference](/sdk/javascript/) and behaves the same way: same requests on the wire, same filtering, scoring and ranking.

It runs on iOS 15, macOS 12, tvOS 15, watchOS 8 and visionOS 1 or later, and on Linux. It needs a Swift 6 toolchain and has no dependencies beyond Foundation.

**Full reference: the [README on GitHub](https://github.com/schuyler/atgeo-sdk-swift#readme).** This page is the quickstart. For concepts shared by every SDK, see [Client SDKs](/sdk/).

## Install

Not tagged yet. Add it with Swift Package Manager, pinned to a commit:

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/schuyler/atgeo-sdk-swift", revision: "<commit-sha>"),
],
targets: [
    .target(name: "MyApp", dependencies: [.product(name: "Atgeo", package: "atgeo-sdk-swift")]),
]
```

In Xcode, that's File > Add Package Dependencies, with the dependency rule set to Commit. Pin a full SHA, not a branch: breaking changes land on `main`.

## Synopsis

```swift
import Atgeo

let atgeo = AtgeoClient()

let result = try await atgeo.searchPlaces(
    region: .circle(lat: 39.9526, lon: -75.1652, radius: 1000),  // meters
    text: "Starbux"
)

for hit in result.places {
    print(hit.place["name"]?.stringValue ?? "-", Int(hit.distance), hit.score ?? 0, hit.origin ?? "-")
}
```

Misspellings are fine. Check `result.complete` and `result.overview`; see [Client SDKs](/sdk/#overview-versus-complete).

## Constructing a client

```swift
let atgeo = AtgeoClient(
    server: URL(string: "http://localhost:8000")!,
    transport: myTransport,
    cacheBudgetBytes: 10 * 1024 * 1024
)
```

| Parameter | Default | Meaning |
|---|---|---|
| `server` | `https://places.atgeo.org` | Base URL. |
| `transport` | `URLSessionTransport()` | Anything conforming to `HTTPTransport`, a protocol with one method: `get(_ url: URL) async throws -> HTTPResponse`. Use `URLSessionTransport(session:)` for a `URLSession` of your own. |
| `cacheBudgetBytes` | 50 MiB | Cap on the in-memory tile cache. |

`AtgeoClient` is an actor. Share one across tasks; every call uses the same caches. The default transport refuses a response body over 32 MiB (counted after decompression), since the server picks the tile URLs. It also uses an ephemeral `URLSession` with no URL cache and no cookies, and sends generic `User-Agent` and `Accept-Language` headers so the request doesn't fingerprint your app or the user's languages.

## The calls

Every method is `async throws`. Cancel the calling `Task` to abort one.

### `searchPlaces(region:text:dataset:collection:sort:) -> SearchResult`

Regions are `.circle(lat:lon:radius:)` (meters) or `.bbox(minLon:minLat:maxLon:maxLat:)` (degrees). `sort` is `.fused` (default), `.distance` or `.similarity`.

`SearchResult` has `places`, `complete`, `overview`, `tiles` (`.fetched`, `.failed`) and `tileFailures`. Each `SearchHit` has `origin: String?`, `place: JSONObject`, `importance: Int64?`, `distance: Double` and `score: Double?`.

`JSONObject` is `[String: JSONValue]`, where `JSONValue` is an enum of the six JSON types, with `stringValue`, `doubleValue`, `boolValue`, `arrayValue` and `objectValue` accessors and subscripts by key and index. So `hit.place["locations"]?[0]?["latitude"]?.stringValue` reads what you'd expect. Nothing is decoded into a Swift type; `place` is the record as served. The result types have public initializers and are `Codable`, handy for SwiftUI previews and tests.

### `place(origin:) -> PlaceRecord`

Here the "get place" call follows Swift's naming guidelines, so it's `place(origin:)`, not `getPlace`. Returns `PlaceRecord` (`origin`, `place`, `importance`). Cache first, then the server.

### `describeService() -> ServiceDescription` and `describeTileset(_ slug:) -> Tileset`

As in the other SDKs: the first is cached for an hour, the second isn't. Every scalar field is optional; a field the server drops or retypes comes back `nil`. The `tilesets` and `collections` lists are always arrays, empty when the server sent none.

## Errors

- `AtgeoError`: a non-2xx from the server, with `code`, `message` and the HTTP `status`. `HttpError` if there was no error body.
- `AtgeoArgumentError`: an invalid region, or `.similarity` without text. Thrown before any request.
- `DecodingError`: a 2xx body that isn't JSON or has nothing usable in it.
- Network errors come from the transport as-is (`URLError` by default). Cancellation throws `CancellationError` or `URLError(.cancelled)`, so check `Task.isCancelled` rather than matching the error.
- A `TileFailure` has `url`, `kind` (`.refused`, `.status`, `.decode`, `.transport`), `status` and `error`. On Apple platforms each failed tile is also logged at debug level (subsystem `org.atgeo`, category `tiles`), with the URL and error marked private. Nothing goes anywhere but the device log.

## Conformance

The Swift port parses JSON with its own parser, so its edge cases are the same on every platform. Differences from the reference are all on malformed input a compliant server never sends: a lone surrogate escape becomes U+FFFD; two canonically equivalent keys merge into one; nesting deeper than 512 levels is a parse error (a `decode` failure inside a tile). See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-swift/blob/main/CONFORMANCE.md) for the rest.

## Full reference

The [Swift README](https://github.com/schuyler/atgeo-sdk-swift#readme) also has the cache memory measurements (useful for extensions and watchOS, where a smaller `cacheBudgetBytes` is a good idea), parser performance, and the end-to-end script.
