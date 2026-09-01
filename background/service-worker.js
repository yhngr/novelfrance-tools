const CONTENT_SCRIPT_ID = "nf-tools";
const CONTENT_MATCHES = ["https://novelfrance.fr/*", "https://*.novelfrance.fr/*"];

const SCRIPT_FILES = [
  "shared/storage.js",
  "features/volume/audio-engine.js",
  "features/volume/content.js",
  "features/autoscroll/content.js",
  "features/reader/content.js",
];

const STYLE_FILES = [
  "features/volume/volume.css",
  "features/autoscroll/autoscroll.css",
  "features/reader/reader.css",
];

async function registerContentScripts() {
  const registeredScripts = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });
  if (registeredScripts.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: CONTENT_MATCHES,
      js: SCRIPT_FILES,
      css: STYLE_FILES,
      runAt: "document_idle",
    },
  ]);
}

function updateBadge(text, muted) {
  chrome.action.setBadgeText({ text: text || "" });
  chrome.action.setBadgeBackgroundColor({ color: muted ? "#52525b" : "#e11d48" });
}

chrome.runtime.onInstalled.addListener(() => {
  registerContentScripts()
    .then(() => updateBadge("", false))
    .catch((error) => console.error("NovelFrance Tools: content script registration failed", error));
});

chrome.runtime.onStartup.addListener(() => {
  registerContentScripts().catch((error) =>
    console.error("NovelFrance Tools: content script registration failed", error)
  );
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
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
