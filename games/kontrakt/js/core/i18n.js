/* RDE // KONTRAKT — languages. English is the source language: every visible text in the code is
 * English, wrapped in K.T('…') (with {placeholders}); js/lang/<code>.js maps English → translation.
 * Data tables (weapons, items, shops, outfits, barks…) are translated in place once at start-up.
 * Static HTML carries data-i18n attributes. The choice is stored with the settings; switching
 * languages saves and reloads the page so every generated name comes out in the new language. */
(function (K) {
  'use strict';
  const L = K.LANGS = { en: {} };
  K.LANG_NAMES = { en: 'English', de: 'Deutsch' };
  const pick = () => {
    if (typeof globalThis !== 'undefined' && globalThis.KONTRAKT_LANG) return globalThis.KONTRAKT_LANG;
    try { const s = JSON.parse(localStorage.getItem('kontrakt.settings.v1') || '{}'); if (s.lang) return s.lang; } catch (e) { /* no storage */ }
    return 'en';
  };
  K.lang = pick();
  K.addLang = (code, dict) => Object.assign(L[code] || (L[code] = {}), dict);
  /** translate an English source text; {name} placeholders are filled from vars */
  K.T = function (s, vars) {
    let o = s;
    if (K.lang !== 'en') { const d = L[K.lang]; if (d && d[s] != null) o = d[s]; else if (K.i18nMissing) K.i18nMissing(s); }
    if (vars) o = o.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return o;
  };
  K.tr = (s) => (typeof s === 'string' ? K.T(s) : s);

  // ---------------------------------------------------------------- data tables
  const KEYS = new Set(['name', 'desc', 'label', 'title', 'sub', 'text', 'hint', 'tip', 'info', 'group', 'short', 'unit']);
  const tables = [];
  /** register a data table: fields named like KEYS are display text (deep) */
  K.i18nData = (obj) => { if (obj) tables.push([obj, 'keys']); return obj; };
  /** register a table whose every string (deep) is display text (bark lists, district names…) */
  K.i18nStrings = (obj) => { if (obj) tables.push([obj, 'all']); return obj; };
  let done = null;
  K.localizeData = function () {
    if (done === K.lang) return;
    done = K.lang;
    const seen = new Set();
    const walk = (o, all) => {
      if (!o || typeof o !== 'object' || seen.has(o)) return;
      seen.add(o);
      if (!Object.prototype.hasOwnProperty.call(o, '__en')) Object.defineProperty(o, '__en', { value: {}, enumerable: false });
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (typeof v === 'string') {
          if (all || KEYS.has(k)) { if (!(k in o.__en)) o.__en[k] = v; o[k] = K.T(o.__en[k]); }
        } else if (v && typeof v === 'object') walk(v, all || (Array.isArray(v) && KEYS.has(k)));
      }
    };
    for (const [obj, mode] of tables) walk(obj, mode === 'all');
  };

  // ---------------------------------------------------------------- static HTML
  /** elements: data-i18n (innerHTML), data-i18n-title / -placeholder (attributes) */
  K.localizeDOM = function (root) {
    if (typeof document === 'undefined') return;
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach((el) => { if (el.dataset.en == null) el.dataset.en = el.innerHTML.trim(); el.innerHTML = K.T(el.dataset.en); });
    for (const a of ['title', 'placeholder']) r.querySelectorAll(`[data-i18n-${a}]`).forEach((el) => { const k = 'en' + a; if (el.dataset[k] == null) el.dataset[k] = el.getAttribute(a) || ''; el.setAttribute(a, K.T(el.dataset[k])); });
    if (r === document) document.documentElement.lang = K.lang;
  };
  /** BCP-47 tag for speech synthesis */
  K.langTag = () => ({ en: 'en-US', de: 'de-DE' }[K.lang] || 'en-US');
})(K);
