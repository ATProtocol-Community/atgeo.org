// Map demo: searches the gazetteer through @atgeo/client. Text stays in the browser unless
// the tile search finds nothing and the search widens to the server's keyword search.

import { createClient, AtgeoError } from './client.js';
import {
  DATASETS, searchOptions, placePoint, viewportBbox, hitMarkerPoint, hitBox, boundsOf, widenSearch,
} from './places.js';

const container = document.getElementById('map-demo');

if (container) {
  const atgeo = createClient();
  const RESULT_LIMIT = 12;

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

  // Philadelphia City Hall. The public data covers mostly the US east coast for now.
  const map = new maplibregl.Map({
    container: container,
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    center: [-75.1652, 39.9526],
    zoom: 14.5,
  });

  let markers = [];
  let currentFit = [];
  let geolocating = false;
  let searchSeq = 0;

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

  function fitTo(boxes) {
    const b = boundsOf(boxes);
    if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 50, maxZoom: 17 });
  }

  async function doSearch({ keywordFallback = true } = {}) {
    const text = queryInput.value.trim();
    const seq = ++searchSeq;

    clearError();
    clearMarkers();
    searchBtn.disabled = true;
    searchBtn.classList.add('loading');
    document.dispatchEvent(new CustomEvent('search-results', { detail: [] }));

    const viewport = viewportBbox(map.getBounds());
    let outcome;
    try {
      // searchNearby throws synchronously for a bad region; await inside try catches both.
      if (text) {
        outcome = await widenSearch({
          atgeo,
          viewport,
          text,
          options: searchOptions(datasetSelect.value),
          isStale: () => seq !== searchSeq,
          keywordFallback,
        });
      } else {
        const result = await atgeo.searchNearby({
          region: { bbox: viewport },
          ...searchOptions(datasetSelect.value),
        });
        outcome = { stage: 1, hits: result.places, result };
      }
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

    const { stage, result } = outcome;
    const hits = outcome.hits.slice(0, RESULT_LIMIT);
    const expanded = stage === 1 && !!result?.expanded;
    const widened = stage > 1 || expanded;
    const notes = [];
    if (expanded) notes.push('Nothing here matched; showing the closest match from nearby tiles');
    if (stage > 1) {
      notes.push(`Not found nearby; searched the server for '${text}' (${stage === 2 ? 'about a degree' : 'the whole world'})`);
    }
    if (stage === 1 && result?.overview) notes.push('Showing only the most important places here; zoom in for more');
    if (result && !result.complete) notes.push(`${result.tiles.failed} of ${result.tiles.fetched + result.tiles.failed} tiles failed to load`);
    if (hits.length === 0) notes.push(stage > 1 ? 'No places found' : 'No places found here');
    if (notes.length) showNote(notes.join('. '));

    hits.forEach((hit, i) => {
      const point = widened ? hitMarkerPoint(hit) : placePoint(hit.place, viewport);
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
    if (expanded) {
      currentFit = [viewport, hitBox(hits[0])];
    } else if (stage === 2) {
      currentFit = hits.map(hitBox);
    } else if (stage === 3) {
      currentFit = [hitBox(hits[0])];
    } else {
      // Bbox-derived points sit wherever the view was; fitting to them would only drift.
      currentFit = markers.filter((m) => !m.approximate).map((m) => [m.point.lon, m.point.lat, m.point.lon, m.point.lat]);
    }
    fitTo(currentFit);
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

    // The position only moves the map; searchNearby snaps whatever region it's given
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

  searchBtn.addEventListener('click', () => doSearch());
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
  document.addEventListener('results-refocus', () => fitTo(currentFit));

  map.on('click', (e) => {
    map.setCenter(e.lngLat);
    if (queryInput.value.trim()) doSearch({ keywordFallback: false });
  });
}
