importScripts("../shared/storage.js");

const CONTENT_SCRIPT_ID = "nf-tools";

const SCRIPT_FILES = [
  "shared/storage.js",
  "features/volume/audio-engine.js",
  "features/volume/content.js",
  "features/autoscroll/content.js",
];

const STYLE_FILES = [
  "features/volume/volume.css",
  "features/autoscroll/autoscroll.css",
];

async function registerContentScripts() {
  const settings = await NFStorage.getSettings();

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  } catch (_error) {
    // Script not registered yet.
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: settings.sites,
      js: SCRIPT_FILES,
      css: STYLE_FILES,
      runAt: "document_idle",
    },
  ]);
}

async function ensureHostPermissions(sites) {
  const optional = await chrome.permissions.getAll();
  const known = new Set(optional.origins || []);
  const missing = sites.filter((site) => site.includes("*://*/*") && !known.has("*://*/*"));

  if (missing.length) {
    await chrome.permissions.request({ origins: missing });
  }
}

function updateBadge(text, muted) {
  chrome.action.setBadgeText({ text: text || "" });
  chrome.action.setBadgeBackgroundColor({ color: muted ? "#52525b" : "#e11d48" });
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await NFStorage.getSettings();
  await ensureHostPermissions(settings.sites);
  await registerContentScripts();
  updateBadge("", false);
});

chrome.runtime.onStartup.addListener(() => {
  registerContentScripts();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.nf_settings) {
    registerContentScripts();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "NF_REREGISTER_SCRIPTS") {
    registerContentScripts().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "NF_BADGE_UPDATE" || message.type === "NF_VOLUME_CHANGED") {
    const muted = message.muted || message.volume === 0;
    const text = muted ? "M" : String(message.volume ?? "");
    updateBadge(text, muted);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "NF_CHAPTER_ENDED") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Chapitre terminé",
      message: message.title || "La lecture audio est terminée.",
    });
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
