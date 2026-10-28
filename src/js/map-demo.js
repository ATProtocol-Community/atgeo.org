// Map demo: searches the gazetteer through @atgeo/client, entirely in the browser.

import { createClient, AtgeoError, SERVER } from './client.js';
import {
  DATASETS, searchOptions, placePoint, viewportBbox, xrpcURL, fitsBudget, findSearchableBox, boxNote,
} from './places.js';

const container = document.getElementById('map-demo');

if (container) {
  const atgeo = createClient();
  const RESULT_LIMIT = 12;
  const PROBE_TIMEOUT_MS = 5000;

  // Build search controls into the separate search bar
  const searchBar = document.getElementById('map-search');

  const controls = document.createElement('div');
  controls.className = 'map-search';

  const queryInput = document.createElement('input');
  queryInput.type = 'text';
  queryInput.placeholder = 'Search for places...';
  queryInput.setAttribute('aria-label', 'Place search');

  const datasetSelect = document.createElement('select');
  datasetSelect.setAttribute('aria-label', 'Dataset');
  DATASETS.forEach(({ id, label }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    datasetSelect.appendChild(opt);
  });

  const geolocateBtn = document.createElement('button');
  geolocateBtn.type = 'button';
  geolocateBtn.className = 'icon-btn';
  geolocateBtn.setAttribute('aria-label', 'Use my location');
  geolocateBtn.setAttribute('title', 'Use my location');
  geolocateBtn.innerHTML = '<img src="/assets/location-arrow-532530.svg" alt="" width="16" height="16">';

  const searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.className = 'icon-btn icon-btn-wide';
  searchBtn.setAttribute('aria-label', 'Search');
  searchBtn.setAttribute('title', 'Search');
  searchBtn.innerHTML = '<img src="/assets/search-alt-1-532551.svg" alt="" width="16" height="16">';

  const errorMsg = document.createElement('span');
  errorMsg.className = 'map-search-error';
  errorMsg.hidden = true;

  controls.appendChild(queryInput);
  controls.appendChild(datasetSelect);
  controls.appendChild(geolocateBtn);
  controls.appendChild(searchBtn);
  controls.appendChild(errorMsg);
  if (searchBar) searchBar.appendChild(controls);

  // San Francisco.
  const map = new maplibregl.Map({
    container: container,
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    center: [-122.4375, 37.7625],
    zoom: 13.5,
  });

  let markers = [];
  let geolocating = false;
  let searchSeq = 0;

  // The outline of a box searched in place of an over-budget view. A box set before the style
  // has loaded is drawn once it has.
  let searchBox = null;
  function boxFeature(box) {
    if (!box) return { type: 'FeatureCollection', features: [] };
    const [w, s, e, n] = box;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    };
  }
  function showSearchBox(box) {
    searchBox = box;
    const source = map.getSource('search-box');
    if (source) source.setData(boxFeature(box));
  }
  map.on('load', () => {
    map.addSource('search-box', { type: 'geojson', data: boxFeature(searchBox) });
    map.addLayer({
      id: 'search-box',
      type: 'line',
      source: 'search-box',
      paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 2] },
    });
  });

  // Whether the view's regular tiles fit the server's budget, asked of getTiles directly: the SDK
  // doesn't expose it, and it decides which one region the search covers.
  async function fitsTileBudget(options, bbox) {
    const url = xrpcURL(SERVER, 'org.atgeo.getTiles', { ...options, bbox });
    const response = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // fitsBudget throws on the missing body.
    }
    return fitsBudget(response.status, body);
  }

  function clearMarkers() {
    markers.forEach((m) => m.marker.remove());
    markers = [];
  }

  function showError(msg) {
    errorMsg.classList.remove('map-search-note');
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
  }

  function showNote(msg) {
    showError(msg);
    errorMsg.classList.add('map-search-note');
  }

  function clearError() {
    errorMsg.textContent = '';
    errorMsg.hidden = true;
  }

  // place-selected carries { hit, index }: the SDK hit and its position in the results.
  function selectPlace(hit, index) {
    document.dispatchEvent(new CustomEvent('place-selected', { detail: { hit, index } }));
  }

  function fitToMarkers() {
    // Bbox-derived points sit wherever the view was; fitting to them would only drift.
    const exact = markers.filter((m) => !m.approximate);
    if (exact.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    exact.forEach((m) => bounds.extend(m.marker.getLngLat()));
    map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
  }

  async function doSearch() {
    const text = queryInput.value.trim();
    const options = searchOptions(datasetSelect.value);
    const seq = ++searchSeq;

    clearError();
    clearMarkers();
    showSearchBox(null);
    searchBtn.disabled = true;
    searchBtn.classList.add('loading');
    document.dispatchEvent(new CustomEvent('search-results', { detail: [] }));

    const viewport = viewportBbox(map.getBounds());
    let region = viewport;
    let box = null;
    let result;
    try {
      // Over the tile budget, the view gets a sample; a smaller box around its centre may get
      // everything instead. This picks one region to search, never several.
      ({ box } = await findSearchableBox(viewport, (bbox) => fitsTileBudget(options, bbox), {
        isCurrent: () => seq === searchSeq,
      }));
      if (seq !== searchSeq) return;
      if (box) region = box;
      // searchPlaces throws synchronously for a bad region; await inside try catches both.
      result = await atgeo.searchPlaces({
        region: { bbox: region },
        text: text || undefined,
        ...options,
      });
    } catch (err) {
      if (seq !== searchSeq) return;
      if (err instanceof AtgeoError && err.code === 'BboxTooLarge') {
        showError('Zoom in to search here');
      } else {
        showError(`Search failed: ${err.message}`);
      }
      return;
    } finally {
      if (seq === searchSeq) {
        searchBtn.disabled = false;
        searchBtn.classList.remove('loading');
      }
    }
    if (seq !== searchSeq) return;

    const hits = result.places.slice(0, RESULT_LIMIT);
    const notes = [];
    if (box) {
      showSearchBox(box);
      notes.push(boxNote(box));
    }
    // An overview answer is a sample, so an empty one means "zoom in", not "nothing here".
    if (result.overview) notes.push(hits.length ? 'Showing only the most important places here; zoom in for more' : 'Zoom in to search here');
    if (!result.complete) notes.push(`${result.tiles.failed} of ${result.tiles.fetched + result.tiles.failed} tiles failed to load`);
    if (hits.length === 0 && !result.overview) notes.push('No places found here');
    if (notes.length) showNote(notes.join('. '));

    hits.forEach((hit, i) => {
      const point = placePoint(hit.place, region);
      if (!point) return;

      const name = typeof hit.place.name === 'string' ? hit.place.name : '(unnamed)';
      const popup = new maplibregl.Popup({ offset: 25 }).setText(name);

      const marker = new maplibregl.Marker({ color: point.approximate ? '#8a8a8a' : undefined })
        .setLngLat([point.lon, point.lat])
        .setPopup(popup)
        .addTo(map);

      const el = marker.getElement();
      el.addEventListener('mouseenter', () => {
        document.dispatchEvent(new CustomEvent('place-hover', { detail: { recordIndex: i } }));
      });
      el.addEventListener('mouseleave', () => {
        document.dispatchEvent(new CustomEvent('place-unhover', { detail: { recordIndex: i } }));
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPlace(hit, i);
      });

      markers.push({ marker, approximate: !!point.approximate, index: i, point });
    });

    document.dispatchEvent(new CustomEvent('search-results', { detail: hits }));
    fitToMarkers();
  }

  geolocateBtn.addEventListener('click', function () {
    if (geolocating) return;
    geolocating = true;
    geolocateBtn.disabled = true;

    if (!navigator.geolocation) {
      showError('Geolocation is not supported by this browser');
      geolocating = false;
      geolocateBtn.disabled = false;
      return;
    }

    clearError();

    // The position only moves the map; searchPlaces snaps whatever region it's given
    // before anything leaves the browser.
    navigator.geolocation.getCurrentPosition(
      function onSuccess(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const shouldSearch = queryInput.value.trim() !== '';
        const zoom = Math.max(14, map.getZoom());

        let fallbackTimer;
        function moveEndHandler() {
          clearTimeout(fallbackTimer);
          if (shouldSearch) doSearch();
          geolocating = false;
          geolocateBtn.disabled = false;
        }

        map.once('moveend', moveEndHandler);

        fallbackTimer = setTimeout(function () {
          map.off('moveend', moveEndHandler);
          if (shouldSearch) doSearch();
          geolocating = false;
          geolocateBtn.disabled = false;
        }, 5000);

        map.flyTo({ center: [lng, lat], zoom });
      },
      function onError(err) {
        const messages = {
          1: 'Location access denied',
          2: 'Location unavailable',
          3: 'Location request timed out',
        };
        showError(messages[err.code] || 'Could not get location');
        geolocating = false;
        geolocateBtn.disabled = false;
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });

  searchBtn.addEventListener('click', doSearch);
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // Fly to a selected place: close in for a point, without zooming for a region.
  document.addEventListener('place-selected', function (event) {
    const { hit, index } = event.detail || {};
    if (!hit) return;
    const shown = markerFor(index);
    const point = shown ? shown.point : placePoint(hit.place);
    if (!point) return;
    if (point.approximate) {
      map.easeTo({ center: [point.lon, point.lat] });
    } else {
      map.flyTo({ center: [point.lon, point.lat], zoom: 16 });
    }
  });

  function markerFor(idx) {
    return markers.find((m) => m.index === idx);
  }

  document.addEventListener('place-hover', function (event) {
    const m = markerFor(event.detail.recordIndex);
    if (m) m.marker.getElement().classList.add('place-hover');
  });

  document.addEventListener('place-unhover', function (event) {
    const m = markerFor(event.detail.recordIndex);
    if (m) m.marker.getElement().classList.remove('place-hover');
  });

  // Re-zoom to all results when navigating back
  document.addEventListener('results-refocus', fitToMarkers);

  map.on('click', (e) => {
    map.setCenter(e.lngLat);
    if (queryInput.value.trim()) doSearch();
  });
}
