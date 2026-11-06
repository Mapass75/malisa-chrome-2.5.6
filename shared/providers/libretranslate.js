import { withRetry, httpStatusError } from './util.js';
import { getLanguageName } from '../storage.js';
import { normalizeServiceBaseUrl } from '../security.js';

const CHUNK = 50;
const MAX_CHARS = 30000;

export async function translate(texts, p) {
  const base = (p.baseUrl || 'https://libretranslate.com').replace(/\/+$/, '');
  if (!base) throw new Error('LibreTranslate: server URL is required');
  const endpoint = /\/translate\/?$/.test(base) ? base : `${base}/translate`;
  const source = p.source && p.source !== 'auto' ? p.source : 'auto';
  const out = [];

  for (let i = 0; i < texts.length; ) {
    const slice = [];
    let chars = 0;
    while (i < texts.length && slice.length < CHUNK && chars + texts[i].length <= MAX_CHARS) {
      slice.push(texts[i]);
      chars += texts[i].length;
      i++;
    }

    const body = { q: slice, source, target: p.target, format: 'text' };
    if (p.apiKey) body.api_key = p.apiKey;

    const res = await withRetry(() =>
      fetch(endpoint, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 400 && /not supported|unsupported/i.test(text)) {
        const m = text.match(/([a-z]{2,3}(?:-[a-zA-Z]{2,8})?)\s+is not supported/i);
        const code = m?.[1] ?? p.target;
        const err = new Error(
          `LibreTranslate does not support ${getLanguageName(code)}. Choose another provider.`
        );
        err.status = 400;
        err.langUnsupported = true;
        throw err;
      }
      throw httpStatusError(`LibreTranslate ${res.status}: ${text.slice(0, 200)}`, res.status);
    }
    const data = await res.json();
    const translated = Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
    slice.forEach((t, j) => out.push(translated[j] ?? t));
  }
  return out;
}
