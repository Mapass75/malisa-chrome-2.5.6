import { withRetry, httpStatusError, sleep } from './util.js';
import { normalizeServiceBaseUrl } from '../security.js';

const GAP_MS = 150;

export async function translate(texts, p) {
  const base = (p.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Lingva Translate: instance URL is required');
  const source = p.source && p.source !== 'auto' ? p.source : 'auto';
  const out = [];

  for (const text of texts) {
    const url = `${base}/api/v1/${source}/${p.target}/${encodeURIComponent(text)}`;
    const res = await withRetry(() => fetch(url, { signal: AbortSignal.timeout(30000) }));
    if (!res.ok) {
      let msg = `Lingva Translate ${res.status}`;
      if (res.status === 404) msg = 'Lingva Translate: instance not found or endpoint changed — check the instance URL';
      else if (res.status === 429) msg = 'Lingva Translate: rate limit reached';
      else if (res.status === 403) msg = 'Lingva Translate: access denied by instance';
      throw httpStatusError(msg, res.status);
    }
    const data = await res.json();
    out.push(data?.translation ?? text);
    await sleep(GAP_MS);
  }
  return out;
}
