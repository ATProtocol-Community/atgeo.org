// Place display: the results list and the selected place's details, from SDK hits.

import { placeCategory, withinNames, upstreamLink, highlightJson, escapeHtml } from './places.js';

const placeName = (hit) => (typeof hit?.place?.name === 'string' && hit.place.name) || null;

let lastResults = [];

function addRow(dl, label, valueNode) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  if (typeof valueNode === 'string') dd.textContent = valueNode;
  else dd.appendChild(valueNode);
  dl.append(dt, dd);
}

function renderPlace(hit) {
  const container = document.getElementById('place-display');
  if (!container) return;

  container.innerHTML = '';

  if (lastResults.length > 0) {
    const back = document.createElement('a');
    back.className = 'place-display-back';
    back.href = '#';
    back.textContent = '← Back to results';
    back.addEventListener('click', (e) => {
      e.preventDefault();
      renderResultsList(lastResults);
      document.dispatchEvent(new CustomEvent('results-refocus'));
    });
    container.appendChild(back);
  }

  const heading = document.createElement('h3');
  heading.className = 'place-display-name';
  heading.textContent = placeName(hit) || 'Place';
  const type = placeCategory(hit.place, hit.origin);
  if (type) {
    const typeSpan = document.createElement('span');
    typeSpan.className = 'place-result-type';
    typeSpan.textContent = type;
    heading.appendChild(typeSpan);
  }
  container.appendChild(heading);

  const dl = document.createElement('dl');
  dl.className = 'place-display-facts';
  const within = withinNames(hit.place);
  if (within.length) addRow(dl, 'Within', within.join(' › '));
  if (hit.origin) {
    const code = document.createElement('code');
    code.textContent = hit.origin;
    addRow(dl, 'Origin', code);
  }
  if (hit.importance !== null && hit.importance !== undefined) addRow(dl, 'Importance', String(hit.importance));
  const link = upstreamLink(hit.origin);
  if (link) {
    const a = document.createElement('a');
    a.href = link;
    a.rel = 'noopener';
    a.textContent = 'View on OpenStreetMap';
    addRow(dl, 'Source', a);
  }
  container.appendChild(dl);

  const pre = document.createElement('pre');
  pre.className = 'place-display-json';
  pre.innerHTML = '<code>' + highlightJson(JSON.stringify(hit.place, null, 2)) + '</code>';
  container.appendChild(pre);
}

function renderResultsList(hits) {
  const container = document.getElementById('place-display');
  if (!container) return;

  if (!hits || hits.length === 0) {
    showInitialState();
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'place-results-list';

  hits.forEach((hit, i) => {
    const name = placeName(hit) || '(unnamed)';
    const type = placeCategory(hit.place, hit.origin);

    const li = document.createElement('li');
    li.dataset.recordIndex = String(i);
    li.innerHTML =
      '<span class="place-result-name">' + escapeHtml(name) + '</span>' +
      (type ? '<span class="place-result-type">' + escapeHtml(type) + '</span>' : '');
    li.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('place-selected', { detail: { hit, index: i } }));
    });
    li.addEventListener('mouseenter', () => {
      document.dispatchEvent(new CustomEvent('place-hover', { detail: { recordIndex: i } }));
    });
    li.addEventListener('mouseleave', () => {
      document.dispatchEvent(new CustomEvent('place-unhover', { detail: { recordIndex: i } }));
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
    '<p class="place-display-hint">Search, then pick a place on the map or in the list to see its record.</p>';
}

document.addEventListener('place-hover', function (event) {
  const idx = event.detail.recordIndex;
  const li = document.querySelector('.place-results-list li[data-record-index="' + idx + '"]');
  if (li) li.classList.add('place-hover');
});

document.addEventListener('place-unhover', function (event) {
  const idx = event.detail.recordIndex;
  const li = document.querySelector('.place-results-list li[data-record-index="' + idx + '"]');
  if (li) li.classList.remove('place-hover');
});

document.addEventListener('search-results', function (event) {
  lastResults = event.detail || [];
  renderResultsList(lastResults);
});

document.addEventListener('place-selected', function (event) {
  const hit = event.detail?.hit;
  if (hit) renderPlace(hit);
});

// Modules run after parsing, so the container already exists.
showInitialState();
