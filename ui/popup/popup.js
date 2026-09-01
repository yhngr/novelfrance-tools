const PRESETS = [25, 50, 75, 100];

const MUTE_ON =
  "M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6M17 9l6 6";
const MUTE_OFF =
  "M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14";

const slider = document.getElementById("volume-slider");
const valueEl = document.getElementById("volume-value");
const muteBtn = document.getElementById("mute-btn");
const muteIcon = document.getElementById("mute-icon");
const presetsEl = document.getElementById("presets");
const profilesEl = document.getElementById("profiles");
const contextLabel = document.getElementById("context-label");
const optionsLink = document.getElementById("options-link");
const shortcutHint = document.getElementById("shortcut-hint");
const scrollToggle = document.getElementById("scroll-toggle");
const scrollSpeed = document.getElementById("scroll-speed");
const scrollSpeedValue = document.getElementById("scroll-speed-value");
const scrollStatus = document.getElementById("scroll-status");

let currentVolume = 100;
let currentMax = 100;

optionsLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

function setRangeFill(input, value, max) {
  const fill = max > 0 ? (value / max) * 100 : 0;
  input.style.setProperty("--fill", fill + "%");
}

function renderPresets(max) {
  presetsEl.innerHTML = "";
  PRESETS.forEach((preset) => {
    if (preset > max) {
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = preset + "%";
    btn.classList.toggle("is-active", preset === currentVolume);
    btn.addEventListener("click", () => sendToTab({ type: "NF_SET_VOLUME", volume: preset }).then(loadState));
    presetsEl.appendChild(btn);
  });
}

function renderProfiles() {
  profilesEl.innerHTML = "";
  Object.entries(NFStorage.PROFILES).forEach(([key, profile]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = profile.label;
    btn.addEventListener("click", () => sendToTab({ type: "NF_APPLY_PROFILE", profile: key }).then(loadState));
    profilesEl.appendChild(btn);
  });
}

function renderShortcuts(settings) {
  if (!settings?.shortcuts) {
    shortcutHint.innerHTML = "";
    return;
  }
  const s = settings.shortcuts;
  const items = [
    s.toggleAutoScroll.replace("ArrowUp", "↑").replace("ArrowDown", "↓"),
    s.mute.replace("ArrowUp", "↑").replace("ArrowDown", "↓"),
    s.volumeUp.replace("ArrowUp", "↑").replace("ArrowDown", "↓") +
      "/" +
      s.volumeDown.replace("ArrowUp", "↑").replace("ArrowDown", "↓"),
  ];
  shortcutHint.innerHTML = items.map((key) => `<kbd>${key}</kbd>`).join("");
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return null;
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (_error) {
    contextLabel.textContent = "Ouvrez un chapitre novelfrance.fr";
    contextLabel.classList.add("header-context--warn");
    return null;
  }
}

function updateVolumeUi(state, settings) {
  const display = state.muted ? 0 : state.volume;
  currentVolume = display;
  currentMax = state.max || 100;

  slider.max = String(currentMax);
  slider.step = String(settings?.sliderStep || 5);
  slider.value = String(display);
  valueEl.textContent = display + "%";

  muteBtn.classList.toggle("is-muted", display === 0);
  muteIcon.querySelector("path").setAttribute("d", display === 0 ? MUTE_ON : MUTE_OFF);

  contextLabel.classList.remove("header-context--warn");
  contextLabel.textContent = state.narrator
    ? `${state.narrator}${state.novel ? " · " + state.novel : ""}`
    : state.novel || "novelfrance.fr";

  renderPresets(currentMax);
  setRangeFill(slider, display, currentMax);
}

function updateScrollUi(scrollState, settings) {
  const speed = scrollState?.speed || settings.autoScroll.speed;
  const active = Boolean(scrollState?.running);
  const paused = Boolean(scrollState?.paused);
  const scrolling = Boolean(scrollState?.scrolling);

  scrollSpeed.value = String(speed);
  scrollSpeedValue.textContent = speed + " px/s";
  setRangeFill(scrollSpeed, speed - 10, 160);

  if (paused) {
    scrollToggle.textContent = "Reprendre le défilement";
    scrollToggle.classList.remove("is-active");
    scrollStatus.textContent = "Pause";
    scrollStatus.classList.remove("badge--active");
  } else if (scrolling) {
    scrollToggle.textContent = "Pause le défilement";
    scrollToggle.classList.add("is-active");
    scrollStatus.textContent = "Actif";
    scrollStatus.classList.add("badge--active");
  } else if (active) {
    scrollToggle.textContent = "Pause le défilement";
    scrollToggle.classList.add("is-active");
    scrollStatus.textContent = "En attente";
    scrollStatus.classList.remove("badge--active");
  } else {
    scrollToggle.textContent = "Activer le défilement";
    scrollToggle.classList.remove("is-active");
    scrollStatus.textContent = "Inactif";
    scrollStatus.classList.remove("badge--active");
  }
}

async function loadState() {
  const settings = await NFStorage.getSettings();
  renderProfiles();

  const [volumeState, scrollState] = await Promise.all([
    sendToTab({ type: "NF_GET_STATE" }),
    sendToTab({ type: "NF_GET_AUTOSCROLL_STATE" }),
  ]);

  if (volumeState) {
    updateVolumeUi(volumeState, settings);
  } else {
    const volumes = await NFStorage.getVolumes();
    updateVolumeUi(
      {
        volume: volumes.global,
        muted: volumes.global === 0,
        max: settings.boostEnabled ? settings.maxBoost : 100,
        novel: null,
        narrator: null,
      },
      settings
    );
  }

  updateScrollUi(scrollState, settings);
  renderShortcuts(settings);
}

slider.addEventListener("input", () => {
  const volume = Number(slider.value);
  currentVolume = volume;
  valueEl.textContent = volume + "%";
  setRangeFill(slider, volume, Number(slider.max));
  renderPresets(Number(slider.max));
  sendToTab({ type: "NF_SET_VOLUME", volume });
});

muteBtn.addEventListener("click", () => {
  sendToTab({ type: "NF_TOGGLE_MUTE" }).then(loadState);
});

scrollToggle.addEventListener("click", () => {
  sendToTab({ type: "NF_TOGGLE_AUTOSCROLL" }).then(loadState);
});

scrollSpeed.addEventListener("input", () => {
  const speed = Number(scrollSpeed.value);
  scrollSpeedValue.textContent = speed + " px/s";
  setRangeFill(scrollSpeed, speed - 10, 160);
  sendToTab({ type: "NF_SET_AUTOSCROLL_SPEED", speed });
});

loadState();
