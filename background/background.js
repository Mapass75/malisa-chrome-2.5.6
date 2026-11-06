import browser from '../shared/browser.js';
import { getSettings, writePublicSettingsMirror } from '../shared/storage.js';
import { getCachedTranslations, cacheTranslations } from '../shared/cache.js';
import { dedupeBlocks } from '../shared/dedupe.js';
import { translate } from '../shared/providers.js';
import { chunkBlocks, runConcurrent } from '../shared/batcher.js';
import { fetchModels, refreshAllModels } from '../shared/models.js';
import { getProviderLimits, isProviderReady, PROVIDERS } from '../shared/types.js';
import { getUiLanguage, t } from '../shared/i18n.js';
import {
  assertTrustedSender,
  isValidLanguage,
  isValidProvider,
  sanitizeErrorMessage,
  validateBlocks,
  validateOllamaBaseUrl,
  validateSelectionText,
  validateTtsText,
} from '../shared/security.js';
import { fetchSpeech } from '../shared/tts.js';
import { transcribeAudio, supportsTranscription } from '../shared/transcribe.js';
import { isTranslatableUrl, sendToContent } from '../shared/tabs.js';
import { chatComplete, isChatProvider } from '../shared/chat.js';

const CONTEXT_MENU_ID = 'malisa-translate-selection';
const CONTEXT_MENU_PAGE_ID = 'malisa-translate-page';
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_TTL = 60000;
const pendingVoicePages = new Map();

async function getCachedSettings() {
  if (settingsCache && Date.now() - settingsCacheTime < SETTINGS_TTL) {
    return settingsCache;
  }
  settingsCache = await getSettings();
  settingsCacheTime = Date.now();
  return settingsCache;
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    settingsCache = null;
    // Keep the redacted mirror in sync for content scripts (covers writes
    // that bypass saveSettings, e.g. migrations or other extension pages).
    writePublicSettingsMirror().catch(() => {});
    if (changes.settings.newValue?.uiLanguage !== changes.settings.oldValue?.uiLanguage) {
      setupContextMenu().catch(() => {});
    }
  }
});

browser.runtime.onInstalled.addListener(() => {
  writePublicSettingsMirror().catch(() => {});
});
browser.runtime.onStartup.addListener(() => {
  writePublicSettingsMirror().catch(() => {});
});

function contextMenuCall(method, ...args) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    try {
      const result = browser.contextMenus[method](...args, done);
      if (result && typeof result.then === 'function') result.then(done, done);
    } catch {
      done();
    }
  });
}

let contextMenuQueue = Promise.resolve();

async function rebuildContextMenu() {
  const lang = await getUiLanguage();
  await contextMenuCall('removeAll');
  await contextMenuCall('create', {
    id: CONTEXT_MENU_ID,
    title: t('contextMenuTranslate', lang),
    contexts: ['selection'],
  });
  await contextMenuCall('create', {
    id: CONTEXT_MENU_PAGE_ID,
    title: t('contextMenuTranslatePage', lang),
    contexts: ['page', 'link', 'image', 'selection', 'editable', 'video', 'audio', 'frame'],
  });
}

function setupContextMenu() {
  contextMenuQueue = contextMenuQueue.then(rebuildContextMenu).catch(() => {});
  return contextMenuQueue;
}

browser.runtime.onInstalled.addListener(() => {
  setupContextMenu().catch(() => {});
  getCachedSettings();
});

browser.runtime.onStartup.addListener(() => {
  setupContextMenu().catch(() => {});
  getCachedSettings();
});

setupContextMenu().catch(() => {});
function notifyTab(tabId, message, frameId) {
  if (!tabId) return;
  browser.tabs
    .sendMessage(tabId, message, frameId == null ? {} : { frameId })
    .catch(() => {});
}

async function notifyTabEnsured(tabId, message) {
  if (!tabId) return;
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch {
    await browser.scripting.executeScript({ target: { tabId }, files: ['content/content.js'] });
    await browser.tabs.sendMessage(tabId, message);
  }
}
function createProgressThrottle(tabId, frameId, epoch) {
  let last = 0;
  return (done, total) => {
    const now = Date.now();
    if (done < total && now - last < 400) return;
    last = now;
    notifyTab(tabId, { type: 'TRANSLATION_PROGRESS', done, total, epoch }, frameId);
  };
}

function sortBatchesLargestFirst(batches) {
  return batches
    .map((batch, index) => ({ batch, index, size: batch.reduce((s, b) => s + b.text.length, 0) }))
    .sort((a, b) => b.size - a.size)
    .map((item) => item.batch);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isTransientError(message) {
  return /429|rate.?limit|too many|timeout|timed out|network|failed to fetch|500|502|503|504|overload/i.test(
    message
  );
}

async function translateBatchWithRetry(provider, translateOpts, batch, retried = false) {
  try {
    return await translate(provider, { ...translateOpts, blocks: batch });
  } catch (err) {
    // One backoff retry for transient failures (rate limits, 5xx, network).
    if (!retried && isTransientError(err.message)) {
      await sleep(2000);
      return translateBatchWithRetry(provider, translateOpts, batch, true);
    }
    const retryable =
      batch.length >= 4 &&
      /did not translate|format mismatch|not valid JSON|No text was translated/i.test(err.message);
    if (!retryable) throw err;

    const mid = Math.ceil(batch.length / 2);
    const first = await translateBatchWithRetry(provider, translateOpts, batch.slice(0, mid));
    const second = await translateBatchWithRetry(provider, translateOpts, batch.slice(mid));
    return [...first, ...second];
  }
}

async function resolveProvider(settings, provider = settings.activeProvider) {
  if (!isValidProvider(provider)) {
    throw new Error('Invalid AI provider');
  }
  const providerConfig = settings.providers[provider];
  if (!isProviderReady(provider, providerConfig)) {
    throw new Error(`Provider ${provider} is not configured. Open Settings.`);
  }
  if (provider === 'ollama' && !validateOllamaBaseUrl(providerConfig.baseUrl)) {
    throw new Error('Invalid Ollama URL');
  }
  return {
    provider,
    translateOpts: {
      ...providerConfig,
      fallbacks: buildFallbacks(settings, provider),
    },
    cacheEnabled: settings.translationCacheEnabled !== false,
  };
}

function buildFallbacks(settings, provider) {
  const ids = settings.fallbackProviders;
  if (!Array.isArray(ids) || !ids.length) return undefined;
  const fallbacks = ids
    .filter((id) => id !== provider && isValidProvider(id) && PROVIDERS[id])
    .map((id) => ({ provider: id, config: settings.providers?.[id] ?? {} }))
    .filter((f) => isProviderReady(f.provider, settings.providers?.[f.provider] ?? {}));
  return fallbacks.length ? fallbacks : undefined;
}

async function translateSingleText(text, targetLanguage, providerId, sourceLanguage = 'auto') {
  const settings = await getCachedSettings();
  const { provider, translateOpts, cacheEnabled } = await resolveProvider(settings, providerId);
  const cached = await getCachedTranslations(
    [text],
    targetLanguage,
    cacheEnabled,
    sourceLanguage
  );
  if (cached.has(text)) return cached.get(text);

  const results = await translateBatchWithRetry(
    provider,
    { ...translateOpts, targetLanguage, sourceLanguage },
    [{ id: '0', text }]
  );
  const translated = results[0]?.translated ?? text;
  cacheTranslations(
    [{ text, translation: translated }],
    targetLanguage,
    cacheEnabled,
    sourceLanguage
  ).catch(() => {});
  return translated;
}

const POPUP_TEXT_LIMIT = 40000;
const POPUP_CHUNK_SIZE = 3000;

function validatePopupText(text) {
  if (typeof text !== 'string') throw new Error('No text to translate');
  const trimmed = text.trim();
  if (!trimmed || !/\p{L}/u.test(trimmed)) throw new Error('No text to translate');
  if (trimmed.length > POPUP_TEXT_LIMIT) {
    throw new Error(`Text is too long (${trimmed.length} chars, max ${POPUP_TEXT_LIMIT})`);
  }
  return trimmed;
}

// Split long popup input at paragraph/space boundaries; the exact separator
// is kept so the translated chunks can be reassembled faithfully. Fixed-length
// fallback cuts are moved to a code-point boundary to avoid splitting
// surrogate pairs (e.g. emoji).
function chunkPopupText(text) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > POPUP_CHUNK_SIZE) {
    let cut = remaining.lastIndexOf('\n', POPUP_CHUNK_SIZE);
    let sepLen = 1;
    if (cut < POPUP_CHUNK_SIZE / 2) cut = remaining.lastIndexOf(' ', POPUP_CHUNK_SIZE);
    if (cut < POPUP_CHUNK_SIZE / 2) {
      cut = POPUP_CHUNK_SIZE;
      sepLen = 0;
      // Don't split a surrogate pair: back off while the char before the cut
      // is a high surrogate.
      while (cut > 0 && /[\uD800-\uDBFF]/.test(remaining[cut - 1])) cut--;
    }
    chunks.push({ text: remaining.slice(0, cut), sep: remaining.slice(cut, cut + sepLen) });
    remaining = remaining.slice(cut + sepLen);
  }
  if (remaining) chunks.push({ text: remaining, sep: '' });
  return chunks;
}

async function translatePopupText(text, targetLanguage, providerId, sourceLanguage = 'auto') {
  const chunks = chunkPopupText(validatePopupText(text));
  let result = '';
  for (const chunk of chunks) {
    result +=
      (await translateSingleText(chunk.text, targetLanguage, providerId, sourceLanguage)) +
      chunk.sep;
  }
  return result;
}

async function translateAllBlocks(blocks, targetLanguage, tabId, frameId, epoch) {
  if (!isValidLanguage(targetLanguage)) {
    throw new Error('Invalid target language');
  }

  const safeBlocks = validateBlocks(blocks);
  const settings = await getCachedSettings();
  const { provider, translateOpts, cacheEnabled } = await resolveProvider(settings);

  const limits = getProviderLimits(provider, settings);
  const texts = safeBlocks.map((b) => b.text);
  const cached = await getCachedTranslations(texts, targetLanguage, cacheEnabled);

  const cachedResults = [];
  const uncachedBlocks = [];

  for (const block of safeBlocks) {
    if (cached.has(block.text)) {
      cachedResults.push({ id: block.id, translated: cached.get(block.text) });
    } else {
      uncachedBlocks.push(block);
    }
  }

  if (cachedResults.length) {
    notifyTab(tabId, { type: 'APPLY_TRANSLATIONS', results: cachedResults, epoch }, frameId);
  }
  if (!uncachedBlocks.length) return;

  const batches = sortBatchesLargestFirst(
    chunkBlocks(uncachedBlocks, limits.batchSize, limits.maxChars)
  );
  const onProgress = batches.length > 2 ? createProgressThrottle(tabId, frameId, epoch) : () => {};

  translateOpts.targetLanguage = targetLanguage;

  await runConcurrent(
    batches,
    limits.parallel,
    async (batch) => {
      const { uniqueBlocks, expandResults, cacheEntries } = dedupeBlocks(batch);
      const dedupedResults = await translateBatchWithRetry(provider, translateOpts, uniqueBlocks);
      const translated = expandResults(dedupedResults);
      notifyTab(tabId, { type: 'APPLY_TRANSLATIONS', results: translated, epoch }, frameId);
      cacheTranslations(cacheEntries(dedupedResults), targetLanguage, cacheEnabled).catch(() => {});
      return translated;
    },
    onProgress
  );
}

async function translateSelection(text, tabId) {
  const trimmed = validateSelectionText(text);
  const settings = await getCachedSettings();
  const targetLanguage = settings.defaultLanguage;

  if (!isValidLanguage(targetLanguage)) {
    throw new Error('Invalid target language');
  }

  const translated = await translateSingleText(trimmed, targetLanguage);

  await notifyTabEnsured(tabId, {
    type: 'SELECTION_TRANSLATED',
    original: trimmed,
    translated,
    targetLanguage,
  });
}

async function translatePageFromMenu(tab) {
  if (!tab?.id || !isTranslatableUrl(tab.url)) return;
  const settings = await getCachedSettings();
  const targetLanguage = settings.defaultLanguage;

  if (!isValidLanguage(targetLanguage)) {
    await notifyTabEnsured(tab.id, {
      type: 'TRANSLATION_ERROR',
      error: 'Invalid target language',
    }).catch(() => {});
    return;
  }

  await sendToContent(tab.id, { type: 'TRANSLATE_PAGE', targetLanguage }).catch((err) => {
    notifyTabEnsured(tab.id, {
      type: 'TRANSLATION_ERROR',
      error: sanitizeErrorMessage(err.message),
    }).catch(() => {});
  });
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_PAGE_ID) {
    translatePageFromMenu(tab).catch(() => {});
    return;
  }
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
  const text = info.selectionText?.trim();
  if (!text) return;

  notifyTabEnsured(tab.id, { type: 'SELECTION_TRANSLATING' }).catch(() => {});
  translateSelection(text, tab.id).catch((err) => {
    notifyTabEnsured(tab.id, {
      type: 'SELECTION_ERROR',
      error: sanitizeErrorMessage(err.message),
    }).catch(() => {});
  });
});

function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  let total = 0;
  for (const m of messages.slice(-40)) {
    const role = m?.role;
    const content = typeof m?.content === 'string' ? m.content.slice(0, 24000) : '';
    if (!content || !['system', 'user', 'assistant'].includes(role)) continue;
    total += content.length;
    if (total > 120000) break;
    out.push({ role, content });
  }
  return out;
}

function resolveChatConfig(settings, msg) {
  const chatbot = settings.chatbot ?? {};
  const providerId = msg.provider || chatbot.provider || settings.activeProvider;
  if (!isChatProvider(providerId)) {
    throw new Error('The selected provider does not support chat. Choose an LLM provider in Settings.');
  }
  const pcfg = settings.providers?.[providerId] ?? {};
  const model = String(
    msg.model || chatbot.model || pcfg.model || PROVIDERS[providerId]?.defaultModel || ''
  ).trim();
  if (!isProviderReady(providerId, { ...pcfg, model })) {
    throw new Error('Chat provider is not configured. Open Settings and set an API key and model.');
  }
  return {
    providerId,
    apiKey: pcfg.apiKey ?? '',
    model,
    baseUrl: pcfg.baseUrl ?? '',
    messages: sanitizeChatMessages(msg.messages),
    temperature: Math.min(2, Math.max(0, Number(msg.temperature ?? chatbot.temperature ?? 0.7) || 0)),
    maxTokens: Math.min(8192, Math.max(1, Number(msg.maxTokens || chatbot.maxTokens || 2048) || 2048)),
  };
}

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== 'malisa-chat') return;
  let abort = null;
  port.onMessage.addListener((msg) => {
    if (msg?.type !== 'chat-start' || abort) return;
    (async () => {
      try {
        const settings = await getCachedSettings();
        const cfg = resolveChatConfig(settings, msg);
        abort = new AbortController();
        await chatComplete({
          ...cfg,
          stream: true,
          signal: abort.signal,
          onChunk: (text) => {
            try {
              port.postMessage({ type: 'chunk', text });
            } catch {
              /* port closed */
            }
          },
        });
        try {
          port.postMessage({ type: 'done' });
        } catch {
          /* port closed */
        }
      } catch (err) {
        try {
          port.postMessage({ type: 'error', error: sanitizeErrorMessage(err.message) });
        } catch {
          /* port closed */
        }
      } finally {
        abort = null;
      }
    })();
  });
  port.onDisconnect.addListener(() => {
    try {
      abort?.abort();
    } catch {
      /* already aborted */
    }
  });
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {  try {
    assertTrustedSender(sender);
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
    return false;
  }

  if (message.type === 'TRANSLATE_PAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'Translation is only available on web pages' });
      return false;
    }

    const frameId = sender.frameId;
    const epoch = message.epoch;
    if (message.rescan === true && !isValidLanguage(message.targetLanguage)) {
      sendResponse({ ok: true });
      return false;
    }
    translateAllBlocks(message.blocks, message.targetLanguage, tabId, frameId, epoch)
      .then(() => notifyTab(tabId, { type: 'TRANSLATION_DONE', epoch }, frameId))
      .catch((err) =>
        notifyTab(
          tabId,
          { type: 'TRANSLATION_ERROR', error: sanitizeErrorMessage(err.message), epoch },
          frameId
        )
      );
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'CHAT_SEND') {
    (async () => {
      try {
        const settings = await getCachedSettings();
        const cfg = resolveChatConfig(settings, message);
        const text = await chatComplete({ ...cfg, stream: false });
        sendResponse({ ok: true, text });
      } catch (err) {
        sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) });
      }
    })();
    return true;
  }

  if (message.type === 'GET_CHAT_PROVIDERS') {
    const providers = Object.keys(PROVIDERS)
      .filter(isChatProvider)
      .map((id) => ({
        id,
        label: PROVIDERS[id]?.label || id,
        defaultModel: PROVIDERS[id]?.defaultModel || '',
      }));
    sendResponse({ ok: true, providers });
    return false;
  }

  if (message.type === 'VOICE_TRANSCRIBE') {
    (async () => {
      try {
        const settings = await getCachedSettings();
        const provId = (message.provider || settings.chatbot?.provider || settings.activeProvider || '').toLowerCase();
        if (!supportsTranscription(provId)) {
          sendResponse({
            ok: false,
            error: `Provider "${provId}" does not support audio transcription — use Browser method or OpenAI/Groq/Mistral`,
          });
          return;
        }
        const pcfg = settings.providers?.[provId] || {};
        if (!message.audio?.byteLength || message.audio.byteLength > 25 * 1024 * 1024) {
          sendResponse({ ok: false, error: 'Audio is missing or too large (max 25 MB)' });
          return;
        }
        const { text } = await transcribeAudio({
          provider: provId,
          apiKey: pcfg.apiKey,
          baseUrl: pcfg.baseUrl,
          model: message.model,
          audio: message.audio,
          mimeType: message.mimeType,
          language: message.language,
        });
        sendResponse({ ok: true, text });
      } catch (err) {
        sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) });
      }
    })();
    return true;
  }

  if (message.type === 'OPEN_VOICE_PAGE') {
    const req = typeof message.req === 'string' && message.req ? message.req.slice(0, 64) : '';
    if (!req) {
      sendResponse({ ok: false, error: 'Missing request id' });
      return false;
    }
    if (pendingVoicePages.size > 100) {
      pendingVoicePages.delete(pendingVoicePages.keys().next().value);
    }
    pendingVoicePages.set(req, sender.tab?.id ?? null);
    const params = new URLSearchParams({
      req,
      method: message.method === 'ai' ? 'ai' : 'browser',
      lang: typeof message.lang === 'string' ? message.lang.slice(0, 20) : '',
      provider: typeof message.provider === 'string' ? message.provider.slice(0, 40) : '',
      model: typeof message.model === 'string' ? message.model.slice(0, 80) : '',
    });
    const url = `${browser.runtime.getURL('mic.html')}?${params.toString()}`;
    browser.windows
      .create({ url, type: 'popup', width: 400, height: 520 })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) }));
    return true;
  }

  if (message.type === 'VOICE_PAGE_RESULT') {
    const req = typeof message.req === 'string' ? message.req : '';
    const tabId = pendingVoicePages.get(req);
    pendingVoicePages.delete(req);
    if (tabId != null) {
      browser.tabs
        .sendMessage(tabId, { type: 'CHAT_VOICE_RESULT', req, text: message.text || '' })
        .catch(() => {
          /* tab gone */
        });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'TRANSLATE_TEXT') {
    try {
      validatePopupText(message.text);
      if (!isValidLanguage(message.targetLanguage)) {
        throw new Error('Invalid target language');
      }
      translatePopupText(
        message.text,
        message.targetLanguage,
        message.provider,
        message.sourceLanguage
      )
        .then((translated) => sendResponse({ ok: true, translated }))
        .catch((err) => sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) }));
    } catch (err) {
      sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) });
    }
    return true;
  }

  if (message.type === 'FETCH_MODELS') {
    if (!isValidProvider(message.provider)) {
      sendResponse({ ok: false, error: 'Unknown provider' });
      return false;
    }
    fetchModels(message.provider, message.config, !!message.force)
      .then((models) => sendResponse({ ok: true, models }))
      .catch((err) => sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) }));
    return true;
  }

  if (message.type === 'TEST_PROVIDER') {
    if (!isValidProvider(message.provider)) {
      sendResponse({ ok: false, error: 'Unknown provider' });
      return false;
    }
    (async () => {
      try {
        const settings = await getCachedSettings();
        let targetLanguage = settings.defaultLanguage;
        if (!isValidLanguage(targetLanguage) || targetLanguage === 'en') targetLanguage = 'hr';
        const cfg = message.config ?? {};
        const results = await translate(message.provider, {
          apiKey: cfg.apiKey,
          model: cfg.model,
          baseUrl: cfg.baseUrl,
          region: cfg.region,
          folderId: cfg.folderId,
          appId: cfg.appId,
          secret: cfg.secret,
          email: cfg.email,
          blocks: [{ id: '0', text: 'Hello world' }],
          targetLanguage,
          sourceLanguage: 'en',
        });
        sendResponse({ ok: true, translated: results[0]?.translated ?? '' });
      } catch (err) {
        sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) });
      }
    })();
    return true;
  }

  if (message.type === 'REFRESH_ALL_MODELS') {
    refreshAllModels(message.providers ?? {})
      .then((results) => sendResponse({ ok: true, results }))
      .catch((err) => sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) }));
    return true;
  }

  if (message.type === 'GET_TTS_SETTINGS') {
    getCachedSettings()
      .then((settings) =>
        sendResponse({
          ok: true,
          settings: {
            enabled: settings.selectionTtsEnabled !== false,
            speech: {
              engine: settings.speech?.engine ?? 'browser',
              voice: settings.speech?.voice ?? '',
              rate: settings.speech?.rate ?? 1,
              pitch: settings.speech?.pitch ?? 1,
            },
          },
        })
      )
      .catch((err) => sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) }));
    return true;
  }

  if (message.type === 'SPEAK_SELECTION') {
    const text = validateTtsText(message.text);
    getCachedSettings()
      .then(async (settings) => {
        if (settings.selectionTtsEnabled === false) {
          throw new Error('Text-to-speech is disabled in Settings');
        }
        const engine = settings.speech?.engine ?? 'browser';
        if (engine === 'browser') throw new Error('Browser voices play in the page');
        const audio = await fetchSpeech(
          engine,
          text,
          { ...settings.speech, lang: message.lang || settings.defaultLanguage },
          {
            geminiKey: settings.providers?.google?.apiKey,
            openaiKey: settings.providers?.openai?.apiKey,
          }
        );
        sendResponse({ ok: true, ...audio });
      })
      .catch((err) => sendResponse({ ok: false, error: sanitizeErrorMessage(err.message) }));
    return true;
  }

  return false;
});
