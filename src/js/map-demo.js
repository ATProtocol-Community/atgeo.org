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
    { label: 'OpenStreetMap', value: 'org.atgeo.places.osm' },
    { label: 'Foursquare', value: 'org.atgeo.places.foursquare' },
    { label: 'Overture Maps', value: 'org.atgeo.places.overture' },
  ].forEach(({ label, value }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    collectionSelect.appendChild(opt);
  });

  const geolocateBtn = document.createElement('button');
  geolocateBtn.type = 'button';
  geolocateBtn.className = 'geolocate-btn';
  geolocateBtn.setAttribute('aria-label', 'Use my location');
  geolocateBtn.setAttribute('title', 'Use my location');
  geolocateBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="4"/><line x1="8" y1="12" x2="8" y2="15"/><line x1="1" y1="8" x2="4" y2="8"/><line x1="12" y1="8" x2="15" y2="8"/></svg>';

  const searchBtn = document.createElement('button');
  searchBtn.textContent = 'Search';

  const errorMsg = document.createElement('span');
  errorMsg.className = 'map-search-error';
  errorMsg.hidden = true;

  controls.appendChild(queryInput);
  controls.appendChild(collectionSelect);
  controls.appendChild(geolocateBtn);
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
  let geolocating = false;

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
      limit: 12,
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

    navigator.geolocation.getCurrentPosition(
      function onSuccess(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const shouldSearch = queryInput.value.trim() !== '';
        const zoom = Math.max(14, map.getZoom());

        function moveEndHandler() {
          clearTimeout(fallbackTimer);
          if (shouldSearch) doSearch();
          geolocating = false;
          geolocateBtn.disabled = false;
        }

        map.once('moveend', moveEndHandler);

        var fallbackTimer = setTimeout(function () {
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
