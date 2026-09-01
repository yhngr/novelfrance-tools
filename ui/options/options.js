const fields = {
  autoScrollEnabled: document.getElementById("autoScrollEnabled"),
  autoScrollSpeed: document.getElementById("autoScrollSpeed"),
  autoScrollSpeedValue: document.getElementById("autoScrollSpeedValue"),
  autoScrollOnlyPlaying: document.getElementById("autoScrollOnlyPlaying"),
  autoScrollPauseManual: document.getElementById("autoScrollPauseManual"),
  autoScrollShowPanel: document.getElementById("autoScrollShowPanel"),
  shortcutAutoScroll: document.getElementById("shortcutAutoScroll"),
  readerShowProgress: document.getElementById("readerShowProgress"),
  readerShowPanel: document.getElementById("readerShowPanel"),
  autoNextChapter: document.getElementById("autoNextChapter"),
  shortcutSeekBackward: document.getElementById("shortcutSeekBackward"),
  shortcutSeekForward: document.getElementById("shortcutSeekForward"),
  shortcutRateDown: document.getElementById("shortcutRateDown"),
  shortcutRateUp: document.getElementById("shortcutRateUp"),
  defaultVolume: document.getElementById("defaultVolume"),
  sliderStep: document.getElementById("sliderStep"),
  boostEnabled: document.getElementById("boostEnabled"),
  maxBoost: document.getElementById("maxBoost"),
  limiterEnabled: document.getElementById("limiterEnabled"),
  narratorNormalization: document.getElementById("narratorNormalization"),
  fadeEnabled: document.getElementById("fadeEnabled"),
  fadeDurationMs: document.getElementById("fadeDurationMs"),
  chapterEndNotification: document.getElementById("chapterEndNotification"),
  keyboardShortcuts: document.getElementById("keyboardShortcuts"),
  shortcutMute: document.getElementById("shortcutMute"),
  shortcutUp: document.getElementById("shortcutUp"),
  shortcutDown: document.getElementById("shortcutDown"),
  floatingControl: document.getElementById("floatingControl"),
  compactPresets: document.getElementById("compactPresets"),
  eqBass: document.getElementById("eqBass"),
  eqMid: document.getElementById("eqMid"),
  eqTreble: document.getElementById("eqTreble"),
  eqBassValue: document.getElementById("eqBassValue"),
  eqMidValue: document.getElementById("eqMidValue"),
  eqTrebleValue: document.getElementById("eqTrebleValue"),
};

const saveBtn = document.getElementById("save-btn");
const resetPanelPositionsBtn = document.getElementById("resetPanelPositions");
const statusEl = document.getElementById("status");

function setRangeFill(input, value, min, max) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--fill", fill + "%");
}

function bindRange(input, output, formatter, min, max) {
  const update = () => {
    const value = Number(input.value);
    output.textContent = formatter(value);
    setRangeFill(input, value, min, max);
  };
  input.addEventListener("input", update);
  update();
}

bindRange(
  fields.autoScrollSpeed,
  fields.autoScrollSpeedValue,
  (v) => v + " px/s",
  10,
  160
);

bindRange(fields.eqBass, fields.eqBassValue, (v) => v + " dB", -12, 12);
bindRange(fields.eqMid, fields.eqMidValue, (v) => v + " dB", -12, 12);
bindRange(fields.eqTreble, fields.eqTrebleValue, (v) => v + " dB", -12, 12);

async function loadOptions() {
  const settings = await NFStorage.getSettings();
  const scroll = settings.autoScroll;

  fields.autoScrollEnabled.checked = scroll.enabled;
  fields.autoScrollSpeed.value = scroll.speed;
  fields.autoScrollSpeedValue.textContent = scroll.speed + " px/s";
  setRangeFill(fields.autoScrollSpeed, scroll.speed, 10, 160);
  fields.autoScrollOnlyPlaying.checked = scroll.onlyWhenPlaying;
  fields.autoScrollPauseManual.checked = scroll.pauseOnManualScroll;
  fields.autoScrollShowPanel.checked = scroll.showFloatingControl;
  fields.shortcutAutoScroll.value = settings.shortcuts.toggleAutoScroll;
  fields.readerShowProgress.checked = settings.reader.showProgressBar;
  fields.readerShowPanel.checked = settings.reader.showFloatingPanel;
  fields.autoNextChapter.checked = settings.reader.autoNextChapter;
  fields.shortcutSeekBackward.value = settings.shortcuts.seekBackward;
  fields.shortcutSeekForward.value = settings.shortcuts.seekForward;
  fields.shortcutRateDown.value = settings.shortcuts.rateDown;
  fields.shortcutRateUp.value = settings.shortcuts.rateUp;

  fields.defaultVolume.value = settings.defaultVolume;
  fields.sliderStep.value = settings.sliderStep;
  fields.boostEnabled.checked = settings.boostEnabled;
  fields.maxBoost.value = settings.maxBoost;
  fields.limiterEnabled.checked = settings.limiterEnabled;
  fields.narratorNormalization.checked = settings.narratorNormalization;
  fields.fadeEnabled.checked = settings.fadeEnabled;
  fields.fadeDurationMs.value = settings.fadeDurationMs;
  fields.chapterEndNotification.checked = settings.chapterEndNotification;
  fields.keyboardShortcuts.checked = settings.keyboardShortcuts;
  fields.shortcutMute.value = settings.shortcuts.mute;
  fields.shortcutUp.value = settings.shortcuts.volumeUp;
  fields.shortcutDown.value = settings.shortcuts.volumeDown;
  fields.floatingControl.checked = settings.floatingControl;
  fields.compactPresets.checked = settings.compactPresets;
  fields.eqBass.value = settings.equalizer.bass;
  fields.eqMid.value = settings.equalizer.mid;
  fields.eqTreble.value = settings.equalizer.treble;
  fields.eqBassValue.textContent = settings.equalizer.bass + " dB";
  fields.eqMidValue.textContent = settings.equalizer.mid + " dB";
  fields.eqTrebleValue.textContent = settings.equalizer.treble + " dB";
  setRangeFill(fields.eqBass, settings.equalizer.bass, -12, 12);
  setRangeFill(fields.eqMid, settings.equalizer.mid, -12, 12);
  setRangeFill(fields.eqTreble, settings.equalizer.treble, -12, 12);
}

async function saveOptions() {
  const current = await NFStorage.getSettings();

  const settings = {
    defaultVolume: Number(fields.defaultVolume.value),
    sliderStep: Number(fields.sliderStep.value),
    boostEnabled: fields.boostEnabled.checked,
    maxBoost: Number(fields.maxBoost.value),
    limiterEnabled: fields.limiterEnabled.checked,
    narratorNormalization: fields.narratorNormalization.checked,
    fadeEnabled: fields.fadeEnabled.checked,
    fadeDurationMs: Number(fields.fadeDurationMs.value),
    chapterEndNotification: fields.chapterEndNotification.checked,
    keyboardShortcuts: fields.keyboardShortcuts.checked,
    floatingControl: fields.floatingControl.checked,
    compactPresets: fields.compactPresets.checked,
    equalizer: {
      bass: Number(fields.eqBass.value),
      mid: Number(fields.eqMid.value),
      treble: Number(fields.eqTreble.value),
    },
    shortcuts: {
      mute: fields.shortcutMute.value.trim() || "m",
      volumeUp: fields.shortcutUp.value.trim() || "ArrowUp",
      volumeDown: fields.shortcutDown.value.trim() || "ArrowDown",
      toggleAutoScroll: fields.shortcutAutoScroll.value.trim() || "s",
      seekBackward: fields.shortcutSeekBackward.value.trim() || "j",
      seekForward: fields.shortcutSeekForward.value.trim() || "l",
      rateDown: fields.shortcutRateDown.value.trim() || "[",
      rateUp: fields.shortcutRateUp.value.trim() || "]",
    },
    autoScroll: {
      enabled: fields.autoScrollEnabled.checked,
      speed: Number(fields.autoScrollSpeed.value),
      onlyWhenPlaying: fields.autoScrollOnlyPlaying.checked,
      pauseOnManualScroll: fields.autoScrollPauseManual.checked,
      showFloatingControl: fields.autoScrollShowPanel.checked,
    },
    reader: {
      showProgressBar: fields.readerShowProgress.checked,
      showFloatingPanel: fields.readerShowPanel.checked,
      autoNextChapter: fields.autoNextChapter.checked,
    },
    floatingPosition: current.floatingPosition,
    autoScrollPosition: current.autoScrollPosition,
    readerPanelPosition: current.readerPanelPosition,
  };

  await NFStorage.saveSettings(settings);
  await notifyOpenTabs();

  statusEl.textContent = "Enregistré ✓";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2500);
}

async function notifyOpenTabs() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach((tab) => {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "NF_SETTINGS_UPDATED" }).catch(() => {});
    }
  });
}

async function resetPanelPositions() {
  const current = await NFStorage.getSettings();
  current.floatingPosition = null;
  current.autoScrollPosition = null;
  current.readerPanelPosition = null;
  await NFStorage.saveSettings(current);
  await notifyOpenTabs();
  statusEl.textContent = "Positions réinitialisées ✓";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2500);
}

saveBtn.addEventListener("click", saveOptions);
resetPanelPositionsBtn.addEventListener("click", resetPanelPositions);
loadOptions();
