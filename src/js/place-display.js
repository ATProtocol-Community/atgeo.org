// Place display implementation

(function () {
  function highlightJson(json) {
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getPlaceName(record) {
    try {
      return record?.value?.name || null;
    } catch (_) {}
    return null;
  }

  function titleCase(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }

  function getPrimaryType(record) {
    const collection = record?.value?.collection;
    const attrs = record?.value?.attributes;
    if (!attrs) return null;

    if (collection === 'org.atgeo.places.foursquare') {
      const labels = attrs.fsq_category_labels;
      if (Array.isArray(labels) && labels.length > 0) {
        const parts = labels[0].split('>');
        return parts[parts.length - 1].trim();
      }
    }

    if (collection === 'org.atgeo.places.overture') {
      const primary = attrs.categories?.primary;
      if (primary) {
        return titleCase(primary.replace(/_/g, ' '));
      }
    }

    if (collection === 'org.atgeo.places.osm') {
      // Priority order matches garganorn/osm_filter.yaml
      const osmKeys = [
        'amenity', 'shop', 'tourism', 'leisure', 'healthcare', 'office',
        'craft', 'club', 'emergency', 'diplomatic', 'historic', 'military',
        'aeroway', 'railway', 'highway', 'waterway', 'natural', 'geological',
        'man_made', 'building', 'boundary', 'landuse', 'place', 'power',
      ];
      for (const key of osmKeys) {
        const val = attrs[key];
        if (typeof val === 'string' && val !== 'yes') {
          return titleCase(val.replace(/_/g, ' '));
        }
      }
    }

    return null;
  }

  let lastResults = [];

  function renderRecord(data) {
    const container = document.getElementById('place-display');
    if (!container) return;

    const name = getPlaceName(data) || 'Place';
    const json = JSON.stringify(data.value || data, null, 2);

    container.innerHTML = '';

    if (lastResults.length > 0) {
      const back = document.createElement('a');
      back.className = 'place-display-back';
      back.href = '#';
      back.textContent = '\u2190 Back to results';
      back.addEventListener('click', (e) => {
        e.preventDefault();
        renderResultsList(lastResults);
        document.dispatchEvent(new CustomEvent('results-refocus'));
      });
      container.appendChild(back);
    }

    const heading = document.createElement('h3');
    heading.className = 'place-display-name';
    heading.textContent = name;
    const type = getPrimaryType(data);
    if (type) {
      const typeSpan = document.createElement('span');
      typeSpan.className = 'place-result-type';
      typeSpan.textContent = type;
      heading.appendChild(typeSpan);
    }
    container.appendChild(heading);

    const pre = document.createElement('pre');
    pre.className = 'place-display-json';
    pre.innerHTML = '<code>' + highlightJson(json) + '</code>';
    container.appendChild(pre);
  }

  function renderResultsList(records) {
    const container = document.getElementById('place-display');
    if (!container) return;

    if (!records || records.length === 0) {
      showInitialState();
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'place-results-list';

    records.forEach(record => {
      const name = getPlaceName(record) || '(unnamed)';
      const type = getPrimaryType(record);

      const li = document.createElement('li');
      li.innerHTML =
        '<span class="place-result-name">' + escapeHtml(name) + '</span>' +
        (type ? '<span class="place-result-type">' + escapeHtml(type) + '</span>' : '');
      li.addEventListener('click', () => {
        document.dispatchEvent(
          new CustomEvent('place-selected', { detail: record })
        );
      });
      ul.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(ul);
  }

  function showInitialState() {
    const container = document.getElementById('place-display');
    if (!container) return;
    container.innerHTML =
      '<p class="place-display-hint">Select a place on the map to view its record.</p>';
  }

  document.addEventListener('search-results', function (event) {
    lastResults = event.detail || [];
    renderResultsList(lastResults);
  });

  document.addEventListener('place-selected', function (event) {
    const detail = event.detail;
    if (!detail) return;
    renderRecord(detail);
  });

  document.addEventListener('DOMContentLoaded', showInitialState);

  if (
    document.readyState === 'interactive' ||
    document.readyState === 'complete'
  ) {
    showInitialState();
  }
})();
