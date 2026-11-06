import browser from './browser.js';
import { DEFAULT_SETTINGS, LANGUAGES } from './types.js';

const STORAGE_KEY = 'settings';
const PUBLIC_SETTINGS_KEY = 'public_settings';
const CONSENT_KEY = 'privacy_consent_v1';
const REDACTED = '•••';

// Fields whose values must never reach content scripts. Non-secret config
// (model, baseUrl, region, folderId, appId) stays visible so the UI can show
// provider state; only credentials/PII are masked with a truthy placeholder.
const SECRET_PROVIDER_FIELDS = new Set(['apiKey', 'secret']);
const PII_PROVIDER_FIELDS = new Set(['email']);
const SECRET_SPEECH_FIELDS = new Set([
  'googleKey',
  'elevenlabsKey',
  'azureKey',
  'pollyAccessKey',
  'pollySecretKey',
  'customKey',
]);

function maskSecret(value) {
  return typeof value === 'string' && value.trim() ? REDACTED : value;
}

export function redactSettings(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const out = { ...settings };
  if (settings.providers && typeof settings.providers === 'object') {
    out.providers = {};
    for (const [id, cfg] of Object.entries(settings.providers)) {
      const copy = { ...(cfg || {}) };
      for (const f of SECRET_PROVIDER_FIELDS) {
        if (copy[f] != null) copy[f] = maskSecret(copy[f]);
      }
      for (const f of PII_PROVIDER_FIELDS) {
        if (copy[f] != null) copy[f] = maskSecret(copy[f]);
      }
      out.providers[id] = copy;
    }
  }
  if (settings.speech && typeof settings.speech === 'object') {
    const speech = { ...settings.speech };
    for (const f of SECRET_SPEECH_FIELDS) {
      if (speech[f] != null) speech[f] = maskSecret(speech[f]);
    }
    out.speech = speech;
  }
  return out;
}

export async function writePublicSettingsMirror() {
  try {
    const settings = await getSettings();
    await browser.storage.local.set({ [PUBLIC_SETTINGS_KEY]: redactSettings(settings) });
  } catch {
    /* storage unavailable */
  }
}

export async function getPublicSettings() {
  const res = await browser.storage.local.get(PUBLIC_SETTINGS_KEY);
  if (res[PUBLIC_SETTINGS_KEY]) return res[PUBLIC_SETTINGS_KEY];
  // Legacy installs have no mirror yet — derive it (still redacted).
  return redactSettings(await getSettings());
}

async function migrateFromSyncIfNeeded() {
  const local = await browser.storage.local.get(STORAGE_KEY);
  if (local[STORAGE_KEY]) return;

  const sync = await browser.storage.sync.get(STORAGE_KEY);
  if (!sync[STORAGE_KEY]) return;

  await browser.storage.local.set({ [STORAGE_KEY]: sync[STORAGE_KEY] });
  await browser.storage.sync.remove(STORAGE_KEY);
}

export async function getSettings() {
  await migrateFromSyncIfNeeded();
  const result = await browser.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  if (!stored) return structuredClone(DEFAULT_SETTINGS);

  const providers = { ...DEFAULT_SETTINGS.providers };
  for (const [id, defaults] of Object.entries(DEFAULT_SETTINGS.providers)) {
    providers[id] = { ...defaults, ...stored.providers?.[id] };
  }

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    parallelRequests: stored.parallelRequests ?? DEFAULT_SETTINGS.parallelRequests,
    maxCharsPerBatch: stored.maxCharsPerBatch ?? DEFAULT_SETTINGS.maxCharsPerBatch,
    uiLanguage: stored.uiLanguage ?? DEFAULT_SETTINGS.uiLanguage,
    translationCacheEnabled:
      stored.translationCacheEnabled ?? DEFAULT_SETTINGS.translationCacheEnabled,
    translatorTheme: stored.translatorTheme ?? DEFAULT_SETTINGS.translatorTheme,
    selectionTtsEnabled: stored.selectionTtsEnabled ?? DEFAULT_SETTINGS.selectionTtsEnabled,
    speech: migrateSpeech(stored),
    speechMigrated: true,
    providers,
  };
}

// Older versions had a separate selection-popup engine (browser | openai).
// Fold it into the single speech config once, keeping the user's choice.
function migrateSpeech(stored) {
  const speech = { ...DEFAULT_SETTINGS.speech, ...(stored.speech ?? {}) };
  if (stored.speechMigrated || stored.selectionTtsEngine !== 'openai') return speech;
  if ((stored.speech?.engine ?? 'browser') !== 'browser') return speech;
  speech.engine = 'openai';
  if (!stored.speech?.openaiVoice && stored.selectionTtsVoice) speech.openaiVoice = stored.selectionTtsVoice;
  if (!stored.speech?.openaiModel && stored.selectionTtsModel) speech.openaiModel = stored.selectionTtsModel;
  return speech;
}

export async function saveSettings(settings) {
  await browser.storage.local.set({
    [STORAGE_KEY]: settings,
    [PUBLIC_SETTINGS_KEY]: redactSettings(settings),
  });
}

export async function hasPrivacyConsent() {
  const result = await browser.storage.local.get(CONSENT_KEY);
  return result[CONSENT_KEY] === true;
}

export async function setPrivacyConsent(accepted) {
  await browser.storage.local.set({ [CONSENT_KEY]: !!accepted });
}

export function getLanguageName(code) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
