import { withRetry, httpStatusError } from './util.js';

const CHUNK = 100;
const MAX_CHARS = 30000;
const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

function mapLang(code) {
  const c = (code || '').toLowerCase();
  return c === 'zh' ? 'zh-CN' : c;
}

export async function translate(texts, p) {
  const out = [];

  for (let i = 0; i < texts.length; ) {
    const slice = [];
    let chars = 0;
    while (i < texts.length && slice.length < CHUNK && chars + texts[i].length <= MAX_CHARS) {
      slice.push(texts[i]);
      chars += texts[i].length;
      i++;
    }

    const body = { q: slice, target: mapLang(p.target), format: 'text' };
    if (p.source && p.source !== 'auto') body.source = mapLang(p.source);

    const res = await withRetry(() =>
      fetch(`${ENDPOINT}?key=${encodeURIComponent(p.apiKey)}`, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
    if (!res.ok) {
      let msg = `Google Cloud Translation ${res.status}`;
      if (res.status === 400) msg = 'Google Cloud Translation: bad request — check that the Translation API is enabled for this key';
      else if (res.status === 401 || res.status === 403) msg = 'Google Cloud Translation: invalid API key or API not enabled';
      else if (res.status === 429) msg = 'Google Cloud Translation: quota exceeded';
      else {
        const text = await res.text().catch(() => '');
        if (text) msg += `: ${text.slice(0, 200)}`;
      }
      throw httpStatusError(msg, res.status);
    }
    const data = await res.json();
    (data.data?.translations ?? []).forEach((t, j) => out.push(t.translatedText ?? slice[j]));
  }
  return out;
}
