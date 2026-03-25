// Place display implementation

(function () {
  const GETRECORD_URL =
    'https://places.atgeo.org/xrpc/com.atproto.repo.getRecord';

  function highlightJson(json) {
    // Escape HTML first so literal < > & in values don't break markup.
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/g,
      function (match) {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            return '<span class="json-key">' + match + '</span>';
          }
          return '<span class="json-string">' + match + '</span>';
        }
        if (/\b(true|false|null)\b/.test(match)) {
          return '<span class="json-bool">' + match + '</span>';
        }
        return '<span class="json-number">' + match + '</span>';
      }
    );
  }

  function parseAtUri(uri) {
    // at://repo/collection/rkey
    const parts = (uri || '').split('/');
    return {
      repo: parts[2] || null,
      collection: parts[3] || null,
      rkey: parts[4] || null,
    };
  }

  function getPlaceName(record) {
    try {
      const names = record.value && record.value.names;
      if (Array.isArray(names) && names.length > 0) {
        return names[0].text || null;
      }
    } catch (_) {}
    return null;
  }

  function renderRecord(data) {
    const container = document.getElementById('place-display');
    if (!container) return;

    const name = getPlaceName(data) || 'Place';
    const json = JSON.stringify(data, null, 2);

    container.innerHTML =
      '<h3 class="place-display-name">' +
      escapeHtml(name) +
      '</h3>' +
      '<pre class="place-display-json"><code>' +
      highlightJson(json) +
      '</code></pre>';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showInitialState() {
    const container = document.getElementById('place-display');
    if (!container) return;
    container.innerHTML =
      '<p class="place-display-hint">Select a place on the map to view its record.</p>';
  }

  async function fetchAndDisplay(detail) {
    const parsed = parseAtUri(detail.uri);

    let data = null;

    if (parsed.repo && parsed.collection && parsed.rkey) {
      const url = new URL(GETRECORD_URL);
      url.searchParams.set('repo', parsed.repo);
      url.searchParams.set('collection', parsed.collection);
      url.searchParams.set('rkey', parsed.rkey);

      try {
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('HTTP ' + response.status);
        data = await response.json();
      } catch (err) {
        console.warn('place-display: getRecord failed, using event data', err);
        data = detail;
      }
    } else {
      data = detail;
    }

    renderRecord(data);
  }

  document.addEventListener('place-selected', function (event) {
    const detail = event.detail;
    if (!detail) return;
    fetchAndDisplay(detail);
  });

  document.addEventListener('DOMContentLoaded', showInitialState);

  // If DOMContentLoaded already fired (script loaded late), run immediately.
  if (
    document.readyState === 'interactive' ||
    document.readyState === 'complete'
  ) {
    showInitialState();
  }
})();
