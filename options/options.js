(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    list: $('rule-list'),
    listEmpty: $('list-empty'),
    search: $('search'),
    editor: $('editor'),
    placeholder: $('placeholder'),
    name: $('f-name'),
    enabled: $('f-enabled'),
    patterns: $('f-patterns'),
    patternErrors: $('pattern-errors'),
    test: $('f-test'),
    testResult: $('test-result'),
    css: $('f-css'),
    js: $('f-js'),
    runAt: $('f-runat'),
    world: $('f-world'),
    allFrames: $('f-allframes'),
    saveState: $('save-state'),
    toast: $('toast'),
  };

  let rules = [];
  let selectedId = null;
  let dirty = false;
  let saveTimer = null;
  let lastWritten = null;

  // ---------- helpers ----------
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function selected() {
    return rules.find((r) => r.id === selectedId) || null;
  }

  function patternsText(rule) {
    return Restyle.splitPatterns(rule.patterns).join('\n');
  }

  function firstPattern(rule) {
    return Restyle.splitPatterns(rule.patterns).map((p) => p.trim()).filter((p) => p && !p.startsWith('#'))[0] || 'no pattern';
  }

  async function persist() {
    clearTimeout(saveTimer);
    lastWritten = JSON.stringify(rules);
    await Restyle.saveRules(rules);
    dirty = false;
    els.saveState.textContent = 'Saved ✓';
    els.saveState.classList.add('saved');
  }

  function scheduleSave() {
    dirty = true;
    els.saveState.textContent = 'Saving…';
    els.saveState.classList.remove('saved');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  // ---------- list ----------
  function renderList() {
    const q = els.search.value.trim().toLowerCase();
    const shown = rules.filter((r) => {
      if (!q) return true;
      return [r.name, patternsText(r), r.css, r.js].join('\n').toLowerCase().includes(q);
    });

    els.list.textContent = '';
    els.listEmpty.classList.toggle('hidden', rules.length > 0);

    shown.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'rule-item' + (r.id === selectedId ? ' active' : '');
      li.style.animationDelay = Math.min(i, 12) * 15 + 'ms';
      li.addEventListener('click', () => select(r.id));

      const dot = document.createElement('span');
      dot.className = 'dot' + (r.enabled ? ' on' : '');
      dot.title = r.enabled ? 'Enabled' : 'Disabled';

      const body = document.createElement('div');
      body.className = 'ri-body';
      const name = document.createElement('div');
      name.className = 'ri-name';
      name.textContent = r.name || 'Untitled rule';
      const pat = document.createElement('div');
      pat.className = 'ri-pattern';
      pat.textContent = firstPattern(r);
      body.append(name, pat);

      const chips = document.createElement('div');
      chips.className = 'ri-chips';
      if (r.css && r.css.trim()) chips.append(chip('CSS', 'css'));
      if (r.js && r.js.trim()) chips.append(chip('JS', 'js'));

      li.append(dot, body, chips);
      els.list.append(li);
    });
  }

  function chip(text, cls) {
    const c = document.createElement('span');
    c.className = 'chip ' + cls;
    c.textContent = text;
    return c;
  }

  // ---------- editor ----------
  function select(id) {
    if (dirty) persist();
    selectedId = id;
    const url = new URL(location.href);
    if (id) url.searchParams.set('id', id); else url.searchParams.delete('id');
    url.searchParams.delete('new');
    history.replaceState(null, '', url);
    fillEditor();
    renderList();
  }

  function fillEditor() {
    const r = selected();
    els.editor.classList.toggle('hidden', !r);
    els.placeholder.classList.toggle('hidden', !!r);
    if (!r) return;

    els.name.value = r.name || '';
    els.enabled.checked = !!r.enabled;
    els.patterns.value = patternsText(r);
    els.css.value = r.css || '';
    els.js.value = r.js || '';
    els.runAt.value = r.runAt || 'document_idle';
    els.world.value = r.world || 'MAIN';
    els.allFrames.checked = !!r.allFrames;
    els.saveState.textContent = '';
    els.saveState.classList.remove('saved');
    validatePatterns();
    updateTest();
  }

  function readEditor() {
    const r = selected();
    if (!r) return;
    r.name = els.name.value;
    r.enabled = els.enabled.checked;
    r.patterns = els.patterns.value.split('\n');
    r.css = els.css.value;
    r.js = els.js.value;
    r.runAt = els.runAt.value;
    r.world = els.world.value;
    r.allFrames = els.allFrames.checked;
    r.updatedAt = Date.now();
  }

  function validatePatterns() {
    const bad = els.patterns.value.split('\n').filter((p) => !Restyle.isValidPattern(p));
    const empty = !els.patterns.value.split('\n').some((p) => p.trim() && !p.trim().startsWith('#'));
    els.patterns.classList.toggle('invalid', bad.length > 0);
    if (bad.length) {
      els.patternErrors.textContent = 'Invalid pattern: ' + bad.join(', ');
    } else if (empty) {
      els.patternErrors.textContent = 'Add at least one pattern – this rule currently matches nothing.';
    }
    els.patternErrors.classList.toggle('hidden', !bad.length && !empty);
  }

  function updateTest() {
    const r = selected();
    const url = els.test.value.trim();
    if (!r || !url) {
      els.testResult.textContent = '';
      els.testResult.className = 'test-result';
      return;
    }
    const ok = Restyle.ruleMatches(r, url);
    els.testResult.textContent = ok ? '✓ Matches' : '✗ No match';
    els.testResult.className = 'test-result ' + (ok ? 'yes' : 'no');
  }

  function onEdit() {
    readEditor();
    validatePatterns();
    updateTest();
    renderList();
    scheduleSave();
  }

  [els.name, els.patterns, els.css, els.js].forEach((el) => el.addEventListener('input', onEdit));
  [els.enabled, els.runAt, els.world, els.allFrames].forEach((el) => el.addEventListener('change', onEdit));
  els.test.addEventListener('input', updateTest);
  els.search.addEventListener('input', renderList);

  // Tab / Shift+Tab indentation in code areas.
  [els.css, els.js, els.patterns].forEach((ta) => {
    ta.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value } = ta;
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        if (value.slice(lineStart, lineStart + 2) === '  ') {
          ta.setRangeText('', lineStart, lineStart + 2, 'preserve');
          ta.setSelectionRange(Math.max(lineStart, s - 2), Math.max(lineStart, end - 2));
        }
      } else {
        ta.setRangeText('  ', s, end, 'end');
      }
      ta.dispatchEvent(new Event('input'));
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (selected()) {
        readEditor();
        persist().then(() => toast('Saved'));
      }
    }
  });

  // ---------- actions ----------
  function createRule(partial) {
    const r = Restyle.createRule(partial);
    rules.unshift(r);
    persist();
    select(r.id);
    els.name.focus();
    els.name.select();
    return r;
  }

  $('btn-new').addEventListener('click', () => createRule());

  $('btn-delete').addEventListener('click', async () => {
    const r = selected();
    if (!r) return;
    if (!confirm(`Delete rule "${r.name || 'Untitled rule'}"?`)) return;
    const idx = rules.indexOf(r);
    rules.splice(idx, 1);
    await persist();
    select(rules[Math.min(idx, rules.length - 1)]?.id || null);
    toast('Rule deleted');
  });

  $('btn-duplicate').addEventListener('click', () => {
    const r = selected();
    if (!r) return;
    const copy = JSON.parse(JSON.stringify(r));
    delete copy.id;
    copy.name = (r.name || 'Rule') + ' (copy)';
    createRule(copy);
    toast('Rule duplicated');
  });

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob(
      [JSON.stringify({ app: 'restyle', version: 1, exportedAt: new Date().toISOString(), rules }, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `restyle-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.rules;
      if (!Array.isArray(incoming)) throw new Error('No rules array found');
      const existingIds = new Set(rules.map((r) => r.id));
      let added = 0, replaced = 0;
      incoming.forEach((raw) => {
        const r = Restyle.createRule(raw);
        if (existingIds.has(r.id)) {
          rules[rules.findIndex((x) => x.id === r.id)] = r;
          replaced++;
        } else {
          rules.push(r);
          added++;
        }
      });
      await persist();
      renderList();
      fillEditor();
      toast(`Imported ${added} new, ${replaced} updated`);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  });

  $('open-ext-settings').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  });

  // ---------- userScripts availability ----------
  async function checkUserScripts() {
    const res = await chrome.runtime.sendMessage({ type: 'restyle:status' }).catch(() => null);
    const available = !!(res && res.userScripts);
    if (available) chrome.runtime.sendMessage({ type: 'restyle:sync' }).catch(() => {});
    $('us-banner').classList.toggle('hidden', available);
  }
  // Re-check when the user comes back from chrome://extensions.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkUserScripts();
  });

  // ---------- external changes (e.g. popup toggles) ----------
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.rules) return;
    const next = changes.rules.newValue || [];
    if (JSON.stringify(next) === lastWritten) return;
    if (dirty) {
      // Keep the in-progress edit of the selected rule, take everything else.
      const mine = selected();
      rules = next.map((r) => (mine && r.id === mine.id ? mine : r));
    } else {
      rules = next;
      fillEditor();
    }
    renderList();
  });

  // ---------- init ----------
  async function init() {
    rules = await Restyle.getRules();
    lastWritten = JSON.stringify(rules);
    const params = new URLSearchParams(location.search);

    if (params.has('new')) {
      const pageUrl = params.get('new');
      let host = '';
      try { host = new URL(pageUrl).hostname.replace(/^www\./, ''); } catch (e) {}
      createRule({ name: host || 'New rule', patterns: host ? [host] : [] });
      els.test.value = pageUrl;
      updateTest();
    } else {
      const id = params.get('id');
      selectedId = rules.some((r) => r.id === id) ? id : rules[0]?.id || null;
      fillEditor();
      renderList();
    }
    checkUserScripts();
  }

  window.addEventListener('beforeunload', () => {
    if (dirty) {
      readEditor();
      Restyle.saveRules(rules);
    }
  });

  init();
})();
