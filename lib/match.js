/**
 * Shared URL-pattern matching + storage helpers.
 * Loaded in the content script, the service worker (importScripts),
 * the popup and the options page. Exposes `globalThis.Restyle`.
 *
 * Pattern syntax (one pattern per line in a rule):
 *   hackthebox.com              bare domain -> that domain and all subdomains, any scheme/path
 *   *://*.hackthebox.com/*      wildcard: `*` matches anything; `*.` before a host
 *                               also matches the bare host (like Chrome match patterns)
 *   https://example.com/docs/*  any other wildcard URL
 *   /^https:\/\/x\.com\/a/i     a JavaScript regular expression wrapped in slashes
 *   # comment                   lines starting with # are ignored
 */
(function () {
  'use strict';

  const SUBDOMAIN_TOKEN = '\u0000';

  function escapeRegExp(ch) {
    return /[.*+?^${}()|[\]\\\/]/.test(ch) ? '\\' + ch : ch;
  }

  /** Converts a single pattern string to { source, flags } or null when empty/invalid. */
  function compilePattern(raw) {
    let p = (raw || '').trim();
    if (!p || p.startsWith('#')) return null;

    // Regex form: /.../flags
    const regexForm = /^\/(.+)\/([a-z]*)$/.exec(p);
    if (regexForm) {
      try {
        new RegExp(regexForm[1], regexForm[2]);
        return { source: regexForm[1], flags: regexForm[2] };
      } catch (e) {
        return null;
      }
    }

    // Bare domain convenience: "example.com" -> "*://*.example.com/*"
    if (!p.includes('://')) {
      if (!p.includes('/')) {
        p = '*://' + (p.startsWith('*.') ? p : '*.' + p) + '/*';
      } else {
        p = '*://' + p;
      }
    }

    p = p.replace('://*.', '://' + SUBDOMAIN_TOKEN);

    let source = '';
    // A leading "*://" must only match a scheme, not "https://evil.com/?r=https".
    if (p.startsWith('*://')) {
      source = '[a-z][a-z0-9+.-]*';
      p = p.slice(1);
    }
    for (const ch of p) {
      if (ch === '*') source += '.*';
      else if (ch === SUBDOMAIN_TOKEN) source += '(?:[^/?#]*\\.)?';
      else source += escapeRegExp(ch);
    }
    return { source: '^' + source + '$', flags: 'i' };
  }

  function splitPatterns(patterns) {
    if (Array.isArray(patterns)) return patterns;
    return String(patterns || '').split('\n');
  }

  /** Returns a list of { source, flags } for every valid pattern of a rule. */
  function compileRule(rule) {
    return splitPatterns(rule.patterns).map(compilePattern).filter(Boolean);
  }

  function urlMatches(url, compiled) {
    return compiled.some(({ source, flags }) => {
      try {
        return new RegExp(source, flags).test(url);
      } catch (e) {
        return false;
      }
    });
  }

  function ruleMatches(rule, url) {
    return urlMatches(url, compileRule(rule));
  }

  function isValidPattern(raw) {
    const p = (raw || '').trim();
    return !p || p.startsWith('#') || compilePattern(p) !== null;
  }

  function newId() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  }

  function createRule(partial = {}) {
    return Object.assign(
      {
        id: newId(),
        name: 'New rule',
        enabled: true,
        patterns: [],
        css: '',
        js: '',
        runAt: 'document_idle', // document_start | document_end | document_idle (JS only)
        world: 'MAIN',          // MAIN (page context) | USER_SCRIPT (isolated)
        allFrames: false,
        updatedAt: Date.now(),
      },
      partial
    );
  }

  async function getRules() {
    const { rules } = await chrome.storage.local.get('rules');
    return Array.isArray(rules) ? rules : [];
  }

  async function saveRules(rules) {
    await chrome.storage.local.set({ rules });
  }

  globalThis.Restyle = {
    compilePattern,
    compileRule,
    urlMatches,
    ruleMatches,
    isValidPattern,
    splitPatterns,
    createRule,
    getRules,
    saveRules,
  };
})();
