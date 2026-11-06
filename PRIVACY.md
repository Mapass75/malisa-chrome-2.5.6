# Privacy Policy — Malisa

**Last updated:** June 18, 2026.

Malisa - AI web site Translator ("Malisa", "the extension") translates web pages and offers optional AI features (chat, summarize, explain, read-aloud) using services you configure. Malisa has no servers of its own for translation or chat, collects no analytics, and does not sell or share your data for advertising.

The canonical in-product policy lives at `privacy/privacy.html`; this file mirrors it for source review.

## Data we process, and when

- **Page translation** — when you click Translate (popup, context menu, or floating icon), visible page text is sent in batches to the translation provider you selected (or the configured fallback provider).
- **Selection translation** — selected text is sent to the selected provider via the Malisa popup or context menu.
- **Chat, Summarize, Explain** — typed messages, plus optional page context (page text and page URL) when "Include page content" is enabled, are sent to the chat provider in Options → Chatbot. Selection actions send only the selected text unless page context is enabled.
- **Voice input** — audio is recorded locally and sent to the configured transcription provider (OpenAI-compatible `/audio/transcriptions`). If the browser's built-in speech recognition is used, recognition is performed by the browser vendor's service (e.g. Google in Chrome) — it is **not** an offline feature.
- **Read-aloud (TTS)** — text is sent to the configured speech provider (Google, Gemini, ElevenLabs, OpenAI, Azure, AWS Polly, custom OpenAI-compatible endpoint). The "Browser voice" option uses local `speechSynthesis` and sends nothing.
- **API keys & settings** — stored in `browser.storage.local` on your device. This is browser-managed local storage, **not** an encrypted vault; keys are stored in plaintext protected only by your OS/browser profile security. Content scripts receive a redacted copy (`public_settings`) masking keys, secrets and e-mail addresses. Keys are sent only to the provider they belong to.
- **Translation cache** — cached locally in `browser.storage.local` (capped at 5,000 entries); clearable in Options.
- **Chat history** — kept in `sessionStorage` for the current tab session only (latest 60 messages) and sent back to the chat provider as context. Cleared on tab close, "Clear history", or "New chat"; deleted messages are not sent as context.

## What we do not do

- No analytics, telemetry, crash reporting, or usage tracking.
- No selling or sharing data with third parties for marketing.
- No proprietary backend servers for translation, chat, or speech.
- No reading of password fields or form input values during page translation.

## Third-party services

Malisa sends content only to services you explicitly configure and initiate:

- **Translation** — Google Translate (web/Cloud), MyMemory, Lingva, LibreTranslate (hosted or self-hosted), DeepL, Azure Translator, Yandex, Baidu.
- **Fallback providers** — if enabled, failed text is retried on your chosen fallbacks; only enable providers you trust.
- **Chat** — OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral, OpenRouter, xAI (Grok), Ollama (local).
- **Speech** — Google TTS, Gemini TTS, ElevenLabs, OpenAI TTS, Azure Speech, AWS Polly, custom OpenAI-compatible TTS.
- **Transcription** — OpenAI-compatible `/audio/transcriptions` endpoints, or browser built-in speech recognition (browser vendor service).
- **Self-hosted** — Ollama, LibreTranslate, Lingva and custom TTS/transcription URLs you enter yourself. Remote endpoints must use HTTPS; plain HTTP is allowed only for localhost/private-network addresses.

Each provider's own privacy policy and terms apply. Malisa does not control or warrant their retention practices.

## Permissions

- **storage** — settings, API keys, translation cache (all local).
- **activeTab** — access the current tab only when you invoke an action.
- **scripting** — inject the content script for translation/chat on demand.
- **contextMenus** — "Translate selection" / "Translate page" menu items.
- **Host permissions** — network access only to the provider APIs above (plus localhost for self-hosted services); optional host permissions for additional self-hosted endpoints.
- **Microphone** — only while voice input is active; audio tracks stop when recording ends or is cancelled.

## Retention & deletion

- Cache: capped at 5,000 entries; clear via Options → "Clear translation cache".
- Chat history: per-tab session only; cleared via "Clear history"/"New chat".
- API keys: remove in Options → Providers; deleted on uninstall.
- All local data is removed on uninstall or when clearing the extension's site data.

## Contact

Open an issue on the project's issue tracker or contact the developer listed on the store listing.
