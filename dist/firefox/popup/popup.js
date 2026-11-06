import browser from '../shared/browser.js';
import { getSettings, saveSettings } from '../shared/storage.js';
import { LANGUAGES, PROVIDER_LABELS, PROVIDERS, isProviderReady, FREE_TIER_INFO } from '../shared/types.js';
import { escapeHtml } from '../shared/security.js';
import { sendToActiveTab } from '../shared/tabs.js';
import { getUiLanguage, t } from '../shared/i18n.js';
import { applyDocumentTheme, watchSystemTheme } from '../shared/theme.js';
import { fetchSpeech, splitForSpeech } from '../shared/tts.js';

const languageSelect = document.getElementById('language');
const providerSelect = document.getElementById('provider');
const translateBtn = document.getElementById('translateBtn');
const restoreBtn = document.getElementById('restoreBtn');
const statusEl = document.getElementById('status');
const optionsLink = document.getElementById('optionsLink');
const themeButtons = document.querySelectorAll('.theme-btn');
const textInput = document.getElementById('textInput');
const textOutput = document.getElementById('textOutput');
const translateTextBtn = document.getElementById('translateTextBtn');
const copyTextBtn = document.getElementById('copyTextBtn');
const sourceLanguageSelect = document.getElementById('sourceLanguage');
const textTargetSelect = document.getElementById('textTargetLanguage');
const swapLangBtn = document.getElementById('swapLangBtn');
const listenInputBtn = document.getElementById('listenInputBtn');
const listenOutputBtn = document.getElementById('listenOutputBtn');
const stopInputBtn = document.getElementById('stopInputBtn');
const stopOutputBtn = document.getElementById('stopOutputBtn');

let uiLang = 'en';
let unwatchSystem = () => {};

function applyPopupI18n() {
  document.documentElement.lang = uiLang;
  document.getElementById('subtitle').textContent = t('appSubtitle', uiLang);
  document.getElementById('labelLanguage').textContent = t('targetLanguage', uiLang);
  document.getElementById('labelProvider').textContent = t('aiProvider', uiLang);
  translateBtn.textContent = t('translatePage', uiLang);
  restoreBtn.textContent = t('restoreOriginal', uiLang);
  optionsLink.textContent = t('settingsLink', uiLang);
  document.getElementById('themeLight').textContent = t('themeLight', uiLang);
  document.getElementById('themeDark').textContent = t('themeDark', uiLang);
  document.getElementById('themeSystem').textContent = t('themeSystem', uiLang);
  document.getElementById('themeToggle').setAttribute('aria-label', t('translatorTheme', uiLang));
  document.getElementById('textTranslateTitle').textContent = t('translateTextTitle', uiLang);
  textInput.placeholder = t('translateTextPlaceholder', uiLang);
  listenInputBtn.title = t('listen', uiLang);
  listenOutputBtn.title = t('listen', uiLang);
  stopInputBtn.title = t('stop', uiLang);
  stopOutputBtn.title = t('stop', uiLang);
  swapLangBtn.title = t('swapLanguages', uiLang);
  translateTextBtn.textContent = t('translateText', uiLang);
  copyTextBtn.textContent = t('copyText', uiLang);
}

function setThemeButtons(activeTheme) {
  themeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === activeTheme);
  });
}

function applyTranslatorTheme(theme) {
  unwatchSystem();
  applyDocumentTheme(document, theme);
  setThemeButtons(theme);
  unwatchSystem = watchSystemTheme(document, theme, () => setThemeButtons(theme));
}

async function saveTranslatorTheme(theme) {
  const settings = await getSettings();
  settings.translatorTheme = theme;
  await saveSettings(settings);
  applyTranslatorTheme(theme);
}
function populateLanguages(selected) {
  languageSelect.innerHTML = LANGUAGES.map(
    (l) => `<option value="${escapeHtml(l.code)}" ${l.code === selected ? 'selected' : ''}>${escapeHtml(l.name)}</option>`
  ).join('');
}

function populateTextLanguages(target) {
  textTargetSelect.innerHTML = languageSelect.innerHTML;
  textTargetSelect.value = target;
  sourceLanguageSelect.innerHTML =
    `<option value="auto">${escapeHtml(t('autoDetect', uiLang))}</option>` + languageSelect.innerHTML;
  sourceLanguageSelect.value = 'auto';
}

// Playback state: speechSynthesis for browser voices, an <audio> queue for
// remote TTS engines. Audio is cached per engine+voice+text for this popup.
let speakingBtn = null;
let speakingStopBtn = null;
let currentAudio = null;
let currentAudioResolve = null;
let speechStopped = false;
let speechPaused = false;
const audioCache = new Map();

function stopSpeech() {
  window.speechSynthesis?.cancel();
  speechStopped = true;
  if (currentAudioResolve) {
    currentAudioResolve();
    currentAudioResolve = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (speakingBtn) {
    speakingBtn.classList.remove('speaking');
    speakingBtn = null;
  }
  if (speakingStopBtn) {
    speakingStopBtn.hidden = true;
    speakingStopBtn = null;
  }
}

window.addEventListener('pagehide', stopSpeech);
window.addEventListener('unload', stopSpeech);

function getVoicesOnce() {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) return Promise.resolve(voices);
  // Voice list loads asynchronously — wait once for voiceschanged (bounded).
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearTimeout(timer);
        resolve(window.speechSynthesis.getVoices());
      },
      { once: true }
    );
  });
}

async function speakWithBrowser(text, langCode, btn, stopBtn, cfg) {
  const voices = await getVoicesOnce();
  const code = langCode === 'auto' ? '' : (langCode ?? '').toLowerCase();
  const voice =
    (cfg.voice && voices.find((v) => v.name === cfg.voice)) ??
    voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(code)) ??
    voices[0]; // system default — better than failing when the language has no voice
  if (!voice) {
    showStatus(t('noVoice', uiLang), 'error');
    return;
  }
  for (const chunk of splitForSpeech(text, 300)) {
    if (speechStopped) return;
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = Math.min(4, Math.max(0.5, +cfg.rate || 1));
    utterance.pitch = Math.min(2, Math.max(0, +cfg.pitch || 1));
    utterance.onend = utterance.onerror = () => {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        // Only clear when the whole queue is drained.
        setTimeout(() => {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) stopSpeech();
        }, 50);
      }
    };
    btn.classList.add('speaking');
    speakingBtn = btn;
    speakingStopBtn = stopBtn;
    stopBtn.hidden = false;
    window.speechSynthesis.speak(utterance);
  }
}

async function speakRemote(text, engine, btn, stopBtn, cfg, keys) {
  const voiceKey = `${engine}|${cfg.googleVoice}|${cfg.geminiModel}|${cfg.elevenlabsVoiceId}|${cfg.openaiVoice}|${cfg.openaiModel}|${cfg.azureVoice}|${cfg.azureRegion}|${cfg.pollyVoice}|${cfg.pollyRegion}|${cfg.customBaseUrl}|${cfg.customVoice}|${cfg.customModel}`;
  for (const chunk of splitForSpeech(text)) {
    if (speechStopped) return;
    const cacheKey = `${voiceKey}|${chunk}`;
    if (!audioCache.has(cacheKey)) {
      audioCache.set(cacheKey, await fetchSpeech(engine, chunk, cfg, keys));
    }
    const { audioBase64, mimeType } = audioCache.get(cacheKey);
    if (speechStopped) return;
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    audio.playbackRate = Math.min(4, Math.max(0.5, +cfg.rate || 1));
    currentAudio = audio;
    btn.classList.add('speaking');
    speakingBtn = btn;
    speakingStopBtn = stopBtn;
    stopBtn.hidden = false;
    await audio.play(); // propagates playback rejection (e.g. NotAllowedError)
    await new Promise((resolve) => {
      currentAudioResolve = resolve;
      audio.onended = audio.onerror = () => {
        currentAudioResolve = null;
        resolve();
      };
      if (audio.ended) {
        currentAudioResolve = null;
        resolve();
      }
    });
  }
}

async function speak(text, langCode, btn, stopBtn) {
  // Click while playing/paused toggles pause and resume.
  if (btn === speakingBtn) {
    speechPaused = !speechPaused;
    if (currentAudio) {
      if (speechPaused) currentAudio.pause();
      else await currentAudio.play().catch(() => {});
    } else if ('speechSynthesis' in window) {
      if (speechPaused) window.speechSynthesis.pause();
      else window.speechSynthesis.resume();
    }
    btn.classList.toggle('speaking', !speechPaused);
    return;
  }
  stopSpeech();
  speechStopped = false;
  speechPaused = false;

  const settings = await getSettings();
  const cfg = settings.speech;
  const engine = cfg.engine === 'browser' && !('speechSynthesis' in window) ? null : cfg.engine;
  if (!engine) {
    showStatus(t('noVoice', uiLang), 'error');
    return;
  }
  try {
    if (engine === 'browser') {
      await speakWithBrowser(text, langCode, btn, stopBtn, cfg);
    } else {
      await speakRemote(text, engine, btn, stopBtn, { ...cfg, lang: langCode }, {
        geminiKey: settings.providers?.google?.apiKey,
        openaiKey: settings.providers?.openai?.apiKey,
      });
    }
  } catch (err) {
    showStatus(err.message, 'error');
    // Fall back to browser voices if the cloud engine failed and any exist.
    if (engine !== 'browser' && 'speechSynthesis' in window &&
        window.speechSynthesis.getVoices().length) {
      try {
        await speakWithBrowser(text, langCode, btn, stopBtn, cfg);
      } catch { /* keep the original error shown */ }
    }
  }
  // Remote playback awaits each chunk, so reaching here means it's done.
  // Browser speechSynthesis only queues utterances — cleanup happens in onend.
  if (engine !== 'browser' && speakingBtn === btn && !speechPaused) stopSpeech();
}

function showStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function populateProviders(selected) {
  providerSelect.innerHTML = Object.entries(PROVIDERS)
    .map(([id, p]) => `<option value="${escapeHtml(id)}" ${id === selected ? 'selected' : ''}>${escapeHtml(p.label + (FREE_TIER_INFO[id] ? ` · ${t('freeTier', uiLang)}` : ''))}</option>`)
    .join('');
}

async function init() {
  uiLang = await getUiLanguage();
  applyPopupI18n();

  const settings = await getSettings();
  populateLanguages(settings.defaultLanguage);
  populateTextLanguages(settings.defaultLanguage);
  populateProviders(settings.activeProvider);
  providerSelect.value = settings.activeProvider;
  applyTranslatorTheme(settings.translatorTheme ?? 'system');

  themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => saveTranslatorTheme(btn.dataset.theme));
  });

  try {    const status = await sendToActiveTab({ type: 'GET_STATUS' });
    restoreBtn.disabled = !status?.isTranslated;
  } catch {
    showStatus(t('refreshPage', uiLang), 'error');
    translateBtn.disabled = true;
  }

  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });

  providerSelect.addEventListener('change', async () => {
    const s = await getSettings();
    s.activeProvider = providerSelect.value;
    await saveSettings(s);
  });

  languageSelect.addEventListener('change', async () => {
    const s = await getSettings();
    s.defaultLanguage = languageSelect.value;
    await saveSettings(s);
  });

  translateBtn.addEventListener('click', async () => {
    statusEl.className = 'status hidden';
    translateBtn.disabled = true;
    showStatus(t('translating', uiLang), 'info');

    try {
      const settings = await getSettings();
      const provider = providerSelect.value;
      if (!isProviderReady(provider, settings.providers[provider])) {
        const hint = PROVIDERS[provider]?.apiKeyOptional
          ? t('setProviderUrl', uiLang)
          : t('enterApiKey', uiLang, { provider: PROVIDER_LABELS[provider] });
        showStatus(hint, 'error');
        return;
      }
      settings.activeProvider = provider;
      await saveSettings(settings);
      await sendToActiveTab({ type: 'TRANSLATE_PAGE', targetLanguage: languageSelect.value });
      restoreBtn.disabled = false;
      window.close();
    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      translateBtn.disabled = false;
    }
  });

  restoreBtn.addEventListener('click', async () => {
    try {
      await sendToActiveTab({ type: 'RESTORE_PAGE' });
      restoreBtn.disabled = true;
      window.close();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  });

  translateTextBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) return;
    const provider = providerSelect.value;
    const settings = await getSettings();
    if (!isProviderReady(provider, settings.providers[provider])) {
      const hint = PROVIDERS[provider]?.apiKeyOptional
        ? t('setProviderUrl', uiLang)
        : t('enterApiKey', uiLang, { provider: PROVIDER_LABELS[provider] });
      showStatus(hint, 'error');
      return;
    }

    translateTextBtn.disabled = true;
    textOutput.textContent = t('translating', uiLang);
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        text,
        targetLanguage: textTargetSelect.value,
        sourceLanguage: sourceLanguageSelect.value,
        provider,
      });
      if (!response?.ok) throw new Error(response?.error ?? 'Translation failed');
      textOutput.textContent = response.translated;
      copyTextBtn.disabled = false;
      copyTextBtn.textContent = t('copyText', uiLang);
    } catch (err) {
      textOutput.textContent = '';
      showStatus(err.message, 'error');
    } finally {
      translateTextBtn.disabled = false;
    }
  });

  swapLangBtn.addEventListener('click', () => {
    const source = sourceLanguageSelect.value;
    if (source === 'auto') return;
    sourceLanguageSelect.value = textTargetSelect.value;
    textTargetSelect.value = source;
  });

  listenInputBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) speak(text, sourceLanguageSelect.value, listenInputBtn, stopInputBtn);
  });

  stopInputBtn.addEventListener('click', stopSpeech);

  listenOutputBtn.addEventListener('click', () => {
    const text = textOutput.textContent.trim();
    if (text) speak(text, textTargetSelect.value, listenOutputBtn, stopOutputBtn);
  });

  stopOutputBtn.addEventListener('click', stopSpeech);

  copyTextBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textOutput.textContent);
      copyTextBtn.textContent = t('copiedText', uiLang);
      setTimeout(() => {
        copyTextBtn.textContent = t('copyText', uiLang);
      }, 1500);
    } catch {
      showStatus(t('copyFailed', uiLang), 'error');
    }
  });
}

init();
