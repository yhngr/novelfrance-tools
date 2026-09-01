(function () {
  "use strict";

  const PANEL_ID = "nf-autoscroll-panel";
  const TTS_SECTION = 'section[aria-label="Lecture audio du chapitre"]';
  const TTS_GRACE_MS = 600;
  const UI_REFRESH_MS = 400;

  const state = {
    settings: null,
    running: false,
    paused: false,
    rafId: null,
    lastFrame: 0,
    lastUiRefresh: 0,
    scrollRemainder: 0,
    manualPauseTimer: null,
    userEnabled: false,
    userToggledOff: false,
    ttsGraceUntil: 0,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function atBottom() {
    return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
  }

  function isTtsPlayingSmooth() {
    if (NFStorage.isTtsPlaying()) {
      state.ttsGraceUntil = performance.now() + TTS_GRACE_MS;
      return true;
    }
    return performance.now() < state.ttsGraceUntil;
  }

  function isWaitingForTts() {
    return state.settings.autoScroll.onlyWhenPlaying && !isTtsPlayingSmooth();
  }

  function canScrollNow() {
    if (!state.userEnabled || state.paused || document.hidden) {
      return false;
    }
    if (isWaitingForTts()) {
      return false;
    }
    return !atBottom();
  }

  function applyScrollDistance(distance) {
    if (distance <= 0) {
      return;
    }
    state.scrollRemainder += distance;
    const pixels = Math.floor(state.scrollRemainder);
    if (pixels < 1) {
      return;
    }
    state.scrollRemainder -= pixels;
    window.scrollBy({ top: pixels, left: 0, behavior: "instant" });
  }

  function setSliderFill(slider, value, min, max) {
    const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.setProperty("--nf-fill", fill + "%");
  }

  function tick(timestamp) {
    if (!state.running) {
      return;
    }

    if (!state.lastFrame) {
      state.lastFrame = timestamp;
    }

    let delta = timestamp - state.lastFrame;
    if (delta > 250) {
      delta = 16.67;
    }
    state.lastFrame = timestamp;

    if (canScrollNow()) {
      applyScrollDistance((state.settings.autoScroll.speed * delta) / 1000);

      if (atBottom()) {
        state.scrollRemainder = 0;
        stopScroll(false);
        updatePanelUi();
        return;
      }
    }

    if (timestamp - state.lastUiRefresh >= UI_REFRESH_MS) {
      state.lastUiRefresh = timestamp;
      updatePanelUi();
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function startScroll(fromUser) {
    if (fromUser) {
      state.userEnabled = true;
    }
    state.paused = false;

    if (state.running) {
      updatePanelUi();
      return;
    }

    state.scrollRemainder = 0;
    state.running = true;
    state.lastFrame = 0;
    state.lastUiRefresh = 0;
    state.rafId = requestAnimationFrame(tick);
    updatePanelUi();
  }

  function stopScroll(fromUser) {
    if (fromUser) {
      state.userEnabled = false;
    }
    state.running = false;
    state.paused = false;
    state.scrollRemainder = 0;
    state.lastFrame = 0;

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    updatePanelUi();
  }

  function resumeFromPause() {
    state.paused = false;
    clearTimeout(state.manualPauseTimer);
    updatePanelUi();
  }

  function toggleScroll() {
    if (state.running && state.userEnabled && state.paused) {
      resumeFromPause();
      return;
    }
    if (state.running && state.userEnabled && !state.paused) {
      state.userToggledOff = true;
      stopScroll(true);
    } else {
      state.userToggledOff = false;
      startScroll(true);
    }
  }

  function pauseTemporarily() {
    if (!state.settings.autoScroll.pauseOnManualScroll) {
      return;
    }
    const wasPaused = state.paused;
    state.paused = true;
    clearTimeout(state.manualPauseTimer);
    state.manualPauseTimer = setTimeout(() => {
      state.paused = false;
      updatePanelUi();
    }, 2500);
    if (!wasPaused) {
      updatePanelUi();
    }
  }

  let saveSpeedTimer = null;

  async function setSpeed(speed, { persist = true } = {}) {
    state.settings.autoScroll.speed = clamp(Math.round(speed), 10, 160);
    updatePanelUi();

    if (!persist) {
      return;
    }

    clearTimeout(saveSpeedTimer);
    saveSpeedTimer = setTimeout(async () => {
      await NFStorage.saveSettings(state.settings);
    }, 250);
  }

  function applyPanelPosition(host) {
    const pos = state.settings.autoScrollPosition;
    if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
      host.style.left = pos.left + "px";
      host.style.top = pos.top + "px";
      host.style.right = "auto";
      host.style.bottom = "auto";
    }
  }

  function initPanelDrag(host, handle) {
    if (handle.dataset.bound) {
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
      event.preventDefault();
    });

    window.addEventListener("mousemove", (event) => {
      if (!dragging) {
        return;
      }
      host.style.left = clamp(event.clientX - offsetX, 8, window.innerWidth - host.offsetWidth - 8) + "px";
      host.style.top = clamp(event.clientY - offsetY, 8, window.innerHeight - host.offsetHeight - 8) + "px";
    });

    window.addEventListener("mouseup", async () => {
      if (!dragging) {
        return;
      }
      dragging = false;
      state.settings.autoScrollPosition = {
        left: parseInt(host.style.left, 10),
        top: parseInt(host.style.top, 10),
      };
      await NFStorage.saveSettings(state.settings);
    });
  }

  function updatePanelUi() {
    const host = document.getElementById(PANEL_ID);
    if (!host) {
      return;
    }

    const toggleBtn = host.querySelector(".nf-autoscroll-toggle");
    const speedLabel = host.querySelector(".nf-autoscroll-speed-value");
    const statusEl = host.querySelector(".nf-autoscroll-status");
    const slider = host.querySelector(".nf-autoscroll-speed");

    const scrolling = state.running && state.userEnabled && !state.paused && canScrollNow();
    const waitingTts = state.running && state.userEnabled && !state.paused && isWaitingForTts();

    host.classList.toggle("nf-autoscroll-panel--active", scrolling);
    host.classList.toggle("nf-autoscroll-panel--paused", state.paused || waitingTts);

    if (toggleBtn) {
      const active = state.userEnabled && state.running;
      if (active && state.paused) {
        toggleBtn.textContent = "Reprendre";
        toggleBtn.setAttribute("aria-pressed", "false");
      } else if (active) {
        toggleBtn.textContent = "Pause";
        toggleBtn.setAttribute("aria-pressed", "true");
      } else {
        toggleBtn.textContent = "Démarrer";
        toggleBtn.setAttribute("aria-pressed", "false");
      }
    }

    if (statusEl) {
      if (!state.userEnabled || !state.running) {
        statusEl.textContent = "Inactif";
      } else if (state.paused) {
        statusEl.textContent = "Pause";
      } else if (waitingTts) {
        statusEl.textContent = "Attente TTS";
      } else if (scrolling) {
        statusEl.textContent = "Actif";
      } else {
        statusEl.textContent = "Fin";
      }
    }

    if (speedLabel && slider) {
      const speed = state.settings.autoScroll.speed;
      slider.value = String(speed);
      speedLabel.textContent = speed + " px/s";
      setSliderFill(slider, speed, 10, 160);
    }
  }

  function ensurePanel() {
    if (!state.settings.autoScroll.showFloatingControl) {
      document.getElementById(PANEL_ID)?.remove();
      return;
    }

    let host = document.getElementById(PANEL_ID);
    if (host) {
      updatePanelUi();
      return;
    }

    host = document.createElement("div");
    host.id = PANEL_ID;
    host.className = "nf-autoscroll-panel";
    host.innerHTML =
      '<div class="nf-autoscroll-head">' +
      '<span class="nf-autoscroll-handle">Auto-scroll</span>' +
      '<span class="nf-autoscroll-status">Inactif</span>' +
      "</div>" +
      '<button type="button" class="nf-autoscroll-toggle">Démarrer</button>' +
      '<label class="nf-autoscroll-speed-wrap">' +
      '<div class="nf-autoscroll-speed-top">' +
      "<span>Vitesse</span>" +
      '<span class="nf-autoscroll-speed-value">45 px/s</span>' +
      "</div>" +
      '<input class="nf-autoscroll-speed" type="range" min="10" max="160" step="5" aria-label="Vitesse de défilement" />' +
      "</label>" +
      '<button type="button" class="nf-autoscroll-goto">↩ Retour lecteur</button>';

    document.body.appendChild(host);

    host.querySelector(".nf-autoscroll-toggle").addEventListener("click", toggleScroll);

    const slider = host.querySelector(".nf-autoscroll-speed");
    slider.addEventListener("input", () => setSpeed(Number(slider.value), { persist: false }));
    slider.addEventListener("change", () => setSpeed(Number(slider.value), { persist: true }));

    host.querySelector(".nf-autoscroll-goto").addEventListener("click", () => {
      document.querySelector(TTS_SECTION)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    applyPanelPosition(host);
    initPanelDrag(host, host.querySelector(".nf-autoscroll-handle"));
    updatePanelUi();
  }

  function initManualScrollPause() {
    const ignorePanel = (target) => target?.closest?.("#" + PANEL_ID);

    window.addEventListener(
      "wheel",
      (event) => {
        if (state.running && !ignorePanel(event.target)) {
          pauseTemporarily();
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      (event) => {
        if (state.running && !ignorePanel(event.target)) {
          pauseTemporarily();
        }
      },
      { passive: true }
    );
  }

  function initKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (!state.settings.keyboardShortcuts) {
        return;
      }
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) {
        return;
      }
      const key = state.settings.shortcuts?.toggleAutoScroll;
      if (key && event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        toggleScroll();
      }
    });
  }

  function initMessageBridge() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "NF_GET_AUTOSCROLL_STATE") {
        sendResponse({
          running: state.running && state.userEnabled,
          paused: state.paused,
          scrolling: state.running && state.userEnabled && !state.paused && canScrollNow(),
          speed: state.settings.autoScroll.speed,
          enabled: state.settings.autoScroll.enabled,
        });
        return true;
      }

      if (message.type === "NF_TOGGLE_AUTOSCROLL") {
        toggleScroll();
        sendResponse({
          ok: true,
          running: state.running && state.userEnabled,
          paused: state.paused,
        });
        return true;
      }

      if (message.type === "NF_SET_AUTOSCROLL_SPEED") {
        setSpeed(message.speed).then(() =>
          sendResponse({ ok: true, speed: state.settings.autoScroll.speed })
        );
        return true;
      }

      if (message.type === "NF_SETTINGS_UPDATED") {
        bootstrap().then(() => sendResponse({ ok: true }));
        return true;
      }

      return false;
    });
  }

  async function bootstrap() {
    state.settings = await NFStorage.getSettings();
    ensurePanel();

    if (!state.settings.autoScroll.enabled) {
      if (!state.userEnabled) {
        stopScroll(false);
      }
    } else if (!state.userToggledOff && !state.running) {
      state.userEnabled = true;
      startScroll(false);
    }

    updatePanelUi();
  }

  async function start() {
    await bootstrap();
    initManualScrollPause();
    initKeyboard();
    initMessageBridge();

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.userEnabled && state.running) {
        state.lastFrame = 0;
      }
      updatePanelUi();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.nf_settings) {
        bootstrap();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
