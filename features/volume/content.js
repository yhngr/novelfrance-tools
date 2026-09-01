(function () {
  "use strict";

  const SECTION_SELECTOR = 'section[aria-label="Lecture audio du chapitre"]';
  const CONTROL_CLASS = "nf-volume-control";
  const FLOATING_ID = "nf-volume-floating";
  const PRESETS = [25, 50, 75, 100];

  const state = {
    settings: null,
    volume: 100,
    baseVolume: 100,
    muted: false,
    volumeBeforeMute: 100,
    novelSlug: NFStorage.extractNovelSlug(),
    narrator: null,
    narratorLevels: {},
    narratorMultiplier: 1,
    sections: new Set(),
    widgets: [],
    floatingWidget: null,
    keepAliveTimer: null,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function maxVolume() {
    if (state.settings?.boostEnabled) {
      return state.settings.maxBoost || 100;
    }
    return 100;
  }

  function audioOptions() {
    return {
      equalizer: state.settings.equalizer,
      limiterEnabled: state.settings.limiterEnabled,
      fadeEnabled: state.settings.fadeEnabled,
      fadeDurationMs: state.settings.fadeDurationMs,
    };
  }

  function iconLevel(percent) {
    const normalized = clamp(percent, 0, maxVolume()) / maxVolume();
    if (normalized <= 0) {
      return "M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6M17 9l6 6";
    }
    if (normalized <= 0.33) {
      return "M11 5L6 9H2v6h4l5 4V5z";
    }
    if (normalized <= 0.66) {
      return "M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 010 7.07";
    }
    return "M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14";
  }

  function updateBadge() {
    const text = state.muted || state.volume === 0 ? "M" : String(state.volume);
    chrome.runtime.sendMessage({
      type: "NF_BADGE_UPDATE",
      text,
      muted: state.muted || state.volume === 0,
    }).catch(() => {});
  }

  function applyToAudio(percent, fadeOverride) {
    const options = {
      ...audioOptions(),
      fadeEnabled: fadeOverride != null ? fadeOverride : state.settings.fadeEnabled,
    };

    state.sections.forEach((section) => {
      const audio = section.querySelector("audio");
      if (!audio) {
        return;
      }
      const effective = percent * state.narratorMultiplier;
      NFAudioEngine.apply(audio, effective, options);
    });
  }

  async function persistVolume(percent) {
    state.baseVolume = state.narratorMultiplier
      ? Math.round(percent / state.narratorMultiplier)
      : percent;
    await NFStorage.saveVolumeForContext(
      state.baseVolume,
      state.novelSlug,
      state.narrator,
      state.narratorMultiplier
    );
  }

  function broadcastUi() {
    state.widgets.forEach((widget) => widget.render(state.volume, state.muted));
    if (state.floatingWidget) {
      state.floatingWidget.render(state.volume, state.muted);
    }
  }

  async function setVolume(percent, { save = true, muteFlag = null, fade = true } = {}) {
    const max = maxVolume();
    state.volume = clamp(Math.round(percent), 0, max);

    if (muteFlag === false) {
      state.muted = false;
    } else if (muteFlag === true) {
      state.muted = true;
    } else if (state.volume === 0) {
      state.muted = true;
    } else {
      state.muted = false;
      state.volumeBeforeMute = state.volume;
    }

    applyToAudio(state.volume, fade);
    broadcastUi();
    updateBadge();

    if (save) {
      await persistVolume(state.volume);
    }

    chrome.runtime.sendMessage({
      type: "NF_VOLUME_CHANGED",
      volume: state.volume,
      muted: state.muted,
    }).catch(() => {});
  }

  function toggleMute() {
    if (state.muted || state.volume === 0) {
      setVolume(state.volumeBeforeMute || state.settings.defaultVolume, { muteFlag: false });
    } else {
      state.volumeBeforeMute = state.volume;
      setVolume(0, { muteFlag: true });
    }
  }

  async function applyProfile(profileKey) {
    const profile = NFStorage.PROFILES[profileKey];
    if (!profile) {
      return;
    }

    state.settings.equalizer = { ...profile.equalizer };
    await NFStorage.saveSettings({ ...state.settings, equalizer: profile.equalizer });
    await setVolume(profile.volume);
  }

  function scrollToAudioBar() {
    const section = document.querySelector(SECTION_SELECTOR);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function bindWheelControl(target) {
    target.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const step = state.settings.sliderStep || 5;
        const delta = event.deltaY < 0 ? step : -step;
        setVolume(state.volume + delta);
      },
      { passive: false }
    );
  }

  function createVolumeWidget({ compact = false, section = null, register = true, showProfiles = true } = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = CONTROL_CLASS + (compact ? " nf-volume-control--compact" : "");
    const collapsePresets = state.settings?.compactPresets && !compact;
    if (collapsePresets) {
      wrapper.classList.add("nf-volume-control--collapsed-presets");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "nf-volume-btn";
    button.setAttribute("aria-label", "Volume de la lecture audio");
    button.title = "Clic : couper/réactiver — Double-clic : 100 % — Molette : ajuster";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "nf-volume-slider";
    slider.setAttribute("aria-label", "Niveau du volume");

    const percent = document.createElement("span");
    percent.className = "nf-volume-percent";

    const presets = document.createElement("div");
    presets.className = "nf-volume-presets";

    PRESETS.forEach((value) => {
      const presetBtn = document.createElement("button");
      presetBtn.type = "button";
      presetBtn.className = "nf-volume-preset";
      presetBtn.textContent = value + "%";
      presetBtn.addEventListener("click", () => {
        if (value <= maxVolume()) {
          setVolume(value);
        }
      });
      presets.appendChild(presetBtn);
    });

    const profiles = document.createElement("div");
    profiles.className = "nf-volume-profiles";
    if (showProfiles && !compact) {
      Object.entries(NFStorage.PROFILES).forEach(([key, profile]) => {
        const profileBtn = document.createElement("button");
        profileBtn.type = "button";
        profileBtn.className = "nf-volume-profile";
        profileBtn.textContent = profile.label;
        profileBtn.addEventListener("click", () => applyProfile(key));
        profiles.appendChild(profileBtn);
      });
    }

    bindWheelControl(wrapper);
    bindWheelControl(slider);

    slider.addEventListener("input", () => setVolume(Number(slider.value), { fade: false }));

    button.addEventListener("click", () => toggleMute());
    button.addEventListener("dblclick", (event) => {
      event.preventDefault();
      setVolume(100);
    });

    function render(volume, muted) {
      const max = maxVolume();
      const display = muted ? 0 : volume;
      const fill = max > 0 ? (display / max) * 100 : 0;

      wrapper.classList.toggle("nf-volume-control--muted", muted || display === 0);
      slider.min = "0";
      slider.max = String(max);
      slider.step = String(state.settings?.sliderStep || 1);
      slider.value = String(display);
      slider.style.setProperty("--nf-fill", fill + "%");
      slider.setAttribute("aria-valuetext", display + "%");
      percent.textContent = display + "%";

      button.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
        iconLevel(display) +
        '"></path></svg>';

      presets.querySelectorAll(".nf-volume-preset").forEach((el) => {
        const val = Number(el.textContent);
        el.hidden = val > max;
        el.classList.toggle("nf-volume-preset--active", val === display && !muted);
      });
    }

    let presetsToggle = null;
    if (collapsePresets) {
      presetsToggle = document.createElement("button");
      presetsToggle.type = "button";
      presetsToggle.className = "nf-volume-presets-toggle";
      presetsToggle.setAttribute("aria-label", "Afficher les préréglages");
      presetsToggle.setAttribute("aria-expanded", "false");
      presetsToggle.title = "Préréglages et profils";
      presetsToggle.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
      presetsToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const expanded = wrapper.classList.toggle("nf-volume-control--expanded-presets");
        presetsToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        presetsToggle.setAttribute("aria-label", expanded ? "Masquer les préréglages" : "Afficher les préréglages");
      });
    }

    wrapper.append(button, slider, percent);
    if (presetsToggle) {
      wrapper.append(presetsToggle);
    }
    if (!compact) {
      wrapper.append(presets, profiles);
    }

    const widget = { wrapper, render, section };
    if (register) {
      state.widgets.push(widget);
    }
    render(state.volume, state.muted);
    return widget;
  }

  function injectInlineControl(section) {
    if (section.querySelector("." + CONTROL_CLASS)) {
      return;
    }

    const toolbar = section.querySelector(".flex.items-center.gap-3.px-4.py-3");
    if (!toolbar) {
      return;
    }

    const widget = createVolumeWidget({ section });
    const anchor =
      toolbar.querySelector('[aria-label="Vitesse de lecture"]')?.closest(".relative") ||
      toolbar.querySelector('[aria-haspopup="listbox"]')?.closest(".relative") ||
      toolbar.querySelector('[aria-label="Choisir la voix"]')?.closest(".relative") ||
      toolbar.lastElementChild;

    if (anchor) {
      toolbar.insertBefore(widget.wrapper, anchor);
    } else {
      toolbar.appendChild(widget.wrapper);
    }
  }

  function applyFloatingPosition(host) {
    const pos = state.settings.floatingPosition;
    if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
      host.style.left = pos.left + "px";
      host.style.top = pos.top + "px";
      host.style.right = "auto";
      host.style.bottom = "auto";
    }
  }

  function initFloatingDrag(host) {
    const handle = host.querySelector(".nf-volume-floating-handle");
    if (!handle || handle.dataset.bound) {
      return;
    }
    handle.dataset.bound = "1";

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("mousedown", (event) => {
      const rect = host.getBoundingClientRect();
      if (!host.style.left) {
        host.style.left = rect.left + "px";
        host.style.top = rect.top + "px";
        host.style.right = "auto";
        host.style.bottom = "auto";
      }
      dragging = true;
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      host.classList.add("nf-volume-floating--dragging");
      event.preventDefault();
    });

    window.addEventListener("mousemove", (event) => {
      if (!dragging) {
        return;
      }
      const left = clamp(event.clientX - offsetX, 8, window.innerWidth - host.offsetWidth - 8);
      const top = clamp(event.clientY - offsetY, 8, window.innerHeight - host.offsetHeight - 8);
      host.style.left = left + "px";
      host.style.top = top + "px";
      host.style.right = "auto";
      host.style.bottom = "auto";
    });

    window.addEventListener("mouseup", async () => {
      if (!dragging) {
        return;
      }
      dragging = false;
      host.classList.remove("nf-volume-floating--dragging");
      state.settings.floatingPosition = {
        left: parseInt(host.style.left, 10),
        top: parseInt(host.style.top, 10),
      };
      await NFStorage.saveSettings(state.settings);
    });
  }

  function ensureFloatingControl() {
    if (!state.settings.floatingControl) {
      document.getElementById(FLOATING_ID)?.remove();
      state.floatingWidget = null;
      return;
    }

    let host = document.getElementById(FLOATING_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = FLOATING_ID;
      host.className = "nf-volume-floating";

      const handle = document.createElement("div");
      handle.className = "nf-volume-floating-handle";
      handle.textContent = "Volume";
      handle.title = "Glisser pour déplacer";

      const scrollBtn = document.createElement("button");
      scrollBtn.type = "button";
      scrollBtn.className = "nf-volume-scroll-btn";
      scrollBtn.textContent = "↩ Lecteur";
      scrollBtn.title = "Retour à la barre audio";
      scrollBtn.addEventListener("click", scrollToAudioBar);

      host.append(handle, scrollBtn);
      document.body.appendChild(host);

      state.floatingWidget = createVolumeWidget({ compact: true, register: false, showProfiles: false });
      host.appendChild(state.floatingWidget.wrapper);

      applyFloatingPosition(host);
      initFloatingDrag(host);
    }
  }

  function isTtsSessionActive() {
    const audio = document.querySelector(SECTION_SELECTOR + " audio");
    if (!audio || audio.ended) {
      return false;
    }
    return !audio.paused || audio.currentTime > 0;
  }

  function updateFloatingVisibility() {
    const host = document.getElementById(FLOATING_ID);
    if (!host || !state.settings.floatingControl) {
      return;
    }

    if (!isTtsSessionActive()) {
      host.hidden = true;
      return;
    }

    const section = document.querySelector(SECTION_SELECTOR);
    if (!section) {
      host.hidden = true;
      return;
    }

    const rect = section.getBoundingClientRect();
    const barVisible = rect.top < window.innerHeight && rect.bottom > 0;
    host.hidden = barVisible;
  }

  function bindAudioEvents(section) {
    const audio = section.querySelector("audio");
    if (!audio || audio.dataset.nfBound) {
      return;
    }
    audio.dataset.nfBound = "1";

    audio.addEventListener("play", () => {
      applyToAudio(state.volume, true);
      updateFloatingVisibility();
      if (state.narrator && state.settings.narratorNormalization) {
        NFAudioEngine.startSampling(audio, (rms) => {
          NFStorage.saveNarratorLevel(state.narrator, rms).then((levels) => {
            state.narratorLevels = levels;
          });
        });
      }
    });

    audio.addEventListener("pause", () => {
      NFAudioEngine.stopSampling(audio);
      updateFloatingVisibility();
    });
    audio.addEventListener("ended", () => {
      NFAudioEngine.stopSampling(audio);
      updateFloatingVisibility();
      if (state.settings.chapterEndNotification) {
        chrome.runtime.sendMessage({
          type: "NF_CHAPTER_ENDED",
          title: document.title,
        }).catch(() => {});
      }
    });
  }

  async function reloadContextVolume(section) {
    const narrator = NFStorage.detectNarrator(section);
    if (narrator !== state.narrator) {
      state.narrator = narrator;
      const ctx = await NFStorage.getVolumeForContext(state.novelSlug, state.narrator);
      state.settings = ctx.settings;
      state.narratorLevels = ctx.narratorLevels;
      state.narratorMultiplier = ctx.narratorMultiplier;
      state.baseVolume = ctx.baseVolume;
      await setVolume(ctx.volume, { save: false });
    }
  }

  function initSection(section) {
    state.sections.add(section);
    injectInlineControl(section);
    bindAudioEvents(section);
    reloadContextVolume(section);
    applyToAudio(state.volume, false);

    const observer = new MutationObserver(() => {
      injectInlineControl(section);
      bindAudioEvents(section);
      reloadContextVolume(section);
      applyToAudio(state.volume, false);
      updateFloatingVisibility();
    });
    observer.observe(section, { childList: true, subtree: true, characterData: true });
  }

  function matchesShortcut(event, shortcut) {
    if (!shortcut) {
      return false;
    }
    return event.key.toLowerCase() === shortcut.toLowerCase();
  }

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      if (!state.settings?.keyboardShortcuts) {
        return;
      }

      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) {
        return;
      }

      const step = state.settings.sliderStep || 5;
      const keys = state.settings.shortcuts || {};

      if (matchesShortcut(event, keys.mute) || event.code === "AudioVolumeMute") {
        event.preventDefault();
        toggleMute();
      }

      if (matchesShortcut(event, keys.volumeUp) || event.code === "AudioVolumeUp") {
        event.preventDefault();
        setVolume(state.volume + step);
      }

      if (matchesShortcut(event, keys.volumeDown) || event.code === "AudioVolumeDown") {
        event.preventDefault();
        setVolume(state.volume - step);
      }
    });
  }

  function initMediaSession() {
    if (!navigator.mediaSession) {
      return;
    }

    const section = document.querySelector(SECTION_SELECTOR);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: document.title,
      artist: "NovelFrance Tools",
    });

    navigator.mediaSession.setActionHandler("play", () => {
      section?.querySelector('[aria-label="Écouter ce chapitre"], [aria-label="Mettre en pause"]')?.click();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      section?.querySelector('[aria-label="Mettre en pause"]')?.click();
    });
  }

  function initKeepAlive() {
    if (state.keepAliveTimer) {
      window.clearInterval(state.keepAliveTimer);
    }

    const interval = state.settings.keepAliveIntervalMs || 1500;
    state.keepAliveTimer = window.setInterval(() => {
      NFAudioEngine.keepAlive();
      applyToAudio(state.volume, false);
    }, interval);

    document.addEventListener("visibilitychange", () => {
      NFAudioEngine.keepAlive();
      applyToAudio(state.volume, false);
    });
  }

  function initScrollWatcher() {
    window.addEventListener("scroll", updateFloatingVisibility, { passive: true });
    window.addEventListener("resize", updateFloatingVisibility);
    updateFloatingVisibility();
  }

  function initMessageBridge() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "NF_GET_STATE") {
        sendResponse({
          volume: state.volume,
          muted: state.muted,
          max: maxVolume(),
          novel: state.novelSlug,
          narrator: state.narrator,
        });
        return true;
      }

      if (message.type === "NF_SET_VOLUME") {
        setVolume(message.volume).then(() => sendResponse({ ok: true }));
        return true;
      }

      if (message.type === "NF_TOGGLE_MUTE") {
        toggleMute();
        sendResponse({ ok: true });
        return true;
      }

      if (message.type === "NF_APPLY_PROFILE") {
        applyProfile(message.profile).then(() => sendResponse({ ok: true }));
        return true;
      }

      if (message.type === "NF_SETTINGS_UPDATED") {
        bootstrap(true).then(() => sendResponse({ ok: true }));
        return true;
      }

      return false;
    });
  }

  async function bootstrap(reload) {
    const ctx = await NFStorage.getVolumeForContext(state.novelSlug, state.narrator);
    state.settings = ctx.settings;
    state.narratorLevels = ctx.narratorLevels;
    state.narratorMultiplier = ctx.narratorMultiplier;
    state.baseVolume = ctx.baseVolume;

    if (!reload) {
      state.volume = ctx.volume;
      state.volumeBeforeMute = ctx.volume || state.settings.defaultVolume;
    }

    document.querySelectorAll(SECTION_SELECTOR).forEach((section) => {
      if (!section.dataset.nfVolumeReady) {
        section.dataset.nfVolumeReady = "1";
        initSection(section);
      } else {
        injectInlineControl(section);
        bindAudioEvents(section);
      }
    });

    ensureFloatingControl();
    applyToAudio(state.volume, false);
    broadcastUi();
    updateBadge();
    updateFloatingVisibility();
    initKeepAlive();
    initMediaSession();
  }

  async function start() {
    await bootstrap(false);
    initKeyboardShortcuts();
    initScrollWatcher();
    initMessageBridge();

    const pageObserver = new MutationObserver(() => {
      document.querySelectorAll(SECTION_SELECTOR).forEach((section) => {
        if (!section.dataset.nfVolumeReady) {
          section.dataset.nfVolumeReady = "1";
          initSection(section);
        }
      });
    });
    pageObserver.observe(document.body, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") {
        return;
      }
      if (changes.nf_settings || changes.nf_volumes || changes.nf_narrator_levels) {
        bootstrap(true);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
