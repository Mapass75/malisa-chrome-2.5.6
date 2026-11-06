# Chrome Web Store — listing draft & declaration notes

> Draft only. Nothing here has been submitted. Owner must supply real values
> marked **[OWNER]** before submission.

## Single purpose (required field)

> Translate web pages and selected text, and provide optional AI assistance
> (chat, summarize, explain, read-aloud) through AI services the user
> configures with their own API keys.

Do not downplay the chat feature — CWS requires the description to cover all
functionality. Suggested short description (≤132 chars):

> Translate pages & selections with AI, plus chat, summarize, explain and
> read-aloud via your own API keys. No tracking, no middlemen.

## Permission justifications (paste into CWS dashboard)

| Permission / scope | Justification |
|---|---|
| `storage` | Save user settings, provider API keys, and the local translation cache. All data stays on the device. |
| `activeTab` | Read the current page only when the user invokes Translate, selection translate, or chat actions. |
| `scripting` | Inject the content script on demand for page/selection translation and the chat panel. |
| `contextMenus` | Provide "Translate selection" and "Translate page" right-click menu items. |
| `host_permissions` (AI provider APIs) | Send page text / user messages / audio to the translation, chat, speech and transcription providers the user explicitly configures. Includes localhost for self-hosted services (Ollama, LibreTranslate, custom endpoints). |
| `optional_host_permissions` | Let the user grant access to additional self-hosted/custom endpoints at runtime instead of upfront. |
| `web_accessible_resources` | Expose only `icons/icon128.png` (chat avatar) to pages. `mic.html` was removed — it is an extension page, not a page resource. |
| Microphone (not a manifest permission) | Used only during user-initiated voice input; audio tracks are stopped on completion/cancel. |

## Privacy / data-use declaration answers (based on actual code)

| CWS data type | Answer | Why |
|---|---|---|
| Personally identifiable information | **Yes** — voice recordings/transcripts and optional account e-mail (MyMemory) are transmitted to user-chosen providers; not collected by Malisa. | `shared/transcribe.js`, `shared/providers/mymemory.js` |
| Financial and payment information | No | — |
| Health information | No | — |
| Authentication information | **Yes** — user API keys are transmitted to their issuing provider's API only. | `shared/chat.js`, `shared/providers.js`, `shared/tts.js` |
| Personal communications | **Yes** — chat messages are sent to the configured chat provider. | `shared/chat.js` |
| User-generated content | **Yes** — typed chat messages and custom prompts. | `content/chat-ui.js` |
| Website content | **Yes** — page text, selections, and (opt-in) page URL/context sent to providers on user action. | `content/content.js`, `content/chat-ui.js` |
| Web browsing activity | **Yes** — the current page URL is included as context for chat page actions. No history is recorded. | `content/chat-ui.js` |
| Location information | No | — |

## Privacy policy

- In-product copy: `privacy/privacy.html` (shipped in the package).
- Source copy: `PRIVACY.md`.
- **[OWNER]** must publish the policy at a **public HTTPS URL** and paste that
  URL into the CWS privacy field before submission. Do not use a `file://`,
  localhost, or draft URL.

## Items the owner must supply

- [ ] Real developer name / publisher identity **[OWNER]**
- [ ] Public privacy-policy URL **[OWNER]**
- [ ] Store listing assets: 1280×800 promo tile, 440×280 small tile, screenshots **[OWNER]**
- [ ] Support URL / contact email **[OWNER]**
- [ ] Confirm category (likely "Productivity" or "Tools") and language list
- [ ] Review `assets/malisa-source.png` usage rights for listing screenshots

## Known review risks (honest assessment)

- **Undocumented Google `translate_a/single` (gtx) endpoint** — returns
  translation data only (no executable code), so it does not violate the MV3
  remote-code rule, but it is unofficial and can break or be rate-limited at
  any time. Not a CWS policy violation per se; flagged as a reliability risk.
- **Broad `host_permissions`** — justified above; every listed host maps to a
  shipped provider. Reviewers may still question volume; the permission
  table is the answer.
- **`http://localhost/*` host permission** — required for Ollama/self-hosted;
  documented as local-only.
- **21 `UNSAFE_VAR_ASSIGNMENT` lint warnings (Firefox)** — innerHTML is used
  with escaped or static templates only; audited manually. Chrome has no
  equivalent automated check.
