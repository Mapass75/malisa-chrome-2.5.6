import { withRetry, httpStatusError } from './util.js';

const CHUNK = 50;
const MAX_CHARS = 30000;

const BASES = {
  free: 'https://api-free.deepl.com',
  pro: 'https://api.deepl.com',
};

function mapLang(code) {
  const u = (code || '').toUpperCase();
  if (u === 'PT') return 'PT-PT';
  if (u === 'NO') return 'NB';
  if (u === 'ZH') return 'ZH';
  return u;
}

export async function translate(texts, p) {
  const base = BASES[p.endpoint] ?? BASES.free;
  const out = [];

  for (let i = 0; i < texts.length; ) {
    const slice = [];
    let chars = 0;
    while (i < texts.length && slice.length < CHUNK && chars + texts[i].length <= MAX_CHARS) {
      slice.push(texts[i]);
      chars += texts[i].length;
      i++;
    }

    const body = { text: slice, target_lang: mapLang(p.target) };
    if (p.source && p.source !== 'auto') body.source_lang = mapLang(p.source);

    const res = await withRetry(() =>
      fetch(`${base}/v2/translate`, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `DeepL-Auth-Key ${p.apiKey}`,
        },
        body: JSON.stringify(body),
      })
    );
    if (!res.ok) {
      let msg = `DeepL ${res.status}`;
      if (res.status === 456) msg = 'DeepL monthly quota exceeded — wait for reset or upgrade';
      else if (res.status === 403) msg = 'DeepL rejected this key for the selected endpoint — Free keys end with ":fx" (use DeepL Free), Pro keys use DeepL Pro';
      else if (res.status === 401) msg = 'DeepL: invalid API key';
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
