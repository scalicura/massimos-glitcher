import './styles.css';
import { closeImageSource, formatFileSize, loadImageFile } from './image-io.js';
import { renderImage, renderSourceImage } from './renderer.js';
import { exportImage } from './export.js';
import { cloneSettings, defaultSettings, EFFECT_KEYS, PRESETS, settingsForPreset } from './presets.js';
import { normalizeSeed } from './random/seeded-random.js';
import { initSoundboard } from './audio/soundboard.js';
import { initYouTubePlayer } from './youtube/youtube-player.js';
import { initRetroLab } from './retro/retro-lab.js';
import { initGlitchStudio } from './studio/glitch-studio.js';

const avatarHappy = new URL('../assets/avatar-happy.png', import.meta.url).href;
const avatarSurprised = new URL('../assets/avatar-surprised.png', import.meta.url).href;
const massimoPixelPortrait = new URL('../assets/massimo-pixel-portrait.png', import.meta.url).href;
const HISTORY_LIMIT = 30;
const RENDER_DEBOUNCE_MS = 48;

const elements = {
  fileInput: document.querySelector('#file-input'),
  browseButton: document.querySelector('#browse-button'),
  emptyUploadButton: document.querySelector('#empty-upload-button'),
  dropZone: document.querySelector('#drop-zone'),
  previewStage: document.querySelector('#preview-stage'),
  stageDropOverlay: document.querySelector('#stage-drop-overlay'),
  canvas: document.querySelector('#preview-canvas'),
  emptyState: document.querySelector('#empty-state'),
  uploadError: document.querySelector('#upload-error'),
  effectsFieldset: document.querySelector('#effects-fieldset'),
  presetFieldset: document.querySelector('#preset-fieldset'),
  exportFieldset: document.querySelector('#export-fieldset'),
  randomizeButton: document.querySelector('#randomize-button'),
  resetButton: document.querySelector('#reset-button'),
  compareButton: document.querySelector('#compare-button'),
  undoButton: document.querySelector('#undo-button'),
  redoButton: document.querySelector('#redo-button'),
  exportButton: document.querySelector('#export-button'),
  exportFormat: document.querySelector('#export-format'),
  exportQuality: document.querySelector('#export-quality'),
  exportQualityOutput: document.querySelector('#export-quality-output'),
  qualityControl: document.querySelector('#quality-control'),
  renderStatus: document.querySelector('#render-status'),
  imageMeta: document.querySelector('#image-meta'),
  seedInput: document.querySelector('#seed-input'),
  seedMessage: document.querySelector('#seed-message'),
  newSeedButton: document.querySelector('#new-seed-button'),
};

function assignMascot(selector, source) {
  const image = document.querySelector(selector);
  if (!image) return;
  image.addEventListener('load', () => { image.hidden = false; });
  image.addEventListener('error', () => { image.hidden = true; });
  image.src = source;
}

assignMascot('#header-avatar', avatarHappy);
['#random-avatar', '#datamosh-avatar', '#soundboard-stop-avatar'].forEach((selector) => assignMascot(selector, avatarSurprised));
assignMascot('#empty-avatar', massimoPixelPortrait);

const state = {
  // The decoded source remains immutable; previews and exports always start here.
  originalImage: null,
  renderFrame: null,
  renderTimeout: null,
  isExporting: false,
  showingOriginal: false,
  settings: defaultSettings(),
  historyPast: [],
  historyFuture: [],
};
const rangeHistorySnapshots = new WeakMap();

function valueFromInput(input) {
  return input.tagName === 'SELECT' ? input.value : Number(input.value);
}

function settingFromControl(control) {
  const key = control.dataset.effect;
  const enabled = control.querySelector(`[data-toggle="${key}"]`).checked;
  const parameters = [...control.querySelectorAll('[data-param]')];
  if (!parameters.length) {
    return { enabled, value: Number(control.querySelector(`[data-range="${key}"]`).value) };
  }
  return Object.fromEntries([
    ['enabled', enabled],
    ...parameters.map((input) => [input.dataset.param, valueFromInput(input)]),
  ]);
}

function readSettings(seed = state.settings.seed) {
  const settings = { seed: normalizeSeed(seed) };
  document.querySelectorAll('[data-effect]').forEach((control) => {
    settings[control.dataset.effect] = settingFromControl(control);
  });
  return settings;
}

function createSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0];
}

function settingsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function updateHistoryButtons() {
  const canEdit = Boolean(state.originalImage) && !state.isExporting;
  elements.undoButton.disabled = !canEdit || state.historyPast.length === 0;
  elements.redoButton.disabled = !canEdit || state.historyFuture.length === 0;
}

function recordHistory(previousSettings) {
  if (settingsMatch(previousSettings, state.settings)) return;
  state.historyPast.push(cloneSettings(previousSettings));
  if (state.historyPast.length > HISTORY_LIMIT) state.historyPast.shift();
  state.historyFuture = [];
  updateHistoryButtons();
}

function clearHistory() {
  state.historyPast = [];
  state.historyFuture = [];
  updateHistoryButtons();
}

function clearActivePreset() {
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.classList.remove('is-active');
    button.removeAttribute('aria-pressed');
  });
}

function syncSeedControl(message = '') {
  elements.seedInput.value = String(state.settings.seed);
  elements.seedMessage.textContent = message || `Active seed: ${state.settings.seed}`;
  elements.seedMessage.dataset.mode = 'ready';
}

function syncControlsFromSettings() {
  EFFECT_KEYS.forEach((key) => {
    const setting = state.settings[key];
    const control = document.querySelector(`[data-effect="${key}"]`);
    if (!setting || !control) return;
    const toggle = control.querySelector(`[data-toggle="${key}"]`);
    toggle.checked = setting.enabled;
    const parameters = [...control.querySelectorAll('[data-param]')];
    if (parameters.length) {
      parameters.forEach((input) => {
        input.value = String(setting[input.dataset.param]);
        input.disabled = !setting.enabled;
        const output = control.querySelector(`[data-output-param="${input.dataset.param}"]`);
        if (output) output.value = String(setting[input.dataset.param]);
      });
    } else {
      const range = control.querySelector(`[data-range="${key}"]`);
      range.value = String(setting.value);
      range.disabled = !setting.enabled;
      control.querySelector(`[data-output="${key}"]`).value = String(setting.value);
    }
    control.classList.toggle('is-off', !setting.enabled);
  });
  syncSeedControl();
}

function performRender({ synchronous = false } = {}) {
  state.renderTimeout = null;
  const render = () => {
    try {
      if (state.showingOriginal) renderSourceImage(elements.canvas, state.originalImage);
      else renderImage(elements.canvas, state.originalImage, state.settings);
      elements.canvas.hidden = false;
      elements.emptyState.hidden = true;
      setStatus(state.showingOriginal ? 'Showing original' : 'Signal live', 'ready');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'The preview could not be rendered.');
      setStatus('Render error', 'error');
      console.error(error);
    } finally {
      state.renderFrame = null;
    }
  };
  if (synchronous) render();
  else state.renderFrame = requestAnimationFrame(render);
}

function scheduleRender({ immediate = false } = {}) {
  if (!state.originalImage) return;
  if (state.renderFrame) cancelAnimationFrame(state.renderFrame);
  if (state.renderTimeout) window.clearTimeout(state.renderTimeout);
  setStatus('Rendering', 'working');
  if (immediate) performRender({ synchronous: true });
  else state.renderTimeout = window.setTimeout(performRender, RENDER_DEBOUNCE_MS);
}

function enableEditorControls(enabled) {
  elements.effectsFieldset.disabled = !enabled;
  elements.presetFieldset.disabled = !enabled;
  elements.exportFieldset.disabled = !enabled;
  elements.randomizeButton.disabled = !enabled;
  elements.resetButton.disabled = !enabled;
  elements.compareButton.disabled = !enabled;
  elements.exportButton.disabled = !enabled;
  updateHistoryButtons();
}

function resetComparison() {
  state.showingOriginal = false;
  elements.compareButton.classList.remove('is-active');
  elements.compareButton.setAttribute('aria-pressed', 'false');
  elements.compareButton.querySelector('span').textContent = 'Compare';
}

async function handleFile(file) {
  hideError();
  setStatus('Decoding', 'working');
  try {
    const nextImage = await loadImageFile(file);
    closeImageSource(state.originalImage?.source);
    state.originalImage = nextImage;
    resetComparison();
    elements.imageMeta.textContent = `${nextImage.width} × ${nextImage.height} · ${formatFileSize(nextImage.size)}`;
    enableEditorControls(true);
    clearHistory();
    scheduleRender({ immediate: true });
  } catch (error) {
    showError(error instanceof Error ? error.message : 'The image could not be loaded.');
    setStatus(state.originalImage ? 'Signal live' : 'Awaiting image', state.originalImage ? 'ready' : 'idle');
  } finally {
    elements.fileInput.value = '';
  }
}

function setStatus(message, mode = 'idle') {
  elements.renderStatus.lastChild.textContent = ` ${message}`;
  elements.renderStatus.dataset.mode = mode;
}

function showError(message) {
  elements.uploadError.textContent = message;
  elements.uploadError.hidden = false;
}

function hideError() {
  elements.uploadError.hidden = true;
  elements.uploadError.textContent = '';
}

function resetEffects() {
  const previous = cloneSettings(state.settings);
  state.settings = defaultSettings();
  resetComparison();
  clearActivePreset();
  syncControlsFromSettings();
  recordHistory(previous);
  scheduleRender({ immediate: true });
}

function toggleComparison() {
  if (!state.originalImage || state.isExporting) return;
  state.showingOriginal = !state.showingOriginal;
  elements.compareButton.classList.toggle('is-active', state.showingOriginal);
  elements.compareButton.setAttribute('aria-pressed', String(state.showingOriginal));
  elements.compareButton.querySelector('span').textContent = state.showingOriginal ? 'Original' : 'Compare';
  scheduleRender({ immediate: true });
}

function randomizedInputValue(input) {
  if (input.dataset.param === 'seed') return 0;
  if (input.tagName === 'SELECT') {
    const options = [...input.options];
    return options[Math.floor(Math.random() * options.length)].value;
  }
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  return Math.round(minimum + Math.random() * (maximum - minimum) * 0.82);
}

function randomizeEffects() {
  const previous = cloneSettings(state.settings);
  const randomized = defaultSettings(createSeed());
  document.querySelectorAll('[data-effect]').forEach((control) => {
    const key = control.dataset.effect;
    const parameters = [...control.querySelectorAll('[data-param]')];
    randomized[key].enabled = true;
    if (parameters.length) parameters.forEach((input) => { randomized[key][input.dataset.param] = randomizedInputValue(input); });
    else randomized[key].value = randomizedInputValue(control.querySelector(`[data-range="${key}"]`));
  });
  state.settings = randomized;
  clearActivePreset();
  syncControlsFromSettings();
  recordHistory(previous);
  scheduleRender();
}

function applyPreset(name, button) {
  const previous = cloneSettings(state.settings);
  state.settings = settingsForPreset(name, state.settings.seed);
  syncControlsFromSettings();
  clearActivePreset();
  button.classList.add('is-active');
  button.setAttribute('aria-pressed', 'true');
  recordHistory(previous);
  scheduleRender();
  setStatus(`${PRESETS[name].label} loaded`, 'ready');
}

function undo() {
  if (state.historyPast.length === 0 || !state.originalImage) return;
  state.historyFuture.push(cloneSettings(state.settings));
  state.settings = state.historyPast.pop();
  clearActivePreset();
  syncControlsFromSettings();
  updateHistoryButtons();
  scheduleRender();
}

function redo() {
  if (state.historyFuture.length === 0 || !state.originalImage) return;
  state.historyPast.push(cloneSettings(state.settings));
  state.settings = state.historyFuture.pop();
  clearActivePreset();
  syncControlsFromSettings();
  updateHistoryButtons();
  scheduleRender();
}

function updateExportControls() {
  const format = elements.exportFormat.value;
  const hasQuality = format !== 'png';
  elements.qualityControl.classList.toggle('is-hidden', !hasQuality);
  const label = format === 'jpeg' ? 'JPEG' : format === 'webp' ? 'WebP' : 'PNG';
  elements.exportButton.innerHTML = `Export ${label} <span aria-hidden="true">↓</span>`;
}

async function handleExport() {
  if (!state.originalImage || state.isExporting) return;
  state.isExporting = true;
  elements.exportButton.disabled = true;
  elements.exportFieldset.disabled = true;
  elements.compareButton.disabled = true;
  elements.exportButton.textContent = 'Rendering full size…';
  updateHistoryButtons();
  setStatus('Exporting in background', 'working');
  try {
    const format = elements.exportFormat.value;
    const result = await exportImage(state.originalImage, state.settings, {
      format,
      quality: Number(elements.exportQuality.value) / 100,
    });
    const formatLabel = format === 'jpeg' ? 'JPEG' : format === 'webp' ? 'WebP' : 'PNG';
    elements.exportButton.dataset.exportEngine = result.engine;
    elements.exportButton.dataset.exportSize = String(result.size);
    elements.exportButton.dataset.exportWidth = String(state.originalImage.width);
    elements.exportButton.dataset.exportHeight = String(state.originalImage.height);
    setStatus(`${formatLabel} exported · ${formatFileSize(result.size)}`, 'ready');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Export failed.');
    setStatus('Export error', 'error');
    console.error(error);
  } finally {
    state.isExporting = false;
    elements.exportButton.disabled = false;
    elements.exportFieldset.disabled = false;
    elements.compareButton.disabled = false;
    updateExportControls();
    updateHistoryButtons();
  }
}

function commitRangeHistory(input) {
  const previous = rangeHistorySnapshots.get(input);
  if (!previous) return;
  recordHistory(previous);
  rangeHistorySnapshots.delete(input);
}

function updateParameterOutput(input) {
  const control = input.closest('[data-effect]');
  const output = input.dataset.param
    ? control.querySelector(`[data-output-param="${input.dataset.param}"]`)
    : control.querySelector(`[data-output="${input.dataset.range}"]`);
  if (output) output.value = input.value;
}

function setSeed(value, message = '') {
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw) || Number(raw) > 0xffffffff) {
    elements.seedMessage.textContent = 'Seed must be a whole number from 0 to 4294967295.';
    elements.seedMessage.dataset.mode = 'error';
    elements.seedInput.value = String(state.settings.seed);
    return;
  }
  const previous = cloneSettings(state.settings);
  state.settings.seed = normalizeSeed(raw);
  clearActivePreset();
  syncSeedControl(message || `Active seed: ${state.settings.seed}`);
  recordHistory(previous);
  scheduleRender();
}

elements.browseButton.addEventListener('click', (event) => { event.stopPropagation(); elements.fileInput.click(); });
elements.emptyUploadButton.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('click', () => elements.fileInput.click());
elements.dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.fileInput.click(); }
});
elements.fileInput.addEventListener('change', () => handleFile(elements.fileInput.files[0]));
elements.resetButton.addEventListener('click', resetEffects);
elements.compareButton.addEventListener('click', toggleComparison);
elements.randomizeButton.addEventListener('click', randomizeEffects);
elements.undoButton.addEventListener('click', undo);
elements.redoButton.addEventListener('click', redo);
elements.exportButton.addEventListener('click', handleExport);
elements.seedInput.addEventListener('change', () => setSeed(elements.seedInput.value));
elements.seedInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    setSeed(elements.seedInput.value);
    elements.seedInput.select();
  }
});
elements.newSeedButton.addEventListener('click', () => setSeed(createSeed(), 'New deterministic seed generated.'));

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset, button));
});

document.querySelectorAll('[data-range], [data-param]').forEach((input) => {
  input.addEventListener('input', () => {
    if (!rangeHistorySnapshots.has(input)) rangeHistorySnapshots.set(input, cloneSettings(state.settings));
    updateParameterOutput(input);
    state.settings = readSettings(state.settings.seed);
    clearActivePreset();
    scheduleRender();
  });
  input.addEventListener('change', () => commitRangeHistory(input));
  input.addEventListener('blur', () => commitRangeHistory(input));
});

document.querySelectorAll('[data-toggle]').forEach((toggle) => {
  toggle.addEventListener('change', () => {
    const previous = cloneSettings(state.settings);
    const control = toggle.closest('[data-effect]');
    control.querySelectorAll('[data-range], [data-param]').forEach((input) => { input.disabled = !toggle.checked; });
    control.classList.toggle('is-off', !toggle.checked);
    state.settings = readSettings(state.settings.seed);
    clearActivePreset();
    recordHistory(previous);
    scheduleRender();
  });
});

elements.exportFormat.addEventListener('change', updateExportControls);
elements.exportQuality.addEventListener('input', () => { elements.exportQualityOutput.value = elements.exportQuality.value; });

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
  if (!state.originalImage || document.querySelector('#image-workspace').hidden || event.target.matches('input, textarea, select')) return;
  event.preventDefault();
  if (event.shiftKey) redo();
  else undo();
});

let dragDepth = 0;
[elements.dropZone, elements.previewStage].forEach((target) => {
  target.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    elements.stageDropOverlay.classList.add('is-visible');
    elements.dropZone.classList.add('is-dragging');
  });
  target.addEventListener('dragover', (event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; });
  target.addEventListener('dragleave', (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      elements.stageDropOverlay.classList.remove('is-visible');
      elements.dropZone.classList.remove('is-dragging');
    }
  });
  target.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    elements.stageDropOverlay.classList.remove('is-visible');
    elements.dropZone.classList.remove('is-dragging');
    handleFile(event.dataTransfer?.files[0]);
  });
});

const soundboard = initSoundboard(document.querySelector('#audio-workspace'));
const youtubePlayer = initYouTubePlayer(document.querySelector('#audio-workspace'));
const retroLab = initRetroLab(document.querySelector('#retro-workspace'));
const glitchStudio = initGlitchStudio(document.querySelector('#glitch-workspace'), {
  getSoundboardPads: () => soundboard.getState().pads.values(),
});

function switchWorkspace(targetId) {
  document.querySelectorAll('[data-workspace]').forEach((workspace) => { workspace.hidden = workspace.id !== targetId; });
  document.querySelectorAll('[data-workspace-target]').forEach((button) => {
    const active = button.dataset.workspaceTarget === targetId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  if (targetId !== 'audio-workspace') {
    soundboard.stopAll();
    youtubePlayer.pause();
  }
  if (targetId !== 'retro-workspace') retroLab.pause('workspace-switch');
  if (targetId !== 'glitch-workspace') glitchStudio.pause('workspace-switch');
  else glitchStudio.onShow();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-workspace-target]').forEach((button) => {
  button.addEventListener('click', () => switchWorkspace(button.dataset.workspaceTarget));
});

window.addEventListener('beforeunload', () => {
  closeImageSource(state.originalImage?.source);
  soundboard.destroy();
  youtubePlayer.pause();
  retroLab.destroy();
  glitchStudio.destroy();
});

syncControlsFromSettings();
updateExportControls();
enableEditorControls(false);
