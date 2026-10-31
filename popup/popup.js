(async function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (tab && tab.url) || '';
  let host = '';
  try { host = new URL(url).hostname; } catch (e) {}
  const supported = /^(https?|file):/.test(url);

  $('host').textContent = host || url || 'Unknown page';

  function openOptions(params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html' + q) });
    window.close();
  }

  $('btn-manage').addEventListener('click', () => openOptions());
  $('btn-new').addEventListener('click', () => openOptions({ new: url }));
  $('btn-reload').addEventListener('click', () => {
    if (tab) chrome.tabs.reload(tab.id);
    window.close();
  });
  $('open-ext-settings').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  });

  if (!supported) {
    $('unsupported').classList.remove('hidden');
    $('btn-new').disabled = true;
    $('btn-reload').disabled = true;
    return;
  }

  const status = await chrome.runtime.sendMessage({ type: 'restyle:status' }).catch(() => ({}));
  // Re-sync in case the user just enabled the userScripts toggle.
  if (status && status.userScripts) chrome.runtime.sendMessage({ type: 'restyle:sync' }).catch(() => {});

  async function render() {
    const rules = await Restyle.getRules();
    const matching = rules.filter((r) => Restyle.ruleMatches(r, url));
    const list = $('rules');
    list.textContent = '';

    $('count').textContent = matching.filter((r) => r.enabled).length;
    $('empty').classList.toggle('hidden', matching.length > 0);

    const needsUs = matching.some((r) => r.enabled && r.js && r.js.trim());
    $('us-banner').classList.toggle('hidden', !(needsUs && status && status.userScripts === false));

    matching.forEach((rule, i) => {
      const li = document.createElement('li');
      li.className = 'rule' + (rule.enabled ? '' : ' off');
      li.style.animationDelay = i * 30 + 'ms';

      const main = document.createElement('div');
      main.className = 'rule-main';
      main.title = 'Edit rule';
      main.addEventListener('click', () => openOptions({ id: rule.id }));

      const name = document.createElement('div');
      name.className = 'rule-name';
      name.textContent = rule.name || 'Untitled rule';

      const meta = document.createElement('div');
      meta.className = 'rule-meta';
      if (rule.css && rule.css.trim()) meta.append(chip('CSS', 'css'));
      if (rule.js && rule.js.trim()) meta.append(chip('JS', 'js'));
      const pat = document.createElement('span');
      pat.className = 'rule-pattern';
      pat.textContent = Restyle.splitPatterns(rule.patterns).filter((p) => p.trim()).join(', ');
      meta.append(pat);

      main.append(name, meta);

      const sw = document.createElement('label');
      sw.className = 'switch';
      sw.title = rule.enabled ? 'Disable' : 'Enable';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!rule.enabled;
      input.addEventListener('change', async () => {
        const all = await Restyle.getRules();
        const r = all.find((x) => x.id === rule.id);
        if (r) {
          r.enabled = input.checked;
          r.updatedAt = Date.now();
          await Restyle.saveRules(all);
        }
        render();
      });
      const track = document.createElement('span');
      track.className = 'track';
      sw.append(input, track);

      li.append(main, sw);
      list.append(li);
    });
  }

  function chip(text, cls) {
    const c = document.createElement('span');
    c.className = 'chip ' + cls;
    c.textContent = text;
    return c;
  }

  render();
})();
