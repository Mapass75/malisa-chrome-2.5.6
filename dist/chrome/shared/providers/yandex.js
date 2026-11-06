import { withRetry, httpStatusError } from './util.js';

const CHUNK = 50;
const MAX_CHARS = 30000;
const ENDPOINT = 'https://translate.api.cloud.yandex.net/translate/v2/translate';

function mapLang(code) {
  const c = (code || '').toLowerCase();
  return c === 'zh' ? 'zh' : c;
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

    const body = { texts: slice, targetLanguageCode: mapLang(p.target) };
    if (p.folderId) body.folderId = p.folderId;
    if (p.source && p.source !== 'auto') body.sourceLanguageCode = mapLang(p.source);

    const res = await withRetry(() =>
      fetch(ENDPOINT, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Api-Key ${p.apiKey}`,
        },
        body: JSON.stringify(body),
      })
    );
    if (!res.ok) {
      let msg = `Yandex Translate ${res.status}`;
      if (res.status === 401 || res.status === 403) msg = 'Yandex Translate: invalid API key or folder ID';
      else if (res.status === 429) msg = 'Yandex Translate: rate limit reached';
      else {
        const text = await res.text().catch(() => '');
        if (text) msg += `: ${text.slice(0, 200)}`;
      }
      throw httpStatusError(msg, res.status);
    }
    const data = await res.json();
    (data.translations ?? []).forEach((t, j) => out.push(t.text ?? slice[j]));
  }
  return out;
}
