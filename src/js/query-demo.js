// Query demo implementation

(function () {
  const BASE_URL = 'https://places.atgeo.org/xrpc/org.atgeo.searchRecords';

  const COLLECTIONS = [
    { label: 'OpenStreetMap', value: 'org.atgeo.places.osm' },
    { label: 'Foursquare', value: 'org.atgeo.places.foursquare' },
    { label: 'Overture Maps', value: 'org.atgeo.places.overture' },
  ];

  function buildHTML() {
    return `
      <form class="query-form" id="query-demo-form" autocomplete="off">
        <div class="query-form-fields">
          <label class="query-field">
            <span class="query-label">collection</span>
            <select name="collection" id="qd-collection">
              ${COLLECTIONS.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
            </select>
          </label>
          <label class="query-field">
            <span class="query-label">q</span>
            <input type="text" name="q" id="qd-q" placeholder="coffee" />
          </label>
          <label class="query-field">
            <span class="query-label">latitude</span>
            <input type="text" name="latitude" id="qd-latitude" value="37.7749" />
          </label>
          <label class="query-field">
            <span class="query-label">longitude</span>
            <input type="text" name="longitude" id="qd-longitude" value="-122.4194" />
          </label>
          <label class="query-field">
            <span class="query-label">limit</span>
            <input type="number" name="limit" id="qd-limit" value="5" min="1" max="100" />
          </label>
        </div>
        <button type="submit" class="icon-btn icon-btn-wide" id="qd-run" aria-label="Run Query" title="Run Query"><img src="/assets/search-alt-1-532551.svg" alt="" width="16" height="16"></button>
      </form>
      <div class="query-url" id="qd-url-display"></div>
      <div class="query-results" id="qd-results"></div>
    `;
  }

  function getParams() {
    const collection = document.getElementById('qd-collection').value;
    const q = document.getElementById('qd-q').value.trim();
    const latitude = document.getElementById('qd-latitude').value.trim();
    const longitude = document.getElementById('qd-longitude').value.trim();
    const limit = document.getElementById('qd-limit').value.trim();

    const params = { collection };
    if (q) params.q = q;
    if (latitude) params.latitude = latitude;
    if (longitude) params.longitude = longitude;
    if (limit) params.limit = limit;
    return params;
  }

  function buildURL(params) {
    const qs = new URLSearchParams(params).toString();
    return qs ? `${BASE_URL}?${qs}` : BASE_URL;
  }

  function updateURLDisplay() {
    const display = document.getElementById('qd-url-display');
    if (!display) return;
    const url = buildURL(getParams());
    // Break at '?' for readability
    const [base, query] = url.split('?');
    if (query) {
      const parts = query.split('&');
      display.textContent = base + '?\n  ' + parts.join('\n  &');
    } else {
      display.textContent = url;
    }
  }

  function highlightJSON(json) {
    // Escape HTML first
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            return `<span class="json-key">${match}</span>`;
          }
          return `<span class="json-string">${match}</span>`;
        }
        if (/true|false|null/.test(match)) {
          return `<span class="json-bool">${match}</span>`;
        }
        return `<span class="json-number">${match}</span>`;
      }
    );
  }

  function showLoading(resultsEl) {
    resultsEl.innerHTML = '<span class="query-loading">Loading\u2026</span>';
  }

  function showError(resultsEl, message) {
    var span = document.createElement('span');
    span.className = 'query-error';
    span.textContent = message;
    resultsEl.replaceChildren(span);
  }

  function showResult(resultsEl, data) {
    const formatted = JSON.stringify(data, null, 2);
    const highlighted = highlightJSON(formatted);
    resultsEl.innerHTML = `<pre><code>${highlighted}</code></pre>`;
  }

  async function runQuery() {
    const resultsEl = document.getElementById('qd-results');
    const button = document.getElementById('qd-run');
    const params = getParams();
    const url = buildURL(params);

    button.disabled = true;
    showLoading(resultsEl);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      showResult(resultsEl, data);
    } catch (err) {
      showError(resultsEl, err.message || 'Request failed');
    } finally {
      button.disabled = false;
    }
  }

  function init() {
    const container = document.getElementById('query-demo');
    if (!container) return;

    container.innerHTML = buildHTML();

    // Update URL preview on any input change
    container.addEventListener('input', updateURLDisplay);
    container.addEventListener('change', updateURLDisplay);

    // Run query on form submit
    document.getElementById('query-demo-form').addEventListener('submit', function (e) {
      e.preventDefault();
      runQuery();
    });

    // Listen for place-selected events from the map
    document.addEventListener('place-selected', function (e) {
      const record = e.detail;
      if (!record) return;

      // Extract coordinates from value.locations, same as map-demo.js
      const locations = record?.value?.locations || [];
      const geoLoc = locations.find(
        l => l.$type && l.$type.toLowerCase().includes('geo')
      );
      if (geoLoc && geoLoc.latitude != null && geoLoc.longitude != null) {
        document.getElementById('qd-latitude').value = geoLoc.latitude;
        document.getElementById('qd-longitude').value = geoLoc.longitude;
      }

      updateURLDisplay();
    });

    // Initial URL preview
    updateURLDisplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
