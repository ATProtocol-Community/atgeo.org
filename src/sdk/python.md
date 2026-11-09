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
    result = atgeo.search_nearby(
        Circle(lat=39.9526, lon=-75.1652, radius=1000),  # meters
        dataset="overturemaps.org",
        collection="place",
        text="Starbux",
    )

    for hit in result.places:
        print(hit.name, round(hit.distance), f"{hit.score:.2f}", hit.origin)

    for credit in result.attribution:  # show this wherever you show the places
        print(credit.dataset, credit.collection, credit.licenses)
```

The async version is the same with `await`:

```python
import asyncio
from atgeo import AsyncAtgeoClient, Circle


async def main() -> None:
    async with AsyncAtgeoClient() as atgeo:
        result = await atgeo.search_nearby(
            Circle(39.9526, -75.1652, 1000), dataset="overturemaps.org", collection="place", text="Starbux"
        )
        print(len(result.places))

        # For a place that isn't nearby, search_by_keyword sends the keyword to the server.
        found = await atgeo.search_by_keyword("Liberty Bell", dataset="overturemaps.org")
        print([p.name for p in found.places], found.disclosed)  # Disclosure(keyword=True, region=None)


asyncio.run(main())
```

Misspellings are fine. `search_nearby` never sends your text to the server. For a place that isn't nearby, `search_by_keyword` does, and says so in its name (see the last lines of the example above).

Check `result.complete` and `result.overview` too; if tiles failed, `result.tile_failures` says which and why.

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

The methods are the same on both clients; on `AsyncAtgeoClient` they're coroutines, except `autocomplete_by_keyword`, which is async-client only and returns the autocompleter synchronously.

### `search_nearby(region, *, dataset, text=None, collection=None, sort="fused") -> NearbySearchResult`

| Argument | Meaning |
|---|---|
| `region` | Required. `Circle(lat, lon, radius)` (meters) or `Bbox(west, south, east, north)` (degrees). A circle is latitude first, a box longitude first, so name your arguments. |
| `dataset` | Required, e.g. `"openstreetmap.org"`. No default; a missing or non-string one is a `TypeError`. |
| `text` | Optional. Matched against `name` and `variants[].name`, on the device. |
| `collection` | Optional, e.g. `"way"`. |
| `sort` | `SortMode.FUSED` (default), `DISTANCE` or `SIMILARITY` (needs `text`), or the same as strings. |

Everything after `region` is keyword-only.

`NearbySearchResult` has `places`, `complete`, `overview`, `tiles`, `tile_failures` (a tuple), `attribution` (a tuple) and `disclosed`. Each `NearbyHit` has `via` (`"tiles"`), `origin`, `collection`, `place`, `importance`, `distance`, `score`, plus `name` and `location` properties. `disclosed.keyword` is always `False` here. The result types are frozen, keyword-only dataclasses.

`place` is a read-only mapping over the cache's own dict, not a copy. `hit.place["name"] = "x"` raises `TypeError`, but the lists and dicts inside it are still shared, so **don't change what's inside**. Copy first with `copy.deepcopy(hit.place)` (a plain mutable `dict`). Note that `json.dumps(hit.place)` fails; use `json.dumps(hit.place.copy())`.

### `search_by_keyword(keyword, *, dataset, collection=None, region=None) -> KeywordSearchResult`

| Argument | Meaning |
|---|---|
| `keyword` | Required. **Sent to the server**, exactly as given. |
| `dataset` | Required. |
| `collection` | Optional. |
| `region` | Optional. A `Bbox`, never a `Circle` (a `TypeError`); sent snapped outward to whole degrees. |

The result has `places`, `attribution` and `disclosed`, in the server's order (most important first, at most 20). Each `KeywordHit` has `via` (`"keyword"`), `origin`, `collection`, `place`, `importance`, `name` and `location`: no `distance` and no `score`. It isn't cached. A keyword with no word of two or more characters raises the server's `AtgeoError` with code `KeywordRequired`.

### `search_nearby_then_by_keyword(region, *, dataset, keyword, keyword_region, collection=None, sort="fused") -> FallbackSearchResult`

The arguments of `search_nearby`, with `keyword` in place of `text`, plus a required `keyword_region`: `"degree"` sends the nearby region's whole-degree box with the keyword, `"none"` sends no region (anything else is a `ValueError`). It runs `search_nearby` first. If some nearby hit matches the keyword word for word, that's the answer and the keyword stays on the device. Otherwise it sends the keyword as `search_by_keyword` does and puts the keyword hits first, then the nearby hits, without duplicates. Each hit's `via` says where it came from, and `disclosed` says whether the keyword went out. If the server refuses the keyword as too short (`KeywordRequired`), you get the nearby result, with `disclosed.keyword` true. Any other failed keyword request raises and the nearby results are lost, though the keyword may have reached the server.

### `autocomplete_by_keyword(*, dataset, collection=None, region=None) -> KeywordAutocomplete` (async client only)

```python
typing = atgeo.autocomplete_by_keyword(dataset="overturemaps.org", collection="place")


async def on_keystroke(text: str) -> None:
    try:
        result = await typing.search_by_keyword(text)
    except asyncio.CancelledError:
        if asyncio.current_task().cancelling():  # we were cancelled; let it through
            raise
        return  # superseded by a later keystroke
    show(result.places)
```

Returns an object whose `await search_by_keyword(keyword)` behaves like `search_by_keyword`. Make one per text field. Each call supersedes the previous one on the same autocompleter, which ends with `asyncio.CancelledError` although the awaiting task wasn't cancelled; `current_task().cancelling()` is 0 for a superseded call. Input the server would refuse (`a`, a single character) makes no request and returns an empty result. **Every other string goes to the server as typed, prefixes included.** Debouncing is up to you. If the server refuses a keyword that passed that check (`KeywordRequired`), the call returns an empty result with `disclosed.keyword` true, and `disclosed.region` `1.0` if the autocompleter has a region, else `None`. The blocking client has no autocompleter, since a blocking call can't be cancelled in flight.

### `get_place(origin) -> PlaceRecord`

Returns `PlaceRecord(origin, place, importance, attribution)`, with the same `name`, `location` and read-only `place`. Answered from a cached tile if one holds the place; otherwise a request to `org.atgeo.getPlace`. A keyword search caches nothing, so for a keyword hit this usually goes to the network.

### `describe_service() -> ServiceDescription` and `describe_tileset(slug) -> Tileset`

The first is cached for an hour, the second isn't. Missing or wrong-typed fields come back `None`. Field names are snake_case (`record_count`, `published_at`) and lists are tuples.

## Attribution and `disclosed`

Every search result has an `attribution` tuple: the credit owed for the data the search used, one `Attribution` per `(dataset, collection)`, with `licenses` and the `attribution` URL when the server gave them. Show it wherever you show the places. `get_place` returns the place's own. Each hit's `collection` says which entry it came from.

Every search result also has `disclosed`, a `Disclosure(keyword, region)` that says what the server learned during that call. `keyword` is true if the keyword was sent. `region` is the grid, in degrees, of the finest region sent (`0.01` for a tile search, `1.0` for a keyword search with a box), or `None` if none was.

## Keyword methods and privacy

A method whose name contains `keyword` may send the keyword to the server; no other method sends your text. The server's own search index matches it, so these methods can find a place anywhere in the dataset, not just in the tiles you hold. The cost is that the server is told what you typed. `search_nearby` tells it a 0.01 degree cell and nothing about your text.

The server keeps no log of what it receives; that is garganorn's design. An operator who chose to could still record the keyword along with the time and your address, and a hostile one could. Whether that's acceptable for a feature is your app's decision. A region goes out only as whole degrees, about 111 km of latitude, and `disclosed` reports what each call sent.

An autocompleter sends one request per qualifying prefix. Debouncing reduces how many go out; the autocompleter doesn't debounce, so that choice is yours. The [Client SDKs](/sdk/#what-goes-on-the-wire) page lists everything each call sends.

## Errors

- `AtgeoError`: a non-2xx from the server. `code` (`PlaceNotFound`, `BboxTooLarge`, `KeywordRequired`, ... or `HttpError`), `message`, and the HTTP `status`.
- `TypeError` for a missing or non-string `dataset` or `keyword`, or a region that isn't a `Circle` or `Bbox` (a `Circle` given to `search_by_keyword` included); `ValueError` for an invalid region, an unknown `sort`, a `keyword_region` that isn't `"none"` or `"degree"`, or `SIMILARITY` without text. All before any request.
- `AtgeoDecodingError`: a 2xx body that isn't JSON or has nothing usable in it. It isn't a `ValueError`, so an `except ValueError` meant for a bad region won't swallow it.
- When no answer arrives, you get whatever the transport raised: catch `(urllib3.exceptions.HTTPError, OSError)` with the default blocking transport, `(aiohttp.ClientError, OSError)` with the async one.
- A failed `getTiles` fails the search. A failed tile doesn't (see [tile failures](/sdk/#tile-failures)). Its `kind` is `REFUSED`, `STATUS`, `DECODE` or `TRANSPORT`. Each is also logged at `DEBUG` on the `atgeo` logger (URL, kind, status and error, never your search text or region); nothing shows until you configure logging.
- Cancelling an async call raises `asyncio.CancelledError`, and so does an autocompleter call that a later call superseded. A blocking search can be interrupted with Ctrl-C.

## Speed

It's pure Python, and dense regions show it. For the kilometer around Philadelphia's City Hall (47 tiles, 40 MB), a cold search with no text on CPython 3.13 takes about a second, nearly all of it parsing JSON; scoring text adds 0.4 to 0.8 s more. Fine for a script, a notebook or a request handler; slow for search-as-you-type. The async client parses and scores on its own threads so the event loop keeps running.

## Conformance

Differences from the reference are on malformed input only. A coordinate string must be a plain ASCII decimal number: `" 1.5"` and `1.5abc` are no location here, and 1.5 in the reference. Very deep JSON nesting raises `RecursionError`; the default transports accept only gzip (or no) content encoding; and Unicode data follows your interpreter's version, so normalization can differ from the reference on characters added in newer Unicode releases. See [CONFORMANCE.md](https://github.com/schuyler/atgeo-sdk-python/blob/main/CONFORMANCE.md).

## Full reference

The [Python README](https://github.com/schuyler/atgeo-sdk-python#readme) has the long version, including every transport detail.
