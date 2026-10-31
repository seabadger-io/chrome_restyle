/**
 * Runs at document_start in every frame. Injects the CSS of all enabled
 * rules whose pattern matches the current URL, and keeps it in sync with
 * storage changes and SPA navigations (no reload needed for CSS).
 * JavaScript is handled by the userScripts API in background.js.
 */
(function () {
  'use strict';

  const STYLE_ID = '__restyle_ext_style__';
  const isTop = window.top === window;
  let rules = [];
  let lastUrl = location.href;

  function getStyleEl() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.setAttribute('data-restyle', '');
    }
    // Keep our sheet last in the document so it wins cascade ties.
    const parent = document.head || document.documentElement;
    if (parent && (el.parentNode !== parent || el.nextElementSibling)) {
      parent.appendChild(el);
    }
    return el;
  }

  function apply() {
    const url = location.href;
    const css = rules
      .filter((r) => r.enabled && r.css && r.css.trim())
      .filter((r) => isTop || r.allFrames)
      .filter((r) => Restyle.ruleMatches(r, url))
      .map((r) => `/* Restyle: ${String(r.name).replace(/\*\//g, '')} */\n${r.css}`)
      .join('\n\n');

    const existing = document.getElementById(STYLE_ID);
    if (!css) {
      if (existing) existing.remove();
      return;
    }
    const el = getStyleEl();
    if (el.textContent !== css) el.textContent = css;
  }

  async function load() {
    try {
      rules = await Restyle.getRules();
    } catch (e) {
      rules = [];
    }
    apply();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.rules) {
      rules = changes.rules.newValue || [];
      apply();
    }
  });

  // SPA navigations (pushState / replaceState) – re-evaluate patterns.
  function onMaybeNavigated() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      apply();
    }
  }
  if (window.navigation && typeof window.navigation.addEventListener === 'function') {
    window.navigation.addEventListener('navigatesuccess', onMaybeNavigated);
  }
  window.addEventListener('popstate', onMaybeNavigated);
  window.addEventListener('hashchange', onMaybeNavigated);

  // At document_start <head> may not exist yet; once it does, move the
  // style into it (and to the end) so later page styles don't override it.
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById(STYLE_ID)) getStyleEl();
  });

  load();
})();
