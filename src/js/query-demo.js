// Query demo implementation

(function () {
  const BASE_URL = 'https://places.atgeo.org/xrpc/org.atgeo.getCoverage';

  function buildHTML() {
    return `
      <form class="query-form" id="query-demo-form" autocomplete="off">
        <div class="query-form-fields">
          <label class="query-field">
            <span class="query-label">collection</span>
            <select name="collection" id="qd-collection">
              ${AtgeoSearch.COLLECTIONS.map(c => `<option value="${c.value}"${c.disabled ? ' disabled' : ''}>${c.label}${c.disabled ? ' (unavailable)' : ''}</option>`).join('')}
            </select>
          </label>
          <label class="query-field">
            <span class="query-label">q</span>
            <input type="text" name="q" id="qd-q" placeholder="coffee" />
          </label>
          <label class="query-field">
            <span class="query-label">bbox</span>
            <input type="text" name="bbox" id="qd-bbox" value="-122.44,37.76,-122.42,37.78" />
          </label>
          <label class="query-field">
            <span class="query-label">limit</span>
            <input type="number" name="limit" id="qd-limit" value="5" min="1" max="100" />
          </label>
          <button type="button" class="icon-btn" id="qd-locate" aria-label="Use my location" title="Use my location"><img src="/assets/location-arrow-532530.svg" alt="" width="16" height="16"></button>
          <button type="submit" class="icon-btn icon-btn-wide" id="qd-run" aria-label="Run Query" title="Run Query"><img src="/assets/search-alt-1-532551.svg" alt="" width="16" height="16"></button>
          <button type="button" class="icon-btn icon-btn-wide" id="qd-match">Fetch tiles &amp; match</button>
        </div>
      </form>
      <div class="query-url" id="qd-url-display"></div>
      <p>The URL above is the only request the server sees. <code>q</code> and <code>limit</code> apply locally to the tiles it lists.</p>
      <div class="query-results" id="qd-results"></div>
    `;
  }

  function getParams() {
    return {
      collection: document.getElementById('qd-collection').value,
      bbox: document.getElementById('qd-bbox').value.trim(),
    };
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

  async function withLoading(buttonId, task) {
    const resultsEl = document.getElementById('qd-results');
    const button = document.getElementById(buttonId);

    button.disabled = true;
    button.classList.add('loading');
    showLoading(resultsEl);

    try {
      await task(resultsEl);
    } catch (err) {
      showError(resultsEl, err.message || 'Request failed');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
    }
  }

  function runQuery() {
    const { collection, bbox } = getParams();
    return withLoading('qd-run', async (resultsEl) => {
      showResult(resultsEl, await AtgeoSearch.getCoverage(collection, bbox));
    });
  }

  function runMatch() {
    const { collection, bbox } = getParams();
    const q = document.getElementById('qd-q').value.trim();
    const limit = parseInt(document.getElementById('qd-limit').value, 10) || 5;
    return withLoading('qd-match', async (resultsEl) => {
      const result = await AtgeoSearch.search({
        collection,
        bbox: bbox.split(',').map(Number),
        q,
        limit,
      });
      showResult(resultsEl, result.records);
      const note = document.createElement('p');
      note.textContent = `${result.loaded}/${result.total} tiles loaded`;
      resultsEl.prepend(note);
    });
  }

  // 0.02 degree square around the point, snapped like a search bbox
  function setBboxAround(lat, lon) {
    const d = 0.01;
    document.getElementById('qd-bbox').value = AtgeoSearch.snapBbox([lon - d, lat - d, lon + d, lat + d]);
  }

  function init() {
    const container = document.getElementById('query-demo');
    if (!container) return;

    container.innerHTML = buildHTML();

    // Update URL preview on any input change
    container.addEventListener('input', updateURLDisplay);
    container.addEventListener('change', updateURLDisplay);

    // Geolocate button fills in the bbox field
    document.getElementById('qd-locate').addEventListener('click', function () {
      const btn = this;
      if (btn.disabled) return;
      btn.disabled = true;

      if (!navigator.geolocation) {
        btn.disabled = false;
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          setBboxAround(position.coords.latitude, position.coords.longitude);
          updateURLDisplay();
          btn.disabled = false;
        },
        function () {
          btn.disabled = false;
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    });

    // Run query on form submit
    document.getElementById('query-demo-form').addEventListener('submit', function (e) {
      e.preventDefault();
      runQuery();
    });

    document.getElementById('qd-match').addEventListener('click', runMatch);

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
        setBboxAround(parseFloat(geoLoc.latitude), parseFloat(geoLoc.longitude));
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
