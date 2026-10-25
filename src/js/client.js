// The demos' one way to reach the gazetteer: @atgeo/client, with a fetch that reports
// every request it makes, so a page can show exactly what went on the wire.

import { AtgeoClient, AtgeoError } from './atgeo-client/index.js';

export { AtgeoError };

export const SERVER = 'https://places.atgeo.org';

// onResponse({url, status}) or onResponse({url, error}) fires as each request settles.
export function createClient({ onResponse } = {}) {
  async function fetchAndReport(url, init) {
    const entry = { url: String(url) };
    try {
      const response = await globalThis.fetch(url, init);
      onResponse?.({ ...entry, status: response.status });
      return response;
    } catch (error) {
      onResponse?.({ ...entry, error });
      throw error;
    }
  }
  return new AtgeoClient({ server: SERVER, fetch: fetchAndReport });
}
