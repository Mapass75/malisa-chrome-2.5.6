globalThis.browser ??= globalThis.chrome;

if (globalThis.__MALISA_CONTENT_INIT__) {
  /* already loaded */
} else {
  globalThis.__MALISA_CONTENT_INIT__ = true;

  const UI_LANG_CODES = new Set(['en', 'hr', 'sr', 'de', 'it', 'fr', 'es']);

  const CONTENT_I18N = {
    en: {
      collectingText: 'Collecting text...',
      noTextToTranslate: 'No text to translate',
      translatingOverlay: 'Translating...',
      translatingProgress: 'Translating... {done}/{total} ({pct}%)',
      translationDone: 'Translation complete ✓',
      pageNotReady: 'Page is not ready yet',
      translationNotStarted: 'Translation did not start',
      errorPrefix: 'Error: ',
      selectionPopupTitle: 'Malisa translation',
      selectionOriginal: 'Original',
      selectionTranslation: 'Translation',
      selectionTranslating: 'Translating selection...',
      selectionClose: 'Close',
      selectionSpeak: 'Read aloud',
      selectionTtsError: 'Speech failed: ',
      selectionSummarize: 'Summarize',
      selectionExplain: 'Explain',
      selectionOpening: 'Opening chat…',
    },
    hr: {
      collectingText: 'Prikupljam tekst...',
      noTextToTranslate: 'Nema teksta za prijevod',
      translatingOverlay: 'Prevodim...',
      translatingProgress: 'Prevodim... {done}/{total} ({pct}%)',
      translationDone: 'Prijevod završen ✓',
      pageNotReady: 'Stranica još nije spremna',
      translationNotStarted: 'Prijevod nije pokrenut',
      errorPrefix: 'Greška: ',
      selectionPopupTitle: 'Malisa prijevod',
      selectionOriginal: 'Original',
      selectionTranslation: 'Prijevod',
      selectionTranslating: 'Prevodim označeni tekst...',
      selectionClose: 'Zatvori',
      selectionSpeak: 'Pročitaj naglas',
      selectionTtsError: 'Govor nije uspio: ',
      selectionSummarize: 'Sažmi',
      selectionExplain: 'Objasni',
      selectionOpening: 'Otvaram chat…',
    },
    sr: {
      collectingText: 'Prikupljam tekst...',
      noTextToTranslate: 'Nema teksta za prevod',
      translatingOverlay: 'Prevođenje...',
      translatingProgress: 'Prevođenje... {done}/{total} ({pct}%)',
      translationDone: 'Prevod završen ✓',
      pageNotReady: 'Stranica još nije spremna',
      translationNotStarted: 'Prevod nije pokrenut',
      errorPrefix: 'Greška: ',
      selectionPopupTitle: 'Malisa prevod',
      selectionOriginal: 'Original',
      selectionTranslation: 'Prevod',
      selectionTranslating: 'Prevođenje označenog teksta...',
      selectionClose: 'Zatvori',
      selectionSpeak: 'Pročitaj naglas',
      selectionTtsError: 'Govor nije uspio: ',
      selectionSummarize: 'Sažmi',
      selectionExplain: 'Objasni',
      selectionOpening: 'Otvaram chat…',
    },
    de: {
      collectingText: 'Text wird gesammelt...',
      noTextToTranslate: 'Kein Text zum Übersetzen',
      translatingOverlay: 'Übersetze...',
      translatingProgress: 'Übersetze... {done}/{total} ({pct}%)',
      translationDone: 'Übersetzung abgeschlossen ✓',
      pageNotReady: 'Seite ist noch nicht bereit',
      translationNotStarted: 'Übersetzung wurde nicht gestartet',
      errorPrefix: 'Fehler: ',
      selectionPopupTitle: 'Malisa Übersetzung',
      selectionOriginal: 'Original',
      selectionTranslation: 'Übersetzung',
      selectionTranslating: 'Auswahl wird übersetzt...',
      selectionClose: 'Schließen',
      selectionSpeak: 'Vorlesen',
      selectionTtsError: 'Sprachausgabe fehlgeschlagen: ',
      selectionSummarize: 'Zusammenfassen',
      selectionExplain: 'Erklären',
      selectionOpening: 'Chat wird geöffnet…',
    },
    it: {
      collectingText: 'Raccolta testo...',
      noTextToTranslate: 'Nessun testo da tradurre',
      translatingOverlay: 'Traduzione...',
      translatingProgress: 'Traduzione... {done}/{total} ({pct}%)',
      translationDone: 'Traduzione completata ✓',
      pageNotReady: 'La pagina non è ancora pronta',
      translationNotStarted: 'Traduzione non avviata',
      errorPrefix: 'Errore: ',
      selectionPopupTitle: 'Traduzione Malisa',
      selectionOriginal: 'Originale',
      selectionTranslation: 'Traduzione',
      selectionTranslating: 'Traduzione selezione...',
      selectionClose: 'Chiudi',
      selectionSpeak: 'Leggi ad alta voce',
      selectionTtsError: 'Lettura vocale non riuscita: ',
      selectionSummarize: 'Riassumi',
      selectionExplain: 'Spiega',
      selectionOpening: 'Apertura chat…',
    },
    fr: {
      collectingText: 'Collecte du texte...',
      noTextToTranslate: 'Aucun texte à traduire',
      translatingOverlay: 'Traduction...',
      translatingProgress: 'Traduction... {done}/{total} ({pct}%)',
      translationDone: 'Traduction terminée ✓',
      pageNotReady: 'La page n\'est pas encore prête',
      translationNotStarted: 'La traduction n\'a pas démarré',
      errorPrefix: 'Erreur : ',
      selectionPopupTitle: 'Traduction Malisa',
      selectionOriginal: 'Original',
      selectionTranslation: 'Traduction',
      selectionTranslating: 'Traduction de la sélection...',
      selectionClose: 'Fermer',
      selectionSpeak: 'Lire à voix haute',
      selectionTtsError: 'Échec de la lecture : ',
      selectionSummarize: 'Résumer',
      selectionExplain: 'Expliquer',
      selectionOpening: 'Ouverture du chat…',
    },
    es: {
      collectingText: 'Recopilando texto...',
      noTextToTranslate: 'No hay texto para traducir',
      translatingOverlay: 'Traduciendo...',
      translatingProgress: 'Traduciendo... {done}/{total} ({pct}%)',
      translationDone: 'Traducción completada ✓',
      pageNotReady: 'La página aún no está lista',
      translationNotStarted: 'La traducción no se inició',
      errorPrefix: 'Error: ',
      selectionPopupTitle: 'Traducción Malisa',
      selectionOriginal: 'Original',
      selectionTranslation: 'Traducción',
      selectionTranslating: 'Traduciendo selección...',
      selectionClose: 'Cerrar',
      selectionSpeak: 'Leer en voz alta',
      selectionTtsError: 'Error de voz: ',
      selectionSummarize: 'Resumir',
      selectionExplain: 'Explicar',
      selectionOpening: 'Abriendo chat…',
    },
  };

  function t(key, lang, vars = {}) {
    let text = CONTENT_I18N[lang]?.[key] ?? CONTENT_I18N.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
    return text;
  }

  async function getUiLanguage() {
    const result = await browser.storage.local.get('public_settings');
    const lang = result.public_settings?.uiLanguage;
    return UI_LANG_CODES.has(lang) ? lang : 'en';
  }

  const OVERLAY_THEMES = {
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

  let translatorThemePref = 'system';
  let systemThemeMq = null;

  function resolveTranslatorTheme(setting) {
    if (setting === 'light' || setting === 'dark') return setting;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  async function loadTranslatorTheme() {
    const result = await browser.storage.local.get('public_settings');
    translatorThemePref = result.public_settings?.translatorTheme ?? 'system';
  }

  function applyOverlayTheme(overlay) {
    const resolved = resolveTranslatorTheme(translatorThemePref);
    const theme = OVERLAY_THEMES[resolved];
    overlay.style.background = theme.background;
    overlay.style.color = theme.color;
    overlay.style.boxShadow = theme.boxShadow;
    overlay.style.border = theme.border;
  }

  function watchSystemOverlayTheme() {
    if (systemThemeMq) {
      systemThemeMq.removeEventListener('change', systemThemeMq._handler);
      systemThemeMq = null;
    }
    if (translatorThemePref !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const overlay = document.getElementById('ai-translator-overlay');
      if (overlay) applyOverlayTheme(overlay);
    };
    mq.addEventListener('change', handler);
    mq._handler = handler;
    systemThemeMq = mq;
  }

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'SVG', 'MATH',
    'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  ]);

  const SKIP_SELECTORS =
    '[contenteditable="true"], [data-ai-translator-skip], .ai-translator-overlay, #malisa-selection-popup, #malisa-selection-backdrop';
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'value'];
  const CANDIDATE_SELECTOR =
    'p, h1, h2, h3, h4, h5, h6, li, td, th, dt, dd, blockquote, figcaption, label, article, button, a, span, strong, b, em, i, small, caption, div';

  let uiLang = 'en';
  let blocks = [];
  let translated = false;
  let activeTargetLanguage = null;
  const blockById = new Map();
  const translationByText = new Map();
  const processedElements = new WeakSet();
  let nextId = 0;
  let domObserver = null;
  let rescanTimer = null;
  let translationEpoch = 0;

  function isHiddenElement(el) {
    if (!el.isConnected) return true;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    const rect = el.getBoundingClientRect();
    return rect.width === 0 && rect.height === 0;
  }

  function isSkippableText(text) {
    if (!text || text.length < 1) return true;
    return !/\p{L}/u.test(text);
  }

  function* querySelectorAllDeep(root, selector) {
    for (const el of root.querySelectorAll(selector)) {
      yield el;
      if (el.shadowRoot) yield* querySelectorAllDeep(el.shadowRoot, selector);
    }
  }

  function collectCandidateElements() {
    const candidates = [];

    for (const el of querySelectorAllDeep(document.body, CANDIDATE_SELECTOR)) {
      if (SKIP_TAGS.has(el.tagName)) continue;
      if (el.closest(SKIP_SELECTORS)) continue;
      if (isHiddenElement(el)) continue;

      const text = el.innerText?.trim() ?? '';
      if (isSkippableText(text)) continue;

      candidates.push(el);
    }

    // Keep innermost elements, but also keep an element that has its own
    // direct text nodes alongside candidate children (mixed content like
    // "ad text <a>See more</a>"), so its own text isn't dropped.
    return candidates.filter(
      (el) =>
        !candidates.some((other) => other !== el && el.contains(other)) ||
        hasDirectText(el)
    );
  }

  function hasDirectText(el) {
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && /\p{L}/u.test(child.textContent)) {
        return true;
      }
    }
    return false;
  }

  function collectTextNodes(el) {
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      if (n.textContent?.trim()) nodes.push(n);
      n = walker.nextNode();
    }
    return nodes;
  }

  function collectDirectTextNodes(el) {
    const nodes = [];
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        nodes.push(child);
      }
    }
    return nodes;
  }

  function rememberTranslation(original, translated) {
    if (original && translated && original !== translated) {
      translationByText.set(original, translated);
    }
  }

  function extractBlocks() {
    blocks = [];
    blockById.clear();
    let index = 0;

    const candidates = new Set(collectCandidateElements());
    for (const el of candidates) {
      const directOnly = hasDirectText(el) &&
        Array.from(el.children).some((c) => candidates.has(c));
      const nodes = directOnly ? collectDirectTextNodes(el) : collectTextNodes(el);
      const text = (directOnly
        ? nodes.map((n) => n.textContent).join(' ')
        : el.innerText
      )?.trim() ?? '';
      if (isSkippableText(text) || !nodes.length) continue;

      const id = String(index++);
      const block = { id, el, nodes, originalText: text };
      blocks.push(block);
      blockById.set(id, block);
      processedElements.add(el);

      for (const attr of ATTRS) {
        const attrText = el.getAttribute(attr)?.trim() ?? '';
        if (isSkippableText(attrText) || attrText === text) continue;
        const attrId = String(index++);
        const attrBlock = { id: attrId, el, nodes: [], originalText: attrText, attr };
        blocks.push(attrBlock);
        blockById.set(attrId, attrBlock);
      }
    }

    // Attributes on elements that aren't text candidates (img alt, input
    // placeholder, button value).
    for (const el of querySelectorAllDeep(document.body, '[placeholder],[alt],[value]')) {
      if (SKIP_TAGS.has(el.tagName) && el.tagName !== 'INPUT') continue;
      if (el.closest(SKIP_SELECTORS)) continue;
      for (const attr of ATTRS) {
        if (attr === 'value' &&
            (el.tagName !== 'INPUT' || !['button', 'submit', 'reset'].includes(el.type))) continue;
        const attrText = el.getAttribute(attr)?.trim() ?? '';
        if (isSkippableText(attrText)) continue;
        const attrId = String(index++);
        const attrBlock = { id: attrId, el, nodes: [], originalText: attrText, attr };
        blocks.push(attrBlock);
        blockById.set(attrId, attrBlock);
      }
    }

    nextId = index;
    return blocks.map(({ id, originalText }) => ({ id, text: originalText }));
  }

  function applyToBlock(block, translatedText) {
    if (block.attr) {
      block.el.setAttribute(block.attr, translatedText);
      rememberTranslation(block.originalText, translatedText);
      return;
    }
    if (!block.nodes.length) return;
    block.nodes[0].textContent = translatedText;
    for (let i = 1; i < block.nodes.length; i++) {
      block.nodes[i].textContent = '';
    }
    rememberTranslation(block.originalText, translatedText);
  }

  function applyCachedTranslationsToDom() {
    if (!translationByText.size) return;

    for (const el of collectCandidateElements()) {
      const text = el.innerText?.trim() ?? '';
      const translatedText = translationByText.get(text);
      if (!translatedText || text === translatedText) continue;

      const nodes = collectTextNodes(el);
      if (!nodes.length || nodes[0].textContent?.trim() === translatedText) continue;

      nodes[0].textContent = translatedText;
      for (let i = 1; i < nodes.length; i++) {
        nodes[i].textContent = '';
      }
      processedElements.add(el);

      for (const attr of ['aria-label', 'title']) {
        const attrText = el.getAttribute(attr)?.trim() ?? '';
        const attrTranslated = translationByText.get(attrText);
        if (attrTranslated && attrText !== attrTranslated) {
          el.setAttribute(attr, attrTranslated);
        }
      }
    }
  }

  let pendingRescan = false;

  function extractNewBlocks() {
    const out = [];
    const translatedVals = new Set(translationByText.values());
    const candidates = new Set(collectCandidateElements());

    for (const el of candidates) {
      if (processedElements.has(el)) continue;
      const directOnly = hasDirectText(el) &&
        Array.from(el.children).some((c) => candidates.has(c));
      const nodes = directOnly ? collectDirectTextNodes(el) : collectTextNodes(el);
      const text = (directOnly
        ? nodes.map((n) => n.textContent).join(' ')
        : el.innerText
      )?.trim() ?? '';
      if (isSkippableText(text) || !nodes.length) continue;

      const id = String(nextId++);
      const block = { id, el, nodes, originalText: text };
      blocks.push(block);
      blockById.set(id, block);
      processedElements.add(el);

      const cachedText = translationByText.get(text);
      if (cachedText) applyToBlock(block, cachedText);
      else out.push({ id, text });

      for (const attr of ATTRS) {
        const attrText = el.getAttribute(attr)?.trim() ?? '';
        if (isSkippableText(attrText) || attrText === text) continue;
        const cachedAttr = translationByText.get(attrText);
        if (cachedAttr) { if (attrText !== cachedAttr) el.setAttribute(attr, cachedAttr); continue; }
        if (translatedVals.has(attrText)) continue;
        const attrId = String(nextId++);
        const attrBlock = { id: attrId, el, nodes: [], originalText: attrText, attr };
        blocks.push(attrBlock);
        blockById.set(attrId, attrBlock);
        out.push({ id: attrId, text: attrText });
      }
    }

    for (const el of querySelectorAllDeep(document.body, '[placeholder],[alt],[value]')) {
      if (el.closest(SKIP_SELECTORS)) continue;
      for (const attr of ATTRS) {
        if (attr === 'value' &&
            (el.tagName !== 'INPUT' || !['button', 'submit', 'reset'].includes(el.type))) continue;
        const attrText = el.getAttribute(attr)?.trim() ?? '';
        if (isSkippableText(attrText)) continue;
        const cachedAttr = translationByText.get(attrText);
        if (cachedAttr) {
          if (attrText !== cachedAttr) el.setAttribute(attr, cachedAttr);
          continue;
        }
        if (translatedVals.has(attrText)) continue;
        const attrId = String(nextId++);
        const attrBlock = { id: attrId, el, nodes: [], originalText: attrText, attr };
        blocks.push(attrBlock);
        blockById.set(attrId, attrBlock);
        out.push({ id: attrId, text: attrText });
      }
    }

    return out;
  }

  function isUsablePageTarget(lang) {
    return typeof lang === 'string' && /^[a-z]{2,3}(-[a-zA-Z0-9]+)?$/.test(lang.trim());
  }

  function isStalePageMessage(message) {
    return message.epoch !== undefined && message.epoch !== translationEpoch;
  }

  function scheduleDomRescan() {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => {
      if (!translated || pendingRescan || !isUsablePageTarget(activeTargetLanguage)) return;
      applyCachedTranslationsToDom();
      const newBlocks = extractNewBlocks();
      if (!newBlocks.length) return;
      pendingRescan = true;
      browser.runtime.sendMessage(
        {
          type: 'TRANSLATE_PAGE',
          blocks: newBlocks,
          targetLanguage: activeTargetLanguage,
          rescan: true,
          epoch: translationEpoch,
        },
        () => {
          pendingRescan = false;
          if (browser.runtime.lastError) return;
          scheduleDomRescan();
        }
      );
    }, 400);
  }

  function startDomObserver() {
    if (domObserver || !document.body) return;
    domObserver = new MutationObserver(() => scheduleDomRescan());
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('scroll', scheduleDomRescan, { passive: true });
  }

  function stopDomObserver() {
    domObserver?.disconnect();
    domObserver = null;
    window.removeEventListener('scroll', scheduleDomRescan);
    clearTimeout(rescanTimer);
  }

  function applyPartialResults(results) {
    for (const r of results) {
      const block = blockById.get(String(r.id));
      if (block && r.translated) {
        applyToBlock(block, r.translated);
      }
    }
    translated = true;
  }

  function restoreOriginal() {
    translationEpoch += 1;
    translated = false;
    activeTargetLanguage = null;
    pendingRescan = false;
    stopDomObserver();
    for (const block of blocks) {
      if (block.attr) {
        block.el.setAttribute(block.attr, block.originalText);
      } else {
        applyToBlock(block, block.originalText);
      }
    }
    translationByText.clear();
    removeOverlay();
  }

  function removeSelectionPopup() {
    stopSelectionTts();
    document.getElementById('malisa-selection-backdrop')?.remove();
    document.getElementById('malisa-selection-popup')?.remove();
    document.removeEventListener('keydown', onSelectionPopupKeydown);
  }

  let activeTtsAudio = null;
  let selectionTtsToken = 0;
  const selectionAudioCache = new Map();
  let activeTtsButton = null;

  const LANG_BCP47 = {
    hr: 'hr-HR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
    pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL', cs: 'cs-CZ', sk: 'sk-SK', sl: 'sl-SI',
    sr: 'sr-RS', bs: 'bs-BA', ru: 'ru-RU', uk: 'uk-UA', ja: 'ja-JP', ko: 'ko-KR',
    zh: 'zh-CN', ar: 'ar-SA', tr: 'tr-TR', sv: 'sv-SE', da: 'da-DK', no: 'nb-NO',
    fi: 'fi-FI', hu: 'hu-HU', ro: 'ro-RO', bg: 'bg-BG', el: 'el-GR', he: 'he-IL',
    hi: 'hi-IN', th: 'th-TH', vi: 'vi-VN', id: 'id-ID',
  };

  function langToBcp47(code) {
    if (!code) return '';
    return LANG_BCP47[code.split('-')[0].toLowerCase()] ?? '';
  }

  function guessPageLang() {
    const raw = document.documentElement.lang?.trim();
    return raw ? raw.split('-')[0].toLowerCase() : '';
  }

  function stopSelectionTts() {
    selectionTtsToken++;
    if (activeTtsAudio) {
      activeTtsAudio.pause();
      activeTtsAudio.removeAttribute('src');
      activeTtsAudio = null;
    }
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (activeTtsButton) {
      activeTtsButton.classList.remove('is-speaking');
      activeTtsButton.disabled = false;
      activeTtsButton = null;
    }
  }

  function getTtsSettings() {
    return new Promise((resolve) => {
      browser.runtime.sendMessage({ type: 'GET_TTS_SETTINGS' }, (response) => {
        if (browser.runtime.lastError || !response?.ok) {
          resolve({ enabled: true, speech: { engine: 'browser' } });
          return;
        }
        resolve(response.settings);
      });
    });
  }

  async function speakSelectionText(text, langCode, button) {
    if (!text?.trim()) return;
    if (activeTtsButton === button) {
      stopSelectionTts();
      return;
    }
    stopSelectionTts();
    activeTtsButton = button;
    button.classList.add('is-speaking');

    const settings = await getTtsSettings();
    if (!settings.enabled) {
      stopSelectionTts();
      return;
    }

    const speech = settings.speech ?? {};
    if ((speech.engine ?? 'browser') !== 'browser') {
      const token = ++selectionTtsToken;
      button.disabled = true;
      try {
        for (const chunk of splitSelectionForSpeech(text)) {
          const cacheKey = `${speech.engine}|${langCode}|${chunk}`;
          let audioData = selectionAudioCache.get(cacheKey);
          if (!audioData) {
            audioData = await requestSelectionSpeech(chunk, langCode);
            selectionAudioCache.set(cacheKey, audioData);
          }
          if (token !== selectionTtsToken) return;
          button.disabled = false;
          button.title = t('selectionSpeak', uiLang);
          const audio = new Audio(`data:${audioData.mimeType};base64,${audioData.audioBase64}`);
          activeTtsAudio = audio;
          await new Promise((resolve, reject) => {
            audio.addEventListener('ended', resolve);
            audio.addEventListener('pause', resolve);
            audio.addEventListener('error', () => reject(new Error('Audio playback failed')));
            audio.play().catch(reject);
          });
          if (token !== selectionTtsToken) return;
        }
        stopSelectionTts();
      } catch (err) {
        if (token !== selectionTtsToken) return;
        button.disabled = false;
        button.title = t('selectionTtsError', uiLang) + (err?.message || '');
        // Cloud engine failed (no key, 401, 429, network, no voice) — fall back to browser voices.
        if (window.speechSynthesis?.getVoices().length) {
          speakWithBrowserVoice(text, langCode, speech);
        } else {
          stopSelectionTts();
        }
      }
      return;
    }

    if (!window.speechSynthesis) {
      stopSelectionTts();
      return;
    }
    speakWithBrowserVoice(text, langCode, speech);
  }

  function requestSelectionSpeech(text, lang) {
    return new Promise((resolve, reject) => {
      browser.runtime.sendMessage({ type: 'SPEAK_SELECTION', text, lang }, (response) => {
        if (browser.runtime.lastError || !response?.ok) {
          reject(new Error(response?.error || browser.runtime.lastError?.message || ''));
          return;
        }
        resolve({ audioBase64: response.audioBase64, mimeType: response.mimeType });
      });
    });
  }

  function splitSelectionForSpeech(text, maxLen = 400) {
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

  function speakWithBrowserVoice(text, langCode, speech) {
    const utter = new SpeechSynthesisUtterance(text);
    const bcp = langToBcp47(langCode);
    if (bcp) utter.lang = bcp;
    const voices = window.speechSynthesis.getVoices();
    const namedVoice = speech.voice && voices.find((v) => v.name === speech.voice);
    const langVoice =
      (!namedVoice && bcp
        ? voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(bcp.toLowerCase()))
        : null) ?? (!namedVoice ? voices[0] : null);
    if (namedVoice ?? langVoice) {
      utter.voice = namedVoice ?? langVoice;
      utter.lang = utter.voice.lang;
    }
    utter.rate = Math.min(4, Math.max(0.5, +speech.rate || 1));
    utter.pitch = Math.min(2, Math.max(0, +speech.pitch || 1));
    utter.onend = () => stopSelectionTts();
    utter.onerror = () => stopSelectionTts();
    speechSynthesis.speak(utter);
  }

  function createTtsButton(text, langCode) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'malisa-sel-tts';
    btn.title = t('selectionSpeak', uiLang);
    btn.setAttribute('aria-label', t('selectionSpeak', uiLang));
    btn.innerHTML =
      '<svg class="malisa-sel-tts-icon malisa-sel-tts-play" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>' +
      '<path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>' +
      '<svg class="malisa-sel-tts-icon malisa-sel-tts-stop" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/></svg>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakSelectionText(text, langCode, btn);
    });
    return btn;
  }

  function createSectionHeader(labelText, text, langCode, withTts) {
    const row = document.createElement('div');
    row.className = 'malisa-sel-label-row';
    const label = document.createElement('span');
    label.className = 'malisa-sel-label';
    label.textContent = labelText;
    row.appendChild(label);
    if (withTts) row.appendChild(createTtsButton(text, langCode));
    return row;
  }

  function onSelectionPopupKeydown(e) {
    if (e.key === 'Escape') removeSelectionPopup();
  }

  function getSelectionTheme() {
    return resolveTranslatorTheme(translatorThemePref);
  }

  function injectSelectionStyles() {
    let style = document.getElementById('malisa-selection-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'malisa-selection-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
      @keyframes malisa-sel-in {
        from { opacity: 0; transform: translateY(12px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes malisa-sel-backdrop-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      #malisa-selection-backdrop {
        position: fixed; inset: 0; z-index: 2147483646;
        background: rgba(8, 8, 18, 0.28);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        animation: malisa-sel-backdrop-in 0.2s ease-out;
      }
      #malisa-selection-popup {
        position: fixed; z-index: 2147483647;
        right: 24px; bottom: 24px; left: auto; top: auto;
        width: min(400px, calc(100vw - 32px));
        max-height: min(68vh, 480px);
        display: flex; flex-direction: column;
        border-radius: 20px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        overflow: hidden;
        animation: malisa-sel-in 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        transform-origin: bottom right;
      }
      #malisa-selection-popup[data-theme="dark"] {
        background: rgba(22, 22, 38, 0.92);
        color: #ececf4;
        border: 1px solid rgba(108, 99, 255, 0.22);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.04) inset,
          0 24px 48px rgba(0, 0, 0, 0.45),
          0 8px 16px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      #malisa-selection-popup[data-theme="light"] {
        background: rgba(255, 255, 255, 0.94);
        color: #1a1a2e;
        border: 1px solid rgba(108, 99, 255, 0.12);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.8) inset,
          0 24px 48px rgba(108, 99, 255, 0.12),
          0 8px 24px rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      .malisa-sel-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px;
        padding: 16px 16px 12px 18px;
        font-weight: 600; font-size: 13px; letter-spacing: 0.01em;
      }
      .malisa-sel-title-wrap {
        display: flex; align-items: center; gap: 8px; min-width: 0;
      }
      .malisa-sel-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: linear-gradient(135deg, #6c63ff, #a89cff);
        flex-shrink: 0;
        box-shadow: 0 0 10px rgba(108, 99, 255, 0.55);
      }
      .malisa-sel-title { color: #6c63ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .malisa-sel-close {
        display: flex; align-items: center; justify-content: center;
        width: 32px; height: 32px; padding: 0;
        border: none; border-radius: 50%;
        cursor: pointer; flex-shrink: 0;
        transition: background 0.15s ease, transform 0.15s ease, color 0.15s ease;
      }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-close {
        background: rgba(255, 255, 255, 0.06); color: #b8b8cc;
      }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-close:hover {
        background: rgba(255, 255, 255, 0.12); color: #fff;
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-close {
        background: rgba(26, 26, 46, 0.06); color: #5c5c72;
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-close:hover {
        background: rgba(108, 99, 255, 0.12); color: #6c63ff;
      }
      .malisa-sel-close:active { transform: scale(0.94); }
      .malisa-sel-close svg { display: block; }
      .malisa-sel-body {
        padding: 4px 18px 18px;
        overflow-y: auto;
        scrollbar-width: thin;
      }
      .malisa-sel-label {
        font-size: 10px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.08em;
        opacity: 0.5; margin-bottom: 0;
      }
      .malisa-sel-label-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; margin-bottom: 6px;
      }
      .malisa-sel-tts {
        display: flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; padding: 0;
        border: none; border-radius: 50%;
        cursor: pointer; flex-shrink: 0;
        transition: background 0.15s ease, transform 0.15s ease, color 0.15s ease;
      }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-tts {
        background: rgba(108, 99, 255, 0.12); color: #a89cff;
      }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-tts:hover {
        background: rgba(108, 99, 255, 0.22); color: #fff;
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-tts {
        background: rgba(108, 99, 255, 0.1); color: #6c63ff;
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-tts:hover {
        background: rgba(108, 99, 255, 0.18);
      }
      .malisa-sel-tts:active { transform: scale(0.94); }
      .malisa-sel-tts:disabled { opacity: 0.5; cursor: wait; }
      .malisa-sel-tts.is-speaking {
        background: rgba(108, 99, 255, 0.28) !important;
        color: #fff !important;
      }
      .malisa-sel-tts-icon { display: block; }
      .malisa-sel-tts-stop { display: none; }
      .malisa-sel-tts.is-speaking .malisa-sel-tts-play { display: none; }
      .malisa-sel-tts.is-speaking .malisa-sel-tts-stop { display: block; }
      .malisa-sel-text {
        font-size: 14px; line-height: 1.55; margin-bottom: 16px;
        white-space: pre-wrap; word-break: break-word;
        padding: 10px 12px; border-radius: 12px;
      }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-text {
        background: rgba(255, 255, 255, 0.04);
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-text {
        background: rgba(108, 99, 255, 0.05);
      }
      .malisa-sel-text:last-child { margin-bottom: 0; }
      .malisa-sel-actions {
        display: flex; gap: 8px;
        padding: 12px 18px 16px;
        border-top: 1px solid rgba(108, 99, 255, 0.16);
      }
      .malisa-sel-act {
        flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        min-height: 36px; padding: 8px 10px;
        border-radius: 11px; border: 1px solid transparent;
        font: 600 12.5px/1 system-ui, -apple-system, sans-serif;
        cursor: pointer; white-space: nowrap;
        transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease, border-color 0.15s ease;
      }
      .malisa-sel-act:active { transform: scale(0.97); }
      .malisa-sel-act:disabled { cursor: default; opacity: 0.75; }
      .malisa-sel-act .ic { font-size: 14px; line-height: 1; flex-shrink: 0; }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-act.primary {
        background: linear-gradient(135deg, #6c63ff, #8f7bff); color: #fff;
        box-shadow: 0 4px 14px rgba(108, 99, 255, 0.35);
      }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-act.primary:hover { filter: brightness(1.08); }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-act.secondary {
        background: rgba(255, 255, 255, 0.07); color: #d8d8ea;
        border-color: rgba(255, 255, 255, 0.1);
      }
      #malisa-selection-popup[data-theme="dark"] .malisa-sel-act.secondary:hover {
        background: rgba(255, 255, 255, 0.12); color: #fff;
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-act.primary {
        background: linear-gradient(135deg, #6c63ff, #8f7bff); color: #fff;
        box-shadow: 0 4px 14px rgba(108, 99, 255, 0.3);
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-act.primary:hover { filter: brightness(1.06); }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-act.secondary {
        background: rgba(26, 26, 46, 0.05); color: #3c3c52;
        border-color: rgba(26, 26, 46, 0.1);
      }
      #malisa-selection-popup[data-theme="light"] .malisa-sel-act.secondary:hover {
        background: rgba(108, 99, 255, 0.1); color: #6c63ff;
      }
      .malisa-sel-act.is-loading .ic {
        width: 13px; height: 13px; border-radius: 50%;
        border: 2px solid rgba(128, 128, 128, 0.35);
        border-top-color: currentColor;
        animation: malisa-sel-spin 0.7s linear infinite;
      }
      @media (hover: none) {
        .malisa-sel-act { min-height: 44px; }
      }
      .malisa-sel-loading {
        font-size: 14px; padding: 12px 4px 8px;
        display: flex; align-items: center; gap: 10px;
      }
      .malisa-sel-spinner {
        width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid rgba(108, 99, 255, 0.25);
        border-top-color: #6c63ff;
        animation: malisa-sel-spin 0.7s linear infinite;
      }
      @keyframes malisa-sel-spin { to { transform: rotate(360deg); } }
      .malisa-sel-error {
        color: #ff6b6b; font-size: 14px;
        padding: 10px 12px; border-radius: 12px;
        background: rgba(255, 107, 107, 0.1);
      }
    `;
  }

  function createCloseButton() {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'malisa-sel-close';
    closeBtn.setAttribute('aria-label', t('selectionClose', uiLang));
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
    closeBtn.addEventListener('click', removeSelectionPopup);
    return closeBtn;
  }

  async function buildSelectionActions(original, translated) {
    const text = (original || '').trim();
    if (!text) return null;
    try {
      const result = await browser.storage.local.get('public_settings');
      const cb = result.public_settings?.chatbot || {};
      if (cb.selectionButtons === false) return null;
    } catch {
      return null;
    }
    const wrap = document.createElement('div');
    wrap.className = 'malisa-sel-actions';
    const mk = (action, label, primary, icon) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'malisa-sel-act ' + (primary ? 'primary' : 'secondary');
      b.dataset.act = action;
      const ic = document.createElement('span');
      ic.className = 'ic';
      ic.textContent = icon;
      const tx = document.createElement('span');
      tx.className = 'tx';
      tx.textContent = label;
      b.append(ic, tx);
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => {
        b.classList.add('is-loading');
        b.querySelector('.tx').textContent = t('selectionOpening', uiLang);
        b.disabled = true;
        wrap.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        window.postMessage(
          {
            type: 'malisa-chat-action',
            token: window.__malisaBridgeToken || '',
            action,
            text,
            translation: (translated || '').trim(),
          },
          '*'
        );
        setTimeout(removeSelectionPopup, 450);
      });
      return b;
    };
    wrap.append(
      mk('summarize', t('selectionSummarize', uiLang), true, '⚡'),
      mk('explain', t('selectionExplain', uiLang), false, '💡')
    );
    return wrap;
  }

  async function showSelectionPopup(mode, payload = {}) {
    await refreshUiLang();
    await loadTranslatorTheme();
    injectSelectionStyles();
    removeSelectionPopup();

    const theme = getSelectionTheme();
    const backdrop = document.createElement('div');
    backdrop.id = 'malisa-selection-backdrop';
    backdrop.addEventListener('click', removeSelectionPopup);

    const panel = document.createElement('div');
    panel.id = 'malisa-selection-popup';
    panel.dataset.theme = theme;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('selectionPopupTitle', uiLang));

    const header = document.createElement('div');
    header.className = 'malisa-sel-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'malisa-sel-title-wrap';
    const dot = document.createElement('span');
    dot.className = 'malisa-sel-dot';
    const title = document.createElement('span');
    title.className = 'malisa-sel-title';
    title.textContent = t('selectionPopupTitle', uiLang);
    titleWrap.append(dot, title);
    const closeBtn = createCloseButton();
    header.append(titleWrap, closeBtn);

    const body = document.createElement('div');
    body.className = 'malisa-sel-body';
    let selActions = null;

    if (mode === 'loading') {
      const loading = document.createElement('div');
      loading.className = 'malisa-sel-loading';
      const spinner = document.createElement('span');
      spinner.className = 'malisa-sel-spinner';
      const label = document.createElement('span');
      label.textContent = t('selectionTranslating', uiLang);
      loading.append(spinner, label);
      body.appendChild(loading);
    } else if (mode === 'error') {
      const err = document.createElement('div');
      err.className = 'malisa-sel-error';
      err.textContent = t('errorPrefix', uiLang) + (payload.error ?? '');
      body.appendChild(err);
    } else {
      const ttsSettings = await getTtsSettings();
      const withTts = ttsSettings.enabled;
      const original = payload.original ?? '';
      const translated = payload.translated ?? '';
      const targetLang = payload.targetLanguage ?? '';
      const sourceLang = guessPageLang();

      const origHeader = createSectionHeader(
        t('selectionOriginal', uiLang),
        original,
        sourceLang,
        withTts
      );
      const origText = document.createElement('div');
      origText.className = 'malisa-sel-text';
      origText.textContent = original;

      const transHeader = createSectionHeader(
        t('selectionTranslation', uiLang),
        translated,
        targetLang,
        withTts
      );
      const transText = document.createElement('div');
      transText.className = 'malisa-sel-text';
      transText.textContent = translated;

      body.append(origHeader, origText, transHeader, transText);
      selActions = await buildSelectionActions(original, translated);
    }

    if (selActions) panel.append(header, body, selActions);
    else panel.append(header, body);
    document.body.append(backdrop, panel);
    document.addEventListener('keydown', onSelectionPopupKeydown);
    closeBtn.focus();
  }

  function showOverlay(message) {
    let overlay = document.getElementById('ai-translator-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ai-translator-overlay';
      document.body.appendChild(overlay);
    }
    overlay.textContent = message;
    applyOverlayTheme(overlay);
  }

  function removeOverlay() {
    document.getElementById('ai-translator-overlay')?.remove();
  }

  function injectStyles() {
    if (document.getElementById('ai-translator-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-translator-styles';
    style.textContent = `
      #ai-translator-overlay {
        position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
        padding: 12px 20px; border-radius: 10px;
        font-family: system-ui, sans-serif; font-size: 14px;
        pointer-events: none;
      }`;
    document.head.appendChild(style);
  }

  async function refreshUiLang() {
    uiLang = await getUiLanguage();
  }

  async function startTranslation(targetLanguage) {
    await refreshUiLang();
    await loadTranslatorTheme();
    watchSystemOverlayTheme();
    if (!document.body) {
      showOverlay(t('pageNotReady', uiLang));
      setTimeout(removeOverlay, 2000);
      return;
    }

    injectStyles();
    showOverlay(t('collectingText', uiLang));

    activeTargetLanguage = targetLanguage;
    translationEpoch += 1;
    translationByText.clear();
    stopDomObserver();

    const textBlocks = extractBlocks();
    if (!textBlocks.length) {
      showOverlay(t('noTextToTranslate', uiLang));
      setTimeout(removeOverlay, 2000);
      return;
    }

    showOverlay(t('translatingOverlay', uiLang));

    browser.runtime.sendMessage(
      { type: 'TRANSLATE_PAGE', blocks: textBlocks, targetLanguage, epoch: translationEpoch },
      (response) => {
        if (browser.runtime.lastError) {
          showOverlay(t('errorPrefix', uiLang) + browser.runtime.lastError.message);
          setTimeout(removeOverlay, 4000);
          return;
        }
        if (!response?.ok) {
          showOverlay(t('errorPrefix', uiLang) + (response?.error ?? t('translationNotStarted', uiLang)));
          setTimeout(removeOverlay, 4000);
        }
      }
    );
  }

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'TRANSLATE_PAGE':
        startTranslation(message.targetLanguage);
        sendResponse({ ok: true });
        return false;
      case 'RESTORE_PAGE':
        restoreOriginal();
        removeOverlay();
        sendResponse({ ok: true });
        return false;
      case 'GET_STATUS':
        sendResponse({ isTranslated: translated, blockCount: blocks.length });
        return false;
      case 'APPLY_TRANSLATIONS':
        if (isStalePageMessage(message)) return false;
        applyPartialResults(message.results);
        return false;
      case 'TRANSLATION_PROGRESS':
        if (isStalePageMessage(message)) return false;
        refreshUiLang().then(() => {
          showOverlay(
            t('translatingProgress', uiLang, {
              done: message.done,
              total: message.total,
              pct: Math.round((message.done / message.total) * 100),
            })
          );
        });
        return false;
      case 'TRANSLATION_DONE':
        if (isStalePageMessage(message)) return false;
        refreshUiLang().then(() => {
          applyCachedTranslationsToDom();
          startDomObserver();
          showOverlay(t('translationDone', uiLang));
          setTimeout(removeOverlay, 1200);
        });
        return false;
      case 'TRANSLATION_ERROR':
        if (isStalePageMessage(message)) return false;
        refreshUiLang().then(() => {
          showOverlay(t('errorPrefix', uiLang) + message.error);
          setTimeout(removeOverlay, 4000);
        });
        return false;
      case 'SELECTION_TRANSLATING':
        showSelectionPopup('loading');
        return false;
      case 'SELECTION_TRANSLATED':
        showSelectionPopup('result', {
          original: message.original,
          translated: message.translated,
          targetLanguage: message.targetLanguage,
        });
        return false;
      case 'SELECTION_ERROR':
        showSelectionPopup('error', { error: message.error });
        return false;
    }
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.public_settings?.newValue) return;
    const next = changes.public_settings.newValue.translatorTheme;
    if (next) {
      translatorThemePref = next;
      watchSystemOverlayTheme();
      const overlay = document.getElementById('ai-translator-overlay');
      if (overlay) applyOverlayTheme(overlay);
      const sel = document.getElementById('malisa-selection-popup');
      if (sel) sel.dataset.theme = getSelectionTheme();
    }
  });

  refreshUiLang();
}
