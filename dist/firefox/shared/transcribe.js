import { normalizeServiceBaseUrl, sanitizeApiKey } from './security.js';

// Speech-to-text via OpenAI-compatible /audio/transcriptions endpoints.
// Only providers with a real transcription API are supported; everything
// else gets a clear "not supported" error instead of a doomed request.
const TRANSCRIBE_MODELS = {
  openai: 'whisper-1',
  groq: 'whisper-large-v3',
  mistral: 'voxtral-mini-latest',
};

const DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
};

export function supportsTranscription(providerId) {
  const p = (providerId || '').toLowerCase();
  return p === 'openai' || p === 'groq' || p === 'mistral';
}

async function transcriptionError(response, name) {
  let detail = `${name} transcription failed (${response.status})`;
  try {
    const err = await response.json();
    const msg = err?.error?.message ?? err?.detail?.message ?? err?.message;
    if (msg) detail = msg;
  } catch {
    /* ignore */
  }
  if (response.status === 401 || response.status === 403) {
    detail = `${name} transcription rejected the API key — check it in Settings`;
  }
  if (response.status === 429) detail = `${name} transcription quota exceeded — try again later`;
  throw new Error(detail);
}

export async function transcribeAudio({
  provider,
  apiKey,
  baseUrl,
  model,
  audio,
  mimeType,
  language,
  filename = 'audio.webm',
}) {
  const p = (provider || '').toLowerCase();
  if (!supportsTranscription(p)) {
    throw new Error(`Provider "${provider}" does not support audio transcription`);
  }
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) throw new Error('API key is not configured for transcription');
  const root = normalizeServiceBaseUrl(baseUrl || DEFAULT_BASE_URLS[p], `${p} transcription`);
  if (!root) throw new Error(`Provider "${provider}" does not support audio transcription`);
  if (!audio || !audio.byteLength) throw new Error('No audio recorded');

  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType || 'audio/webm' }), filename);
  form.append('model', model || TRANSCRIBE_MODELS[p]);
  if (language) form.append('language', language);
  form.append('response_format', 'json');

  const headers = { Authorization: `Bearer ${cleanKey}` };
  const response = await fetch(`${root}/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) await transcriptionError(response, p);
  const data = await response.json();
  const text = (data?.text || '').trim();
  if (!text) throw new Error('Transcription returned empty text');
  return { text };
}
