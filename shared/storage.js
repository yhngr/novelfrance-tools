const NFStorage = (() => {
  "use strict";

  const KEYS = {
    settings: "nf_settings",
    volumes: "nf_volumes",
    narratorLevels: "nf_narrator_levels",
    legacy: "nf_tts_volume",
  };

  const PROFILES = {
    nuit: {
      label: "Nuit",
      volume: 45,
      equalizer: { bass: -2, mid: -1, treble: -4 },
    },
    voixFaible: {
      label: "Voix faible",
      volume: 100,
      equalizer: { bass: 2, mid: 6, treble: 3 },
    },
    casque: {
      label: "Casque",
      volume: 75,
      equalizer: { bass: -1, mid: 2, treble: 1 },
    },
  };

  const DEFAULT_AUTO_SCROLL = {
    enabled: false,
    speed: 45,
    onlyWhenPlaying: false,
    pauseOnManualScroll: true,
    showFloatingControl: true,
  };

  const DEFAULT_SETTINGS = {
    defaultVolume: 100,
    sliderStep: 5,
    keyboardShortcuts: true,
    boostEnabled: false,
    maxBoost: 100,
    floatingControl: true,
    compactPresets: true,
    fadeEnabled: true,
    fadeDurationMs: 200,
    limiterEnabled: true,
    narratorNormalization: true,
    chapterEndNotification: true,
    keepAliveIntervalMs: 1500,
    equalizer: { bass: 0, mid: 0, treble: 0 },
    shortcuts: {
      mute: "m",
      volumeUp: "ArrowUp",
      volumeDown: "ArrowDown",
      toggleAutoScroll: "s",
    },
    autoScroll: { ...DEFAULT_AUTO_SCROLL },
    floatingPosition: null,
    autoScrollPosition: null,
    sites: ["*://novelfrance.fr/*", "*://*.novelfrance.fr/*"],
  };

  const DEFAULT_VOLUMES = {
    global: 100,
    byNovel: {},
    byNarrator: {},
  };

  function mergeSettings(raw) {
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      equalizer: { ...DEFAULT_SETTINGS.equalizer, ...(raw?.equalizer || {}) },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(raw?.shortcuts || {}) },
      autoScroll: { ...DEFAULT_AUTO_SCROLL, ...(raw?.autoScroll || {}) },
      sites: raw?.sites?.length ? raw.sites : DEFAULT_SETTINGS.sites,
    };
  }

  function mergeVolumes(raw) {
    return {
      ...DEFAULT_VOLUMES,
      ...raw,
      byNovel: { ...DEFAULT_VOLUMES.byNovel, ...(raw?.byNovel || {}) },
      byNarrator: { ...DEFAULT_VOLUMES.byNarrator, ...(raw?.byNarrator || {}) },
    };
  }

  function getSync(keys) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, resolve);
    });
  }

  function setSync(data) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, resolve);
    });
  }

  async function migrateLegacy() {
    const data = await getSync([KEYS.legacy, KEYS.volumes]);
    if (typeof data[KEYS.legacy] === "number" && !data[KEYS.volumes]) {
      const global = Math.round(data[KEYS.legacy] * 100);
      await setSync({
        [KEYS.volumes]: { ...DEFAULT_VOLUMES, global },
      });
      await new Promise((resolve) => {
        chrome.storage.sync.remove(KEYS.legacy, resolve);
      });
    }
  }

  function maxAllowedVolume(settings) {
    if (settings?.boostEnabled) {
      return settings.maxBoost || 100;
    }
    return 100;
  }

  async function getSettings() {
    await migrateLegacy();
    const data = await getSync(KEYS.settings);
    const settings = mergeSettings(data[KEYS.settings]);
    const raw = data[KEYS.settings];

    if (raw && (raw.boostEnabled || (raw.maxBoost && raw.maxBoost > 100))) {
      const capped = { ...settings, boostEnabled: false, maxBoost: 100 };
      await setSync({ [KEYS.settings]: capped });
      return capped;
    }

    return settings;
  }

  async function saveSettings(settings) {
    await setSync({ [KEYS.settings]: mergeSettings(settings) });
  }

  async function getVolumes() {
    await migrateLegacy();
    const data = await getSync(KEYS.volumes);
    return mergeVolumes(data[KEYS.volumes]);
  }

  async function saveVolumes(volumes) {
    await setSync({ [KEYS.volumes]: mergeVolumes(volumes) });
  }

  async function getNarratorLevels() {
    const data = await getSync(KEYS.narratorLevels);
    return data[KEYS.narratorLevels] || {};
  }

  async function saveNarratorLevel(narrator, rms) {
    const levels = await getNarratorLevels();
    const previous = levels[narrator];
    levels[narrator] = previous ? previous * 0.7 + rms * 0.3 : rms;
    await setSync({ [KEYS.narratorLevels]: levels });
    return levels;
  }

  function resolveVolume(volumes, novelSlug, narrator, settings) {
    if (narrator && volumes.byNarrator[narrator] != null) {
      return volumes.byNarrator[narrator];
    }
    if (novelSlug && volumes.byNovel[novelSlug] != null) {
      return volumes.byNovel[novelSlug];
    }
    if (volumes.global != null) {
      return volumes.global;
    }
    return settings.defaultVolume;
  }

  function getNarratorMultiplier(narrator, levels, enabled) {
    if (!enabled || !narrator || !levels[narrator]) {
      return 1;
    }
    const target = 0.07;
    const measured = levels[narrator];
    return Math.min(2, Math.max(0.5, target / measured));
  }

  async function getVolumeForContext(novelSlug, narrator) {
    const [settings, volumes, narratorLevels] = await Promise.all([
      getSettings(),
      getVolumes(),
      getNarratorLevels(),
    ]);
    const baseVolume = resolveVolume(volumes, novelSlug, narrator, settings);
    const multiplier = getNarratorMultiplier(narrator, narratorLevels, settings.narratorNormalization);
    const max = maxAllowedVolume(settings);
    return {
      settings,
      volumes,
      narratorLevels,
      volume: Math.min(max, Math.round(baseVolume * multiplier)),
      baseVolume: Math.min(max, baseVolume),
      narratorMultiplier: multiplier,
    };
  }

  async function saveVolumeForContext(percent, novelSlug, narrator, narratorMultiplier) {
    const volumes = await getVolumes();
    const stored = narratorMultiplier && narratorMultiplier !== 1
      ? Math.round(percent / narratorMultiplier)
      : percent;
    volumes.global = stored;
    if (novelSlug) {
      volumes.byNovel[novelSlug] = stored;
    }
    if (narrator) {
      volumes.byNarrator[narrator] = stored;
    }
    await saveVolumes(volumes);
    return volumes;
  }

  function extractNovelSlug() {
    const match = window.location.pathname.match(/\/novel\/([^/]+)/);
    return match ? match[1] : null;
  }

  function detectNarrator(section) {
    if (!section) {
      return null;
    }

    const voiceBtn = section.querySelector('[aria-label="Choisir la voix"]');
    if (voiceBtn) {
      const label = voiceBtn.textContent.trim();
      if (label && !/choisir/i.test(label)) {
        return label.replace(/\s+/g, " ");
      }
    }

    const title = section.querySelector(".min-w-0.flex-1 p.text-sm.font-medium");
    if (title) {
      const text = title.textContent.trim();
      if (text && !/écouter/i.test(text) && text.length < 40) {
        return text;
      }
    }

    return null;
  }

  function isTtsPlaying() {
    const audio = document.querySelector('section[aria-label="Lecture audio du chapitre"] audio');
    return Boolean(audio && !audio.paused && !audio.ended);
  }

  return {
    KEYS,
    PROFILES,
    DEFAULT_SETTINGS,
    DEFAULT_AUTO_SCROLL,
    getSettings,
    saveSettings,
    getVolumes,
    saveVolumes,
    getNarratorLevels,
    saveNarratorLevel,
    getNarratorMultiplier,
    getVolumeForContext,
    saveVolumeForContext,
    extractNovelSlug,
    detectNarrator,
    isTtsPlaying,
  };
})();
