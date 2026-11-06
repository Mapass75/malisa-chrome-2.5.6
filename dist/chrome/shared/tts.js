import { normalizeServiceBaseUrl, sanitizeApiKey } from './security.js';

const LANG_BCP47 = {
  hr: 'hr-HR',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  cs: 'cs-CZ',
  sk: 'sk-SK',
  sl: 'sl-SI',
  sr: 'sr-RS',
  bs: 'bs-BA',
  ru: 'ru-RU',
  uk: 'uk-UA',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ar: 'ar-SA',
  tr: 'tr-TR',
  sv: 'sv-SE',
  da: 'da-DK',
  no: 'nb-NO',
  fi: 'fi-FI',
  hu: 'hu-HU',
  ro: 'ro-RO',
  bg: 'bg-BG',
  el: 'el-GR',
  he: 'he-IL',
  hi: 'hi-IN',
  th: 'th-TH',
  vi: 'vi-VN',
  id: 'id-ID',
};

export const OPENAI_TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
export const OPENAI_TTS_MODELS = ['tts-1', 'tts-1-hd'];

export function langToBcp47(code) {
  if (!code || typeof code !== 'string') return '';
  const base = code.split('-')[0].toLowerCase();
  return LANG_BCP47[base] ?? '';
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Split text into sentence-ish chunks small enough for TTS APIs.
export function splitForSpeech(text, maxLen = 400) {
  const chunks = [];
  let chunk = '';
  for (const piece of text.split(/(?<=[.!?;:\n])\s+|\n+/)) {
    if (!piece.trim()) continue;
    const candidate = chunk ? `${chunk} ${piece}` : piece;
    if (candidate.length > maxLen && chunk) {
      chunks.push(chunk);
      chunk = piece;
    } else {
      chunk = candidate;
    }
    while (chunk.length > maxLen) {
      const cut = chunk.slice(0, maxLen).lastIndexOf(' ');
      chunks.push(chunk.slice(0, cut > 60 ? cut : maxLen));
      chunk = chunk.slice(cut > 60 ? cut : maxLen);
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

// Wrap raw PCM (s16le mono) in a WAV container so it can play in <audio>.
export function pcmToWavBase64(pcmBase64, sampleRate = 24000) {
  const pcm = Uint8Array.from(atob(pcmBase64), (c) => c.charCodeAt(0));
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header));
  out.set(pcm, 44);
  return arrayBufferToBase64(out.buffer);
}

async function ttsError(response, name) {
  let detail = `${name} TTS failed (${response.status})`;
  try {
    const err = await response.json();
    const msg = err?.error?.message ?? err?.detail?.message;
    if (msg) detail = msg;
  } catch {
    /* ignore */
  }
  if (response.status === 401 || response.status === 403) {
    detail = `${name} TTS rejected the API key — check it in Settings`;
  }
  if (response.status === 429) detail = `${name} TTS quota exceeded — try again later`;
  throw new Error(detail);
}

export async function fetchGoogleTts({ text, apiKey, voice = 'en-US-Standard-A' }) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) throw new Error('Google Cloud TTS API key is not configured');
  const languageCode = voice.split('-').slice(0, 2).join('-');
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(cleanKey)}`,
    {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voice },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    }
  );
  if (!response.ok) await ttsError(response, 'Google Cloud');
  const data = await response.json();
  if (!data.audioContent) throw new Error('Google Cloud TTS returned no audio');
  return { audioBase64: data.audioContent, mimeType: 'audio/mpeg' };
}

export async function fetchGeminiTts({ text, apiKey, model = 'gemini-2.5-flash-preview-tts' }) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    throw new Error('Gemini TTS uses the Gemini API key — add it under Google (Gemini) provider');
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cleanKey)}`,
    {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say this: ${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      }),
    }
  );
  if (!response.ok) await ttsError(response, 'Gemini');
  const data = await response.json();
  const pcm = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!pcm?.data) throw new Error('Gemini TTS returned no audio');
  return { audioBase64: pcmToWavBase64(pcm.data), mimeType: 'audio/wav' };
}

export async function fetchElevenLabsTts({ text, apiKey, voiceId }) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) throw new Error('ElevenLabs API key is not configured');
  if (!voiceId?.trim()) throw new Error('ElevenLabs voice ID is not configured');
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId.trim())}`,
    {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { 'xi-api-key': cleanKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    }
  );
  if (!response.ok) await ttsError(response, 'ElevenLabs');
  return { audioBase64: arrayBufferToBase64(await response.arrayBuffer()), mimeType: 'audio/mpeg' };
}

const AZURE_DEFAULT_VOICES = {
  hr: 'hr-HR-GabrijelaNeural', en: 'en-US-JennyNeural', de: 'de-DE-KatjaNeural',
  fr: 'fr-FR-DeniseNeural', es: 'es-ES-ElviraNeural', it: 'it-IT-ElsaNeural',
  pt: 'pt-PT-RaquelNeural', nl: 'nl-NL-ColetteNeural', pl: 'pl-PL-AgnieszkaNeural',
  cs: 'cs-CZ-VlastaNeural', sr: 'sr-RS-SophieNeural', bs: 'bs-BA-GoranNeural',
  ru: 'ru-RU-SvetlanaNeural', uk: 'uk-UA-PolinaNeural', ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural', zh: 'zh-CN-XiaoxiaoNeural', ar: 'ar-SA-ZariyahNeural',
  tr: 'tr-TR-EmelNeural', sv: 'sv-SE-SofieNeural', da: 'da-DK-ChristelNeural',
  no: 'nb-NO-PernilleNeural', fi: 'fi-FI-SelmaNeural', hu: 'hu-HU-NoemiNeural',
  ro: 'ro-RO-AlinaNeural', bg: 'bg-BG-KalinaNeural', el: 'el-GR-AthinaNeural',
  he: 'he-IL-HilaNeural', hi: 'hi-IN-SwaraNeural', th: 'th-TH-PremwadeeNeural',
  vi: 'vi-VN-HoaiMyNeural', id: 'id-ID-GadisNeural', sk: 'sk-SK-ViktoriaNeural',
  sl: 'sl-SI-PetraNeural',
};

function xmlEscape(text) {
  return text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function fetchAzureTts({ text, apiKey, region = 'westeurope', voice, lang = 'en' }) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) throw new Error('Azure Speech API key is not configured');
  const cleanRegion = (region || 'westeurope').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const voiceName = voice?.trim() ||
    AZURE_DEFAULT_VOICES[lang.split('-')[0].toLowerCase()] || 'en-US-JennyNeural';
  const voiceLang = voiceName.split('-').slice(0, 2).join('-');
  const ssml =
    `<speak version="1.0" xml:lang="${xmlEscape(voiceLang)}">` +
    `<voice name="${xmlEscape(voiceName)}">${xmlEscape(text)}</voice></speak>`;
  const response = await fetch(
    `https://${cleanRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: {
        'Ocp-Apim-Subscription-Key': cleanKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    }
  );
  if (!response.ok) await ttsError(response, 'Azure');
  return { audioBase64: arrayBufferToBase64(await response.arrayBuffer()), mimeType: 'audio/mpeg' };
}

// Minimal AWS Signature V4 signer over Web Crypto (service: polly).
async function sha256Hex(data) {
  const buf = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, data) {
  const raw = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}

export async function fetchPollyTts({ text, accessKey, secretKey, region = 'us-east-1', voice = 'Joanna' }) {
  const ak = sanitizeApiKey(accessKey);
  const sk = sanitizeApiKey(secretKey);
  if (!ak || !sk) throw new Error('AWS access key and secret key are not configured');
  const cleanRegion = (region || 'us-east-1').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const host = `polly.${cleanRegion}.amazonaws.com`;
  const body = JSON.stringify({ OutputFormat: 'mp3', Text: text, VoiceId: voice });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${cleanRegion}/polly/aws4_request`;

  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    'POST', '/v1/speech', '', canonicalHeaders, 'content-type;host;x-amz-date',
    await sha256Hex(body),
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  let k = await hmacSha256(`AWS4${sk}`, dateStamp);
  k = await hmacSha256(k, cleanRegion);
  k = await hmacSha256(k, 'polly');
  k = await hmacSha256(k, 'aws4_request');
  const signature = Array.from(await hmacSha256(k, stringToSign))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  const response = await fetch(`https://${host}/v1/speech`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, ` +
        `SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`,
    },
    body,
  });
  if (!response.ok) await ttsError(response, 'Polly');
  return { audioBase64: arrayBufferToBase64(await response.arrayBuffer()), mimeType: 'audio/mpeg' };
}

export async function fetchCustomTts({ text, baseUrl, apiKey, model, voice }) {
  const root = normalizeServiceBaseUrl(baseUrl, 'Custom TTS');
  if (!root) throw new Error('Custom TTS base URL is not configured');
  const headers = { 'Content-Type': 'application/json' };
  const cleanKey = sanitizeApiKey(apiKey);
  if (cleanKey) headers.Authorization = `Bearer ${cleanKey}`;
  const response = await fetch(`${root}/audio/speech`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers,
    body: JSON.stringify({
      model: model || 'tts-1',
      input: text,
      voice: voice || 'af_heart',
      response_format: 'mp3',
    }),
  });
  if (!response.ok) await ttsError(response, 'Custom');
  return { audioBase64: arrayBufferToBase64(await response.arrayBuffer()), mimeType: 'audio/mpeg' };
}

export async function fetchSpeech(engine, text, cfg, keys = {}) {
  if (engine === 'google') return fetchGoogleTts({ text, apiKey: cfg.googleKey, voice: cfg.googleVoice });
  if (engine === 'gemini') return fetchGeminiTts({ text, apiKey: keys.geminiKey, model: cfg.geminiModel });
  if (engine === 'elevenlabs') {
    return fetchElevenLabsTts({ text, apiKey: cfg.elevenlabsKey, voiceId: cfg.elevenlabsVoiceId });
  }
  if (engine === 'openai') {
    return fetchOpenAiSpeech({
      text,
      apiKey: keys.openaiKey,
      voice: OPENAI_TTS_VOICES.includes(cfg.openaiVoice) ? cfg.openaiVoice : 'nova',
      model: OPENAI_TTS_MODELS.includes(cfg.openaiModel) ? cfg.openaiModel : 'tts-1',
    });
  }
  if (engine === 'azure') {
    return fetchAzureTts({
      text, apiKey: cfg.azureKey, region: cfg.azureRegion,
      voice: cfg.azureVoice, lang: cfg.lang,
    });
  }
  if (engine === 'polly') {
    return fetchPollyTts({
      text, accessKey: cfg.pollyAccessKey, secretKey: cfg.pollySecretKey,
      region: cfg.pollyRegion, voice: cfg.pollyVoice,
    });
  }
  if (engine === 'custom') {
    return fetchCustomTts({
      text, baseUrl: cfg.customBaseUrl, apiKey: cfg.customKey,
      model: cfg.customModel, voice: cfg.customVoice,
    });
  }
  throw new Error(`Unknown speech engine: ${engine}`);
}

export async function fetchOpenAiSpeech({ text, apiKey, voice = 'nova', model = 'tts-1' }) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) throw new Error('OpenAI API key is not configured');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 4096),
      voice,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    let detail = `OpenAI TTS failed (${response.status})`;
    try {
      const err = await response.json();
      if (err?.error?.message) detail = err.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const buffer = await response.arrayBuffer();
  return {
    audioBase64: arrayBufferToBase64(buffer),
    mimeType: 'audio/mpeg',
  };
}
