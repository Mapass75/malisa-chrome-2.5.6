import browser from '../browser.js';
import { getLanguageName } from '../storage.js';
import { PROVIDERS } from '../types.js';
import { BAIDU_LANGS } from './baidu.js';

// Per-provider language support. Providers without an entry are assumed to
// support every UI language (LLM providers, MyMemory, Lingva, Ollama).
// Static lists are used where the set is fixed; dynamic lists are fetched
// from each API's /languages endpoint and cached for 24h per configuration.

const TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'langsup_v1_';

const memCache = new Map(); // hash -> { ts, support: {source:Set,target:Set} | null }
const inflight = new Map(); // hash -> Promise<support|null>

// Provider language codes -> Malisa UI codes.
const ALIASES = {
  nb: 'no',
  nn: 'no',
  'no-no': 'no',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  in: 'id',
  iw: 'he',
  ji: 'yi',
  jw: 'jv',
  mo: 'ro',
};

export function normLangCode(code) {
  const c = String(code ?? '')
    .trim()
    .toLowerCase();
  if (!c) return c;
  if (ALIASES[c]) return ALIASES[c];
  const base = c.split(/[-_]/)[0];
  return ALIASES[base] ?? base;
}

// DeepL target languages mapped to UI codes. Croatian, Serbian, Bosnian,
// Hebrew, Hindi, Thai and Vietnamese are not supported by DeepL.
const DEEPL_SET = new Set(
  [
    'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'hu',
    'id', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv',
    'tr', 'uk', 'zh', 'no',
  ].map(normLangCode)
);

const BAIDU_SET = new Set(Object.keys(BAIDU_LANGS).map(normLangCode));

const STATIC_SUPPORT = {
  'deepl-free': { source: DEEPL_SET, target: DEEPL_SET },
  'deepl-pro': { source: DEEPL_SET, target: DEEPL_SET },
  baidu: { source: BAIDU_SET, target: BAIDU_SET },
};

const DYNAMIC_PROVIDERS = new Set([
  'libre-self',
  'libre',
  'azure',
  'google-translate',
  'yandex',
]);

async function fetchJson(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

function parseLibreLanguages(data) {
  const list = Array.isArray(data) ? data : data?.languages;
  if (!Array.isArray(list) || !list.length) return null;
  const source = new Set();
  const target = new Set();
  let sawTargets = false;
  for (const item of list) {
    const code = typeof item === 'string' ? item : item?.code;
    if (!code || typeof code !== 'string') continue;
    source.add(normLangCode(code));
    const targets = Array.isArray(item?.targets) ? item.targets : null;
    if (targets?.length) {
      sawTargets = true;
      for (const tg of targets) {
        if (typeof tg === 'string') target.add(normLangCode(tg));
      }
    }
  }
  if (!source.size) return null;
  // Older instances omit per-language targets — fall back to "all codes".
  if (!sawTargets) for (const c of source) target.add(c);
  return { source, target };
}

async function fetchDynamicSupport(providerId, config) {
  const meta = PROVIDERS[providerId];
  switch (providerId) {
    case 'libre-self':
    case 'libre': {
      const base = (config.baseUrl || meta?.defaultBaseUrl || '').replace(/\/+$/, '');
      if (!base) return null;
      return parseLibreLanguages(await fetchJson(`${base}/languages`));
    }
    case 'azure': {
      if (!config.apiKey) return null;
      const headers = { 'Ocp-Apim-Subscription-Key': config.apiKey };
      if (config.region) headers['Ocp-Apim-Subscription-Region'] = config.region;
      const data = await fetchJson(
        'https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation',
        { headers }
      );
      const langs = data?.translation;
      if (!langs || typeof langs !== 'object') return null;
      const codes = new Set(Object.keys(langs).map(normLangCode));
      return codes.size ? { source: codes, target: codes } : null;
    }
    case 'google-translate': {
      if (!config.apiKey) return null;
      const data = await fetchJson(
        `https://translation.googleapis.com/language/translate/v2/languages?key=${encodeURIComponent(config.apiKey)}`
      );
      const list = data?.data?.languages;
      if (!Array.isArray(list)) return null;
      const codes = new Set(
        list.map((l) => normLangCode(l?.languageCode ?? l?.code)).filter(Boolean)
      );
      return codes.size ? { source: codes, target: codes } : null;
    }
    case 'yandex': {
      if (!config.apiKey) return null;
      const data = await fetchJson(
        'https://translate.api.cloud.yandex.net/translate/v2/languages',
        { headers: { Authorization: `Api-Key ${config.apiKey}` } }
      );
      const list = data?.languages;
      if (!Array.isArray(list)) return null;
      const source = new Set();
      const target = new Set();
      for (const l of list) {
        const code = normLangCode(l?.code);
        if (!code) continue;
        const role = String(l?.role ?? '');
        if (!role || /SOURCE/i.test(role)) source.add(code);
        if (!role || /TARGET/i.test(role)) target.add(code);
      }
      return source.size || target.size ? { source, target } : null;
    }
    default:
      return null;
  }
}

function cacheHash(providerId, config) {
  const material = [
    providerId,
    config.baseUrl ?? '',
    config.apiKey ?? '',
    config.region ?? '',
    config.folderId ?? '',
  ].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function storageKey(hash) {
  return `${STORAGE_PREFIX}${hash}`;
}

async function persistSupport(hash, support) {
  await browser.storage.local.set({
    [storageKey(hash)]: {
      ts: Date.now(),
      source: [...support.source],
      target: [...support.target],
    },
  });
}

async function readStoredSupport(hash) {
  try {
    const res = await browser.storage.local.get(storageKey(hash));
    const rec = res[storageKey(hash)];
    if (!rec || Date.now() - rec.ts > TTL_MS) return null;
    return {
      ts: rec.ts,
      support: {
        source: new Set(rec.source ?? []),
        target: new Set(rec.target ?? []),
      },
    };
  } catch {
    return null;
  }
}

// { source: Set|null, target: Set|null } — a null set means "unknown, allow".
export async function getLanguageSupport(providerId, config = {}) {
  const staticSupport = STATIC_SUPPORT[providerId];
  if (staticSupport) return staticSupport;
  if (!DYNAMIC_PROVIDERS.has(providerId)) return null;

  const hash = cacheHash(providerId, config);
  const hit = memCache.get(hash);
  if (hit && Date.now() - hit.ts < (hit.support ? TTL_MS : NEGATIVE_TTL_MS)) {
    return hit.support;
  }

  const stored = await readStoredSupport(hash);
  if (stored) {
    memCache.set(hash, stored);
    return stored.support;
  }

  if (!inflight.has(hash)) {
    inflight.set(
      hash,
      (async () => {
        try {
          const support = await fetchDynamicSupport(providerId, config);
          memCache.set(hash, { ts: Date.now(), support });
          if (support) await persistSupport(hash, support).catch(() => {});
          return support;
        } catch {
          memCache.set(hash, { ts: Date.now(), support: null });
          return null;
        } finally {
          inflight.delete(hash);
        }
      })()
    );
  }
  return inflight.get(hash);
}

// true = supported, false = definitively unsupported, null = unknown.
export async function isTargetLanguageSupported(providerId, config, code) {
  const support = await getLanguageSupport(providerId, config);
  if (!support?.target) return null;
  return support.target.has(normLangCode(code));
}

function unsupportedError(label, code, isSource) {
  const name = getLanguageName(code);
  const err = new Error(
    `${label} does not support ${name}${isSource ? ' as a source language' : ''}. Choose another provider.`
  );
  err.langUnsupported = true;
  return err;
}

// Returns an Error when the provider definitively cannot handle the
// requested languages, otherwise null. Never throws — fetch problems
// fail open so translation can still be attempted.
export async function findUnsupportedLanguage(providerId, config, source, target) {
  try {
    const support = await getLanguageSupport(providerId, config);
    if (!support) return null;
    const label = PROVIDERS[providerId]?.label ?? providerId;
    if (target && support.target && !support.target.has(normLangCode(target))) {
      return unsupportedError(label, target, false);
    }
    if (source && source !== 'auto' && support.source && !support.source.has(normLangCode(source))) {
      return unsupportedError(label, source, true);
    }
    return null;
  } catch {
    return null;
  }
}
