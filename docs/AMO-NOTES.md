# Mozilla Add-ons (AMO) — submission notes

> Draft only. `release/malisa-firefox-2.5.6.zip` is **unsigned** — AMO signs
> it during review. Do not present it as installable before signing.

## Package

- `dist/firefox/` — unpacked Firefox build (for temporary testing)
- `release/malisa-firefox-2.5.6.zip` — AMO upload package, `manifest.json` at root

## Manifest adaptations already applied (build script)

| Chrome | Firefox build |
|---|---|
| `background.service_worker` | `background.scripts` + `type: "module"` (module event page) |
| `options_page` | `options_ui` with `open_in_tab: true` |
| `minimum_chrome_version` | removed |
| — | `browser_specific_settings.gecko.id` = `{4f2c9a1e-7b3d-4e5f-9a6c-2d8b1f0e3a47}` (generated — **confirm**) |
| — | `strict_min_version: "142.0"` (needed for `data_collection_permissions` on Android; 140 on desktop) |
| — | `data_collection_permissions` declared (below) |

## data_collection_permissions rationale

```json
"required":  ["websiteContent"],
"optional":  ["personalCommunications", "personallyIdentifyingInfo", "authenticationInfo"]
```

- `websiteContent` (required) — page text, selections and opt-in page context
  are sent to user-configured providers; this is the core function.
- `personalCommunications` (optional) — chat messages → chat provider.
- `personallyIdentifyingInfo` (optional) — voice recordings/transcripts;
  optional MyMemory account e-mail.
- `authenticationInfo` (optional) — user API keys transmitted to their
  issuing provider only.

`"none"` would be false — data does leave the device when features are used.

## AMO review requirements checklist

- [ ] **Source code review**: AMO may request source for MV3 extensions.
  `release/malisa-source-2.5.6.zip` contains the full reviewable source,
  `scripts/build-dist.mjs` (reproducible build) and `scripts/generate-icons.mjs`.
- [ ] **Add-on ID**: confirm `{4f2c9a1e-7b3d-4e5f-9a6c-2d8b1f0e3a47}` or replace
  with the owner's chosen ID **before** first submission — it becomes permanent.
- [ ] **Privacy policy**: same public URL as CWS (see `docs/CWS-LISTING.md`).
- [ ] **Listing text**: reuse the CWS description draft; disclose chat,
  voice input, TTS, fallback providers and self-hosted endpoints.
- [ ] **Consent**: in-product consent card (`privacy_consent_v1`) exists;
  Firefox 142+ additionally shows the built-in data-collection consent.
- [ ] **Licensing**: `LICENSE` file is in the source ZIP.

## Known Firefox-specific risks

- **Module event-page background** — requires Firefox 128+; `strict_min_version`
  is set to 142. Temporary-load test in real Firefox is still required.
- **`browser.storage.sync` migration** — `shared/storage.js` migrates legacy
  sync settings to local; the `gecko.id` now present resolves the
  `about:debugging` temporary-load warning.
- **`match_about_blank` content scripts** — supported, but verify chat/translate
  on `about:blank` and iframe pages in real Firefox.
- **Optional host permissions** — `ensureHostPermission()` requests them at
  runtime; verify the prompt flow in Firefox 142+.
- **Microphone/speech** — `getUserMedia` + `MediaRecorder` work in Firefox;
  browser `speechRecognition` is **not** available in Firefox — the extension
  already falls back to the configured transcription provider. Verify the
  fallback path shows a clear message, not a silent failure.
- **`web-ext lint` result**: 0 errors, 21 `UNSAFE_VAR_ASSIGNMENT` warnings —
  all innerHTML uses audited (escaped or static templates).

## Reproduce the build

```bash
npm install          # devDependency: sharp (icons only)
node scripts/generate-icons.mjs   # optional, only if icons change
node scripts/build-dist.mjs
```

No bundler/minifier is used — shipped code is the reviewed source verbatim.
