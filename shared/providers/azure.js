import { withRetry, httpStatusError } from './util.js';

const CHUNK = 50;
const MAX_CHARS = 30000;
const ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate';

function mapLang(code) {
  return (code || '').toLowerCase() === 'zh' ? 'zh-Hans' : (code || '').toLowerCase();
}

export async function translate(texts, p) {
  if (!p.region) throw new Error('Azure Translator: region is required');
  const params = new URLSearchParams({ 'api-version': '3.0', to: mapLang(p.target) });
  if (p.source && p.source !== 'auto') params.set('from', mapLang(p.source));
  const url = `${ENDPOINT}?${params}`;
  const out = [];

  for (let i = 0; i < texts.length; ) {
    const slice = [];
    let chars = 0;
    while (i < texts.length && slice.length < CHUNK && chars + texts[i].length <= MAX_CHARS) {
      slice.push(texts[i]);
      chars += texts[i].length;
      i++;
    }

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': p.apiKey,
          'Ocp-Apim-Subscription-Region': p.region,
        },
        body: JSON.stringify(slice.map((text) => ({ text }))),
      })
    );
    if (!res.ok) {
      let msg = `Azure Translator ${res.status}`;
      if (res.status === 401 || res.status === 403) msg = 'Azure Translator: invalid subscription key or region';
      else if (res.status === 429) msg = 'Azure Translator: rate limit reached';
      else {
        const text = await res.text().catch(() => '');
        if (text) msg += `: ${text.slice(0, 200)}`;
      }
      throw httpStatusError(msg, res.status);
    }
    const data = await res.json();
    data.forEach((item, j) => out.push(item?.[0]?.translations?.[0]?.text ?? slice[j]));
  }
  return out;
}
