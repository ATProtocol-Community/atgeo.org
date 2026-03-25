// Map demo implementation

(function () {
  const GETRECORD_URL =
    'https://places.atgeo.org/xrpc/com.atproto.repo.getRecord';

  const container = document.getElementById('map-demo');
  if (!container) return;

  // Ensure the container is positioned so absolute children work
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // Build search controls
  const controls = document.createElement('div');
  controls.className = 'map-search';

  const queryInput = document.createElement('input');
  queryInput.type = 'text';
  queryInput.placeholder = 'Search for places...';
  queryInput.setAttribute('aria-label', 'Place search');

  const collectionSelect = document.createElement('select');
  [
    { label: 'Foursquare', value: 'org.atgeo.places.foursquare' },
    { label: 'Overture Maps', value: 'org.atgeo.places.overture' },
  ].forEach(({ label, value }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    collectionSelect.appendChild(opt);
  });

  const searchBtn = document.createElement('button');
  searchBtn.textContent = 'Search';

  const errorMsg = document.createElement('span');
  errorMsg.className = 'map-search-error';

  controls.appendChild(queryInput);
  controls.appendChild(collectionSelect);
  controls.appendChild(searchBtn);
  controls.appendChild(errorMsg);
  container.appendChild(controls);

  // Initialize map
  const map = new maplibregl.Map({
    container: container,
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    center: [-122.4375, 37.7625],
    zoom: 11.25,
  });

  let markers = [];
  // Cache of full records keyed by URI
  const recordCache = {};

  function clearMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
  }

  function clearError() {
    errorMsg.textContent = '';
    errorMsg.hidden = true;
  }

  function selectPlace(record) {
    document.dispatchEvent(
      new CustomEvent('place-selected', { detail: record })
    );
  }

  async function fetchFullRecord(searchRecord) {
    const uri = searchRecord.uri;
    if (recordCache[uri]) return recordCache[uri];

    const collection = searchRecord.value?.collection;
    const rkey = searchRecord.value?.rkey;
    if (!collection || !rkey) {
      recordCache[uri] = searchRecord;
      return searchRecord;
    }

    try {
      const url = new URL(GETRECORD_URL);
      url.searchParams.set('repo', 'gazetteer.social');
      url.searchParams.set('collection', collection);
      url.searchParams.set('rkey', rkey);
      const resp = await fetch(url.toString());
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      recordCache[uri] = data;
      return data;
    } catch (err) {
      console.warn('Failed to fetch full record', uri, err);
      recordCache[uri] = searchRecord;
      return searchRecord;
    }
  }

  async function doSearch() {
    const q = queryInput.value.trim();
    const collection = collectionSelect.value;
    const center = map.getCenter();

    clearError();
    clearMarkers();
    document.dispatchEvent(new CustomEvent('search-results', { detail: [] }));

    const params = new URLSearchParams({
      collection,
      latitude: center.lat,
      longitude: center.lng,
      limit: 10,
    });
    if (q) params.set('q', q);

    let data;
    try {
      const resp = await fetch(
        `https://places.atgeo.org/xrpc/org.atgeo.searchRecords?${params}`
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
    } catch (err) {
      showError(`Search failed: ${err.message}`);
      return;
    }

    const records = data.records || [];
    const fetchPromises = [];

    records.forEach(record => {
      const locations = record?.value?.locations || [];
      const geoLoc = locations.find(
        l => l.$type && l.$type.toLowerCase().includes('geo')
      );
      if (!geoLoc || geoLoc.latitude == null || geoLoc.longitude == null) return;

      const name = record?.value?.names?.[0]?.text || '(unnamed)';

      fetchPromises.push(fetchFullRecord(record));

      const popup = new maplibregl.Popup({ offset: 25 }).setText(name);

      const marker = new maplibregl.Marker()
        .setLngLat([geoLoc.longitude, geoLoc.latitude])
        .setPopup(popup)
        .addTo(map);

      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        const cached = recordCache[record.uri];
        selectPlace(cached || record);
      });

      markers.push(marker);
    });

    // Once all full records are fetched, send them to the results panel
    Promise.all(fetchPromises).then(fullRecords => {
      document.dispatchEvent(new CustomEvent('search-results', { detail: fullRecords }));
    });

    if (markers.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      markers.forEach(m => bounds.extend(m.getLngLat()));
      map.fitBounds(bounds, { padding: 50 });
    }
  }

  searchBtn.addEventListener('click', doSearch);
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // Zoom to a selected place
  document.addEventListener('place-selected', function (event) {
    const record = event.detail;
    if (!record) return;
    const locations = record?.value?.locations || [];
    const geoLoc = locations.find(
      l => l.$type && l.$type.toLowerCase().includes('geo')
    );
    if (geoLoc && geoLoc.latitude != null && geoLoc.longitude != null) {
      map.flyTo({ center: [geoLoc.longitude, geoLoc.latitude], zoom: 15 });
    }
  });

  // Re-zoom to all results when navigating back
  document.addEventListener('results-refocus', function () {
    if (markers.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      markers.forEach(m => bounds.extend(m.getLngLat()));
      map.fitBounds(bounds, { padding: 50 });
    }
  });

  map.on('click', (e) => {
    map.setCenter(e.lngLat);
    if (queryInput.value.trim()) doSearch();
  });
})();
