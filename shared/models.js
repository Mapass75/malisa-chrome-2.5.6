import browser from './browser.js';
import { PROVIDERS } from './types.js';
import { buildAuthHeaders, sanitizeApiKey, sanitizeHeaderValue } from './security.js';
const CACHE_KEY = 'model_lists_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const OPENAI_CHAT = /^(gpt-|o[0-9]|chatgpt-)/i;
const OPENAI_SKIP = /dall-e|whisper|tts|embed|moderation|realtime|audio|transcribe|davinci|babbage|sora|image|search|codex|computer-use|omni-moderation/i;
const GENERIC_SKIP = /whisper|embed|moderation|guard|tts|transcribe|ocr|speech|dall-e|sora/i;

const genericFilter = (id) => !GENERIC_SKIP.test(id);
const openaiFilter = (id) => OPENAI_CHAT.test(id) && !OPENAI_SKIP.test(id);

async function fetchAllPages(url, headers, parsePage) {
  const all = [];
  let cursor = null;
  do {
    const pageUrl = cursor ? `${url}${url.includes('?') ? '&' : '?'}${cursor}` : url;
    const res = await fetch(pageUrl, { headers, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    const data = await res.json();
    const { items, next } = parsePage(data);
    all.push(...items);
    cursor = next;
  } while (cursor);
  return all;
}

async function fetchOpenAICompatible(baseUrl, apiKey, filterFn) {
  const headers = buildAuthHeaders(apiKey);
  const res = await fetch(`${baseUrl}/models`, { headers, signal: AbortSignal.timeout(30000) });  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.data ?? [])
    .filter((m) => m.id && filterFn(m.id))
    .map((m) => ({ id: m.id, name: m.id }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

function ollamaRoot(baseUrl) {
  return (baseUrl || 'http://localhost:11434/v1').replace(/\/v1\/?$/, '');
}

function ollamaOpenAiBase(baseUrl) {
  const trimmed = (baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

async function fetchOllamaJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchOllamaFromTags(root, headers) {
  const roots = [root];
  if (/localhost/i.test(root)) {
    roots.push(root.replace(/localhost/i, '127.0.0.1'));
  }

  for (const base of roots) {
    try {
      const data = await fetchOllamaJson(`${base}/api/tags`, headers);
      const models = (data.models ?? [])
        .map((m) => m.name || m.model)
        .filter(Boolean)
        .map((id) => ({ id, name: id }));
      if (models.length) return models;
    } catch {
      // try next host
    }
  }
  return [];
}

async function fetchOllamaFromOpenAi(baseUrl, headers) {
  const candidates = [
    `${baseUrl}/models`,
    `${ollamaRoot(baseUrl)}/v1/models`,
  ];
  const seen = new Set();

  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const data = await fetchOllamaJson(url, headers);
      return (data.data ?? [])
        .map((m) => m.id)
        .filter(Boolean)
        .map((id) => ({ id, name: id }));
    } catch {
      // try next endpoint
    }
  }
  return [];
}

function mergeOllamaModels(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const model of list) {
      if (model?.id && !byId.has(model.id)) {
        byId.set(model.id, { id: model.id, name: model.name || model.id });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchOllama(config) {
  const root = ollamaRoot(config.baseUrl);
  const openAiBase = ollamaOpenAiBase(config.baseUrl);
  const headers = buildAuthHeaders(config.apiKey);

  const models = mergeOllamaModels(
    await fetchOllamaFromTags(root, headers),
    await fetchOllamaFromOpenAi(openAiBase, headers)
  );

  if (!models.length) {
    return [];
  }

  return models;
}

async function fetchOpenAI(apiKey) {
  return fetchOpenAICompatible('https://api.openai.com/v1', apiKey, openaiFilter);
}

async function fetchAnthropic(apiKey) {
  return fetchAllPages(
    'https://api.anthropic.com/v1/models?limit=100',
    {
      'x-api-key': sanitizeApiKey(apiKey),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    (data) => ({
      items: (data.data ?? []).map((m) => ({
        id: m.id,
        name: m.display_name || m.id,
      })),
      next: data.has_more && data.last_id ? `after_id=${data.last_id}` : null,
    })
  );
}

async function fetchGoogle(apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(sanitizeApiKey(apiKey))}&pageSize=100`
  );
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.models ?? [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        !/embed/i.test(m.name)
    )
    .map((m) => {
      const id = m.name.replace(/^models\//, '');
      return { id, name: m.displayName || id };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

async function fetchOpenRouter(apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: buildAuthHeaders(apiKey),
  });  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.data ?? [])
    .filter((m) => m.id && !/moderation|embed/i.test(m.id))
    .map((m) => ({ id: m.id, name: m.name || m.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const FETCHERS = {
  openai: (c) => fetchOpenAI(c.apiKey),
  anthropic: (c) => fetchAnthropic(c.apiKey),
  google: (c) => fetchGoogle(c.apiKey),
  deepseek: (c) => fetchOpenAICompatible('https://api.deepseek.com', c.apiKey, genericFilter),
  groq: (c) => fetchOpenAICompatible('https://api.groq.com/openai/v1', c.apiKey, genericFilter),
  mistral: (c) => fetchOpenAICompatible('https://api.mistral.ai/v1', c.apiKey, genericFilter),
  openrouter: (c) => fetchOpenRouter(c.apiKey),
  grok: (c) => fetchOpenAICompatible('https://api.x.ai/v1', c.apiKey, genericFilter),
  ollama: fetchOllama,
};

function canFetchModels(provider, config) {
  const meta = PROVIDERS[provider];
  if (!meta || meta.noModel || !FETCHERS[provider]) return false;
  if (meta.apiKeyOptional) return !!config.baseUrl;
  return !!config.apiKey;
}

export async function getCachedModels(provider) {
  const cache = await browser.storage.local.get(CACHE_KEY);
  const entry = cache[CACHE_KEY]?.[provider];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
  return entry.models;
}

export async function fetchModels(provider, config, force = false) {
  if (!canFetchModels(provider, config)) {
    const meta = PROVIDERS[provider];
    throw new Error(meta?.apiKeyOptional ? 'Enter server URL first' : 'Enter API key first');
  }

  if (!force) {
    const cached = await getCachedModels(provider);
    if (cached?.length) return cached;
  }

  const fetcher = FETCHERS[provider];
  if (!fetcher) throw new Error(`Unknown provider: ${provider}`);

  const models = await fetcher(config);
  if (!models.length && provider !== 'ollama') {
    throw new Error('No models available');
  }
  if (!models.length) return [];

  const cache = (await browser.storage.local.get(CACHE_KEY))[CACHE_KEY] ?? {};
  cache[provider] = { models, fetchedAt: Date.now() };
  await browser.storage.local.set({ [CACHE_KEY]: cache });

  return models;
}

export async function refreshAllModels(providers) {
  const results = {};
  await Promise.all(
    Object.entries(providers).map(async ([id, config]) => {
      if (!canFetchModels(id, config)) {
        results[id] = { ok: false, error: PROVIDERS[id]?.apiKeyOptional ? 'No URL set' : 'No API key set' };
        return;
      }
      try {
        const models = await fetchModels(id, config, true);
        results[id] = { ok: true, models };
      } catch (err) {
        results[id] = { ok: false, error: err.message };
      }
    })
  );
  return results;
}
