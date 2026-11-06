import { getLanguageName } from './storage.js';
import { PROVIDERS } from './types.js';
import { buildAuthHeaders, sanitizeApiKey, sanitizeHeaderValue } from './security.js';
import { translate as translateLibreModule } from './providers/libretranslate.js';
import { translate as translateDeeplModule } from './providers/deepl.js';
import { translate as translateAzureModule } from './providers/azure.js';
import { translate as translateGoogleCloudModule } from './providers/google-cloud.js';
import { translate as translateYandexModule } from './providers/yandex.js';
import { translate as translateBaiduModule } from './providers/baidu.js';
import { translate as translateMyMemoryModule } from './providers/mymemory.js';
import { translate as translateLingvaModule } from './providers/lingva.js';
import { isRetryableError } from './providers/util.js';
import { normalizeServiceBaseUrl } from './security.js';
import { findUnsupportedLanguage } from './providers/langsupport.js';
const langCache = new Map();

function targetLabel(code) {
  if (!langCache.has(code)) {
    langCache.set(code, `${getLanguageName(code)} (${code})`);
  }
  return langCache.get(code);
}

function buildPrompt(blocks, targetLanguage, sourceLanguage) {
  const lang = targetLabel(targetLanguage);
  const from =
    sourceLanguage && sourceLanguage !== 'auto' ? ` from ${targetLabel(sourceLanguage)}` : '';
  const lines = blocks.map((b) => `${b.id}|${b.text}`).join('\n');
  return `Translate each line${from} to ${lang}. Web page UI text (buttons, labels, menus, product names where appropriate). Return one translation per id.\nJSON only: {"translations":[{"id":"0","t":"..."}]}\n${lines}`;
}

const SYSTEM =
  'Professional website translator. Return only valid JSON: {"translations":[{"id":"...","t":"..."}]}. ' +
  'Translate every line including short ALL CAPS labels. Keep brand names, URLs, SKUs and pure numbers unchanged. ' +
  'Use natural phrasing for the target language. Match formal/informal tone of the source.';

function getTranslatedValue(item) {
  if (!item || typeof item !== 'object') return '';
  return (
    item.t ??
    item.translated ??
    item.translation ??
    item.content ??
    item.value ??
    item.target ??
    ''
  );
}

function collectTranslationsFromParsed(parsed, blocks, byId) {
  const translations = Array.isArray(parsed)
    ? parsed
    : parsed.translations ?? parsed.results ?? parsed.data ?? [];

  for (const item of translations) {
    if (!item || typeof item !== 'object') continue;
    if (item.id === undefined || item.id === null) continue;
    const value = getTranslatedValue(item).trim();
    if (value) byId.set(String(item.id), value);
  }

  if (!byId.size && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const block of blocks) {
      const raw = parsed[block.id] ?? parsed[Number(block.id)];
      if (typeof raw === 'string' && raw.trim()) {
        byId.set(String(block.id), raw.trim());
      } else if (raw && typeof raw === 'object') {
        const value = getTranslatedValue(raw).trim();
        if (value) byId.set(String(block.id), value);
      }
    }
  }
}

function parseTranslationResponse(content, blocks, targetLanguage) {
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI response is not valid JSON');
  }

  const translations = Array.isArray(parsed) ? parsed : parsed.translations ?? [];
  const byId = new Map();
  collectTranslationsFromParsed(parsed, blocks, byId);

  const results = blocks.map((block, index) => {
    let translated = byId.get(String(block.id));

    if (!translated && translations[index]) {
      translated = getTranslatedValue(translations[index]).trim();
    }

    if (!translated) {
      translated = block.text;
    }

    return { id: block.id, translated, source: block.text };
  });

  const changed = results.filter((r) => r.translated !== r.source).length;
  const matchedById = blocks.filter((block) => byId.has(String(block.id))).length;

  if (blocks.length >= 3 && changed === 0) {
    if (matchedById === 0 && translations.length > 0) {
      throw new Error('AI response format mismatch. Try a smaller batch or another model.');
    }
    if (matchedById > 0) {
      return results.map(({ id, translated }) => ({ id, translated }));
    }
    const lang = targetLabel(targetLanguage);
    throw new Error(
      `No text was translated. The page may already be in ${lang}, or try a smaller batch / another model.`
    );
  }

  return results.map(({ id, translated }) => ({ id, translated }));
}

function estimateMaxTokens(blocks) {
  const chars = blocks.reduce((s, b) => s + b.text.length, 0);
  return Math.min(16384, Math.max(1024, Math.ceil(chars * 1.6) + 256));
}

const FREE_DEFAULT_URL = 'https://api.mymemory.translated.net/get';
const GTX_URL = 'https://translate.googleapis.com/translate_a/single';
const FREE_RATE_LIMIT_MESSAGE = 'Free translate is rate limited, try again in a minute.';
const FREE_MAX_ATTEMPTS = 3;
const FREE_RETRY_BASE_MS = 1000;
const FREE_GAP_MS = 250;
const FREE_GROUP_MAX_CHARS = 1200;

function httpStatusError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isRetryableFreeError(err) {
  if (err?.isQuota) return false;
  const status = err?.status;
  if (status != null) return status === 429 || status === 403 || (status >= 500 && status < 600);
  return err instanceof TypeError;
}

async function freeRequest(fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableFreeError(err) || attempt >= FREE_MAX_ATTEMPTS) {
        if (err?.status === 429 && !err?.isQuota) {
          throw new Error(FREE_RATE_LIMIT_MESSAGE);
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, FREE_RETRY_BASE_MS * 2 ** (attempt - 1)));
    }
  }
}

// Free no-key translation. Default endpoint is MyMemory; the public Google
// `gtx` API and any LibreTranslate-compatible /translate URL also work.
async function translateWithFree(opts) {
  const baseUrl = (opts.baseUrl || FREE_DEFAULT_URL).replace(/\/$/, '');
  if (/mymemory/.test(baseUrl)) return translateWithMyMemory(baseUrl, opts);
  if (/translate_a\/single|translate\.googleapis/.test(baseUrl)) {
    return translateWithGtx(baseUrl, opts);
  }
  return translateWithLibreTranslate(baseUrl, opts);
}

// MyMemory caps queries at ~500 bytes; split long text at sentence/space
// boundaries and concatenate the translations.
function splitForMyMemory(text, maxBytes = 450) {
  if (new TextEncoder().encode(text).length <= maxBytes) return [text];
  const parts = [];
  let chunk = '';
  for (const piece of text.split(/(?<=[.!?;:\n])\s+|\n+/)) {
    const candidate = chunk ? `${chunk} ${piece}` : piece;
    if (new TextEncoder().encode(candidate).length > maxBytes && chunk) {
      parts.push(chunk);
      chunk = piece;
    } else {
      chunk = candidate;
    }
    while (new TextEncoder().encode(chunk).length > maxBytes) {
      // Byte-accurate cut: longest prefix within maxBytes, preferring a space,
      // always ending on a code-point boundary.
      const enc = new TextEncoder();
      let prefix = '';
      for (const ch of chunk) {
        if (enc.encode(prefix + ch).length > maxBytes) break;
        prefix += ch;
      }
      const space = prefix.lastIndexOf(' ');
      const cut = space > 50 ? space : prefix.length;
      parts.push(chunk.slice(0, cut));
      chunk = chunk.slice(cut);
    }
  }
  if (chunk) parts.push(chunk);
  return parts;
}

async function myMemoryOne(baseUrl, text, targetLanguage, sourceLanguage, email) {
  const src = sourceLanguage && sourceLanguage !== 'auto' ? sourceLanguage : null;
  if (!src) {
    // MyMemory has no autodetect — route this request through the public
    // Google endpoint, which supports sl=auto.
    return gtxOne(GTX_URL, text, targetLanguage, 'auto');
  }
  const url =
    `${baseUrl}?q=${encodeURIComponent(text)}&langpair=${src}|${targetLanguage}` +
    (email ? `&de=${encodeURIComponent(email)}` : '');
  const response = await fetch(url);
  if (response.status === 429 || response.status === 403) {
    const err = new Error(
      'MyMemory daily limit reached — try again tomorrow or add your email in Settings for a higher quota'
    );
    err.status = response.status;
    err.isQuota = true;
    throw err;
  }
  if (!response.ok) throw httpStatusError(`Free translate ${response.status}`, response.status);
  const data = await response.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID EMAIL/i.test(translated)) {
    if (translated?.startsWith('MYMEMORY')) {
      const err = new Error(
        'MyMemory daily limit reached — try again tomorrow or add your email in Settings for a higher quota'
      );
      err.isQuota = true;
      throw err;
    }
    throw new Error('Free translate: unexpected response');
  }
  return translated;
}

async function translateWithMyMemory(baseUrl, opts) {
  const email = opts.email?.trim();
  const jobs = opts.blocks.map((block) => ({
    id: block.id,
    original: block.text,
    chunks: splitForMyMemory(block.text),
  }));

  if (!opts.sourceLanguage || opts.sourceLanguage === 'auto') {
    const items = [];
    for (const job of jobs) {
      for (const chunk of job.chunks) items.push({ job, text: chunk });
    }
    const translated = await gtxTranslateBatch(items.map((i) => i.text), opts.targetLanguage);
    const byJob = new Map();
    items.forEach((item, index) => {
      const list = byJob.get(item.job) ?? [];
      list.push(translated[index] || item.text);
      byJob.set(item.job, list);
    });
    return jobs.map((job) => ({
      id: job.id,
      translated: (byJob.get(job) ?? []).join(' ').trim() || job.original,
    }));
  }

  const results = [];
  for (const job of jobs) {
    const translated = [];
    for (const chunk of job.chunks) {
      translated.push(
        await freeRequest(() =>
          myMemoryOne(baseUrl, chunk, opts.targetLanguage, opts.sourceLanguage, email)
        )
      );
      await new Promise((r) => setTimeout(r, FREE_GAP_MS));
    }
    results.push({ id: job.id, translated: translated.join(' ').trim() || job.original });
  }
  return results;
}

async function gtxTranslateBatch(texts, targetLanguage) {
  const out = new Array(texts.length);
  let i = 0;
  while (i < texts.length) {
    const group = [];
    let size = 0;
    while (
      i < texts.length &&
      (group.length === 0 || size + texts[i].length + 1 <= FREE_GROUP_MAX_CHARS)
    ) {
      group.push(i);
      size += texts[i].length + 1;
      i++;
    }
    const joined = group.map((idx) => texts[idx]).join('\n');
    let translated = null;
    try {
      translated = await freeRequest(() => gtxOne(GTX_URL, joined, targetLanguage, 'auto'));
    } catch (err) {
      if (err?.message === FREE_RATE_LIMIT_MESSAGE) throw err;
    }
    const parts = translated?.split('\n') ?? null;
    if (parts && parts.length === group.length) {
      group.forEach((idx, k) => {
        out[idx] = parts[k].trim() || texts[idx];
      });
    } else {
      for (const idx of group) {
        out[idx] = await freeRequest(() => gtxOne(GTX_URL, texts[idx], targetLanguage, 'auto'));
        await new Promise((r) => setTimeout(r, FREE_GAP_MS));
      }
    }
    await new Promise((r) => setTimeout(r, FREE_GAP_MS));
  }
  return out;
}

async function gtxOne(baseUrl, text, targetLanguage, sourceLanguage = 'auto') {
  const url =
    `${baseUrl}?client=gtx&sl=${encodeURIComponent(sourceLanguage)}&tl=${encodeURIComponent(targetLanguage)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw httpStatusError(`Free translate ${response.status}`, response.status);
  const data = await response.json();
  const segments = data?.[0];
  if (!Array.isArray(segments)) throw new Error('Free translate: unexpected response');
  return segments.map((s) => s?.[0] ?? '').join('').trim();
}

async function translateWithGtx(baseUrl, opts) {
  const joined = opts.blocks.map((b) => b.text.replace(/\n/g, ' ')).join('\n');
  const translated = await freeRequest(() =>
    gtxOne(baseUrl, joined, opts.targetLanguage, opts.sourceLanguage)
  );
  const parts = translated.split('\n');

  if (parts.length === opts.blocks.length) {
    return opts.blocks.map((block, i) => ({
      id: block.id,
      translated: parts[i].trim() || block.text,
    }));
  }

  // Line counts mismatched — fall back to one request per block.
  // Failed requests propagate so callers see the error instead of a
  // silently-untranslated block reported as complete.
  const results = [];
  for (const block of opts.blocks) {
    results.push({
      id: block.id,
      translated:
        (await freeRequest(() =>
          gtxOne(baseUrl, block.text, opts.targetLanguage, opts.sourceLanguage)
        )) || block.text,
    });
    await new Promise((r) => setTimeout(r, FREE_GAP_MS));
  }
  return results;
}

async function translateWithLibreTranslate(baseUrl, opts) {
  const endpoint = /\/translate\/?$/.test(baseUrl) ? baseUrl : `${baseUrl}/translate`;
  const data = await freeRequest(async () => {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: opts.blocks.map((b) => b.text),
        source: opts.sourceLanguage ?? 'auto',
        target: opts.targetLanguage,
        format: 'text',
      }),
    });
    if (!response.ok) {
      throw httpStatusError(`Free translate ${response.status}: ${await response.text()}`, response.status);
    }
    return response.json();
  });
  const translated = Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
  return opts.blocks.map((block, i) => ({
    id: block.id,
    translated: (translated[i] ?? block.text).trim() || block.text,
  }));
}

// ---- Ollama (native /api/chat) ----

function ollamaRoot(baseUrl) {
  return (baseUrl || 'http://localhost:11434/v1').replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

function stripThinkBlocks(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function isTranslateGemma(model) {
  return /translategemma/i.test(model || '');
}

function ollamaLanguageName(code) {
  return code && code !== 'auto' ? getLanguageName(code) : null;
}

function ollamaSystemPrompt(opts) {
  const lang = ollamaLanguageName(opts.targetLanguage) ?? opts.targetLanguage;
  const from = ollamaLanguageName(opts.sourceLanguage);
  if (isTranslateGemma(opts.model)) {
    return `You are a professional translator. Translate the user's text ${from ? `from ${from} ` : ''}to ${lang}. Output only the translation.`;
  }
  if (opts.blocks.length === 1) {
    return `Translate ${from ? `from ${from} ` : ''}to ${lang}. Output only the translation.`;
  }
  return `Translate each line ${from ? `from ${from} ` : ''}to ${lang}. Output only the translations: one line per input, same order, formatted as "id|translation".`;
}

function ollamaUserContent(opts) {
  if (opts.blocks.length === 1) return opts.blocks[0].text;
  return opts.blocks.map((b) => `${b.id}|${b.text}`).join('\n');
}

function parseOllamaBatchOutput(content, opts) {
  const cleaned = stripThinkBlocks(content);
  const byId = new Map();
  for (const line of cleaned.split('\n')) {
    const m = line.match(/^\s*[\`'"]?([\w-]+)\s*[|:]\s*(.*)$/);
    if (m) byId.set(m[1], m[2].trim().replace(/^["']|["']$/g, ''));
  }
  if (byId.size > 0) {
    // ID-tagged reply: never guess positions — a missing id keeps its
    // original text rather than borrowing another block's translation.
    return opts.blocks.map((block) => ({
      id: block.id,
      translated: byId.get(String(block.id)) || block.text,
    }));
  }
  const lines = cleaned.split('\n').filter((l) => l.trim());
  if (lines.length !== opts.blocks.length) {
    throw new Error(
      `Ollama batch format mismatch: expected ${opts.blocks.length} translations, got ${lines.length} — the model may not support the batch format`
    );
  }
  return opts.blocks.map((block, i) => ({
    id: block.id,
    translated: lines[i].replace(/^\s*[\w-]+\s*[|:]\s*/, '').trim() || block.text,
  }));
}

async function ollamaChat(root, opts, messages) {
  const temperature =
    opts.temperature === '' || opts.temperature == null || !Number.isFinite(+opts.temperature)
      ? 0.2
      : +opts.temperature;
  const timeoutSec = Math.min(600, Math.max(10, +opts.timeout || 120));
  const payload = {
    model: sanitizeHeaderValue(opts.model),
    messages,
    stream: false,
    options: {
      temperature,
      ...(opts.numCtx ? { num_ctx: +opts.numCtx } : {}),
    },
    ...(opts.keepAlive ? { keep_alive: opts.keepAlive } : {}),
  };

  let response;
  try {
    response = await fetch(`${root}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(opts.apiKey) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${timeoutSec}s — try a smaller batch or model`);
    }
    throw new Error(
      'Ollama is not running or CORS is blocked — set OLLAMA_ORIGINS=chrome-extension://*,moz-extension://* and restart Ollama (see README)'
    );
  }

  if (response.status === 404) {
    throw new Error(`Model not found — run: ollama pull ${opts.model}`);
  }
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 403 || /cors|forbidden origin/i.test(errText)) {
      throw new Error(
        'CORS blocked — set OLLAMA_ORIGINS=chrome-extension://*,moz-extension://* and restart Ollama (see README)'
      );
    }
    throw new Error(`Ollama ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.message?.content ?? '';
}

async function ollamaTranslateOne(root, opts, block) {
  const content = await ollamaChat(root, opts, [
    { role: 'system', content: ollamaSystemPrompt({ ...opts, blocks: [block] }) },
    { role: 'user', content: block.text },
  ]);
  return { id: block.id, translated: stripThinkBlocks(content) || block.text };
}

async function translateWithOllama(opts) {
  if (!opts.model?.trim()) throw new Error('Enter an Ollama model name in Settings (e.g. gemma3:12b)');
  const root = ollamaRoot(opts.baseUrl);

  // Single block (popup / selection): one minimal request.
  if (opts.blocks.length === 1 || isTranslateGemma(opts.model)) {
    const results = [];
    for (const block of opts.blocks) {
      results.push(await ollamaTranslateOne(root, opts, block));
    }
    return results;
  }

  const content = await ollamaChat(root, opts, [
    { role: 'system', content: ollamaSystemPrompt(opts) },
    { role: 'user', content: ollamaUserContent(opts) },
  ]);
  return parseOllamaBatchOutput(content, opts);
}

async function translateOpenAICompatible(baseUrl, apiKey, model, blocks, targetLanguage, sourceLanguage, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(apiKey, extraHeaders),
  };
  const safeModel = sanitizeHeaderValue(model);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(120000),
    headers,
    body: JSON.stringify({
      model: safeModel,
      temperature: 0,
      max_tokens: estimateMaxTokens(blocks),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPrompt(blocks, targetLanguage, sourceLanguage) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  const data = await response.json();
  return parseTranslationResponse(data.choices?.[0]?.message?.content ?? '{}', blocks, targetLanguage);
}

async function translateWithAnthropic(opts) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(120000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': sanitizeApiKey(opts.apiKey),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },    body: JSON.stringify({
      model: opts.model,
      max_tokens: estimateMaxTokens(opts.blocks),
      temperature: 0,
      messages: [{ role: 'user', content: buildPrompt(opts.blocks, opts.targetLanguage, opts.sourceLanguage) }],
      system: SYSTEM,
    }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return parseTranslationResponse(data.content?.[0]?.text ?? '{}', opts.blocks, opts.targetLanguage);
}

async function translateWithGoogle(opts) {
  const modelId = sanitizeHeaderValue(opts.model).replace(/^models\//, '');
  const apiKey = encodeURIComponent(sanitizeApiKey(opts.apiKey));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(120000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(opts.blocks, opts.targetLanguage, opts.sourceLanguage) }] }],
      systemInstruction: { parts: [{ text: SYSTEM }] },
      generationConfig: {
        temperature: 0,
        maxOutputTokens: estimateMaxTokens(opts.blocks),
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!response.ok) throw new Error(`Google ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return parseTranslationResponse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}', opts.blocks, opts.targetLanguage);
}

const MODULES = {
  libretranslate: translateLibreModule,
  deepl: translateDeeplModule,
  azure: translateAzureModule,
  'google-cloud': translateGoogleCloudModule,
  yandex: translateYandexModule,
  baidu: translateBaiduModule,
  mymemory: translateMyMemoryModule,
  lingva: translateLingvaModule,
};

async function translateModuleProvider(provider, meta, opts) {
  const texts = opts.blocks.map((b) => b.text);
  const params = {
    source: opts.sourceLanguage,
    target: opts.targetLanguage,
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    region: opts.region,
    folderId: opts.folderId,
    appId: opts.appId,
    secret: opts.secret,
    email: opts.email,
    endpoint: meta.endpoint,
  };
  const translated = await MODULES[meta.module](texts, params);
  return opts.blocks.map((b, i) => ({ id: b.id, translated: translated[i] || b.text }));
}

export async function translate(provider, opts) {
  const meta = PROVIDERS[provider];
  if (!meta) throw new Error(`Unknown provider: ${provider}`);

  const attempts = [{ provider, opts }];
  for (const f of opts.fallbacks ?? []) {
    if (f?.provider && f.provider !== provider && PROVIDERS[f.provider]) {
      attempts.push({ provider: f.provider, opts: { ...opts, ...f.config, fallbacks: undefined } });
    }
  }

  let lastError;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const unsupported = await findUnsupportedLanguage(
        attempt.provider,
        attempt.opts,
        attempt.opts.sourceLanguage,
        attempt.opts.targetLanguage
      );
      if (unsupported) throw unsupported;
      return await translateOnce(attempt.provider, attempt.opts);
    } catch (err) {
      lastError = err;
      // A provider rejecting a language with 400 "not supported" will never
      // succeed for it — treat like an unsupported language and move on.
      if (
        err?.status === 400 &&
        /not supported|does not support|unsupported/i.test(err?.message ?? '')
      ) {
        err.langUnsupported = true;
      }
      const canTryNext = isRetryableError(err) || !!err?.langUnsupported;
      if (i === attempts.length - 1 || !canTryNext) throw err;
    }
  }
  throw lastError;
}

async function translateOnce(provider, opts) {
  const config = PROVIDERS[provider];
  if (config.type === 'module') return translateModuleProvider(provider, config, opts);
  if (config.type === 'anthropic') return translateWithAnthropic(opts);
  if (config.type === 'google') return translateWithGoogle(opts);
  if (config.type === 'ollama') return translateWithOllama(opts);
  if (config.type === 'libretranslate' || config.type === 'mymemory') {
    return translateWithFree(opts);
  }

  const extraHeaders =
    provider === 'openrouter'
      ? { 'HTTP-Referer': 'https://malisa-translator.extension', 'X-Title': 'Malisa Translator' }
      : {};

  return translateOpenAICompatible(
    config.baseUrl,
    opts.apiKey,
    opts.model,
    opts.blocks,
    opts.targetLanguage,
    opts.sourceLanguage,
    extraHeaders
  );
}
