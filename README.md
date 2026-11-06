# Malisa — AI Web Site Translator (v2.5.6)

Translate web pages and selected text, chat with AI about the page, summarize,
explain, and listen to text read aloud — using **your own AI API keys** (BYOK).
No analytics, no middlemen, no tracking.

**Browsers:** Google Chrome 109+ · Firefox 142+ (AMO build)

**Providers:** OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Groq, Mistral,
OpenRouter, xAI (Grok), Ollama (local) for chat/translation; MyMemory, Lingva,
LibreTranslate, DeepL, Azure, Yandex, Baidu, Google/Cloud for machine
translation; Google/Gemini/ElevenLabs/OpenAI/Azure/Polly/custom for speech.

## Repository layout

This repository contains the **shared source** plus generated builds:

```
manifest.json        — Chrome MV3 manifest (source of truth)
background/          — service worker / event page: providers, chat, TTS, transcription
content/             — page translation, selection popup, chat panel (Shadow DOM)
popup/               — quick translate UI
options/             — settings, providers, chatbot, speech, privacy consent
shared/              — storage, cache, security, i18n, providers/, chat, tts, ...
mic.html, mic.js     — voice-input helper page
privacy/             — in-product privacy policy
icons/, assets/      — icons and artwork
scripts/             — build-dist.mjs (packages), generate-icons.mjs
 dist/chrome/        — unpacked Chrome extension (generated)
 dist/firefox/       — unpacked Firefox extension, gecko manifest (generated)
 release/            — distributable ZIPs (generated, gitignored)
docs/                — store listing drafts, AMO notes, build docs
```

The Firefox build is produced from the same source by
`scripts/build-dist.mjs` — there is no duplicated application code.

## Build

```bash
npm install                          # devDependency: sharp (icons only)
node scripts/generate-icons.mjs      # optional — only when artwork changes
node scripts/build-dist.mjs          # or: npm run build
```

Outputs:

| Path | Contents |
|---|---|
| `dist/chrome/` | Unpacked Chrome extension → `chrome://extensions` → Load unpacked |
| `dist/firefox/` | Unpacked Firefox extension → `about:debugging` → Load Temporary Add-on |
| `release/malisa-chrome-2.5.6.zip` | Chrome Web Store upload package |
| `release/malisa-firefox-2.5.6.zip` | AMO submission package (**unsigned** until Mozilla signs) |
| `release/malisa-source-2.5.6.zip` | Reviewable source for store review |

`manifest.json` sits at the root of every ZIP. The build refuses forbidden file
names (`nul`, `con`, …) and suspicious files (`.env*`, `*secret*`).

## Install (development)

1. `node scripts/build-dist.mjs` (or use `dist/chrome/` directly).
2. Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → `dist/chrome/`.
   Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `dist/firefox/manifest.json`.
3. Open **Settings**, accept the privacy notice, add your API keys.

## Usage

- **Popup / context menu / floating icon** → translate page or selection.
- **Floating Malisa icon** → chat panel: ask questions, Summarize/Explain the page
  or selection, voice input, read-aloud.
- **Options** → providers, API keys, fallback providers, chatbot settings,
  speech engines, cache/history controls.

## Privacy

See `privacy/privacy.html` (in-product) and `PRIVACY.md`. API keys are stored
in `browser.storage.local` — **not an encrypted vault**. Content scripts only
receive a redacted `public_settings` copy. No telemetry of any kind.

## License

MIT — see [LICENSE](LICENSE).
