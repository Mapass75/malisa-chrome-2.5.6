// Cross-browser WebExtension namespace shim.
// Firefox exposes `browser` (promise-based); Chrome MV3 exposes `chrome`,
// whose async APIs are also promise-based. Aliasing keeps one code path.
globalThis.browser ??= globalThis.chrome;

export default globalThis.browser;
