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

val result = atgeo.searchPlaces(
    region = Region.Circle(lat = 43.0, lon = -71.45, radius = 3000.0), // meters
    text = "pizza",
)

for (hit in result.places) {
    val point = hit.location.point
    println("${hit.name}  ${point?.lat},${point?.lon}  ${hit.distance.toInt()} m  ${"%.2f".format(hit.score)}  ${hit.origin}")
}
```

`searchPlaces` is a `suspend` function; call it from any coroutine, the main thread included. Parsing and ranking happen on `computeDispatcher`, not on your thread.

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

### `searchPlaces(region, text?, dataset?, collection?, sort?): SearchResult`

Regions are `Region.Circle(lat, lon, radius)` (meters) or `Region.Bbox(minLon, minLat, maxLon, maxLat)` (degrees). A circle is latitude first, a box longitude first, so name your arguments. `sort` is `SortMode.FUSED` (default), `DISTANCE` or `SIMILARITY`.

`SearchResult` has `places`, `complete`, `overview`, `tiles` and `tileFailures`. Each `SearchHit` has `origin: String?`, `place: JsonObject`, `importance: Long?`, `distance: Double` and `score: Double?`, plus two conveniences: `name` and `location` (a `point` and/or `bbox`, with coordinates already parsed from the strings they arrive as). For any other field, `place["field"].stringOrNull()` gives a string or `null`.

The result types are plain classes, not data classes, so later versions can add fields without breaking you. They compare by value but have no `copy()` or destructuring, and only the client constructs them.

### `getPlace(origin): PlaceRecord`

Returns `PlaceRecord(origin, place, importance)`, with the same `name` and `location`. Cache first, then the server.

### `describeService(): ServiceDescription` and `describeTileset(slug): Tileset`

The first is cached for an hour, the second isn't. Missing or wrong-typed fields come back `null`. The types are `@Serializable`, in case you want to store them.

## Errors

- `AtgeoException`: the server's error `code` (or `HttpError`) and the HTTP `status`.
- `IllegalArgumentException`: an invalid region, or `SIMILARITY` without text. Thrown before any request.
- `AtgeoDecodingException` (an `IOException`): a 2xx body that isn't JSON or has nothing usable in it.
- Network errors come through as whatever the transport throws, usually `IOException`.
- Cancelling the calling coroutine throws `CancellationException`. Don't let a `catch (e: Exception)` swallow it; rethrow it.
- `TileFailure.kind` is `REFUSED`, `STATUS`, `DECODE` or `TRANSPORT`; `status` is the HTTP status for `STATUS`, else `null`.

## Conformance

All differences from the reference involve malformed input. Coordinate strings are parsed with `String.toDoubleOrNull()` (so `0x1p3` is 8.0 here and 0 in the reference, and `1.5abc` is no location rather than 1.5); `kotlinx.serialization` accepts unquoted literals like `1.5f` where `JSON.parse` rejects the body; and the JDK's final-sigma rule can differ from V8's next to a digit or combining mark. See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-kotlin/blob/main/CONFORMANCE.md).

## Full reference

The [Kotlin README](https://github.com/schuyler/atgeo-sdk-kotlin#readme) has the rest, including the Android sample and the `includeBuild` setup for working from a checkout.
