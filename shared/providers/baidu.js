import { md5 } from './md5.js';
import { withRetry, httpStatusError, sleep } from './util.js';

const ENDPOINT = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
const GAP_MS = 120;

// Baidu language codes (ISO 639-1 -> Baidu). Croatian is not supported.
export const BAIDU_LANGS = {
  en: 'en', zh: 'zh', ja: 'jp', ko: 'kor', fr: 'fra', es: 'spa', de: 'de',
  it: 'it', pt: 'pt', ru: 'ru', nl: 'nl', pl: 'pl', sv: 'swe', da: 'dan',
  fi: 'fin', cs: 'cs', ro: 'rom', sl: 'slo', bg: 'bul', et: 'est', el: 'ell',
  hu: 'hu', th: 'th', vi: 'vi', ms: 'ms', ar: 'ara', tr: 'tr',
};

function mapLang(code) {
  return BAIDU_LANGS[(code || '').toLowerCase()] ?? null;
}

function baiduError(errorCode, errorMsg) {
  const status = errorCode === 52001 ? 401 : errorCode === 52002 || errorCode === 52003 ? 429 : 400;
  const msg =
    errorCode === 52001
      ? 'Baidu Translate: invalid App ID or secret'
      : errorCode === 52002
        ? 'Baidu Translate: daily quota exceeded'
        : errorCode === 52003
          ? 'Baidu Translate: rate limit reached'
          : `Baidu Translate error ${errorCode}${errorMsg ? `: ${errorMsg}` : ''}`;
  return httpStatusError(msg, status);
}

export async function translate(texts, p) {
  const to = mapLang(p.target);
  if (!to) throw new Error(`Baidu Translate does not support language "${p.target}"`);
  let from = 'auto';
  if (p.source && p.source !== 'auto') {
    from = mapLang(p.source);
    if (!from) throw new Error(`Baidu Translate does not support language "${p.source}"`);
  }

  const out = [];
  for (const text of texts) {
    const salt = String(Math.floor(Math.random() * 1e10));
    const sign = md5(`${p.appId}${text}${salt}${p.secret}`);
    const body = new URLSearchParams({ q: text, from, to, appid: p.appId, salt, sign });
    const res = await withRetry(() =>
      fetch(ENDPOINT, {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
    );
    if (!res.ok) throw httpStatusError(`Baidu Translate ${res.status}`, res.status);
    const data = await res.json();
    if (data.error_code) throw baiduError(data.error_code, data.error_msg);
    out.push(data.trans_result?.[0]?.dst ?? text);
    await sleep(GAP_MS);
  }
  return out;
}
