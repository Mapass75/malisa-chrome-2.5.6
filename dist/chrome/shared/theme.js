export const TRANSLATOR_THEMES = ['system', 'light', 'dark'];

export function isValidTranslatorTheme(value) {
  return TRANSLATOR_THEMES.includes(value);
}

export function resolveTranslatorTheme(setting) {
  const pref = isValidTranslatorTheme(setting) ? setting : 'system';
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyDocumentTheme(doc, setting) {
  const root = doc.documentElement;
  const pref = isValidTranslatorTheme(setting) ? setting : 'system';
  root.dataset.translatorTheme = pref;
  root.dataset.resolvedTheme = resolveTranslatorTheme(pref);
}

export function watchSystemTheme(doc, setting, onChange) {
  if (setting !== 'system') return () => {};

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    applyDocumentTheme(doc, 'system');
    onChange?.();
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

export const OVERLAY_THEME_STYLES = {
  dark: {
    background: '#1a1a2e',
    color: '#eeeeee',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(108, 99, 255, 0.25)',
  },
  light: {
    background: '#ffffff',
    color: '#1a1a2e',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
    border: '1px solid #e0e0ea',
  },
};
