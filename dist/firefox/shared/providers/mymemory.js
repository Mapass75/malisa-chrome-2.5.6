import { withRetry, httpStatusError, sleep } from './util.js';

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const GTX_URL = 'https://translate.googleapis.com/translate_a/single';
const MAX_BYTES = 450;
const GAP_MS = 250;

function utf8Len(s) {
  return new TextEncoder().encode(s).length;
}

function splitForMyMemory(text) {
  if (utf8Len(text) <= MAX_BYTES) return [text];
  const chunks = [];
  let rest = text;
  while (utf8Len(rest) > MAX_BYTES) {
    let cut = MAX_BYTES;
    while (cut > 50 && utf8Len(rest.slice(0, cut)) > MAX_BYTES) cut -= 10;
    let idx = rest.lastIndexOf(' ', cut);
    if (idx < cut / 2) idx = cut;
    chunks.push(rest.slice(0, idx).trim());
    rest = rest.slice(idx).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

async function myMemoryOne(text, source, target, email) {
  const langpair = `${source}|${target}`;
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${langpair}${email ? `&de=${encodeURIComponent(email)}` : ''}`;
  const res = await withRetry(() => fetch(url, { signal: AbortSignal.timeout(30000) }));
  if (!res.ok) throw httpStatusError(`MyMemory ${res.status}`, res.status);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(translated)) {
    throw httpStatusError(
      'MyMemory daily limit reached — add your email in Settings or try again later',
      429
    );
  }
  return translated;
}

async function gtxOne(text, target) {
  const url = `${GTX_URL}?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await withRetry(() => fetch(url, { signal: AbortSignal.timeout(30000) }));
  if (!res.ok) throw httpStatusError(`MyMemory auto-detect ${res.status}`, res.status);
  const data = await res.json();
  return (data?.[0] ?? []).map((s) => s?.[0] ?? '').join('');
}

export async function translate(texts, p) {
  const auto = !p.source || p.source === 'auto';
  const email = p.email?.trim() ?? '';
  const out = [];

  for (const text of texts) {
    const chunks = splitForMyMemory(text);
    const parts = [];
    for (const chunk of chunks) {
      parts.push(auto ? await gtxOne(chunk, p.target) : await myMemoryOne(chunk, p.source, p.target, email));
      await sleep(GAP_MS);
    }
    out.push(parts.join(' '));
  }
  return out;
}
