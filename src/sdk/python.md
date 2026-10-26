---
layout: base.njk
title: "Python SDK"
permalink: /sdk/python/
---

# Python SDK

`atgeo` is a Python client that searches ATGeo places without telling the server what you searched for. It's a port of the [TypeScript reference](/sdk/javascript/) and returns the same places in the same order for the same server answers.

There's a blocking client for scripts, notebooks and WSGI apps, and an asyncio client for async servers, with the same methods and results. It needs Python 3.11 or later. The plain install brings urllib3 and truststore; the async client needs aiohttp as well.

**Full reference: the [README on GitHub](https://github.com/schuyler/atgeo-sdk-python#readme).** This page is the quickstart. For concepts shared by every SDK, see [Client SDKs](/sdk/).

## Install

Not on PyPI yet. Install from GitHub, pinned to a commit:

```sh
pip install "atgeo @ git+https://github.com/schuyler/atgeo-sdk-python@<commit-sha>"
pip install "atgeo[async] @ git+https://github.com/schuyler/atgeo-sdk-python@<commit-sha>"   # with the async client
```

`uv add` takes the same URL. Pin a full SHA, not a branch: breaking changes land on `main`.

The `async` extra adds aiohttp and the eight or nine packages it needs, several compiled, which is why it's an extra. `import atgeo` never imports aiohttp; `AsyncAtgeoClient()` without it raises an `ImportError` telling you to install `atgeo[async]`.

## Synopsis

```python
from atgeo import AtgeoClient, Circle

with AtgeoClient() as atgeo:
    result = atgeo.search_places(Circle(lat=39.9526, lon=-75.1652, radius=1000), text="Starbux")  # meters

    for hit in result.places:
        print(hit.name, round(hit.distance), f"{hit.score:.2f}", hit.origin)
```

The async version is the same with `await`:

```python
import asyncio
from atgeo import AsyncAtgeoClient, Circle


async def main() -> None:
    async with AsyncAtgeoClient() as atgeo:
        result = await atgeo.search_places(Circle(39.9526, -75.1652, 1000), text="Starbux")
        print(len(result.places))


asyncio.run(main())
```

Misspellings are fine. Check `result.complete` and `result.overview`; if tiles failed, `result.tile_failures` says which and why.

## Constructing a client

```python
atgeo = AtgeoClient(
    "http://localhost:8000",
    transport=my_transport,
    cache_budget_bytes=10 * 1024 * 1024,
)
```

| Argument | Default | Meaning |
|---|---|---|
| `server` (first, positional) | `https://places.atgeo.org` | Base URL; must be absolute `http` or `https` with no credentials, or `ValueError`. |
| `transport` | `Urllib3Transport()` (`AiohttpTransport()` for async) | A transport is one method, `get(url) -> HttpResponse(status, body)`; a coroutine for the async client. |
| `cache_budget_bytes` | 50 MiB | Non-negative integer; cap on the in-memory tile cache. |

Make one client per server and share it. `AtgeoClient` is thread-safe; `AsyncAtgeoClient` is safe across tasks. Both default transports pool connections, so use `with` / `async with`, or call `close()` / `await aclose()`.

The async client's default transport holds an aiohttp session, which belongs to the event loop it was first used in. Using the client from another loop raises `RuntimeError`. A script that calls `asyncio.run` more than once should make a client inside each.

The default transports follow redirects themselves, cap a decoded body at 32 MiB, keep no cookies or cache, verify TLS against the OS certificate store (through truststore; pass `ssl_context=` for your own CA), and read proxies from the usual environment variables. Timeouts are 10 s to connect and 30 s between bytes; `Urllib3Transport` also gives the whole call 120 s. If you already have a configured `requests.Session` or use httpx, the repo has short [examples](https://github.com/schuyler/atgeo-sdk-python/tree/main/examples) to copy.

## The calls

The methods are the same on both clients; on `AsyncAtgeoClient` they're coroutines.

### `search_places(region, *, text=None, dataset=None, collection=None, sort="fused") -> SearchResult`

Regions are `Circle(lat, lon, radius)` (meters) or `Bbox(min_lon, min_lat, max_lon, max_lat)` (degrees). A circle is latitude first, a box longitude first, so name your arguments. Everything after `region` is keyword-only. `sort` is `SortMode.FUSED`, `DISTANCE` or `SIMILARITY`, or the same as strings.

`SearchResult` has `places`, `complete`, `overview`, `tiles` and `tile_failures` (a tuple). Each `SearchHit` has `origin`, `place`, `importance`, `distance`, `score`, plus `name` and `location` properties. The result types are frozen, keyword-only dataclasses.

`place` is a read-only mapping over the cache's own dict, not a copy. `hit.place["name"] = "x"` raises `TypeError`, but the lists and dicts inside it are still shared, so **don't change what's inside**. Copy first with `copy.deepcopy(hit.place)` (a plain mutable `dict`). Note that `json.dumps(hit.place)` fails; use `json.dumps(hit.place.copy())`.

### `get_place(origin) -> PlaceRecord`

Returns `PlaceRecord(origin, place, importance)`. Cache first, then the server.

### `describe_service() -> ServiceDescription` and `describe_tileset(slug) -> Tileset`

The first is cached for an hour, the second isn't. Missing or wrong-typed fields come back `None`. Field names are snake_case (`record_count`, `published_at`) and lists are tuples.

## Errors

- `AtgeoError`: a non-2xx from the server. `code` (or `HttpError`), `message`, and the HTTP `status`.
- `ValueError` for an invalid region, an unknown `sort` or `SIMILARITY` without text; `TypeError` for a region that isn't a `Circle` or `Bbox`. Both before any request.
- `AtgeoDecodingError`: a 2xx body that isn't JSON or has nothing usable in it. It isn't a `ValueError`, so an `except ValueError` meant for a bad region won't swallow it.
- When no answer arrives, you get whatever the transport raised: catch `(urllib3.exceptions.HTTPError, OSError)` with the default blocking transport, `(aiohttp.ClientError, OSError)` with the async one.
- A failed tile has `kind` `REFUSED`, `STATUS`, `DECODE` or `TRANSPORT`. Each is also logged at `DEBUG` on the `atgeo` logger (URL, kind, status and error, never your search text or region); nothing shows until you configure logging.
- Cancelling an async call raises `asyncio.CancelledError`. A blocking search can be interrupted with Ctrl-C.

## Speed

It's pure Python, and dense regions show it. For the kilometer around Philadelphia's City Hall (47 tiles, 40 MB), a cold search with no text on CPython 3.13 takes about a second, nearly all of it parsing JSON; scoring text adds 0.4 to 0.8 s more. Fine for a script, a notebook or a request handler; slow for search-as-you-type. The async client parses and scores on its own threads so the event loop keeps running.

## Conformance

Differences from the reference are on malformed input only. A coordinate string must be a plain ASCII decimal number: `" 1.5"` and `1.5abc` are no location here, and 1.5 in the reference. Very deep JSON nesting raises `RecursionError`; the default transports accept only gzip (or no) content encoding; and Unicode data follows your interpreter's version, so normalization can differ from the reference on characters added in newer Unicode releases. See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-python/blob/main/CONFORMANCE.md).

## Full reference

The [Python README](https://github.com/schuyler/atgeo-sdk-python#readme) has the long version, including every transport detail.
