import browser from '../shared/browser.js';
import { getSettings, saveSettings, hasPrivacyConsent, setPrivacyConsent, getLanguageName } from '../shared/storage.js';
import { isTargetLanguageSupported } from '../shared/providers/langsupport.js';
import {
  LANGUAGES,
  PROVIDERS,
  PROVIDER_KEY_URLS,
  OLLAMA_DOWNLOAD_URL,
  FREE_TIER_INFO,
  FREE_TIER_CHECKED,
  SPEECH_ENGINES,
  isProviderReady,
  CHATBOT_DEFAULTS,
} from '../shared/types.js';
import { getCachedModels } from '../shared/models.js';
import { clearTranslationCache, countTranslationCacheEntries } from '../shared/cache.js';
import { escapeHtml, validateOllamaBaseUrl, sanitizeApiKey, sanitizeHeaderValue } from '../shared/security.js';
import { UI_LANGUAGES, t } from '../shared/i18n.js';
import { OPENAI_TTS_MODELS, OPENAI_TTS_VOICES, fetchSpeech, splitForSpeech, langToBcp47 } from '../shared/tts.js';

const uiLanguage = document.getElementById('uiLanguage');
const privacyCard = document.getElementById('privacyCard');
const settingsContent = document.getElementById('settingsContent');
const privacyConsent = document.getElementById('privacyConsent');
const acceptPrivacyBtn = document.getElementById('acceptPrivacyBtn');
const defaultLanguage = document.getElementById('defaultLanguage');
const activeProvider = document.getElementById('activeProvider');
const batchSize = document.getElementById('batchSize');
const parallelRequests = document.getElementById('parallelRequests');
const skipDomains = document.getElementById('skipDomains');
const translationCacheEnabled = document.getElementById('translationCacheEnabled');
const translationCacheCount = document.getElementById('translationCacheCount');
const clearCacheBtn = document.getElementById('clearCacheBtn');
const clearCacheStatus = document.getElementById('clearCacheStatus');
const selectionTtsEnabled = document.getElementById('selectionTtsEnabled');
const speechEngine = document.getElementById('speechEngine');
const speechVoice = document.getElementById('speechVoice');
const speechRate = document.getElementById('speechRate');
const speechPitch = document.getElementById('speechPitch');
const speechEngineInfo = document.getElementById('speechEngineInfo');
const speechEngineLink = document.getElementById('speechEngineLink');
const speechGoogleKey = document.getElementById('speechGoogleKey');
const speechGoogleVoice = document.getElementById('speechGoogleVoice');
const speechGeminiModel = document.getElementById('speechGeminiModel');
const speechElevenlabsKey = document.getElementById('speechElevenlabsKey');
const speechElevenlabsVoiceId = document.getElementById('speechElevenlabsVoiceId');
const speechOpenaiVoice = document.getElementById('speechOpenaiVoice');
const speechOpenaiModel = document.getElementById('speechOpenaiModel');
const speechAzureKey = document.getElementById('speechAzureKey');
const speechAzureRegion = document.getElementById('speechAzureRegion');
const speechAzureVoice = document.getElementById('speechAzureVoice');
const speechPollyAccessKey = document.getElementById('speechPollyAccessKey');
const speechPollySecretKey = document.getElementById('speechPollySecretKey');
const speechPollyRegion = document.getElementById('speechPollyRegion');
const speechPollyVoice = document.getElementById('speechPollyVoice');
const speechCustomBaseUrl = document.getElementById('speechCustomBaseUrl');
const speechCustomKey = document.getElementById('speechCustomKey');
const speechCustomModel = document.getElementById('speechCustomModel');
const speechCustomVoice = document.getElementById('speechCustomVoice');
const speechTestBtn = document.getElementById('speechTestBtn');
const speechTestStatus = document.getElementById('speechTestStatus');
const providerSections = document.getElementById('providerSections');
const refreshAllBtn = document.getElementById('refreshAllBtn');
const refreshStatus = document.getElementById('refreshStatus');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const fallbackProvidersEl = document.getElementById('fallbackProviders');
const fallbackMs = document.getElementById('fallbackMs');
const fallbackMsBtn = document.getElementById('fallbackMsBtn');
const providerSearch = document.getElementById('providerSearch');
const mymemoryWarn = document.getElementById('mymemoryWarn');
const chatEnabled = document.getElementById('chatEnabled');
const chatShowIcon = document.getElementById('chatShowIcon');
const chatProvider = document.getElementById('chatProvider');
const chatModel = document.getElementById('chatModel');
const chatSystemPrompt = document.getElementById('chatSystemPrompt');
const chatSummarizePrompt = document.getElementById('chatSummarizePrompt');
const chatExplainPrompt = document.getElementById('chatExplainPrompt');
const chatCustomActions = document.getElementById('chatCustomActions');
const chatAddAction = document.getElementById('chatAddAction');
const chatTemperature = document.getElementById('chatTemperature');
const chatTemperatureValue = document.getElementById('chatTemperatureValue');
const chatMaxTokens = document.getElementById('chatMaxTokens');
const chatMaxPageChars = document.getElementById('chatMaxPageChars');
const chatResponseLanguage = document.getElementById('chatResponseLanguage');
const chatIncludePage = document.getElementById('chatIncludePage');
const chatAutoClear = document.getElementById('chatAutoClear');
const chatNoHistory = document.getElementById('chatNoHistory');
const chatVoiceEnabled = document.getElementById('chatVoiceEnabled');
const chatVoiceMethod = document.getElementById('chatVoiceMethod');
const chatVoiceLang = document.getElementById('chatVoiceLang');
const chatVoiceAutoSend = document.getElementById('chatVoiceAutoSend');
const chatVoiceCommands = document.getElementById('chatVoiceCommands');
const chatAutoRead = document.getElementById('chatAutoRead');
const chatShowTimestamps = document.getElementById('chatShowTimestamps');
const chatSelButtons = document.getElementById('chatSelButtons');
const chatActionButtons = document.getElementById('chatActionButtons');
const chatTestMic = document.getElementById('chatTestMic');
const chatTestVoice = document.getElementById('chatTestVoice');
const chatVoiceTestStatus = document.getElementById('chatVoiceTestStatus');
const chatSystemPromptReset = document.getElementById('chatSystemPromptReset');
const chatSummarizePromptReset = document.getElementById('chatSummarizePromptReset');
const chatExplainPromptReset = document.getElementById('chatExplainPromptReset');

const providerEls = {};
const themeSegmentButtons = document.querySelectorAll('.theme-segment-btn');
let lang = 'en';
let selectedTranslatorTheme = 'system';
function applyOptionsI18n() {
  document.documentElement.lang = lang;
  document.title = t('optionsTitle', lang);
  document.getElementById('pageSubtitle').textContent = t('optionsSubtitle', lang);
  document.getElementById('privacyTitle').textContent = t('privacyTitle', lang);
  document.getElementById('privacyBody').textContent = t('privacyBody', lang);
  document.getElementById('privacyConsentText').textContent = t('privacyConsent', lang) + ' ';
  document.getElementById('privacyPolicyLink').textContent = t('privacyPolicy', lang);
  document.getElementById('privacyAgreeText').textContent = ' ' + t('privacyAgree', lang);
  acceptPrivacyBtn.textContent = t('acceptContinue', lang);
  document.getElementById('generalTitle').textContent = t('generalSettings', lang);
  document.getElementById('labelUiLanguage').textContent = t('uiLanguage', lang);
  document.getElementById('labelDefaultLanguage').textContent = t('defaultTargetLanguage', lang);
  document.getElementById('labelActiveProvider').textContent = t('defaultProvider', lang);
  document.getElementById('labelBatchSize').textContent = t('batchSize', lang);
  document.getElementById('labelParallel').textContent = t('parallelRequests', lang);
  document.getElementById('batchHint').textContent = t('batchHint', lang);
  document.getElementById('labelSkipDomains').textContent = t('skipDomains', lang);
  document.getElementById('selectionTtsEnableLabel').textContent = t('selectionTtsEnable', lang);
  document.getElementById('speechCustomTestBtn').textContent = t('testConnection', lang);
  document.getElementById('speechTitle').textContent = t('speechTitle', lang);
  document.getElementById('speechNote').textContent = t('speechNote', lang);
  document.getElementById('labelSpeechEngine').textContent = t('speechEngine', lang);
  document.getElementById('labelSpeechVoice').textContent = t('speechVoice', lang);
  document.getElementById('labelSpeechGoogleKey').textContent = t('speechGoogleKey', lang);
  document.getElementById('labelSpeechVoiceName').textContent = t('speechVoiceName', lang);
  document.getElementById('labelSpeechGeminiModel').textContent = t('speechGeminiModel', lang);
  document.getElementById('speechGeminiHint').textContent = t('speechGeminiHint', lang);
  document.getElementById('labelSpeechElevenlabsKey').textContent = t('speechElevenlabsKey', lang);
  document.getElementById('labelSpeechOpenaiVoice').textContent = t('speechOpenaiVoice', lang);
  document.getElementById('labelSpeechOpenaiModel').textContent = t('speechOpenaiModel', lang);
  document.getElementById('speechOpenaiHint').textContent = t('speechOpenaiHint', lang);
  document.getElementById('labelSpeechElevenlabsVoice').textContent = t('speechElevenlabsVoice', lang);
  document.getElementById('labelSpeechAzureKey').textContent = t('speechAzureKey', lang);
  document.getElementById('labelSpeechAzureRegion').textContent = t('speechAzureRegion', lang);
  document.getElementById('labelSpeechAzureVoice').textContent = t('speechVoiceName', lang);
  document.getElementById('speechAzureHint').textContent = t('speechAzureHint', lang);
  document.getElementById('labelSpeechPollyAccessKey').textContent = t('speechPollyAccessKey', lang);
  document.getElementById('labelSpeechPollySecretKey').textContent = t('speechPollySecretKey', lang);
  document.getElementById('labelSpeechPollyRegion').textContent = t('speechAzureRegion', lang);
  document.getElementById('labelSpeechPollyVoice').textContent = t('speechVoiceName', lang);
  document.getElementById('speechPollyHint').textContent = t('speechPollyHint', lang);
  document.getElementById('labelSpeechCustomBaseUrl').textContent = t('serverUrl', lang);
  document.getElementById('labelSpeechCustomKey').textContent = t('apiKeyOptional', lang);
  document.getElementById('labelSpeechCustomModel').textContent = t('model', lang);
  document.getElementById('labelSpeechCustomVoice').textContent = t('speechVoiceName', lang);
  document.getElementById('labelSpeechRate').textContent = t('speechRate', lang);
  document.getElementById('labelSpeechPitch').textContent = t('speechPitch', lang);
  speechTestBtn.textContent = t('speechTest', lang);
  document.getElementById('cacheTitle').textContent = t('cacheTitle', lang);
  document.getElementById('translationCacheLabel').textContent = t('translationCacheEnable', lang);
  document.getElementById('translationCacheHint').textContent = t('translationCacheHint', lang);
  clearCacheBtn.textContent = t('clearTranslationCache', lang);
  document.getElementById('labelTranslatorTheme').textContent = t('translatorTheme', lang);
  document.getElementById('settingsThemeLight').textContent = t('themeLight', lang);
  document.getElementById('settingsThemeDark').textContent = t('themeDark', lang);
  document.getElementById('settingsThemeSystem').textContent = t('themeSystem', lang);
  document.getElementById('translatorThemeHint').textContent = t('translatorThemeHint', lang);
  document.getElementById('translatorThemeToggle').setAttribute('aria-label', t('translatorTheme', lang));
  refreshAllBtn.textContent = t('refreshAllModels', lang);
  saveBtn.textContent = t('saveSettings', lang);
  document.getElementById('footerText').textContent = t('modelsFooter', lang);
  document.getElementById('footerPrivacyLink').textContent = t('privacyPolicy', lang);
  document.getElementById('fallbackTitle').textContent = t('fallbackTitle', lang);
  document.getElementById('fallbackHint').textContent = t('fallbackHint', lang);
  document.getElementById('navGeneral').textContent = t('navGeneral', lang);
  document.getElementById('navProviders').textContent = t('navProviders', lang);
  document.getElementById('navFallback').textContent = t('navFallback', lang);
  document.getElementById('navSpeech').textContent = t('navSpeech', lang);
  document.getElementById('navCache').textContent = t('navCache', lang);
  document.getElementById('navAbout').textContent = t('navAbout', lang);
  document.getElementById('navChatbot').textContent = t('navChatbot', lang);
  document.getElementById('chatbotTitle').textContent = t('chatbotTitle', lang);
  document.getElementById('descChatbot').textContent = t('descChatbot', lang);
  document.getElementById('chatEnabledLabel').textContent = t('chatEnabled', lang);
  document.getElementById('chatEnabledHint').textContent = t('chatEnabledHint', lang);
  document.getElementById('chatShowIconLabel').textContent = t('chatShowIcon', lang);
  document.getElementById('labelChatProvider').textContent = t('chatProvider', lang);
  document.getElementById('labelChatModel').textContent = t('chatModel', lang);
  document.getElementById('labelChatSystemPrompt').textContent = t('chatSystemPrompt', lang);
  document.getElementById('labelChatSummarizePrompt').textContent = t('chatSummarizePrompt', lang);
  document.getElementById('labelChatExplainPrompt').textContent = t('chatExplainPrompt', lang);
  document.getElementById('chatPromptVarsHint').textContent = t('chatPromptVarsHint', lang);
  document.getElementById('labelChatCustomActions').textContent = t('chatCustomActions', lang);
  chatAddAction.textContent = t('chatAddAction', lang);
  document.getElementById('labelChatTemperature').textContent = t('chatTemperature', lang);
  document.getElementById('labelChatMaxTokens').textContent = t('chatMaxTokens', lang);
  document.getElementById('labelChatMaxPageChars').textContent = t('chatMaxPageChars', lang);
  document.getElementById('labelChatResponseLanguage').textContent = t('chatResponseLanguage', lang);
  document.getElementById('chatIncludePageLabel').textContent = t('chatIncludePage', lang);
  document.getElementById('chatIncludePageHint').textContent = t('chatIncludePageHint', lang);
  document.getElementById('chatAutoClearLabel').textContent = t('chatAutoClear', lang);
  document.getElementById('chatAutoClearHint').textContent = t('chatAutoClearHint', lang);
  document.getElementById('chatNoHistoryLabel').textContent = t('chatNoHistory', lang);
  document.getElementById('chatNoHistoryHint').textContent = t('chatNoHistoryHint', lang);
  document.getElementById('chatVoiceTitle').textContent = t('chatVoiceTitle', lang);
  document.getElementById('chatVoiceEnabledLabel').textContent = t('chatVoiceEnabled', lang);
  document.getElementById('chatVoiceEnabledHint').textContent = t('chatVoiceEnabledHint', lang);
  document.getElementById('labelChatVoiceMethod').textContent = t('chatVoiceMethod', lang);
  document.getElementById('chatVoiceMethodHint').textContent = t('chatVoiceMethodHint', lang);
  document.getElementById('labelChatVoiceLang').textContent = t('chatVoiceLang', lang);
  document.getElementById('chatVoiceAutoSendLabel').textContent = t('chatVoiceAutoSend', lang);
  document.getElementById('chatVoiceAutoSendHint').textContent = t('chatVoiceAutoSendHint', lang);
  document.getElementById('chatVoiceCommandsLabel').textContent = t('chatVoiceCommands', lang);
  document.getElementById('chatVoiceCommandsHint').textContent = t('chatVoiceCommandsHint', lang);
  document.getElementById('chatAutoReadLabel').textContent = t('chatAutoRead', lang);
  document.getElementById('chatAutoReadHint').textContent = t('chatAutoReadHint', lang);
  document.getElementById('chatShowTimestampsLabel').textContent = t('chatShowTimestamps', lang);
  document.getElementById('chatShowTimestampsHint').textContent = t('chatShowTimestampsHint', lang);
  document.getElementById('labelChatActionButtons').textContent = t('chatActionButtons', lang);
  document.getElementById('chatActionButtonsHint').textContent = t('chatActionButtonsHint', lang);
  chatActionButtons.options[0].textContent = t('chatActAlways', lang);
  chatActionButtons.options[1].textContent = t('chatActHover', lang);
  document.getElementById('chatSelButtonsLabel').textContent = t('chatSelButtons', lang);
  document.getElementById('chatSelButtonsHint').textContent = t('chatSelButtonsHint', lang);
  chatTestMic.textContent = t('chatTestMic', lang);
  chatTestVoice.textContent = t('chatTestVoice', lang);
  chatVoiceMethod.options[0].textContent = t('chatVoiceMethodBrowser', lang);
  chatVoiceMethod.options[1].textContent = t('chatVoiceMethodAi', lang);
  chatSystemPromptReset.textContent = t('resetToDefault', lang);
  chatSummarizePromptReset.textContent = t('resetToDefault', lang);
  chatExplainPromptReset.textContent = t('resetToDefault', lang);
  chatCustomActions.querySelectorAll('.ca-name').forEach((el) => (el.placeholder = t('chatActionNamePh', lang)));
  chatCustomActions.querySelectorAll('.ca-prompt').forEach((el) => (el.placeholder = t('chatActionPromptPh', lang)));
  chatCustomActions.querySelectorAll('.ca-remove').forEach((el) => (el.textContent = '× ' + t('chatRemove', lang)));
  document.getElementById('providersTitle').textContent = t('providersTitle', lang);
  document.getElementById('descGeneral').textContent = t('descGeneral', lang);
  document.getElementById('descProviders').textContent = t('descProviders', lang);
  document.getElementById('descSpeech').textContent = t('descSpeech', lang);
  document.getElementById('descCache').textContent = t('descCache', lang);
  document.getElementById('aboutTitle').textContent = t('aboutTitle', lang);
  document.getElementById('descAbout').textContent = t('descAbout', lang);
  providerSearch.placeholder = t('providerSearchPlaceholder', lang);
  for (const id of Object.keys(PROVIDERS)) {
    if (!providerEls[id]?.key) continue;
    updateToggleKeyLabels(id);
    providerEls[id].test.textContent = t('testConnection', lang);
    providerEls[id].clearKey.title = t('clearApiKey', lang);
    providerEls[id].clearKey.setAttribute('aria-label', t('clearApiKey', lang));
  }
}

function populateUiLanguages(selected) {
  uiLanguage.innerHTML = UI_LANGUAGES.map(
    (l) => `<option value="${l.code}" ${l.code === selected ? 'selected' : ''}>${escapeHtml(l.name)}</option>`
  ).join('');
}

function populateLanguages(selected) {
  defaultLanguage.innerHTML = LANGUAGES.map(
    (l) => `<option value="${escapeHtml(l.code)}" ${l.code === selected ? 'selected' : ''}>${escapeHtml(l.name)}</option>`
  ).join('');
}

function updateBatchHint() {
  const id = activeProvider.value;
  const meta = PROVIDERS[id];
  const key =
    id === 'ollama'
      ? 'batchHintOllama'
      : meta?.type === 'module' || id === 'free'
        ? 'batchHintFree'
        : 'batchHintAi';
  document.getElementById('batchHint').textContent = t(key, lang);
}

function updateProviderWarnings() {
  mymemoryWarn.hidden = activeProvider.value !== 'mymemory';
  if (!mymemoryWarn.hidden) mymemoryWarn.textContent = t('mymemoryWarn', lang);
}

function populateProviders(selected) {
  activeProvider.innerHTML = Object.entries(PROVIDERS)
    .map(([id, p]) => `<option value="${escapeHtml(id)}" ${id === selected ? 'selected' : ''}>${escapeHtml(p.label)}</option>`)
    .join('');
}

function updateFallbackSummary() {
  const selected = collectFallbackProviders();
  if (!selected.length) {
    fallbackMsBtn.textContent = t('fallbackNone', lang);
    return;
  }
  const names = selected.slice(0, 2).map((id) => PROVIDERS[id]?.label ?? id).join(', ');
  const suffix = selected.length > 2 ? ` +${selected.length - 2}` : '';
  fallbackMsBtn.textContent = t('fallbackSummary', lang, { names: `${names}${suffix}`, n: selected.length });
}

function populateFallbackProviders(selected = []) {
  const sel = new Set(selected);
  const active = activeProvider.value;
  fallbackProvidersEl.innerHTML = Object.entries(PROVIDERS)
    .map(([id, p]) => {
      const disabled = id === active;
      return `<label class="ms-item${disabled ? ' disabled' : ''}">
        <input type="checkbox" id="fb_${id}" ${sel.has(id) && !disabled ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
        <span>${escapeHtml(p.label)}</span>
        <span class="lang-badge" hidden></span>
      </label>`;
    })
    .join('');
  updateFallbackSummary();
}

const unsupportedLangTargets = new Map(); // providerId -> unsupported target code

function applyFallbackLangMarks() {
  for (const id of Object.keys(PROVIDERS)) {
    const input = document.getElementById(`fb_${id}`);
    const item = input?.closest('.ms-item');
    const badge = item?.querySelector('.lang-badge');
    const bad = unsupportedLangTargets.has(id);
    item?.classList.toggle('no-lang', bad);
    if (badge) {
      badge.hidden = !bad;
      if (bad) {
        const code = unsupportedLangTargets.get(id);
        badge.textContent = `no ${code}`;
        badge.title = t('langUnsupportedTitle', lang, { name: getLanguageName(code) });
      }
    }
    if (input) input.disabled = bad || id === activeProvider.value;
  }
  updateFallbackSummary();
}

function markActiveProviderOptions() {
  const target = defaultLanguage.value;
  for (const opt of activeProvider.options) {
    const id = opt.value;
    const label = PROVIDERS[id]?.label ?? id;
    opt.textContent = unsupportedLangTargets.has(id) ? `${label} — no ${target}` : label;
  }
}

async function refreshFallbackLangSupport() {
  const target = defaultLanguage.value;
  await Promise.all(
    Object.keys(PROVIDERS).map(async (id) => {
      try {
        const ok = await isTargetLanguageSupported(id, getProviderConfig(id), target);
        if (ok === false) unsupportedLangTargets.set(id, target);
        else unsupportedLangTargets.delete(id);
      } catch {
        unsupportedLangTargets.delete(id);
      }
    })
  );
  applyFallbackLangMarks();
  markActiveProviderOptions();
}

function refreshFallbackDisabled() {
  applyFallbackLangMarks();
}

function collectFallbackProviders() {
  return Object.keys(PROVIDERS).filter((id) => {
    const el = document.getElementById(`fb_${id}`);
    return el?.checked && !el.disabled;
  });
}

function positionFallbackPanel() {
  const rect = fallbackMsBtn.getBoundingClientRect();
  const panel = fallbackProvidersEl;
  const gap = 4;
  const panelH = Math.min(panel.scrollHeight, 320);
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const openUp = spaceBelow < panelH && rect.top - gap > spaceBelow;
  panel.style.left = `${rect.left}px`;
  panel.style.width = `${rect.width}px`;
  if (openUp) {
    panel.style.top = 'auto';
    panel.style.bottom = `${window.innerHeight - rect.top + gap}px`;
  } else {
    panel.style.bottom = 'auto';
    panel.style.top = `${rect.bottom + gap}px`;
  }
}

function setFallbackOpen(open) {
  fallbackMsBtn.classList.toggle('open', open);
  fallbackMsBtn.setAttribute('aria-expanded', String(open));
  fallbackProvidersEl.classList.toggle('hidden', !open);
  if (open) {
    positionFallbackPanel();
    fallbackProvidersEl.querySelector('input[type="checkbox"]:not(:disabled)')?.focus();
  }
}

function populateSpeechEngines(selected) {
  speechEngine.innerHTML = Object.entries(SPEECH_ENGINES)
    .map(([id, e]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${escapeHtml(e.label)}</option>`)
    .join('');
}

function populateSpeechVoices(selected) {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const code = (defaultLanguage.value ?? '').split('-')[0].toLowerCase();
  const matching = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(code));
  const list = matching.length ? matching : voices;
  speechVoice.innerHTML =
    `<option value="">${t('autoDetect', lang)}</option>` +
    list
      .map(
        (v) =>
          `<option value="${escapeHtml(v.name)}" ${v.name === selected ? 'selected' : ''}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`
      )
      .join('');
}

function updateSpeechFields() {
  const engine = speechEngine.value;
  document.getElementById('speechBrowserFields').hidden = engine !== 'browser';
  document.getElementById('speechGoogleFields').hidden = engine !== 'google';
  document.getElementById('speechGeminiFields').hidden = engine !== 'gemini';
  document.getElementById('speechElevenlabsFields').hidden = engine !== 'elevenlabs';
  document.getElementById('speechOpenaiFields').hidden = engine !== 'openai';
  document.getElementById('speechAzureFields').hidden = engine !== 'azure';
  document.getElementById('speechPollyFields').hidden = engine !== 'polly';
  document.getElementById('speechCustomFields').hidden = engine !== 'custom';
  const meta = SPEECH_ENGINES[engine];
  document.getElementById('selectionTtsHint').textContent = engine === 'openai'
    ? t('selectionTtsHint', lang)
    : `${t('speakButtonsHint', lang)} ${meta.dataNote}`;
  speechEngineInfo.textContent = `${meta.freeInfo} ${t('freeTierChecked', lang, { d: FREE_TIER_CHECKED })}`;
  if (meta.keyUrl) {
    speechEngineLink.hidden = false;
    speechEngineLink.innerHTML = `${t('noApiKey', lang)} <a href="${meta.keyUrl}" target="_blank" rel="noopener noreferrer">${t('getKeyHere', lang)}</a>`;
  } else {
    speechEngineLink.hidden = true;
  }
}

function collectSpeech() {
  return {
    engine: speechEngine.value,
    voice: speechVoice.value,
    rate: +speechRate.value || 1,
    pitch: +speechPitch.value || 1,
    googleKey: sanitizeApiKey(speechGoogleKey.value),
    googleVoice: speechGoogleVoice.value.trim() || 'en-US-Standard-A',
    geminiModel: speechGeminiModel.value.trim() || 'gemini-2.5-flash-preview-tts',
    elevenlabsKey: sanitizeApiKey(speechElevenlabsKey.value),
    elevenlabsVoiceId: speechElevenlabsVoiceId.value.trim(),
    openaiVoice: OPENAI_TTS_VOICES.includes(speechOpenaiVoice.value) ? speechOpenaiVoice.value : 'nova',
    openaiModel: OPENAI_TTS_MODELS.includes(speechOpenaiModel.value) ? speechOpenaiModel.value : 'tts-1',
    azureKey: sanitizeApiKey(speechAzureKey.value),
    azureRegion: speechAzureRegion.value.trim() || 'westeurope',
    azureVoice: speechAzureVoice.value.trim(),
    pollyAccessKey: sanitizeApiKey(speechPollyAccessKey.value),
    pollySecretKey: sanitizeApiKey(speechPollySecretKey.value),
    pollyRegion: speechPollyRegion.value.trim() || 'us-east-1',
    pollyVoice: speechPollyVoice.value.trim() || 'Joanna',
    customBaseUrl: speechCustomBaseUrl.value.trim(),
    customKey: sanitizeApiKey(speechCustomKey.value),
    customModel: speechCustomModel.value.trim(),
    customVoice: speechCustomVoice.value.trim(),
  };
}

async function testSpeech() {
  const cfg = collectSpeech();
  speechTestStatus.textContent = t('speechPlaying', lang);
  try {
    const sample = 'This is a Malisa speech test.';
    if (cfg.engine === 'browser') {
      if (!('speechSynthesis' in window)) throw new Error(t('noVoice', lang));
      const u = new SpeechSynthesisUtterance(sample);
      const voice = window.speechSynthesis.getVoices().find((v) => v.name === cfg.voice);
      if (voice) u.voice = voice;
      u.rate = cfg.rate;
      u.pitch = cfg.pitch;
      u.onend = u.onerror = () => (speechTestStatus.textContent = '');
      window.speechSynthesis.speak(u);
    } else {
      const s = await getSettings();
      for (const chunk of splitForSpeech(sample)) {
        const { audioBase64, mimeType } = await fetchSpeech(
          cfg.engine,
          chunk,
          cfg,
          {
            geminiKey: s.providers?.google?.apiKey,
            openaiKey: s.providers?.openai?.apiKey,
          }
        );
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        audio.playbackRate = cfg.rate;
        await audio.play().catch(() => {});
      }
      speechTestStatus.textContent = '';
    }
  } catch (err) {
    speechTestStatus.textContent = err.message;
  }
}

function renderModuleCard(id, p) {
  const fieldsHtml = (p.fields ?? [])
    .map((f) => {
      const inputType = f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text';
      const ph = f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : '';
      return `<div class="field">
        <label for="${id}_${f.key}">${escapeHtml(t(f.label, lang))}</label>
        <input type="${inputType}" id="${id}_${f.key}"${ph} autocomplete="off" />
      </div>`;
    })
    .join('');
  const hint = p.hint ? `<span class="hint">${escapeHtml(t(p.hint, lang))}</span>` : '';
  const langNote = p.langNote ? `<span class="hint">${escapeHtml(t(p.langNote, lang))}</span>` : '';
  const freeBadge = FREE_TIER_INFO[id]
    ? `<span class="badge" title="${escapeHtml(FREE_TIER_INFO[id] + ' ' + t('freeTierChecked', lang, { d: FREE_TIER_CHECKED }))}">${t('freeTier', lang)}</span>`
    : '';
  const expBadge = p.experimental ? `<span class="badge">${t('experimentalBadge', lang)}</span>` : '';
  return `<div data-provider="${id}">
    ${freeBadge}${expBadge}
    ${fieldsHtml}
    ${hint}
    ${langNote}
    <div class="cache-actions">
      <button type="button" class="btn secondary btn-compact" id="${id}Test">${t('testConnection', lang)}</button>
      <span class="key-status" id="${id}KeyStatus"></span>
    </div>
  </div>`;
}

function accWrap(id, label, body) {
  return `<div class="acc" data-acc="${id}">
    <button type="button" class="acc-head" data-acc-head="${id}" aria-expanded="false">
      <span class="acc-title">${escapeHtml(label)}</span>
      <span class="pbadge off" id="${id}ConfBadge"></span>
      <span class="acc-chev">▾</span>
    </button>
    <div class="acc-body hidden" data-acc-body="${id}">${body}</div>
  </div>`;
}

function setAccState(id, open) {
  const head = providerSections.querySelector(`[data-acc-head="${id}"]`);
  const body = providerSections.querySelector(`[data-acc-body="${id}"]`);
  if (!head || !body) return;
  head.setAttribute('aria-expanded', String(open));
  body.classList.toggle('hidden', !open);
}

function syncProviderAccordion(id) {
  if (!providerSections.querySelector(`[data-acc="${id}"]`)) return;
  for (const h of providerSections.querySelectorAll('[data-acc-head]')) {
    setAccState(h.dataset.accHead, h.dataset.accHead === id);
  }
}

function updateProviderBadges() {
  for (const id of Object.keys(PROVIDERS)) {
    const badge = document.getElementById(`${id}ConfBadge`);
    if (!badge) continue;
    const ready = isProviderReady(id, getProviderConfig(id));
    badge.textContent = ready ? t('providerConfigured', lang) : t('providerNotSet', lang);
    badge.className = `pbadge ${ready ? 'ok' : 'off'}`;
  }
}

function buildProviderSections() {
  providerSections.innerHTML = Object.entries(PROVIDERS)
    .map(([id, p]) => {
      if (p.module) return accWrap(id, p.label, renderModuleCard(id, p));
      const keyLabel = p.apiKeyOptional ? t('apiKeyOptional', lang) : t('apiKey', lang);
      const baseUrlHint = id === 'free' ? t('freeProviderNote', lang) : t('ollamaUrlHint', lang);
      const baseUrlField = p.defaultBaseUrl
        ? `<div class="field">
            <label for="${id}BaseUrl">${t('serverUrl', lang)}</label>
            <input type="text" id="${id}BaseUrl" placeholder="${p.defaultBaseUrl}" />
            <span class="hint">${baseUrlHint}</span>
          </div>`
        : '';
      const statusHint = p.noModel
        ? t('freeProviderReady', lang)
        : p.apiKeyOptional
          ? t('setUrlRefresh', lang)
          : t('setKeyRefresh', lang);
      const modelField = p.noModel
        ? `<span class="model-status" id="${id}Status">${statusHint}</span>`
        : id === 'ollama'
          ? `<div class="field">
              <label for="${id}Model">${t('model', lang)}</label>
              <div class="model-row">
                <input
                  type="text"
                  id="${id}Model"
                  list="${id}ModelList"
                  placeholder="${t('ollamaModelPlaceholder', lang)}"
                  autocomplete="off"
                />
                <datalist id="${id}ModelList"></datalist>
                <button type="button" class="btn-icon" id="${id}Refresh" title="${t('refreshModels', lang)}">↻</button>
              </div>
              <span class="hint">${t('ollamaModelHint', lang)}</span>
              <span class="model-status" id="${id}Status">${statusHint}</span>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="${id}Temperature">${t('ollamaTemperature', lang)}</label>
                <input type="number" id="${id}Temperature" min="0" max="2" step="0.1" placeholder="0.2" />
              </div>
              <div class="field">
                <label for="${id}NumCtx">${t('ollamaNumCtx', lang)}</label>
                <input type="number" id="${id}NumCtx" min="512" step="512" placeholder="${t('defaultHint', lang)}" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="${id}KeepAlive">${t('ollamaKeepAlive', lang)}</label>
                <input type="text" id="${id}KeepAlive" placeholder="5m" />
              </div>
              <div class="field">
                <label for="${id}Timeout">${t('ollamaTimeout', lang)}</label>
                <input type="number" id="${id}Timeout" min="10" max="600" placeholder="120" />
              </div>
            </div>
            <span class="hint">${t('ollamaCorsNote', lang)}</span>
            <span class="hint key-link">${t('noOllama', lang)} <a href="${OLLAMA_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer">${t('downloadOllama', lang)}</a></span>`
          : `<div class="field">
              <label for="${id}Model">${t('model', lang)}</label>
              <div class="model-row">
                <select id="${id}Model"></select>
                <button type="button" class="btn-icon" id="${id}Refresh" title="${t('refreshModels', lang)}">↻</button>
              </div>
              <span class="model-status" id="${id}Status">${statusHint}</span>
            </div>`;

      const keyField = p.noApiKey
        ? ''
        : `<div class="field">
        <label for="${id}Key">${keyLabel}</label>
        <div class="key-row">
          <input type="password" id="${id}Key" class="key-input" placeholder="${p.keyPlaceholder}" autocomplete="off" />
          <button type="button" class="btn-icon" id="${id}ToggleKey" title="${t('showApiKey', lang)}" aria-label="${t('showApiKey', lang)}">&#128065;</button>
          <button type="button" class="btn-icon key-clear-btn" id="${id}ClearKey" title="${t('clearApiKey', lang)}" aria-label="${t('clearApiKey', lang)}">&times;</button>
          <button type="button" class="btn secondary btn-compact" id="${id}Test">${t('testConnection', lang)}</button>
        </div>
        <span class="key-status" id="${id}KeyStatus"></span>
        ${
          PROVIDER_KEY_URLS[id]
            ? `<span class="hint key-link" id="${id}KeyLink">${t('noApiKey', lang)} <a href="${PROVIDER_KEY_URLS[id]}" target="_blank" rel="noopener noreferrer">${t('getKeyHere', lang)}</a></span>`
            : ''
        }
      </div>`;

      const freeBadge = FREE_TIER_INFO[id]
        ? `<span class="badge" title="${escapeHtml(FREE_TIER_INFO[id] + ' ' + t('freeTierChecked', lang, { d: FREE_TIER_CHECKED }))}">${t('freeTier', lang)}</span>`
        : '';
      const emailField =
        id === 'free'
          ? `<div class="field">
            <label for="${id}Email">${t('freeEmailLabel', lang)}</label>
            <input type="email" id="${id}Email" autocomplete="off" />
          </div>`
          : '';

      return accWrap(id, p.label, `
    <div data-provider="${id}">
      ${freeBadge}
      ${baseUrlField}
      ${keyField}
      ${modelField}
      ${emailField}
    </div>`);
    })
    .join('');

  for (const id of Object.keys(PROVIDERS)) {
    providerEls[id] = {
      email: document.getElementById(`${id}Email`),
      key: document.getElementById(`${id}Key`),
      toggleKey: document.getElementById(`${id}ToggleKey`),
      clearKey: document.getElementById(`${id}ClearKey`),
      test: document.getElementById(`${id}Test`),
      keyStatus: document.getElementById(`${id}KeyStatus`),
      model: document.getElementById(`${id}Model`),
      refresh: document.getElementById(`${id}Refresh`),
      status: document.getElementById(`${id}Status`),
    };
    if (PROVIDERS[id].module) {
      providerEls[id].fields = {};
      for (const f of PROVIDERS[id].fields ?? []) {
        providerEls[id].fields[f.key] = document.getElementById(`${id}_${f.key}`);
      }
    }
    if (id === 'ollama') {
      providerEls[id].modelList = document.getElementById(`${id}ModelList`);
      providerEls[id].temperature = document.getElementById(`${id}Temperature`);
      providerEls[id].numCtx = document.getElementById(`${id}NumCtx`);
      providerEls[id].keepAlive = document.getElementById(`${id}KeepAlive`);
      providerEls[id].timeout = document.getElementById(`${id}Timeout`);
    }
    if (PROVIDERS[id].defaultBaseUrl) {
      providerEls[id].baseUrl = document.getElementById(`${id}BaseUrl`);
      providerEls[id].baseUrl?.addEventListener('change', () => refreshProviderModels(id, true));
    }
    providerEls[id].keyLink = document.getElementById(`${id}KeyLink`);
    providerEls[id].refresh?.addEventListener('click', () => refreshProviderModels(id, true));
    providerEls[id].key?.addEventListener('change', () => refreshProviderModels(id, true));
    providerEls[id].key?.addEventListener('input', () => updateKeyLink(id));
    updateKeyLink(id);
    providerEls[id].toggleKey?.addEventListener('click', () => toggleKeyVisibility(id));
    providerEls[id].clearKey?.addEventListener('click', () => clearApiKey(id));
    providerEls[id].test?.addEventListener('click', () => testProviderConnection(id));
  }
}

function fillOllamaModelInput(models, selectedModel) {
  const input = providerEls.ollama.model;
  const datalist = providerEls.ollama.modelList;
  const current = selectedModel || input.value;

  datalist.innerHTML = (models ?? [])
    .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.id)}</option>`)
    .join('');

  if (current) {
    input.value = current;
    return;
  }

  if (models?.length && !input.value) {
    input.value = models[0].id;
  }
}

function fillModelSelect(providerId, models, selectedModel) {
  if (providerId === 'ollama') {
    fillOllamaModelInput(models, selectedModel);
    return;
  }

  const select = providerEls[providerId].model;
  if (!models?.length) {
    select.innerHTML = selectedModel
      ? `<option value="${escapeHtml(selectedModel)}">${escapeHtml(selectedModel)}</option>`
      : '';
    return;
  }
  const ids = new Set(models.map((m) => m.id));
  select.innerHTML = models
    .map((m) => {
      const id = escapeHtml(m.id);
      const label = escapeHtml(m.name !== m.id ? `${m.name} (${m.id})` : m.id);
      return `<option value="${id}" ${m.id === selectedModel ? 'selected' : ''}>${label}</option>`;
    })
    .join('');
  if (selectedModel && !ids.has(selectedModel)) {
    const saved = escapeHtml(selectedModel);
    select.innerHTML =
      `<option value="${saved}">${t('savedModel', lang, { name: saved })}</option>` + select.innerHTML;
    select.value = selectedModel;
  }
}

function setProviderStatus(providerId, text, type = '') {
  const el = providerEls[providerId].status;
  el.textContent = text;
  el.className = `model-status${type ? ` ${type}` : ''}`;
}

function setKeyStatus(providerId, text, type = '') {
  const el = providerEls[providerId].keyStatus;
  el.textContent = text;
  el.className = `key-status${type ? ` ${type}` : ''}`;
}

function updateToggleKeyLabels(providerId) {
  const input = providerEls[providerId].key;
  const btn = providerEls[providerId].toggleKey;
  const label = input.type === 'password' ? t('showApiKey', lang) : t('hideApiKey', lang);
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

function updateKeyLink(providerId) {
  const el = providerEls[providerId]?.keyLink;
  if (!el) return;
  el.hidden = !!(providerEls[providerId].key?.value ?? '').trim();
}

function toggleKeyVisibility(providerId) {
  const input = providerEls[providerId].key;
  input.type = input.type === 'password' ? 'text' : 'password';
  updateToggleKeyLabels(providerId);
}

function clearApiKey(providerId) {
  providerEls[providerId].key.value = '';
  providerEls[providerId].key.type = 'password';
  updateKeyLink(providerId);
  updateToggleKeyLabels(providerId);
  setKeyStatus(providerId, '');
}

function sendTestProvider(provider, config) {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage({ type: 'TEST_PROVIDER', provider, config }, (response) => {
      if (browser.runtime.lastError) return reject(new Error(browser.runtime.lastError.message));
      resolve(response);
    });
  });
}

async function testProviderConnection(providerId) {
  const meta = PROVIDERS[providerId];
  if (meta?.module) {
    const btn = providerEls[providerId].test;
    btn.disabled = true;
    setKeyStatus(providerId, t('testingConnection', lang));
    try {
      const cfg = getProviderConfig(providerId);
      if (cfg.baseUrl && !(await ensureHostPermission(cfg.baseUrl))) {
        throw new Error(t('freePermissionDenied', lang));
      }
      const res = await sendTestProvider(providerId, cfg);
      if (!res?.ok) throw new Error(res?.error || 'Test failed');
      setKeyStatus(providerId, `✓ ${res.translated}`, 'ok');
    } catch (err) {
      setKeyStatus(providerId, err.message, 'error');
    } finally {
      btn.disabled = false;
    }
    return;
  }
  if (!canRefreshProvider(providerId)) {
    setKeyStatus(
      providerId,
      PROVIDERS[providerId].apiKeyOptional ? t('setUrlRefresh', lang) : t('setKeyRefresh', lang),
      'error'
    );
    return;
  }

  const btn = providerEls[providerId].test;
  btn.disabled = true;
  setKeyStatus(providerId, t('testingConnection', lang));

  try {
    const models = await fetchModelsFromBg(providerId, getProviderConfig(providerId), true);
    if (providerId === 'ollama' && !models.length) {
      setKeyStatus(providerId, t('connectionOkNoModels', lang), 'ok');
    } else {
      setKeyStatus(providerId, t('connectionOk', lang, { n: models.length }), 'ok');
      fillModelSelect(providerId, models, providerEls[providerId].model.value);
      setProviderStatus(providerId, t('activeModels', lang, { n: models.length }), 'ok');
    }
  } catch (err) {
    setKeyStatus(providerId, err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function refreshCacheCount() {
  const count = await countTranslationCacheEntries();
  translationCacheCount.textContent = t('translationCacheCount', lang, { n: count });
}

function setThemeSegmentButtons(activeTheme) {
  selectedTranslatorTheme = activeTheme;
  themeSegmentButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === activeTheme);
  });
  applyPageTheme(activeTheme);
}

function applyPageTheme(theme) {
  const resolved =
    theme === 'light' || theme === 'dark'
      ? theme
      : window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
  document.documentElement.dataset.theme = resolved;
}

function getProviderConfig(providerId) {
  const config = {
    apiKey: sanitizeApiKey(providerEls[providerId].key?.value),
    model: sanitizeHeaderValue(providerEls[providerId].model?.value),
  };
  if (PROVIDERS[providerId].module) {
    for (const f of PROVIDERS[providerId].fields ?? []) {
      const el = providerEls[providerId].fields?.[f.key];
      if (!el) continue;
      let v = el.value.trim();
      if (f.type === 'password' || f.key === 'apiKey' || f.key === 'secret') v = sanitizeApiKey(v);
      if (f.key === 'baseUrl' && !v && PROVIDERS[providerId].defaultBaseUrl) {
        v = PROVIDERS[providerId].defaultBaseUrl;
      }
      config[f.key] = v;
    }
    return config;
  }
  if (providerEls[providerId].baseUrl) {
    config.baseUrl = providerEls[providerId].baseUrl.value.trim() || PROVIDERS[providerId].defaultBaseUrl;
  }
  if (providerId === 'free') {
    config.email = providerEls[providerId].email?.value?.trim() ?? '';
  }
  if (providerId === 'ollama') {
    config.temperature = providerEls[providerId].temperature?.value;
    config.numCtx = providerEls[providerId].numCtx?.value;
    config.keepAlive = providerEls[providerId].keepAlive?.value?.trim();
    config.timeout = providerEls[providerId].timeout?.value;
  }
  return config;
}

function canRefreshProvider(providerId) {
  const meta = PROVIDERS[providerId];
  if (meta.noModel) return false;
  const config = getProviderConfig(providerId);
  if (meta.apiKeyOptional) return !!config.baseUrl;
  return !!config.apiKey;
}

async function fetchModelsFromBg(provider, config, force = false) {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage(
      { type: 'FETCH_MODELS', provider, config, force },
      (response) => {
        if (browser.runtime.lastError) return reject(new Error(browser.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response.error));
        resolve(response.models);
      }
    );
  });
}

async function refreshProviderModels(providerId, force = false) {
  if (!canRefreshProvider(providerId)) {
    setProviderStatus(
      providerId,
      PROVIDERS[providerId].apiKeyOptional ? t('setUrlRefresh', lang) : t('setKeyRefresh', lang)
    );
    return;
  }

  const btn = providerEls[providerId].refresh;
  btn.disabled = true;
  setProviderStatus(providerId, t('loadingModels', lang));

  try {
    const models = await fetchModelsFromBg(providerId, getProviderConfig(providerId), force);
    fillModelSelect(providerId, models, providerEls[providerId].model.value);
    if (providerId === 'ollama' && !models.length) {
      setProviderStatus(providerId, t('ollamaManualModel', lang));
    } else {
      setProviderStatus(providerId, t('activeModels', lang, { n: models.length }), 'ok');
    }
  } catch (err) {
    if (providerId === 'ollama') {
      const manual = providerEls.ollama.model.value.trim();
      setProviderStatus(
        providerId,
        manual ? `${err.message} — ${t('ollamaManualModel', lang)}` : err.message,
        manual ? '' : 'error'
      );
      return;
    }
    const cached = await getCachedModels(providerId);
    if (cached?.length) {
      fillModelSelect(providerId, cached, providerEls[providerId].model.value);
      setProviderStatus(providerId, t('cachedModels', lang, { n: cached.length, error: err.message }), 'error');
    } else {
      setProviderStatus(providerId, err.message, 'error');
    }
  } finally {
    btn.disabled = false;
  }
}

async function loadSettings() {
  const settings = await getSettings();
  lang = settings.uiLanguage ?? 'en';
  populateUiLanguages(lang);
  applyOptionsI18n();
  buildProviderSections();

  populateLanguages(settings.defaultLanguage);
  populateProviders(settings.activeProvider);
  updateBatchHint();
  updateProviderWarnings();
  batchSize.value = String(settings.batchSize);
  parallelRequests.value = String(settings.parallelRequests ?? 20);
  skipDomains.value = settings.skipDomains.join('\n');
  translationCacheEnabled.checked = settings.translationCacheEnabled !== false;
  selectionTtsEnabled.checked = settings.selectionTtsEnabled !== false;
  populateChatbot(settings.chatbot);
  const speech = settings.speech ?? {};
  populateSpeechEngines(speech.engine ?? 'browser');
  speechGoogleKey.value = speech.googleKey ?? '';
  speechGoogleVoice.value = speech.googleVoice ?? 'en-US-Standard-A';
  speechGeminiModel.value = speech.geminiModel ?? 'gemini-2.5-flash-preview-tts';
  speechElevenlabsKey.value = speech.elevenlabsKey ?? '';
  speechElevenlabsVoiceId.value = speech.elevenlabsVoiceId ?? '';
  speechAzureKey.value = speech.azureKey ?? '';
  speechAzureRegion.value = speech.azureRegion ?? 'westeurope';
  speechAzureVoice.value = speech.azureVoice ?? '';
  speechPollyAccessKey.value = speech.pollyAccessKey ?? '';
  speechPollySecretKey.value = speech.pollySecretKey ?? '';
  speechPollyRegion.value = speech.pollyRegion ?? 'us-east-1';
  speechPollyVoice.value = speech.pollyVoice ?? 'Joanna';
  speechCustomBaseUrl.value = speech.customBaseUrl ?? '';
  speechCustomKey.value = speech.customKey ?? '';
  speechCustomModel.value = speech.customModel ?? '';
  speechCustomVoice.value = speech.customVoice ?? '';
  speechOpenaiVoice.innerHTML = OPENAI_TTS_VOICES.map((v) => `<option value="${v}">${v}</option>`).join('');
  speechOpenaiModel.innerHTML = OPENAI_TTS_MODELS.map((m) => `<option value="${m}">${m}</option>`).join('');
  speechOpenaiVoice.value = OPENAI_TTS_VOICES.includes(speech.openaiVoice) ? speech.openaiVoice : 'nova';
  speechOpenaiModel.value = OPENAI_TTS_MODELS.includes(speech.openaiModel) ? speech.openaiModel : 'tts-1';
  speechRate.value = String(speech.rate ?? 1);
  speechPitch.value = String(speech.pitch ?? 1);
  populateSpeechVoices(speech.voice ?? '');
  updateSpeechFields();
  setThemeSegmentButtons(settings.translatorTheme ?? 'system');
  applyPageTheme(settings.translatorTheme ?? 'system');
  populateFallbackProviders(settings.fallbackProviders ?? []);
  refreshFallbackDisabled();
  await refreshCacheCount();
  for (const [id, config] of Object.entries(settings.providers)) {
    if (!providerEls[id]) continue;
    if (PROVIDERS[id].module) {
      for (const f of PROVIDERS[id].fields ?? []) {
        const el = providerEls[id]?.fields?.[f.key];
        if (el) {
          el.value = config[f.key] ?? (f.key === 'baseUrl' ? PROVIDERS[id].defaultBaseUrl ?? '' : '');
        }
      }
      continue;
    }
    if (providerEls[id].key) providerEls[id].key.value = config.apiKey ?? '';
    if (providerEls[id].email) providerEls[id].email.value = config.email ?? '';
    updateKeyLink(id);
    if (providerEls[id].baseUrl) {
      providerEls[id].baseUrl.value = config.baseUrl ?? PROVIDERS[id].defaultBaseUrl ?? '';
    }
    if (!PROVIDERS[id].noModel) fillModelSelect(id, null, config.model);
    if (id === 'ollama') {
      providerEls.ollama.temperature.value = config.temperature ?? '';
      providerEls.ollama.numCtx.value = config.numCtx ?? '';
      providerEls.ollama.keepAlive.value = config.keepAlive ?? '';
      providerEls.ollama.timeout.value = config.timeout ?? '';
    }
  }

  syncProviderAccordion(settings.activeProvider);
  updateProviderBadges();
  await refreshFallbackLangSupport();

  await Promise.all(
    Object.keys(PROVIDERS).map(async (id) => {
      if (!canRefreshProvider(id)) return;
      const cached = await getCachedModels(id);
      if (cached?.length) {
        fillModelSelect(id, cached, settings.providers[id]?.model);
        setProviderStatus(id, t('activeModels', lang, { n: cached.length }) + ' (cache)', 'ok');
      }
      refreshProviderModels(id, false);
    })
  );
}

async function ensureHostPermission(baseUrl) {
  if (!baseUrl || /localhost|127\.0\.0\.1/.test(baseUrl)) return true;
  const origin = new URL(baseUrl).origin;
  const pattern = `${origin}/*`;
  if (await browser.permissions.contains({ origins: [pattern] })) return true;
  try {
    return await browser.permissions.request({ origins: [pattern] });
  } catch {
    // Firefox < 128 has no optional_host_permissions: treat as denied.
    return false;
  }
}

const CHAT_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'deepseek', 'groq', 'mistral', 'openrouter', 'grok', 'ollama'];

function populateChatProviderSelect(selected) {
  chatProvider.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = t('chatProviderAuto', lang);
  chatProvider.appendChild(auto);
  for (const id of CHAT_PROVIDER_IDS) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = PROVIDERS[id]?.label || id;
    chatProvider.appendChild(o);
  }
  chatProvider.value = CHAT_PROVIDER_IDS.includes(selected) ? selected : '';
}

function populateChatModelSelect(current) {
  const id = chatProvider.value;
  const pcfg = id ? getProviderConfig(id) : null;
  const fallback = (current || '').trim() || (pcfg?.model || '').trim();
  chatModel.innerHTML = '';
  const seen = new Set();
  const add = (v) => {
    const val = String(v || '').trim();
    if (!val || seen.has(val)) return;
    seen.add(val);
    const o = document.createElement('option');
    o.value = val;
    o.textContent = val;
    chatModel.appendChild(o);
  };
  add(fallback);
  try {
    for (const m of (id ? getCachedModels(id) : null) || []) {
      add(typeof m === 'string' ? m : m?.id || m?.name);
    }
  } catch {
    /* cache unavailable */
  }
  if (fallback) chatModel.value = fallback;
}

function populateChatResponseLanguage(selected) {
  chatResponseLanguage.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = t('chatLangAuto', lang);
  chatResponseLanguage.appendChild(auto);
  for (const l of LANGUAGES) {
    const code = l.code || l.id;
    if (!code) continue;
    const o = document.createElement('option');
    o.value = code;
    o.textContent = l.name || l.label || getLanguageName(code);
    chatResponseLanguage.appendChild(o);
  }
  chatResponseLanguage.value = selected && selected !== 'auto' ? selected : 'auto';
}

function populateChatVoiceLanguage(selected) {
  chatVoiceLang.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = t('chatLangAuto', lang);
  chatVoiceLang.appendChild(auto);
  for (const l of LANGUAGES) {
    const code = l.code || l.id;
    if (!code) continue;
    const o = document.createElement('option');
    o.value = code;
    o.textContent = l.name || l.label || getLanguageName(code);
    chatVoiceLang.appendChild(o);
  }
  chatVoiceLang.value = selected && selected !== 'auto' ? selected : 'auto';
}

function chatActionRow(a) {
  const row = document.createElement('div');
  row.className = 'chat-action-row';
  row.innerHTML =
    '<input type="text" class="ca-name" maxlength="40" />' +
    '<input type="text" class="ca-prompt" />' +
    '<button type="button" class="btn secondary ca-remove">×</button>';
  row.querySelector('.ca-name').value = a?.name || '';
  row.querySelector('.ca-prompt').value = a?.prompt || '';
  row.querySelector('.ca-remove').textContent = '× ' + t('chatRemove', lang);
  row.querySelector('.ca-remove').addEventListener('click', () => {
    row.remove();
    updateChatAddBtn();
  });
  row.querySelector('.ca-name').placeholder = t('chatActionNamePh', lang);
  row.querySelector('.ca-prompt').placeholder = t('chatActionPromptPh', lang);
  return row;
}

function updateChatAddBtn() {
  const count = chatCustomActions.querySelectorAll('.chat-action-row').length;
  chatAddAction.disabled = count >= 5;
  chatAddAction.title = count >= 5 ? t('chatMaxActions', lang) : '';
}

function renderChatActions(list) {
  chatCustomActions.innerHTML = '';
  for (const a of (Array.isArray(list) ? list : []).slice(0, 5)) {
    chatCustomActions.appendChild(chatActionRow(a));
  }
  updateChatAddBtn();
}

function collectChatActions() {
  return [...chatCustomActions.querySelectorAll('.chat-action-row')]
    .map((r) => ({
      name: r.querySelector('.ca-name').value.trim(),
      prompt: r.querySelector('.ca-prompt').value.trim(),
    }))
    .filter((a) => a.name && a.prompt)
    .slice(0, 5);
}

function populateChatbot(cb) {
  const c = { ...CHATBOT_DEFAULTS, ...(cb || {}) };
  chatEnabled.checked = c.enabled !== false;
  chatShowIcon.checked = c.showIcon !== false;
  populateChatProviderSelect(c.provider);
  populateChatModelSelect(c.model);
  chatSystemPrompt.value = c.systemPrompt ?? '';
  chatSummarizePrompt.value = c.summarizePrompt ?? '';
  chatExplainPrompt.value = c.explainPrompt ?? '';
  renderChatActions(c.customActions);
  chatTemperature.value = String(c.temperature ?? 0.7);
  chatTemperatureValue.textContent = Number(c.temperature ?? 0.7).toFixed(1);
  chatMaxTokens.value = String(c.maxTokens ?? 2048);
  chatMaxPageChars.value = String(c.maxPageChars ?? 12000);
  populateChatResponseLanguage(c.responseLanguage);
  chatIncludePage.checked = !!c.includePageContent;
  chatAutoClear.checked = !!c.autoClearOnClose;
  chatNoHistory.checked = c.keepHistory === false;
  const v = c.voice || {};
  chatVoiceEnabled.checked = !!v.enabled;
  chatVoiceMethod.value = v.method === 'ai' ? 'ai' : 'browser';
  populateChatVoiceLanguage(v.language);
  chatVoiceAutoSend.checked = !!v.autoSend;
  chatVoiceCommands.checked = !!v.commands;
  chatAutoRead.checked = !!c.autoRead;
  chatShowTimestamps.checked = c.showTimestamps !== false;
  chatActionButtons.value = c.actionButtons === 'hover' ? 'hover' : 'always';
  chatSelButtons.checked = c.selectionButtons !== false;
}

function collectChatbot() {
  return {
    enabled: chatEnabled.checked,
    showIcon: chatShowIcon.checked,
    provider: chatProvider.value,
    model: chatModel.value || '',
    systemPrompt: chatSystemPrompt.value,
    summarizePrompt: chatSummarizePrompt.value,
    explainPrompt: chatExplainPrompt.value,
    customActions: collectChatActions(),
    temperature: Math.min(2, Math.max(0, Number(chatTemperature.value) || 0.7)),
    maxTokens: Math.min(32000, Math.max(64, Number(chatMaxTokens.value) || 2048)),
    maxPageChars: Math.min(100000, Math.max(500, Number(chatMaxPageChars.value) || 12000)),
    responseLanguage: chatResponseLanguage.value || 'auto',
    includePageContent: chatIncludePage.checked,
    autoClearOnClose: chatAutoClear.checked,
    keepHistory: !chatNoHistory.checked,
    voice: {
      enabled: chatVoiceEnabled.checked,
      method: chatVoiceMethod.value === 'ai' ? 'ai' : 'browser',
      language: chatVoiceLang.value || 'auto',
      autoSend: chatVoiceAutoSend.checked,
      commands: chatVoiceCommands.checked,
    },
    autoRead: chatAutoRead.checked,
    showTimestamps: chatShowTimestamps.checked,
    actionButtons: chatActionButtons.value === 'hover' ? 'hover' : 'always',
    selectionButtons: chatSelButtons.checked,
  };
}

function collectSettings() {
  const providers = {};
  for (const id of Object.keys(PROVIDERS)) {
    providers[id] = getProviderConfig(id);
  }
  return {
    uiLanguage: uiLanguage.value,
    defaultLanguage: defaultLanguage.value,
    activeProvider: activeProvider.value,
    batchSize: Math.min(150, Math.max(40, Number(batchSize.value) || 120)),
    parallelRequests: Math.min(20, Math.max(1, Number(parallelRequests.value) || 20)),
    skipDomains: skipDomains.value.split('\n').map((d) => d.trim()).filter(Boolean),
    translationCacheEnabled: translationCacheEnabled.checked,
    translatorTheme: selectedTranslatorTheme,
    selectionTtsEnabled: selectionTtsEnabled.checked,
    speech: collectSpeech(),
    speechMigrated: true,
    fallbackProviders: collectFallbackProviders(),
    chatbot: collectChatbot(),
    providers,
  };
}

async function saveAllSettings() {  const settings = collectSettings();
  const ollama = settings.providers.ollama;

  if (settings.activeProvider === 'ollama') {
    if (!ollama?.baseUrl?.trim()) {
      throw new Error(t('ollamaUrlRequired', lang));
    }
    if (!ollama?.model?.trim()) {
      throw new Error(t('ollamaModelRequired', lang));
    }
    if (!validateOllamaBaseUrl(ollama.baseUrl)) {
      throw new Error(t('invalidOllamaUrl', lang));
    }
    if (!(await ensureHostPermission(ollama.baseUrl))) {
      throw new Error(t('ollamaPermissionDenied', lang));
    }
  } else if (ollama?.baseUrl?.trim() && !validateOllamaBaseUrl(ollama.baseUrl)) {
    throw new Error(t('invalidOllamaUrl', lang));
  }

  const free = settings.providers.free;
  let freeHost = '', freeSecure = false;
  try {
    const freeUrl = new URL(free?.baseUrl ?? '');
    freeHost = freeUrl.hostname;
    freeSecure = freeUrl.protocol === 'https:';
  } catch {
    freeHost = '';
  }
  const isBuiltInFreeHost =
    freeSecure &&
    (/(^|\.)translate\.googleapis\.com$/.test(freeHost) || /(^|\.)mymemory\.translated\.net$/.test(freeHost));
  if (free?.baseUrl?.trim() && !isBuiltInFreeHost) {
    if (!validateOllamaBaseUrl(free.baseUrl)) {
      throw new Error(t('invalidFreeUrl', lang));
    }
    if (!(await ensureHostPermission(free.baseUrl))) {
      throw new Error(t('freePermissionDenied', lang));
    }
  }

  for (const id of Object.keys(PROVIDERS)) {
    const p = PROVIDERS[id];
    if (!p?.module) continue;
    const url = (settings.providers[id]?.baseUrl ?? '').trim();
    if (!url) continue;
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL for ${p.label}`);
    }
    await ensureHostPermission(url);
  }

  await saveSettings(settings);
  lang = settings.uiLanguage;
  applyOptionsI18n();
}

refreshAllBtn.addEventListener('click', async () => {
  refreshAllBtn.disabled = true;
  refreshStatus.textContent = t('refreshing', lang);
  await Promise.all(
    Object.keys(PROVIDERS).map((id) => {
      if (canRefreshProvider(id)) return refreshProviderModels(id, true);
    })
  );
  refreshStatus.textContent = t('refreshDone', lang);
  refreshAllBtn.disabled = false;
  setTimeout(() => { refreshStatus.textContent = ''; }, 2500);
});

clearCacheBtn.addEventListener('click', async () => {
  clearCacheBtn.disabled = true;
  try {
    await clearTranslationCache();
    clearCacheStatus.textContent = t('cacheCleared', lang);
    await refreshCacheCount();
  } catch (err) {
    clearCacheStatus.textContent = err.message;
  } finally {
    clearCacheBtn.disabled = false;
    setTimeout(() => { clearCacheStatus.textContent = ''; }, 2500);
  }
});

speechEngine.addEventListener('change', updateSpeechFields);
defaultLanguage.addEventListener('change', () => {
  populateSpeechVoices(speechVoice.value);
  refreshFallbackLangSupport();
});
speechTestBtn.addEventListener('click', testSpeech);
document.getElementById('speechCustomTestBtn').addEventListener('click', testSpeech);

fallbackMsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setFallbackOpen(fallbackProvidersEl.classList.contains('hidden'));
  refreshFallbackLangSupport();
});
document.addEventListener('click', (e) => {
  if (!fallbackMs.contains(e.target) && !fallbackProvidersEl.contains(e.target)) {
    setFallbackOpen(false);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !fallbackProvidersEl.classList.contains('hidden')) {
    setFallbackOpen(false);
    fallbackMsBtn.focus();
  }
});
window.addEventListener('scroll', () => {
  if (!fallbackProvidersEl.classList.contains('hidden')) positionFallbackPanel();
}, { passive: true });
window.addEventListener('resize', () => {
  if (!fallbackProvidersEl.classList.contains('hidden')) positionFallbackPanel();
});
fallbackProvidersEl.addEventListener('change', updateFallbackSummary);
fallbackProvidersEl.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = [...fallbackProvidersEl.querySelectorAll('input[type="checkbox"]:not(:disabled)')];
  const idx = items.indexOf(document.activeElement);
  if (idx === -1) {
    e.preventDefault();
    items[0]?.focus();
    return;
  }
  const next = items[idx + (e.key === 'ArrowDown' ? 1 : -1)];
  if (next) {
    e.preventDefault();
    next.focus();
  }
});
activeProvider.addEventListener('change', refreshFallbackDisabled);
activeProvider.addEventListener('change', () => syncProviderAccordion(activeProvider.value));
activeProvider.addEventListener('change', () => {
  updateBatchHint();
  updateProviderWarnings();
});

providerSections.addEventListener('click', (e) => {
  const head = e.target.closest('[data-acc-head]');
  if (!head) return;
  const id = head.dataset.accHead;
  const wasOpen = head.getAttribute('aria-expanded') === 'true';
  for (const h of providerSections.querySelectorAll('[data-acc-head]')) {
    setAccState(h.dataset.accHead, !wasOpen && h.dataset.accHead === id);
  }
});
providerSections.addEventListener('input', updateProviderBadges);
providerSections.addEventListener('change', updateProviderBadges);

let langSupportTimer;
providerSections.addEventListener('change', () => {
  clearTimeout(langSupportTimer);
  langSupportTimer = setTimeout(refreshFallbackLangSupport, 600);
});

providerSearch.addEventListener('input', () => {
  const q = providerSearch.value.trim().toLowerCase();
  for (const acc of providerSections.querySelectorAll('.acc')) {
    const title = acc.querySelector('.acc-title')?.textContent.toLowerCase() ?? '';
    acc.style.display = !q || title.includes(q) ? '' : 'none';
  }
});

const navItems = document.querySelectorAll('.nav-item');
function setActiveNav(id) {
  navItems.forEach((n) => n.classList.toggle('active', n.dataset.section === id));
}
navItems.forEach((n) =>
  n.addEventListener('click', (e) => {
    e.preventDefault();
    const el = document.getElementById(n.dataset.section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveNav(n.dataset.section);
    }
  })
);
const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const en of entries) {
      if (en.isIntersecting) setActiveNav(en.target.id);
    }
  },
  { rootMargin: '-15% 0px -75% 0px' }
);
document.querySelectorAll('.page-section').forEach((s) => sectionObserver.observe(s));

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (selectedTranslatorTheme === 'system') applyPageTheme('system');
});
window.speechSynthesis?.addEventListener('voiceschanged', () => populateSpeechVoices(speechVoice.value));

themeSegmentButtons.forEach((btn) => {
  btn.addEventListener('click', () => setThemeSegmentButtons(btn.dataset.theme));
});

saveBtn.addEventListener('click', async () => {
  try {    await saveAllSettings();
    saveStatus.textContent = t('saved', lang);
  } catch (err) {
    saveStatus.textContent = err.message;
    saveStatus.className = 'save-status error';
  }
  setTimeout(() => {
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
  }, 3500);
});

uiLanguage.addEventListener('change', async () => {
  const s = await getSettings();
  s.uiLanguage = uiLanguage.value;
  await saveSettings(s);
  await loadSettings();
});

function openPrivacyPolicy() {
  browser.tabs.create({ url: browser.runtime.getURL('privacy/privacy.html') });
}

document.getElementById('privacyPolicyLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  openPrivacyPolicy();
});

document.getElementById('footerPrivacyLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  openPrivacyPolicy();
});

privacyConsent.addEventListener('change', () => {
  acceptPrivacyBtn.disabled = !privacyConsent.checked;
});

acceptPrivacyBtn.addEventListener('click', async () => {
  await setPrivacyConsent(true);
  privacyCard.classList.add('hidden');
  settingsContent.classList.remove('hidden');
  await loadSettings();
});

chatProvider.addEventListener('change', () => populateChatModelSelect());
chatTemperature.addEventListener('input', () => {
  chatTemperatureValue.textContent = Number(chatTemperature.value).toFixed(1);
});
chatAddAction.addEventListener('click', () => {
  if (chatCustomActions.querySelectorAll('.chat-action-row').length < 5) {
    chatCustomActions.appendChild(chatActionRow({}));
  }
  updateChatAddBtn();
});
chatSystemPromptReset.addEventListener('click', () => {
  chatSystemPrompt.value = CHATBOT_DEFAULTS.systemPrompt;
});
chatSummarizePromptReset.addEventListener('click', () => {
  chatSummarizePrompt.value = CHATBOT_DEFAULTS.summarizePrompt;
});
chatExplainPromptReset.addEventListener('click', () => {
  chatExplainPrompt.value = CHATBOT_DEFAULTS.explainPrompt;
});

chatTestMic.addEventListener('click', async () => {
  chatVoiceTestStatus.textContent = t('chatVoiceTestMicTesting', lang);
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(t('chatVoiceNoMicApi', lang));
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((tr) => tr.stop());
    chatVoiceTestStatus.textContent = t('chatVoiceTestMicOk', lang);
  } catch (err) {
    chatVoiceTestStatus.textContent =
      err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? t('chatVoiceMicDenied', lang)
        : err?.name === 'NotFoundError'
          ? t('chatVoiceNoMicDevice', lang)
          : (err?.message || String(err));
  }
});

chatTestVoice.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) {
    chatVoiceTestStatus.textContent = t('chatVoiceNoTts', lang);
    return;
  }
  const code = defaultLanguage.value || 'en';
  const utter = new SpeechSynthesisUtterance(t('chatVoiceTestPhrase', lang));
  const bcp = langToBcp47(code);
  if (bcp) utter.lang = bcp;
  utter.onend = utter.onerror = () => { chatVoiceTestStatus.textContent = ''; };
  chatVoiceTestStatus.textContent = t('chatVoiceTestVoicePlaying', lang);
  window.speechSynthesis.speak(utter);
});

async function init() {
  const consented = await hasPrivacyConsent();
  if (consented) {
    privacyCard.classList.add('hidden');
    settingsContent.classList.remove('hidden');
    await loadSettings();
  } else {
    const settings = await getSettings();
    lang = settings.uiLanguage ?? 'en';
    populateUiLanguages(lang);
    applyOptionsI18n();
    privacyCard.classList.remove('hidden');
    settingsContent.classList.add('hidden');
  }
}

init();
