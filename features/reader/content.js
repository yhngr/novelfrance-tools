(function () {
  "use strict";

  const AUDIO_SELECTOR = 'section[aria-label="Lecture audio du chapitre"] audio';
  const PROGRESS_ID = "nf-reading-progress";
  const RESUME_ID = "nf-reading-resume";
  const SAVE_DELAY_MS = 1500;
  const READING_SPEED_WPM = 220;
  const RATE_STEP = 0.25;

  const state = {
    settings: null,
    novelSlug: null,
    chapterKey: null,
    playbackRate: 1,
    audio: null,
    wordCount: 0,
    resumeTarget: null,
    resumeDismissed: false,
    resumeUsed: false,
    currentProgress: null,
    saveTimer: null,
    rateSaveTimer: null,
    contentRefreshTimer: null,
    routeRequestId: 0,
    nextScheduled: false,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getChapterKey() {
    return /^\/novel\/[^/]+\/chapter-[^/?#]+/.test(window.location.pathname)
      ? window.location.pathname.slice(0, 500)
      : null;
  }

  function getScrollProgress() {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const scrollY = clamp(window.scrollY, 0, maxScroll);
    const percent = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 100;
    return { scrollY, percent: clamp(percent, 0, 100) };
  }

  function findChapterContainer() {
    const candidates = [
      ...document.querySelectorAll("article, [data-chapter-content], .chapter-content, main .prose"),
    ];
    if (!candidates.length) {
      const main = document.querySelector("main");
      if (main) {
        candidates.push(main);
      }
    }
    return candidates.reduce((best, element) => {
      const length = element.innerText?.trim().length || 0;
      return length > best.length ? { element, length } : best;
    }, { element: null, length: 0 }).element;
  }

  function refreshWordCount() {
    const text = findChapterContainer()?.innerText || "";
    state.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  function getReadingMinutesRemaining(percent) {
    if (!state.wordCount) {
      return null;
    }
    const remainingWords = state.wordCount * (1 - clamp(percent, 0, 100) / 100);
    return Math.max(0, Math.ceil(remainingWords / READING_SPEED_WPM));
  }

  function getAudioRemaining() {
    const audio = state.audio;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return null;
    }
    return Math.max(0, (audio.duration - audio.currentTime) / state.playbackRate);
  }

  function canResume() {
    return Boolean(
      state.resumeTarget &&
      !state.resumeUsed &&
      Math.abs(window.scrollY - state.resumeTarget.scrollY) > 150
    );
  }

  function ensureProgressBar() {
    if (!state.settings?.reader.showProgressBar || !state.chapterKey) {
      document.getElementById(PROGRESS_ID)?.remove();
      return null;
    }
    let host = document.getElementById(PROGRESS_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = PROGRESS_ID;
      host.setAttribute("role", "progressbar");
      host.setAttribute("aria-valuemin", "0");
      host.setAttribute("aria-valuemax", "100");
      const fill = document.createElement("div");
      fill.className = "nf-reading-progress-fill";
      host.appendChild(fill);
      document.body.appendChild(host);
    }
    return host;
  }

  function ensureResumeButton() {
    if (!canResume() || state.resumeDismissed || !state.chapterKey) {
      document.getElementById(RESUME_ID)?.remove();
      return;
    }
    let host = document.getElementById(RESUME_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = RESUME_ID;

      const resume = document.createElement("button");
      resume.type = "button";
      resume.className = "nf-reading-resume-button";
      resume.addEventListener("click", resumeReading);

      const close = document.createElement("button");
      close.type = "button";
      close.className = "nf-reading-resume-close";
      close.textContent = "×";
      close.setAttribute("aria-label", "Masquer la reprise de lecture");
      close.addEventListener("click", () => {
        state.resumeDismissed = true;
        host.remove();
      });

      host.append(resume, close);
      document.body.appendChild(host);
    }
    const percent = Math.round(state.resumeTarget.percent);
    host.querySelector(".nf-reading-resume-button").textContent = `↩ Reprendre à ${percent} %`;
  }

  function updateUi() {
    if (!state.chapterKey) {
      document.getElementById(PROGRESS_ID)?.remove();
      document.getElementById(RESUME_ID)?.remove();
      return;
    }
    const progress = getScrollProgress();
    state.currentProgress = progress;
    const host = ensureProgressBar();
    if (host) {
      const percent = Math.round(progress.percent * 10) / 10;
      host.querySelector(".nf-reading-progress-fill").style.width = percent + "%";
      host.setAttribute("aria-valuenow", String(percent));
      host.title = `Progression du chapitre : ${Math.round(percent)} %`;
    }
    ensureResumeButton();
  }

  function persistProgress(chapterKey = state.chapterKey, progress = state.currentProgress) {
    if (!chapterKey || !progress) {
      return;
    }
    NFStorage.saveReadingProgress(chapterKey, progress).catch(() => {});
  }

  function queueProgressSave() {
    window.clearTimeout(state.saveTimer);
    const chapterKey = state.chapterKey;
    const progress = { ...state.currentProgress };
    state.saveTimer = window.setTimeout(() => persistProgress(chapterKey, progress), SAVE_DELAY_MS);
  }

  function resumeReading() {
    if (!state.resumeTarget) {
      return;
    }
    state.resumeUsed = true;
    window.scrollTo({ top: state.resumeTarget.scrollY, behavior: "smooth" });
    document.getElementById(RESUME_ID)?.remove();
  }

  function applyPlaybackRate() {
    if (!state.audio) {
      return;
    }
    state.audio.defaultPlaybackRate = state.playbackRate;
    state.audio.playbackRate = state.playbackRate;
  }

  function persistPlaybackRate() {
    if (!state.novelSlug) {
      return;
    }
    window.clearTimeout(state.rateSaveTimer);
    state.rateSaveTimer = window.setTimeout(() => {
      NFStorage.savePlaybackRate(state.novelSlug, state.playbackRate).catch(() => {});
    }, 250);
  }

  function setPlaybackRate(rate, persist = true) {
    state.playbackRate = Math.round(clamp(Number(rate) || 1, 0.75, 2) * 4) / 4;
    applyPlaybackRate();
    if (persist) {
      persistPlaybackRate();
    }
    updateUi();
  }

  function seekBy(seconds) {
    if (!state.audio || !Number.isFinite(state.audio.currentTime)) {
      return false;
    }
    const maximum = Number.isFinite(state.audio.duration) ? state.audio.duration : Infinity;
    state.audio.currentTime = clamp(state.audio.currentTime + seconds, 0, maximum);
    updateUi();
    return true;
  }

  function findNextChapterUrl() {
    if (!state.novelSlug) {
      return null;
    }
    const links = Array.from(document.querySelectorAll("a[href]"));
    const isNextChapter = (link) => {
      const label = `${link.getAttribute("aria-label") || ""} ${link.textContent || ""}`;
      if (!/suivant/i.test(label) && link.getAttribute("rel") !== "next") {
        return false;
      }
      try {
        const url = new URL(link.href, window.location.href);
        const match = url.pathname.match(/^\/novel\/([^/]+)\/chapter-[^/?#]+/);
        return url.origin === window.location.origin && match?.[1] === state.novelSlug;
      } catch (_error) {
        return false;
      }
    };
    return links.find((link) => link.getAttribute("rel") === "next" && isNextChapter(link))?.href ||
      links.find(isNextChapter)?.href ||
      null;
  }

  function handleAudioEnded() {
    updateUi();
    if (!state.settings?.reader.autoNextChapter || state.nextScheduled) {
      return;
    }
    const nextUrl = findNextChapterUrl();
    if (!nextUrl) {
      return;
    }
    state.nextScheduled = true;
    persistProgress();
    window.setTimeout(() => window.location.assign(nextUrl), 1000);
  }

  function bindAudio() {
    const audio = document.querySelector(AUDIO_SELECTOR);
    if (audio === state.audio) {
      return;
    }
    state.audio = audio || null;
    if (!audio) {
      updateUi();
      return;
    }
    applyPlaybackRate();
    if (audio.dataset.nfReaderBound) {
      return;
    }
    audio.dataset.nfReaderBound = "1";
    audio.addEventListener("loadedmetadata", () => {
      applyPlaybackRate();
      updateUi();
    });
    audio.addEventListener("durationchange", updateUi);
    audio.addEventListener("timeupdate", updateUi);
    audio.addEventListener("play", applyPlaybackRate);
    audio.addEventListener("ratechange", () => {
      if (audio !== state.audio) {
        return;
      }
      const rate = Math.round(clamp(audio.playbackRate, 0.75, 2) * 4) / 4;
      if (rate !== state.playbackRate) {
        state.playbackRate = rate;
        persistPlaybackRate();
      }
    });
    audio.addEventListener("ended", handleAudioEnded);
    updateUi();
  }

  async function loadRouteContext() {
    const nextChapterKey = getChapterKey();
    const nextNovelSlug = NFStorage.extractNovelSlug();
    if (nextChapterKey === state.chapterKey && nextNovelSlug === state.novelSlug) {
      return;
    }
    persistProgress();
    const requestId = ++state.routeRequestId;
    state.chapterKey = nextChapterKey;
    state.novelSlug = nextNovelSlug;
    state.resumeTarget = null;
    state.resumeDismissed = false;
    state.resumeUsed = false;
    state.nextScheduled = false;
    state.currentProgress = getScrollProgress();
    refreshWordCount();

    const [savedProgress, savedRate] = await Promise.all([
      nextChapterKey ? NFStorage.getReadingProgress(nextChapterKey) : Promise.resolve(null),
      nextNovelSlug ? NFStorage.getPlaybackRate(nextNovelSlug) : Promise.resolve(1),
    ]);
    if (requestId !== state.routeRequestId) {
      return;
    }
    state.resumeTarget = savedProgress;
    state.playbackRate = savedRate;
    applyPlaybackRate();
    updateUi();
  }

  function matchesShortcut(event, shortcut) {
    return Boolean(shortcut && event.key.toLowerCase() === shortcut.toLowerCase());
  }

  function initKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (!state.settings?.keyboardShortcuts) {
        return;
      }
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) {
        return;
      }
      const shortcuts = state.settings.shortcuts || {};
      if (matchesShortcut(event, shortcuts.seekBackward)) {
        event.preventDefault();
        seekBy(-10);
      } else if (matchesShortcut(event, shortcuts.seekForward)) {
        event.preventDefault();
        seekBy(10);
      } else if (matchesShortcut(event, shortcuts.rateDown)) {
        event.preventDefault();
        setPlaybackRate(state.playbackRate - RATE_STEP);
      } else if (matchesShortcut(event, shortcuts.rateUp)) {
        event.preventDefault();
        setPlaybackRate(state.playbackRate + RATE_STEP);
      }
    });
  }

  function getPublicState() {
    const progress = getScrollProgress();
    return {
      progress: Math.round(progress.percent),
      readingMinutesRemaining: getReadingMinutesRemaining(progress.percent),
      audioRemainingSeconds: getAudioRemaining(),
      playbackRate: state.playbackRate,
      hasAudio: Boolean(state.audio),
      canResume: canResume(),
      resumePercent: state.resumeTarget ? Math.round(state.resumeTarget.percent) : null,
      autoNextChapter: Boolean(state.settings?.reader.autoNextChapter),
      isChapter: Boolean(state.chapterKey),
    };
  }

  function initMessageBridge() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "NF_GET_READER_STATE") {
        sendResponse(getPublicState());
        return true;
      }
      if (message.type === "NF_RESUME_READING") {
        resumeReading();
        sendResponse({ ok: true });
        return true;
      }
      if (message.type === "NF_SEEK_AUDIO") {
        sendResponse({ ok: seekBy(clamp(Number(message.seconds) || 0, -60, 60)) });
        return true;
      }
      if (message.type === "NF_SET_PLAYBACK_RATE") {
        setPlaybackRate(message.rate);
        sendResponse({ ok: true, playbackRate: state.playbackRate });
        return true;
      }
      if (message.type === "NF_SET_AUTO_NEXT") {
        state.settings.reader.autoNextChapter = Boolean(message.enabled);
        NFStorage.saveSettings(state.settings).then(() => sendResponse({ ok: true }));
        return true;
      }
      if (message.type === "NF_SETTINGS_UPDATED") {
        NFStorage.getSettings().then((settings) => {
          state.settings = settings;
          updateUi();
          sendResponse({ ok: true });
        });
        return true;
      }
      return false;
    });
  }

  async function start() {
    state.settings = await NFStorage.getSettings();
    await loadRouteContext();
    bindAudio();
    initKeyboard();
    initMessageBridge();
    updateUi();

    window.addEventListener("scroll", () => {
      updateUi();
      queueProgressSave();
    }, { passive: true });
    window.addEventListener("resize", updateUi);
    window.addEventListener("pagehide", () => persistProgress());

    const observer = new MutationObserver(() => {
      loadRouteContext();
      bindAudio();
      window.clearTimeout(state.contentRefreshTimer);
      state.contentRefreshTimer = window.setTimeout(() => {
        refreshWordCount();
        updateUi();
      }, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.nf_settings) {
        state.settings = NFStorage.DEFAULT_SETTINGS;
        NFStorage.getSettings().then((settings) => {
          state.settings = settings;
          updateUi();
        });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
