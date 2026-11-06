import { PROVIDERS } from './types.js';
import { normalizeServiceBaseUrl, sanitizeApiKey } from './security.js';

// LLM providers that support chat completions (machine-translation providers excluded).
export const CHAT_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'groq',
  'mistral',
  'openrouter',
  'grok',
  'ollama',
]);

export function isChatProvider(id) {
  return CHAT_PROVIDERS.has(id);
}

function resolveBaseUrl(providerId, config) {
  const meta = PROVIDERS[providerId] ?? {};
  const custom = (config?.baseUrl ?? '').trim();
  const base = custom || meta.baseUrl || meta.defaultBaseUrl || '';
  // Custom endpoints must be https (http only for localhost/private hosts)
  // so API keys are never sent over plaintext to a public server.
  return normalizeServiceBaseUrl(base.replace(/\/+$/, ''), `${providerId} API`);
}

function chatError(status, bodyText) {
  let detail = '';
  try {
    const j = JSON.parse(bodyText);
    detail =
      j?.error?.message ||
      j?.error?.status ||
      j?.error?.code ||
      j?.message ||
      '';
  } catch {
    detail = (bodyText || '').slice(0, 160);
  }
  if (status === 401 || status === 403) {
    return new Error(`API key rejected (${status})${detail ? ': ' + detail : ''}. Check the key in Settings.`);
  }
  if (status === 404) {
    return new Error(`Model or endpoint not found (${status})${detail ? ': ' + detail : ''}.`);
  }
  if (status === 429) {
    return new Error(`Rate limited by the provider (429)${detail ? ': ' + detail : ''}. Try again shortly.`);
  }
  return new Error(`Chat request failed (${status})${detail ? ': ' + detail : ''}`);
}

async function* sseData(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of raw.split('\n')) {
          if (line.startsWith('data:')) yield line.slice(5).trim();
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// ---------- OpenAI-compatible (openai, deepseek, groq, mistral, openrouter, grok, ollama) ----------

async function openAiCompatChat(opts) {
  const { apiKey, model, baseUrl, messages, temperature, maxTokens, stream, signal, onChunk } = opts;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${sanitizeApiKey(apiKey)}`;
  if (opts.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://malisa.local';
    headers['X-Title'] = 'Malisa';
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    signal: signal ?? AbortSignal.timeout(120000),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(stream ? { stream: true } : {}),
    }),
  });
  if (!res.ok) throw chatError(res.status, await res.text().catch(() => ''));
  if (!stream) {
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
  let out = '';
  for await (const data of sseData(res)) {
    if (data === '[DONE]') break;
    try {
      const j = JSON.parse(data);
      const delta = j?.choices?.[0]?.delta?.content;
      if (delta) {
        out += delta;
        onChunk?.(delta);
      }
    } catch {
      /* partial JSON line */
    }
  }
  return out;
}

// ---------- Anthropic ----------

function toAnthropicMessages(messages) {
  const system = [];
  const msgs = [];
  for (const m of messages) {
    if (m.role === 'system') system.push(m.content);
    else msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  return { system: system.join('\n\n'), msgs };
}

async function anthropicChat(opts) {
  const { apiKey, model, messages, temperature, maxTokens, stream, signal, onChunk } = opts;
  const { system, msgs } = toAnthropicMessages(messages);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': sanitizeApiKey(apiKey),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    signal: signal ?? AbortSignal.timeout(120000),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 2048,
      temperature,
      ...(system ? { system } : {}),
      messages: msgs,
      ...(stream ? { stream: true } : {}),
    }),
  });
  if (!res.ok) throw chatError(res.status, await res.text().catch(() => ''));
  if (!stream) {
    const data = await res.json();
    return (data?.content ?? [])
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join('');
  }
  let out = '';
  for await (const data of sseData(res)) {
    try {
      const j = JSON.parse(data);
      if (j?.type === 'content_block_delta' && j?.delta?.type === 'text_delta') {
        const t = j.delta.text;
        out += t;
        onChunk?.(t);
      }
    } catch {
      /* partial */
    }
  }
  return out;
}

// ---------- Google Gemini ----------

function toGeminiContents(messages) {
  const system = [];
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') system.push(m.content);
    else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
  }
  return { system: system.join('\n\n'), contents };
}

async function geminiChat(opts) {
  const { apiKey, model, messages, temperature, maxTokens, stream, signal, onChunk } = opts;
  const { system, contents } = toGeminiContents(messages);
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}&key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal ?? AbortSignal.timeout(120000),
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
          temperature,
          ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
        },
      }),
    }
  );
  if (!res.ok) throw chatError(res.status, await res.text().catch(() => ''));
  const pickText = (j) =>
    (j?.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? '').join('');
  if (!stream) {
    const data = await res.json();
    return pickText(data);
  }
  let out = '';
  for await (const data of sseData(res)) {
    try {
      const j = JSON.parse(data);
      const t = pickText(j);
      if (t) {
        out += t;
        onChunk?.(t);
      }
    } catch {
      /* partial */
    }
  }
  return out;
}

// ---------- Public API ----------

/**
 * Run a chat completion.
 * opts: { providerId, apiKey, model, baseUrl, messages:[{role,content}],
 *         temperature, maxTokens, stream, signal, onChunk }
 * Returns the full assistant text.
 */
export async function chatComplete(opts) {
  const providerId = opts.providerId;
  const meta = PROVIDERS[providerId];
  if (!meta) throw new Error('Unknown provider');
  const baseUrl = resolveBaseUrl(providerId, { baseUrl: opts.baseUrl });
  const common = {
    ...opts,
    baseUrl,
    model: opts.model || meta.defaultModel || '',
    temperature: opts.temperature ?? 0.7,
    maxTokens: opts.maxTokens || 2048,
  };
  if (meta.type === 'anthropic') return anthropicChat(common);
  if (meta.type === 'google') return geminiChat(common);
  // openai / ollama / everything else → OpenAI-compatible endpoint
  return openAiCompatChat(common);
}
