# Security — Malisa (Chrome)

## Overview

Malisa is **BYOK** (Bring Your Own Key): no proprietary servers, no telemetry. Risks are mainly related to user API keys and sending page text to AI providers — expected behavior for a translator.

## Controls

| Risk | Status | Mitigation |
|------|--------|------------|
| API key storage | ✅ | `chrome.storage.local` only |
| Key leakage in errors | ✅ | `sanitizeErrorMessage` |
| DOM injection on pages | ✅ | `textContent`, not `innerHTML` for translations |
| Untrusted messages | ✅ | `assertTrustedSender` |
| Analytics | ✅ | None |

## Permissions

- **activeTab** — page access only when the user triggers translation.
- **storage** — local settings and cache.
- **scripting** — inject content script if the tab was opened before install.
- **host_permissions** — HTTPS calls to configured AI APIs and local Ollama only.

## User responsibilities

- Protect API keys; do not share profiles with untrusted parties.
- **Translation cache** — may contain sensitive text until cleared.
- **AI output quality** — not a security issue, but models can mistranslate.

## Reporting

Open a GitHub security advisory or issue for vulnerabilities.
