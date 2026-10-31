/**
 * Service worker: seeds default rules and keeps chrome.userScripts
 * registrations in sync with the stored rules (for custom JavaScript).
 */
importScripts('lib/match.js');

const SCRIPT_PREFIX = 'restyle-';

/** True when the userScripts API is usable (user enabled "Allow User Scripts"/Developer mode). */
async function userScriptsAvailable() {
  try {
    if (!chrome.userScripts) return false;
    await chrome.userScripts.getScripts();
    return true;
  } catch (e) {
    return false;
  }
}

function buildUserScriptCode(rule) {
  const compiled = Restyle.compileRule(rule);
  const label = JSON.stringify(String(rule.name));
  // Matching is done in-page so all pattern syntaxes (incl. regex) behave
  // exactly like the CSS side.
  return `(() => {
  const __patterns = ${JSON.stringify(compiled)};
  const __url = location.href;
  if (!__patterns.some(p => { try { return new RegExp(p.source, p.flags).test(__url); } catch (e) { return false; } })) return;
  try {
${rule.js}
  } catch (err) {
    console.error('[Restyle] Error in rule ' + ${label} + ':', err);
  }
})();
//# sourceURL=restyle://${encodeURIComponent(rule.name || rule.id)}.js`;
}

let syncing = Promise.resolve();

function syncUserScripts() {
  // Serialise syncs so rapid edits can't interleave register/unregister.
  syncing = syncing.then(doSync, doSync);
  return syncing;
}

async function doSync() {
  if (!(await userScriptsAvailable())) return;

  const rules = await Restyle.getRules();
  const wanted = rules.filter(
    (r) => r.enabled && r.js && r.js.trim() && Restyle.compileRule(r).length
  );

  const existing = await chrome.userScripts.getScripts();
  const ownIds = existing.map((s) => s.id).filter((id) => id.startsWith(SCRIPT_PREFIX));
  if (ownIds.length) await chrome.userScripts.unregister({ ids: ownIds });

  if (!wanted.length) return;

  const scripts = wanted.map((r) => ({
    id: SCRIPT_PREFIX + r.id,
    matches: ['<all_urls>'],
    js: [{ code: buildUserScriptCode(r) }],
    runAt: r.runAt || 'document_idle',
    world: r.world === 'USER_SCRIPT' ? 'USER_SCRIPT' : 'MAIN',
    allFrames: !!r.allFrames,
  }));

  try {
    await chrome.userScripts.register(scripts);
  } catch (e) {
    // Register one by one so a single bad rule doesn't block the rest.
    for (const s of scripts) {
      try {
        await chrome.userScripts.register([s]);
      } catch (err) {
        console.error('[Restyle] Failed to register', s.id, err);
      }
    }
  }
}

chrome.runtime.onInstalled.addListener(syncUserScripts);

chrome.runtime.onStartup.addListener(syncUserScripts);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.rules) syncUserScripts();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'restyle:status') {
    userScriptsAvailable().then((available) => sendResponse({ userScripts: available }));
    return true;
  }
  if (msg && msg.type === 'restyle:sync') {
    syncUserScripts().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Badge with the number of active rules on the current tab.
async function updateBadge(tabId, url) {
  if (!url || !/^(https?|file):/.test(url)) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const rules = await Restyle.getRules();
  const n = rules.filter((r) => r.enabled && Restyle.ruleMatches(r, url)).length;
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#6d5efc' });
  chrome.action.setBadgeTextColor?.({ tabId, color: '#ffffff' });
  chrome.action.setBadgeText({ tabId, text: n ? String(n) : '' });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === 'loading') updateBadge(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updateBadge(tabId, tab.url);
  } catch (e) {}
});
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.rules) return;
  const tabs = await chrome.tabs.query({});
  tabs.forEach((t) => updateBadge(t.id, t.url));
});
