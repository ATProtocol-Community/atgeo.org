// API explorer: send the four org.atgeo queries as they are, or run a search through
// @atgeo/client and watch every request it makes.

import { createClient, SERVER } from './client.js';
import { DATASETS, searchOptions, xrpcURL, highlightJson, escapeHtml } from './places.js';

const METHODS = ['org.atgeo.getTiles', 'org.atgeo.getPlace', 'org.atgeo.describeService', 'org.atgeo.describeTileset'];
const SLUGS = ['overture-place', 'osm', 'overture-division'];

function buildHTML() {
  return `
    <form class="query-form" id="query-demo-form" autocomplete="off">
      <div class="query-form-fields">
        <label class="query-field">
          <span class="query-label">method</span>
          <select name="method" id="qd-method">
            ${METHODS.map((m) => `<option value="${m}">${m.replace('org.atgeo.', '')}</option>`).join('')}
          </select>
        </label>
        <label class="query-field" data-methods="org.atgeo.getTiles">
          <span class="query-label">dataset</span>
          <select name="dataset" id="qd-dataset">
            ${DATASETS.map((d) => `<option value="${d.id}">${escapeHtml(d.label)}</option>`).join('')}
          </select>
        </label>
        <label class="query-field" data-methods="org.atgeo.getTiles">
          <span class="query-label">bbox</span>
          <input type="text" name="bbox" id="qd-bbox" value="-75.17,39.95,-75.16,39.96" />
        </label>
        <label class="query-field" data-methods="org.atgeo.getPlace">
          <span class="query-label">uri</span>
          <input type="text" name="uri" id="qd-uri" value="urn:atgeo:openstreetmap.org:node:1015369635" />
        </label>
        <label class="query-field" data-methods="org.atgeo.describeTileset">
          <span class="query-label">slug</span>
          <select name="slug" id="qd-slug">
            ${SLUGS.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="icon-btn icon-btn-wide" id="qd-run" aria-label="Send request" title="Send request"><img src="/assets/search-alt-1-532551.svg" alt="" width="16" height="16"></button>
      </div>
      <div class="query-url" id="qd-url-display"></div>
      <div class="query-form-fields query-client" data-methods="org.atgeo.getTiles">
        <label class="query-field">
          <span class="query-label">text (never sent)</span>
          <input type="text" name="text" id="qd-text" placeholder="coffee" />
        </label>
        <button type="button" class="icon-btn icon-btn-wide" id="qd-search">Search with @atgeo/client</button>
      </div>
    </form>
    <div class="query-results" id="qd-results"></div>
  `;
}

const $ = (id) => document.getElementById(id);

function currentRequest() {
  const method = $('qd-method').value;
  let params = {};
  if (method === 'org.atgeo.getTiles') {
    params = { ...searchOptions($('qd-dataset').value), bbox: $('qd-bbox').value.trim() };
  } else if (method === 'org.atgeo.getPlace') {
    params = { uri: $('qd-uri').value.trim() };
  } else if (method === 'org.atgeo.describeTileset') {
    params = { slug: $('qd-slug').value };
  }
  return { method, url: xrpcURL(SERVER, method, params) };
}

function updateForm() {
  const method = $('qd-method').value;
  document.querySelectorAll('#query-demo [data-methods]').forEach((el) => {
    el.hidden = !el.dataset.methods.split(' ').includes(method);
  });
  const url = currentRequest().url;
  // Break at '?' and '&' for readability
  const [base, query] = url.split('?');
  $('qd-url-display').textContent = query ? `${base}?\n  ${query.split('&').join('\n  &')}` : url;
}

function showLoading(resultsEl) {
  resultsEl.innerHTML = '<span class="query-loading">Loading…</span>';
}

function showError(resultsEl, message) {
  const span = document.createElement('span');
  span.className = 'query-error';
  span.textContent = message;
  resultsEl.replaceChildren(span);
}

function jsonBlock(data) {
  const pre = document.createElement('pre');
  pre.innerHTML = `<code>${highlightJson(JSON.stringify(data, null, 2))}</code>`;
  return pre;
}

let runSeq = 0;

// Runs a task that renders into the results; only the latest run gets to render.
async function withLoading(buttonId, task) {
  const resultsEl = $('qd-results');
  const button = $(buttonId);
  const seq = ++runSeq;
  const latest = {
    replaceChildren: (...nodes) => {
      if (seq === runSeq) resultsEl.replaceChildren(...nodes);
    },
  };

  button.disabled = true;
  button.classList.add('loading');
  showLoading(resultsEl);

  try {
    await task(latest);
  } catch (err) {
    if (seq === runSeq) showError(resultsEl, err.message || 'Request failed');
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

// Sends the request exactly as shown, so a too-precise bbox comes back BboxTooPrecise.
function runRequest() {
  const { url } = currentRequest();
  return withLoading('qd-run', async (resultsEl) => {
    const resp = await fetch(url);
    const text = await resp.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    const status = document.createElement('p');
    status.className = resp.ok ? 'query-status' : 'query-status query-error';
    status.textContent = `HTTP ${resp.status}`;
    resultsEl.replaceChildren(status, typeof body === 'string' ? Object.assign(document.createElement('pre'), { textContent: body }) : jsonBlock(body));
  });
}

function parseBbox(value) {
  const parts = value.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || !parts.every(Number.isFinite)) {
    throw new Error('bbox must be four comma-separated numbers: minLon,minLat,maxLon,maxLat');
  }
  return parts;
}

// A fresh client each time, so its cache can't hide any request from the log.
function runSearch() {
  const text = $('qd-text').value.trim();
  const datasetId = $('qd-dataset').value;
  return withLoading('qd-search', async (resultsEl) => {
    const bbox = parseBbox($('qd-bbox').value);
    const log = [];
    const atgeo = createClient({ onResponse: (entry) => log.push(entry) });
    const result = await atgeo.searchPlaces({ region: { bbox }, text: text || undefined, ...searchOptions(datasetId) });

    const parts = [];

    const heading = document.createElement('p');
    heading.textContent = `Every request the client made (${log.length}):`;
    parts.push(heading);

    const ol = document.createElement('ol');
    ol.className = 'query-log';
    for (const entry of log) {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = entry.url;
      li.append(entry.error ? 'failed ' : `${entry.status} `, code);
      ol.appendChild(li);
    }
    parts.push(ol);

    if (text) {
      const leaked = log.some((e) => {
        const u = e.url.toLowerCase();
        return u.includes(text.toLowerCase()) || u.includes(encodeURIComponent(text).toLowerCase());
      });
      const note = document.createElement('p');
      note.className = leaked ? 'query-error' : 'query-status';
      note.textContent = leaked
        ? `"${text}" appears in a request URL above. (Short text can match a URL by coincidence.)`
        : `"${text}" appears in none of them. The matching happened here, in your browser.`;
      parts.push(note);
    }

    const summary = document.createElement('p');
    const flags = [];
    if (result.overview) flags.push('overview answer: only the most important places');
    if (!result.complete) flags.push(`${result.tiles.failed} tiles failed`);
    summary.textContent =
      `${result.places.length} places from ${result.tiles.fetched} tiles` + (flags.length ? ` (${flags.join('; ')})` : '') + '. Top 5:';
    parts.push(summary);

    parts.push(
      jsonBlock(
        result.places.slice(0, 5).map((hit) => ({
          name: hit.place.name,
          origin: hit.origin,
          importance: hit.importance,
          distance: Math.round(hit.distance),
          score: hit.score === null ? null : Number(hit.score.toFixed(3)),
        })),
      ),
    );

    resultsEl.replaceChildren(...parts);
  });
}

function init() {
  const container = $('query-demo');
  if (!container) return;

  container.innerHTML = buildHTML();

  container.addEventListener('input', updateForm);
  container.addEventListener('change', updateForm);

  $('query-demo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    runRequest();
  });
  $('qd-search').addEventListener('click', runSearch);
  $('qd-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  });

  updateForm();
}

init();
