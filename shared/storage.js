const NFStorage = (() => {
  "use strict";

  const KEYS = {
    settings: "nf_settings",
    volumes: "nf_volumes",
    narratorLevels: "nf_narrator_levels",
    readerState: "nf_reader_state",
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

  const DEFAULT_READER = {
    showProgressBar: true,
    showFloatingPanel: true,
    autoNextChapter: false,
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
      seekBackward: "j",
      seekForward: "l",
      rateDown: "[",
      rateUp: "]",
    },
    autoScroll: { ...DEFAULT_AUTO_SCROLL },
    reader: { ...DEFAULT_READER },
    floatingPosition: null,
    autoScrollPosition: null,
    readerPanelPosition: null,
  };

  const DEFAULT_VOLUMES = {
    global: 100,
    byNovel: {},
    byNarrator: {},
  };

  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  function booleanValue(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function shortcutValue(value, fallback) {
    if (typeof value !== "string") {
      return fallback;
    }
    const normalized = value.trim().slice(0, 20);
    return normalized || fallback;
  }

  function positionValue(value) {
    if (!value || !Number.isFinite(value.left) || !Number.isFinite(value.top)) {
      return null;
    }
    return { left: value.left, top: value.top };
  }

  function mergeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const equalizer = source.equalizer && typeof source.equalizer === "object" ? source.equalizer : {};
    const shortcuts = source.shortcuts && typeof source.shortcuts === "object" ? source.shortcuts : {};
    const autoScroll = source.autoScroll && typeof source.autoScroll === "object" ? source.autoScroll : {};
    const reader = source.reader && typeof source.reader === "object" ? source.reader : {};

    return {
      defaultVolume: clampNumber(source.defaultVolume, DEFAULT_SETTINGS.defaultVolume, 0, 100),
      sliderStep: clampNumber(source.sliderStep, DEFAULT_SETTINGS.sliderStep, 1, 20),
      keyboardShortcuts: booleanValue(source.keyboardShortcuts, DEFAULT_SETTINGS.keyboardShortcuts),
      boostEnabled: booleanValue(source.boostEnabled, DEFAULT_SETTINGS.boostEnabled),
      maxBoost: clampNumber(source.maxBoost, DEFAULT_SETTINGS.maxBoost, 100, 300),
      floatingControl: booleanValue(source.floatingControl, DEFAULT_SETTINGS.floatingControl),
      compactPresets: booleanValue(source.compactPresets, DEFAULT_SETTINGS.compactPresets),
      fadeEnabled: booleanValue(source.fadeEnabled, DEFAULT_SETTINGS.fadeEnabled),
      fadeDurationMs: clampNumber(source.fadeDurationMs, DEFAULT_SETTINGS.fadeDurationMs, 0, 2000),
      limiterEnabled: booleanValue(source.limiterEnabled, DEFAULT_SETTINGS.limiterEnabled),
      narratorNormalization: booleanValue(
        source.narratorNormalization,
        DEFAULT_SETTINGS.narratorNormalization
      ),
      chapterEndNotification: booleanValue(
        source.chapterEndNotification,
        DEFAULT_SETTINGS.chapterEndNotification
      ),
      keepAliveIntervalMs: clampNumber(
        source.keepAliveIntervalMs,
        DEFAULT_SETTINGS.keepAliveIntervalMs,
        250,
        10000
      ),
      equalizer: {
        bass: clampNumber(equalizer.bass, DEFAULT_SETTINGS.equalizer.bass, -12, 12),
        mid: clampNumber(equalizer.mid, DEFAULT_SETTINGS.equalizer.mid, -12, 12),
        treble: clampNumber(equalizer.treble, DEFAULT_SETTINGS.equalizer.treble, -12, 12),
      },
      shortcuts: {
        mute: shortcutValue(shortcuts.mute, DEFAULT_SETTINGS.shortcuts.mute),
        volumeUp: shortcutValue(shortcuts.volumeUp, DEFAULT_SETTINGS.shortcuts.volumeUp),
        volumeDown: shortcutValue(shortcuts.volumeDown, DEFAULT_SETTINGS.shortcuts.volumeDown),
        toggleAutoScroll: shortcutValue(
          shortcuts.toggleAutoScroll,
          DEFAULT_SETTINGS.shortcuts.toggleAutoScroll
        ),
        seekBackward: shortcutValue(shortcuts.seekBackward, DEFAULT_SETTINGS.shortcuts.seekBackward),
        seekForward: shortcutValue(shortcuts.seekForward, DEFAULT_SETTINGS.shortcuts.seekForward),
        rateDown: shortcutValue(shortcuts.rateDown, DEFAULT_SETTINGS.shortcuts.rateDown),
        rateUp: shortcutValue(shortcuts.rateUp, DEFAULT_SETTINGS.shortcuts.rateUp),
      },
      autoScroll: {
        enabled: booleanValue(autoScroll.enabled, DEFAULT_AUTO_SCROLL.enabled),
        speed: clampNumber(autoScroll.speed, DEFAULT_AUTO_SCROLL.speed, 10, 160),
        onlyWhenPlaying: booleanValue(autoScroll.onlyWhenPlaying, DEFAULT_AUTO_SCROLL.onlyWhenPlaying),
        pauseOnManualScroll: booleanValue(
          autoScroll.pauseOnManualScroll,
          DEFAULT_AUTO_SCROLL.pauseOnManualScroll
        ),
        showFloatingControl: booleanValue(
          autoScroll.showFloatingControl,
          DEFAULT_AUTO_SCROLL.showFloatingControl
        ),
      },
      reader: {
        showProgressBar: booleanValue(reader.showProgressBar, DEFAULT_READER.showProgressBar),
        showFloatingPanel: booleanValue(reader.showFloatingPanel, DEFAULT_READER.showFloatingPanel),
        autoNextChapter: booleanValue(reader.autoNextChapter, DEFAULT_READER.autoNextChapter),
      },
      floatingPosition: positionValue(source.floatingPosition),
      autoScrollPosition: positionValue(source.autoScrollPosition),
      readerPanelPosition: positionValue(source.readerPanelPosition),
    };
  }

  function mergeVolumes(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const sanitizeMap = (value) => {
      if (!value || typeof value !== "object") {
        return {};
      }
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key, level]) => key.length <= 200 && Number.isFinite(Number(level)))
          .map(([key, level]) => [key, clampNumber(level, 100, 0, 600)])
      );
    };

    return {
      global: clampNumber(source.global, DEFAULT_VOLUMES.global, 0, 600),
      byNovel: sanitizeMap(source.byNovel),
      byNarrator: sanitizeMap(source.byNarrator),
    };
  }

  function sanitizeNarratorLevels(raw) {
    if (!raw || typeof raw !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([key, level]) => key.length <= 200 && Number.isFinite(Number(level)))
        .map(([key, level]) => [key, clampNumber(level, 0.07, 0.0001, 1)])
    );
  }

  function sanitizeReaderState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const rawProgress = source.progressByChapter && typeof source.progressByChapter === "object"
      ? source.progressByChapter
      : {};
    const rawRates = source.playbackRateByNovel && typeof source.playbackRateByNovel === "object"
      ? source.playbackRateByNovel
      : {};

    const progressByChapter = Object.fromEntries(
      Object.entries(rawProgress)
        .filter(([key, value]) =>
          typeof key === "string" &&
          key.length <= 500 &&
          /^\/novel\/[^/]+\/chapter-[^/?#]+/.test(key) &&
          value &&
          typeof value === "object" &&
          Number.isFinite(Number(value.scrollY)) &&
          Number.isFinite(Number(value.percent))
        )
        .map(([key, value]) => [
          key,
          {
            scrollY: clampNumber(value.scrollY, 0, 0, 10000000),
            percent: clampNumber(value.percent, 0, 0, 100),
            updatedAt: clampNumber(value.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
          },
        ])
        .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, 200)
    );

    const playbackRateByNovel = Object.fromEntries(
      Object.entries(rawRates)
        .filter(([key, value]) =>
          typeof key === "string" &&
          /^[a-z0-9-]{1,200}$/i.test(key) &&
          Number.isFinite(Number(value))
        )
        .slice(-200)
        .map(([key, value]) => [key, clampNumber(value, 1, 0.75, 2)])
    );

    return { progressByChapter, playbackRateByNovel };
  }

  let contextInvalidated = false;
  const invalidationCallbacks = new Set();

  function isContextInvalidatedError(error) {
    const message = error?.message || String(error || "");
    return /extension context invalidated|context invalidated/i.test(message);
  }

  function notifyContextInvalidated() {
    invalidationCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (_error) {
        /* ignore teardown errors */
      }
    });
    invalidationCallbacks.clear();
  }

  function markContextInvalidated() {
    if (contextInvalidated) {
      return;
    }
    contextInvalidated = true;
    notifyContextInvalidated();
  }

  function isContextValid() {
    if (contextInvalidated) {
      return false;
    }
    try {
      return Boolean(chrome.runtime?.id);
    } catch (_error) {
      markContextInvalidated();
      return false;
    }
  }

  function onContextInvalidated(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    if (contextInvalidated) {
      callback();
      return () => {};
    }
    invalidationCallbacks.add(callback);
    return () => invalidationCallbacks.delete(callback);
  }

  function storageCallback(resolve, reject, fallback) {
    return (result) => {
      if (!isContextValid()) {
        markContextInvalidated();
        resolve(fallback);
        return;
      }
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        if (isContextInvalidatedError(runtimeError)) {
          markContextInvalidated();
          resolve(fallback);
          return;
        }
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(result ?? fallback);
    };
  }

  function runStorageCall(area, method, payload, fallback) {
    if (!isContextValid()) {
      return Promise.resolve(fallback);
    }
    return new Promise((resolve, reject) => {
      try {
        const callback = storageCallback(resolve, reject, fallback);
        if (method === "get") {
          chrome.storage[area].get(payload, callback);
        } else if (method === "set") {
          chrome.storage[area].set(payload, callback);
        } else {
          chrome.storage[area].remove(payload, callback);
        }
      } catch (error) {
        if (isContextInvalidatedError(error)) {
          markContextInvalidated();
          resolve(fallback);
        } else {
          reject(error);
        }
      }
    });
  }

  function getArea(area, keys) {
    return runStorageCall(area, "get", keys, {});
  }

  function setArea(area, data) {
    return runStorageCall(area, "set", data, undefined);
  }

  function removeArea(area, keys) {
    return runStorageCall(area, "remove", keys, undefined);
  }

  let migrationPromise = null;

  function ensureLocalDataMigrated() {
    if (!isContextValid()) {
      return Promise.resolve();
    }
    if (migrationPromise) {
      return migrationPromise;
    }

    migrationPromise = (async () => {
      const keys = [KEYS.legacy, KEYS.volumes, KEYS.narratorLevels];
      const [syncData, localData] = await Promise.all([
        getArea("sync", keys),
        getArea("local", [KEYS.volumes, KEYS.narratorLevels]),
      ]);
      if (!isContextValid()) {
        return;
      }
      const localWrites = {};

      if (!localData[KEYS.volumes]) {
        if (syncData[KEYS.volumes]) {
          localWrites[KEYS.volumes] = mergeVolumes(syncData[KEYS.volumes]);
        } else if (typeof syncData[KEYS.legacy] === "number") {
          localWrites[KEYS.volumes] = {
            ...DEFAULT_VOLUMES,
            global: Math.round(syncData[KEYS.legacy] * 100),
          };
        }
      }

      if (!localData[KEYS.narratorLevels] && syncData[KEYS.narratorLevels]) {
        localWrites[KEYS.narratorLevels] = sanitizeNarratorLevels(syncData[KEYS.narratorLevels]);
      }

      if (Object.keys(localWrites).length) {
        await setArea("local", localWrites);
      }

      const syncKeysToRemove = keys.filter(
        (key) => syncData[key] !== null && syncData[key] !== undefined
      );
      if (syncKeysToRemove.length) {
        await removeArea("sync", syncKeysToRemove);
      }
    })().catch((error) => {
      if (isContextInvalidatedError(error)) {
        markContextInvalidated();
        return;
      }
      migrationPromise = null;
      throw error;
    });

    return migrationPromise;
  }

  function maxAllowedVolume(settings) {
    if (settings?.boostEnabled) {
      return settings.maxBoost || 100;
    }
    return 100;
  }

  async function getSettings() {
    await ensureLocalDataMigrated();
    const data = await getArea("sync", KEYS.settings);
    return mergeSettings(data[KEYS.settings]);
  }

  async function saveSettings(settings) {
    if (!isContextValid()) {
      return;
    }
    await setArea("sync", { [KEYS.settings]: mergeSettings(settings) });
  }

  async function getVolumes() {
    await ensureLocalDataMigrated();
    const data = await getArea("local", KEYS.volumes);
    return mergeVolumes(data[KEYS.volumes]);
  }

  async function saveVolumes(volumes) {
    if (!isContextValid()) {
      return;
    }
    await ensureLocalDataMigrated();
    await setArea("local", { [KEYS.volumes]: mergeVolumes(volumes) });
  }

  async function getNarratorLevels() {
    await ensureLocalDataMigrated();
    const data = await getArea("local", KEYS.narratorLevels);
    return sanitizeNarratorLevels(data[KEYS.narratorLevels]);
  }

  async function saveNarratorLevel(narrator, rms) {
    const levels = await getNarratorLevels();
    if (typeof narrator !== "string" || !narrator.trim() || !Number.isFinite(rms) || rms <= 0) {
      return levels;
    }
    const normalizedNarrator = narrator.trim().slice(0, 200);
    const normalizedRms = clampNumber(rms, 0.07, 0.0001, 1);
    const previous = levels[normalizedNarrator];
    levels[normalizedNarrator] = previous
      ? previous * 0.7 + normalizedRms * 0.3
      : normalizedRms;
    await setArea("local", { [KEYS.narratorLevels]: levels });
    return levels;
  }

  async function getReaderState() {
    const data = await getArea("local", KEYS.readerState);
    return sanitizeReaderState(data[KEYS.readerState]);
  }

  async function saveReadingProgress(chapterKey, progress) {
    if (!isContextValid()) {
      return;
    }
    if (typeof chapterKey !== "string" || !/^\/novel\/[^/]+\/chapter-[^/?#]+/.test(chapterKey)) {
      return;
    }
    const readerState = await getReaderState();
    readerState.progressByChapter[chapterKey.slice(0, 500)] = {
      scrollY: clampNumber(progress?.scrollY, 0, 0, 10000000),
      percent: clampNumber(progress?.percent, 0, 0, 100),
      updatedAt: Date.now(),
    };
    await setArea("local", { [KEYS.readerState]: sanitizeReaderState(readerState) });
  }

  async function getReadingProgress(chapterKey) {
    const readerState = await getReaderState();
    return readerState.progressByChapter[chapterKey] || null;
  }

  async function getPlaybackRate(novelSlug) {
    const readerState = await getReaderState();
    return readerState.playbackRateByNovel[novelSlug] || 1;
  }

  async function savePlaybackRate(novelSlug, rate) {
    if (!isContextValid()) {
      return clampNumber(rate, 1, 0.75, 2);
    }
    if (typeof novelSlug !== "string" || !/^[a-z0-9-]{1,200}$/i.test(novelSlug)) {
      return 1;
    }
    const readerState = await getReaderState();
    const normalized = clampNumber(rate, 1, 0.75, 2);
    readerState.playbackRateByNovel[novelSlug] = normalized;
    await setArea("local", { [KEYS.readerState]: sanitizeReaderState(readerState) });
    return normalized;
  }

  function resolveVolume(volumes, novelSlug, narrator, settings) {
    if (
      narrator &&
      volumes.byNarrator[narrator] !== null &&
      volumes.byNarrator[narrator] !== undefined
    ) {
      return volumes.byNarrator[narrator];
    }
    if (
      novelSlug &&
      volumes.byNovel[novelSlug] !== null &&
      volumes.byNovel[novelSlug] !== undefined
    ) {
      return volumes.byNovel[novelSlug];
    }
    if (volumes.global !== null && volumes.global !== undefined) {
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
    DEFAULT_READER,
    getSettings,
    saveSettings,
    getVolumes,
    saveVolumes,
    getNarratorLevels,
    saveNarratorLevel,
    getReaderState,
    saveReadingProgress,
    getReadingProgress,
    getPlaybackRate,
    savePlaybackRate,
    getNarratorMultiplier,
    getVolumeForContext,
    saveVolumeForContext,
    extractNovelSlug,
    detectNarrator,
    isTtsPlaying,
    isContextValid,
    onContextInvalidated,
  };
})();
