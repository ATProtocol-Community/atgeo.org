// Map demo implementation

(function () {
  const container = document.getElementById('map-demo');
  if (!container) return;

  // Build search controls into the separate search bar
  const searchBar = document.getElementById('map-search');

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
  if (searchBar) searchBar.appendChild(controls);

  // Initialize map
  const map = new maplibregl.Map({
    container: container,
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    center: [-122.4375, 37.7625],
    zoom: 10.75,
  });

  let markers = [];

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

  async function doSearch() {
    const q = queryInput.value.trim();
    const collection = collectionSelect.value;

    clearError();
    clearMarkers();
    document.dispatchEvent(new CustomEvent('search-results', { detail: [] }));

    const bounds = map.getBounds();
    const params = new URLSearchParams({
      collection,
      bbox: [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(','),
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

    records.forEach(record => {
      const locations = record?.value?.locations || [];
      const geoLoc = locations.find(
        l => l.$type && l.$type.toLowerCase().includes('geo')
      );
      if (!geoLoc || geoLoc.latitude == null || geoLoc.longitude == null) return;

      const name = record?.value?.name || '(unnamed)';
      const popup = new maplibregl.Popup({ offset: 25 }).setText(name);

      const marker = new maplibregl.Marker()
        .setLngLat([geoLoc.longitude, geoLoc.latitude])
        .setPopup(popup)
        .addTo(map);

      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        selectPlace(record);
      });

      markers.push(marker);
    });

    document.dispatchEvent(new CustomEvent('search-results', { detail: records }));

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
      map.flyTo({ center: [geoLoc.longitude, geoLoc.latitude], zoom: 16 });
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
