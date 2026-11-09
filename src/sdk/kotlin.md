---
layout: base.njk
title: "Kotlin SDK"
permalink: /sdk/kotlin/
---

# Kotlin SDK

`atgeo-client` is a Kotlin client that searches ATGeo places without telling the server what you searched for. It's a port of the [TypeScript reference](/sdk/javascript/) and returns the same places in the same order for the same server answers.

One artifact runs on the JVM (11 or later) and on Android (API 24 or later). Its only dependencies are kotlinx-coroutines and kotlinx-serialization; HTTP goes through `HttpURLConnection` unless you supply something better.

**Full reference: the [README on GitHub](https://github.com/schuyler/atgeo-sdk-kotlin#readme).** This page is the quickstart. For concepts shared by every SDK, see [Client SDKs](/sdk/).

## Install

Not on Maven Central yet. Get it from [JitPack](https://jitpack.io), pinned to a commit:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        mavenCentral()
        maven("https://jitpack.io")
    }
}

// build.gradle.kts
dependencies {
    implementation("com.github.schuyler:atgeo-sdk-kotlin:<commit-sha>")
}
```

Pin a full SHA, not a branch: breaking changes land on `main`. The first build of a commit takes JitPack a minute or two.

## Synopsis

```kotlin
import org.atgeo.client.AtgeoClient
import org.atgeo.client.Region

val atgeo = AtgeoClient()

val result = atgeo.searchNearby(
    region = Region.Circle(lat = 43.0, lon = -71.45, radius = 3000.0), // meters
    dataset = "overturemaps.org",
    text = "pizza",
    collection = "place",
)

for (hit in result.places) {
    val point = hit.location.point
    println("${hit.name}  ${point?.lat},${point?.lon}  ${hit.distance.toInt()} m  ${"%.2f".format(hit.score)}  ${hit.origin}")
}

// show this wherever you show the places
println(result.attribution.map { it.attribution ?: "${it.dataset}/${it.collection}" })
```

`searchNearby` is a `suspend` function; call it from any coroutine, the main thread included. Parsing and ranking happen on `computeDispatcher`, not on your thread. Misspellings are fine. For a place that isn't nearby, `searchByKeyword` sends your search text to the server, and says so in its name:

```kotlin
val found = atgeo.searchByKeyword(keyword = "Liberty Bell", dataset = "overturemaps.org")
println(found.places.map { it.name })
println(found.disclosed.keyword) // true
```

Check `result.complete` and `result.overview` too; see [Client SDKs](/sdk/#overview-versus-complete).

## Constructing a client

```kotlin
val atgeo = AtgeoClient(
    server = "http://localhost:8000",
    transport = myTransport,
    cacheBudgetBytes = 10L * 1024 * 1024,
    computeDispatcher = Dispatchers.Default,
)
```

| Parameter | Default | Meaning |
|---|---|---|
| `server` | `https://places.atgeo.org` | Base URL. |
| `transport` | `HttpUrlConnectionTransport()` | An `HttpTransport`. |
| `cacheBudgetBytes` | 50 MiB | Cap on the in-memory tile cache. |
| `computeDispatcher` | `Dispatchers.Default` | Where tiles are parsed and results ranked. |

Make one client per server and share it; it's thread-safe, and the caches are what make repeat searches free.

### Transports

`HttpTransport` is one function, `suspend fun get(url: String): HttpResponse`, so a test or an app with its own HTTP stack can pass a lambda. The default, `HttpUrlConnectionTransport`, asks for gzip and refuses a body larger than `maxBodyBytes` once decoded (32 MiB by default) with an `IOException`, because the server chooses the tile URLs. On the JDK, a cancelled request keeps its socket reading until the body ends or the read timeout (30 s by default) fires; your coroutine is released at once either way. For OkHttp, copy [`OkHttpTransport.kt`](https://github.com/schuyler/atgeo-sdk-kotlin/blob/main/android-sample/app/src/main/kotlin/org/atgeo/sample/OkHttpTransport.kt) from the sample app; it isn't part of the library. Whatever transport you use, don't give it a disk cache; the client promises to keep nothing on disk.

## The calls

### `searchNearby(region, dataset, text?, collection?, sort?): NearbySearchResult`

| Parameter | Meaning |
|---|---|
| `region` | Required. `Region.Circle(lat, lon, radius)` (meters) or `Region.Bbox(west, south, east, north)` (degrees). A circle is latitude first, a box longitude first, so name your arguments. |
| `dataset` | Required, e.g. `"openstreetmap.org"`. No default. |
| `collection` | Optional, e.g. `"way"`. |
| `text` | Optional. Matched against `name` and `variants[].name`, on the device. |
| `sort` | `SortMode.FUSED` (default), `DISTANCE` or `SIMILARITY` (needs `text`). |

`NearbySearchResult` has `places`, `complete`, `overview`, `tiles`, `tileFailures`, `attribution` and `disclosed`. Each `NearbyHit` has `via` (`Via.TILES`), `origin: String?`, `collection: CollectionKey?`, `place: JsonObject`, `importance: Long?`, `distance: Double` and `score: Double?`, plus two conveniences: `name` and `location` (a `point` and/or `bbox`, with coordinates already parsed from the strings they arrive as). For any other field, `place["field"].stringOrNull()` gives a string or `null`. `disclosed.keyword` is always `false` here.

The result types are plain classes, not data classes, so later versions can add fields without breaking you. They compare by value but have no `copy()` or destructuring, and only the client constructs them.

### `searchByKeyword(keyword, dataset, collection?, region?): KeywordSearchResult`

| Parameter | Meaning |
|---|---|
| `keyword` | Required. **Sent to the server**, exactly as given. |
| `dataset` | Required. |
| `collection` | Optional. |
| `region` | Optional. A `KeywordRegion(west, south, east, north)`, never a circle; sent snapped outward to whole degrees. |

The result has `places`, `attribution` and `disclosed`, in the server's order (most important first, at most 20). Each `KeywordHit` has `via` (`Via.KEYWORD`), `origin`, `collection`, `place`, `importance`, `name` and `location`: no `distance` and no `score`. It isn't cached. A keyword with no word of two or more characters throws the server's `AtgeoException` with code `KeywordRequired`.

### `searchNearbyThenByKeyword(region, dataset, keyword, keywordRegion, collection?, sort?): FallbackSearchResult`

The parameters of `searchNearby`, with `keyword` in place of `text`, plus a required `keywordRegion`: `KeywordRegionMode.DEGREE` sends the nearby region's whole-degree box with the keyword, `NONE` sends no region. It runs `searchNearby` first. If some nearby hit matches the keyword word for word, that's the answer and the keyword stays on the device. Otherwise it sends the keyword as `searchByKeyword` does and puts the keyword hits first, then the nearby hits, without duplicates. Each is a `PlaceHit` (a `NearbyHit` or a `KeywordHit`), and its `via` says which. `disclosed` says whether the keyword went out. If the server refuses the keyword as too short (`KeywordRequired`), you get the nearby result, with `disclosed.keyword` true. Any other failed keyword request throws and the nearby results are lost, though the keyword may have reached the server.

### `autocompleteByKeyword(dataset, collection?, region?): KeywordAutocomplete`

```kotlin
val field = atgeo.autocompleteByKeyword(dataset = "overturemaps.org")

// on each change to the text field:
scope.launch {
    show(field.searchByKeyword(text).places) // a CancellationException here means "superseded"
}
```

Not a `suspend` function itself; it returns an object whose `suspend fun searchByKeyword(keyword)` behaves like `searchByKeyword`. Make one per text field. Each call supersedes the previous one on the same autocompleter, which throws `CancellationException` although its caller is still active: treat that as "superseded" and ignore it (left uncaught in a `launch {}`, it ends that coroutine quietly). Input the server would refuse (`a`, a single character) makes no request and resolves an empty result. **Every other string goes to the server as typed, prefixes included.** Debouncing is up to you. If the server refuses a keyword that passed that check (`KeywordRequired`), the call resolves empty with `disclosed.keyword` true, and `disclosed.region` `1.0` if the autocompleter has a region, else `null`.

### `getPlace(origin): PlaceRecord`

Returns `PlaceRecord(origin, place, importance, attribution)`, with the same `name` and `location`. Answered from a cached tile if one holds the place; otherwise a request to `org.atgeo.getPlace`. A keyword search caches nothing, so for a keyword hit this usually goes to the network.

### `describeService(): ServiceDescription` and `describeTileset(slug): Tileset`

The first is cached for an hour, the second isn't. A missing or wrong-typed field comes back `null`, except the lists `ServiceDescription.tilesets`, `ServedTileset.collections` and `Tileset.collections`, which come back empty. (`Tileset.references` and the lists inside `CollectionInfo` are `null` when absent.) The types are `@Serializable`, in case you want to store them.

## Attribution and `disclosed`

Every search result has an `attribution` list: the credit owed for the data the search used, one `Attribution` per dataset and collection, with `licenses` and the `attribution` URL (the upstream's attribution or copyright page) when the server gave them. Show it wherever you show the places. `getPlace` returns the place's own list. Each hit's `collection` says which entry it came from.

Every search result also has `disclosed`, which says what the server learned during that call. `disclosed.keyword` is true if the keyword was sent. `disclosed.region` is the grid, in degrees, of the finest region sent (`0.01` for a tile search, `1.0` for a keyword search with a box), or `null` if none was.

## Keyword methods and privacy

With `searchNearby` (only), your search text never leaves the device. A method whose name contains `Keyword` may send the keyword to the server; no other method sends your text. The server's own search index matches it, so these methods can find a place anywhere in the dataset, not just in the tiles you hold. The cost is that the server is told what you typed. `searchNearby` tells it a 0.01 degree cell and nothing about your text.

The server keeps no log of what it receives; that is garganorn's design. An operator who chose to could still record the keyword along with the time and your address, and a hostile one could. Whether that's acceptable for a feature is your app's decision. A region goes out only as whole degrees, about 111 km of latitude, and `disclosed` reports what each call sent.

An autocompleter sends one request per qualifying prefix. Debouncing reduces how many go out; the autocompleter doesn't debounce, so that choice is yours. The [Client SDKs](/sdk/#what-goes-on-the-wire) page lists everything each call sends.

## Errors

- `AtgeoException`: the server's error `code` (`PlaceNotFound`, `BboxTooLarge`, `KeywordRequired`, ... or `HttpError`) and the HTTP `status`.
- `IllegalArgumentException`: an invalid region (a `KeywordRegion` included), or `SIMILARITY` without text. Thrown before any request.
- `AtgeoDecodingException` (an `IOException`): a 2xx body that isn't JSON or has nothing usable in it.
- Network errors come through as whatever the transport throws, usually `IOException`.
- Cancelling the calling coroutine throws `CancellationException`. Don't let a `catch (e: Exception)` swallow it; rethrow it.
- A failed `getTiles` fails the search. A failed tile doesn't (see [tile failures](/sdk/#tile-failures)). `TileFailure.kind` is `REFUSED`, `STATUS`, `DECODE` or `TRANSPORT`; `status` is the HTTP status for `STATUS`, else `null`.

## Conformance

All differences from the reference involve malformed input. Coordinate strings are parsed with `String.toDoubleOrNull()` (so `0x1p3` is 8.0 here and 0 in the reference, and `1.5abc` is no location rather than 1.5); `kotlinx.serialization` accepts unquoted literals like `1.5f` where `JSON.parse` rejects the body; and the JDK's final-sigma rule can differ from V8's next to a digit or combining mark. See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-kotlin/blob/main/CONFORMANCE.md).

## Full reference

The [Kotlin README](https://github.com/schuyler/atgeo-sdk-kotlin#readme) has the rest, including the Android sample and the `includeBuild` setup for working from a checkout.
