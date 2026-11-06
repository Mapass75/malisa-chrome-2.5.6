import browser from './browser.js';
export const CACHE_PREFIX = 'tr_v4_';
const LEGACY_CACHE_PREFIXES = ['tr_v3_', 'tr_v2_', 'tr_cache_'];
const MAX_CACHE_ENTRIES = 5000;
const MAX_L1_ENTRIES = 10000;
let writesSincePrune = 0;

/** @type {Map<string, string>} */
const memoryCache = new Map();

function isTranslationCacheKey(key) {
  return key.startsWith(CACHE_PREFIX) || LEGACY_CACHE_PREFIXES.some((p) => key.startsWith(p));
}

async function hashText(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function cacheKey(text, targetLanguage, sourceLanguage = 'auto') {
  return `${CACHE_PREFIX}${sourceLanguage}_${targetLanguage}_${await hashText(text)}`;
}

function l1Get(key) {
  return memoryCache.get(key);
}

function l1Set(key, value) {
  if (memoryCache.size >= MAX_L1_ENTRIES && !memoryCache.has(key)) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
  memoryCache.set(key, value);
}

function l1Clear() {
  memoryCache.clear();
}

async function pruneCacheIfNeeded() {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter(isTranslationCacheKey);
  if (keys.length <= MAX_CACHE_ENTRIES) return;
  await browser.storage.local.remove(keys.slice(0, keys.length - MAX_CACHE_ENTRIES));
}

export async function countTranslationCacheEntries() {
  const all = await browser.storage.local.get(null);
  return Object.keys(all).filter(isTranslationCacheKey).length;
}

export async function clearTranslationCache() {
  l1Clear();
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter(isTranslationCacheKey);
  if (keys.length) await browser.storage.local.remove(keys);
}

export async function getCachedTranslations(
  texts,
  targetLanguage,
  enabled = true,
  sourceLanguage = 'auto'
) {
  if (!enabled || !texts.length) return new Map();

  const uniqueTexts = [...new Set(texts)];
  const keyPairs = await Promise.all(
    uniqueTexts.map(async (text) => ({
      text,
      key: await cacheKey(text, targetLanguage, sourceLanguage),
    }))
  );

  const map = new Map();
  const storageMisses = [];

  for (const { text, key } of keyPairs) {
    const fromMemory = l1Get(key);
    if (fromMemory && fromMemory !== text) {
      map.set(text, fromMemory);
      continue;
    }
    storageMisses.push({ text, key });
  }

  if (storageMisses.length) {
    const storageResult = await browser.storage.local.get(storageMisses.map((m) => m.key));
    for (const { text, key } of storageMisses) {
      const cached = storageResult[key];
      if (cached && cached !== text) {
        l1Set(key, cached);
        map.set(text, cached);
      }
    }
  }

  return map;
}

export async function cacheTranslations(
  entries,
  targetLanguage,
  enabled = true,
  sourceLanguage = 'auto'
) {
  if (!enabled) return;

  const updates = {};
  for (const { text, translation } of entries) {
    if (!translation || translation === text) continue;
    const key = await cacheKey(text, targetLanguage, sourceLanguage);
    l1Set(key, translation);
    updates[key] = translation;
  }
  if (!Object.keys(updates).length) return;

  await browser.storage.local.set(updates);
  writesSincePrune++;
  if (writesSincePrune >= 8) {
    writesSincePrune = 0;
    pruneCacheIfNeeded().catch(() => {});
  }
}
