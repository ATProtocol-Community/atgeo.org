---
layout: base.njk
title: "Swift SDK"
permalink: /sdk/swift/
---

# Swift SDK

`Atgeo` is a Swift client that searches ATGeo places without telling the server what you searched for. The methods that do send the server a keyword have `Keyword` in their names. It's a port of the [TypeScript reference](/sdk/javascript/) and behaves the same way: same requests on the wire, same filtering, scoring and ranking.

It runs on iOS 15, macOS 12, tvOS 15, watchOS 8 and visionOS 1 or later, and on Linux. It needs a Swift 6 toolchain and has no dependencies beyond Foundation.

**Full reference: the [README on GitHub](https://github.com/schuyler/atgeo-sdk-swift#readme).** This page is the quickstart. For concepts shared by every SDK (regions, sorting, overview answers, privacy), see [Client SDKs](/sdk/).

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

let result = try await atgeo.searchNearby(
    region: .circle(lat: 39.9526, lon: -75.1652, radius: 1000),  // meters
    dataset: "overturemaps.org",
    text: "Starbux"
)

for hit in result.places {
    print(hit.name ?? "-", Int(hit.distance), hit.score ?? 0, hit.origin ?? "-")
}

// show this wherever you show the places
print(result.attribution.map { $0.attribution ?? "\($0.dataset)/\($0.collection)" })
```

Misspellings are fine. `searchNearby` never sends your text to the server. For a place that isn't nearby, `searchByKeyword` does, and says so in its name:

```swift
let found = try await atgeo.searchByKeyword(keyword: "Liberty Bell", dataset: "overturemaps.org")
print(found.places.map { $0.name ?? "-" }, found.disclosed)  // Disclosure(keyword: true, region: nil)
```

Check `result.complete` and `result.overview` too; see [Client SDKs](/sdk/#overview-versus-complete).

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

`AtgeoClient` is an actor. Share one across tasks; every call uses the same caches. The default transport refuses a response body over 32 MiB (counted after decompression), since the server picks the tile URLs; `URLSessionTransport(maxBodyBytes:)` changes the limit. It also uses an ephemeral `URLSession` with no URL cache and no cookies, and sends generic `User-Agent` and `Accept-Language` headers so the request doesn't fingerprint your app or the user's languages.

## The calls

Every method except `autocompleteByKeyword` is `async throws`. Cancel the calling `Task` to abort one.

### `searchNearby(region:dataset:text:collection:sort:) -> NearbySearchResult`

| Parameter | Meaning |
|---|---|
| `region` | Required. `.circle(lat:lon:radius:)` (meters) or `.bbox(west:south:east:north:)` (degrees). |
| `dataset` | Required, e.g. `"openstreetmap.org"`. No default. |
| `text` | Optional. Matched against `name` and `variants[].name`, on the device. |
| `collection` | Optional, e.g. `"way"`. |
| `sort` | `.fused` (default), `.distance` or `.similarity` (needs `text`). |

`NearbySearchResult` has `places`, `complete`, `overview`, `tiles` (`.fetched`, `.failed`), `tileFailures`, `attribution` and `disclosed`. Each `NearbyHit` has `via` (`.tiles`), `origin: String?`, `collection: CollectionKey?`, `place: JSONObject`, `name: String?`, `location: PlaceLocation`, `importance: Int64?`, `distance: Double` and `score: Double?`. `disclosed.keyword` is always `false` here.

`JSONObject` is `[String: JSONValue]`, where `JSONValue` is an enum of the six JSON types, with `stringValue`, `doubleValue`, `boolValue`, `arrayValue` and `objectValue` accessors and subscripts by key and index. So `hit.place["locations"]?[0]?["latitude"]?.stringValue` reads what you'd expect. Nothing is decoded into a Swift type; `place` is the record as served. `name` and `location` (`point` and `bbox`, both optional) are read from it for you. The result types have public initializers and are `Codable`, handy for SwiftUI previews and tests. They're value types, so a hit's `place` is your own copy, nested objects included.

### `searchByKeyword(keyword:dataset:collection:region:) -> KeywordSearchResult`

| Parameter | Meaning |
|---|---|
| `keyword` | Required. **Sent to the server**, exactly as given. |
| `dataset` | Required. |
| `collection` | Optional. |
| `region` | Optional. A `KeywordRegion(west:south:east:north:)`, never a circle; sent snapped outward to whole degrees. |

The result is `places`, `attribution` and `disclosed`, in the server's order (most important first, at most 20). Each `KeywordHit` has `via` (`.keyword`), `origin`, `collection`, `place`, `name`, `location` and `importance`: no `distance` and no `score`. It isn't cached. A keyword with no word of two or more characters throws the server's `AtgeoError` with code `KeywordRequired`.

### `searchNearbyThenByKeyword(region:dataset:keyword:keywordRegion:collection:sort:) -> FallbackSearchResult`

The parameters of `searchNearby`, with `keyword` in place of `text`, plus a required `keywordRegion`: `.degree` sends the nearby region's whole-degree box with the keyword, `.none` sends no region. It runs `searchNearby` first. If some nearby hit matches the keyword word for word, that's the answer and the keyword stays on the device. Otherwise it calls `searchByKeyword` and puts the keyword hits first, then the nearby hits, without duplicates. Each hit is a `PlaceHit` (`.nearby` or `.keyword`), and its `via` says where it came from. `disclosed` says whether the keyword went out. If the server refuses the keyword as too short (`KeywordRequired`), you get the nearby result, with `disclosed.keyword` true. Any other failed keyword request throws and the nearby results are lost, though the keyword may have reached the server.

### `autocompleteByKeyword(dataset:collection:region:) throws -> KeywordAutocomplete`

```swift
let field = try atgeo.autocompleteByKeyword(dataset: "overturemaps.org")

// on each change to the text field:
do {
    show(try await field.searchByKeyword(text).places)
} catch is CancellationError {
    // superseded by a later keystroke
}
```

Returns an object whose `searchByKeyword(_:)` behaves like `searchByKeyword`. Make one per text field. Each call supersedes the previous one on the same autocompleter, which throws `CancellationError` although its own task wasn't cancelled; ignore it. Input the server would refuse (`a`, a single character) makes no request and resolves an empty result. **Every other string goes to the server as typed, prefixes included.** Debouncing is up to you. If the server refuses a keyword that passed that check (`KeywordRequired`), the call resolves empty with `disclosed.keyword` true, and `disclosed.region` `1` if the autocompleter has a region, else `nil`.

### `getPlace(origin:) -> PlaceRecord`

Returns `origin`, `place`, `name`, `location`, `importance` and `attribution`. Answered from a cached tile if one holds the place; otherwise a request to `org.atgeo.getPlace`. A keyword search caches nothing, so for a keyword hit this usually goes to the network.

### `describeService() -> ServiceDescription` and `describeTileset(_ slug:) -> Tileset`

The first is cached for an hour, the second isn't. Every scalar field is optional; a field the server drops or retypes comes back `nil`. The `tilesets` and `collections` lists are always arrays, empty when the server sent none.

## Attribution and `disclosed`

Every search result has an `attribution` list: the credit owed for the data the search used, one `Attribution` per `(dataset, collection)`, with `licenses` and the `attribution` URL (the upstream's attribution or copyright page) when the server gave them. Show it wherever you show the places. `getPlace` returns the place's own list. Each hit's `collection` says which entry it came from.

Every search result also has `disclosed`, a `Disclosure(keyword:region:)` that says what the server learned during that call. `keyword` is true if the keyword was sent. `region` is the grid, in degrees, of the finest region sent (`0.01` for a tile search, `1` for a keyword search with a box), or `nil` if none was.

## Keyword methods and privacy

A method whose name contains `Keyword` may send the keyword to the server; no other method sends your text. The server's own search index matches it, so these methods can find a place anywhere in the dataset, not just in the tiles you hold. The cost is that the server is told what you typed. `searchNearby` tells it a 0.01 degree cell and nothing about your text.

The server keeps no log of what it receives; that is garganorn's design. An operator who chose to could still record the keyword along with the time and your address, and a hostile one could. Whether that's acceptable for a feature is your app's decision. A region goes out only as whole degrees, about 111 km of latitude, and `disclosed` reports what each call sent.

An autocompleter sends one request per qualifying prefix. Debouncing reduces how many go out; the autocompleter doesn't debounce, so that choice is yours. The [Client SDKs](/sdk/#what-goes-on-the-wire) page lists everything each call sends.

## Errors

- `AtgeoError`: a non-2xx from the server, with `code`, `message` and the HTTP `status`. Codes are the server's (`PlaceNotFound`, `BboxTooLarge`, `KeywordRequired`, ...), or `HttpError` if there was no error body.
- `AtgeoArgumentError`: an invalid region, or `.similarity` without text. Thrown before any request. A `KeywordRegion` that isn't a valid box does the same, from `searchByKeyword` or `autocompleteByKeyword`.
- `DecodingError`: a 2xx body that isn't JSON or has nothing usable in it.
- Network errors come from the transport as-is (`URLError` by default). Cancellation throws `CancellationError` or `URLError(.cancelled)`, so check `Task.isCancelled` rather than matching the error. A call answered entirely from cache completes even if its task was already cancelled.
- A failed `getTiles` request fails the search. A failed tile doesn't (see [tile failures](/sdk/#tile-failures)). A `TileFailure` has `url`, `kind` (`.refused`, `.status`, `.decode`, `.transport`), `status` and `error`. On Apple platforms each failed tile is also logged at debug level (subsystem `org.atgeo`, category `tiles`), with the URL and error marked private. Nothing goes anywhere but the device log.

## Conformance

The Swift port parses JSON with its own parser, so its edge cases are the same on every platform. Differences from the reference are all on malformed input a compliant server never sends: a lone surrogate escape becomes U+FFFD; two canonically equivalent keys merge into one; nesting deeper than 512 levels is a parse error (a `decode` failure inside a tile). See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-swift/blob/main/CONFORMANCE.md) for the rest.

## Full reference

The [Swift README](https://github.com/schuyler/atgeo-sdk-swift#readme) also has the cache memory measurements (useful for extensions and watchOS, where a smaller `cacheBudgetBytes` is a good idea), parser performance, and the end-to-end script.
