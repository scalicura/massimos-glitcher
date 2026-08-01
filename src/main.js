import './styles.css';
import { closeImageSource, formatFileSize, loadImageFile } from './image-io.js';
import { renderImage } from './renderer.js';
import { exportImage } from './export.js';
import { cloneSettings, EFFECT_KEYS, PRESETS, settingsForPreset } from './presets.js';

const avatarHappy = new URL('../assets/avatar-happy.png', import.meta.url).href;
const avatarSurprised = new URL('../assets/avatar-surprised.png', import.meta.url).href;
const HISTORY_LIMIT = 30;

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
  undoButton: document.querySelector('#undo-button'),
  redoButton: document.querySelector('#redo-button'),
  exportButton: document.querySelector('#export-button'),
  exportFormat: document.querySelector('#export-format'),
  exportQuality: document.querySelector('#export-quality'),
  exportQualityOutput: document.querySelector('#export-quality-output'),
  qualityControl: document.querySelector('#quality-control'),
  renderStatus: document.querySelector('#render-status'),
  imageMeta: document.querySelector('#image-meta'),
};

document.querySelector('#header-avatar').src = avatarHappy;
document.querySelector('#empty-avatar').src = avatarHappy;
document.querySelector('#random-avatar').src = avatarSurprised;

const state = {
  // The decoded source is immutable. Preview, history, and export never paint into it.
  originalImage: null,
  renderFrame: null,
  isExporting: false,
  settings: readSettings(),
  historyPast: [],
  historyFuture: [],
};

const rangeHistorySnapshots = new WeakMap();

function readSettings(seed = 3817) {
  const settings = { seed };
  document.querySelectorAll('[data-effect]').forEach((control) => {
    const key = control.dataset.effect;
    settings[key] = {
      enabled: control.querySelector(`[data-toggle="${key}"]`).checked,
      value: Number(control.querySelector(`[data-range="${key}"]`).value),
    };
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

function syncControlsFromSettings() {
  EFFECT_KEYS.forEach((key) => {
    const setting = state.settings[key];
    const control = document.querySelector(`[data-effect="${key}"]`);
    const toggle = control.querySelector(`[data-toggle="${key}"]`);
    const range = control.querySelector(`[data-range="${key}"]`);
    toggle.checked = setting.enabled;
    range.value = String(setting.value);
    range.disabled = !setting.enabled;
    control.querySelector(`[data-output="${key}"]`).value = String(setting.value);
    control.classList.toggle('is-off', !setting.enabled);
  });
}

function scheduleRender() {
  if (!state.originalImage) return;
  if (state.renderFrame) cancelAnimationFrame(state.renderFrame);
  setStatus('Rendering', 'working');
  state.renderFrame = requestAnimationFrame(() => {
    try {
      renderImage(elements.canvas, state.originalImage, state.settings);
      elements.canvas.hidden = false;
      elements.emptyState.hidden = true;
      setStatus('Signal live', 'ready');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'The preview could not be rendered.');
      setStatus('Render error', 'error');
      console.error(error);
    } finally {
      state.renderFrame = null;
    }
  });
}

function enableEditorControls(enabled) {
  elements.effectsFieldset.disabled = !enabled;
  elements.presetFieldset.disabled = !enabled;
  elements.exportFieldset.disabled = !enabled;
  elements.randomizeButton.disabled = !enabled;
  elements.resetButton.disabled = !enabled;
  elements.exportButton.disabled = !enabled;
  updateHistoryButtons();
}

async function handleFile(file) {
  hideError();
  setStatus('Decoding', 'working');
  try {
    const nextImage = await loadImageFile(file);
    closeImageSource(state.originalImage?.source);
    state.originalImage = nextImage;
    elements.imageMeta.textContent = `${nextImage.width} × ${nextImage.height} · ${formatFileSize(nextImage.size)}`;
    enableEditorControls(true);
    clearHistory();
    scheduleRender();
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

function openFilePicker() {
  elements.fileInput.click();
}

function resetEffects() {
  const previous = cloneSettings(state.settings);
  EFFECT_KEYS.forEach((key) => {
    state.settings[key].enabled = false;
  });
  clearActivePreset();
  syncControlsFromSettings();
  recordHistory(previous);
  scheduleRender();
}

function randomizeEffects() {
  const previous = cloneSettings(state.settings);
  EFFECT_KEYS.forEach((key) => {
    const range = document.querySelector(`[data-range="${key}"]`);
    const min = Number(range.min);
    const max = Number(range.max);
    state.settings[key] = {
      enabled: true,
      value: Math.round(min + Math.random() * (max - min) * 0.82),
    };
  });
  state.settings.seed = createSeed();
  clearActivePreset();
  syncControlsFromSettings();
  recordHistory(previous);
  scheduleRender();
}

function applyPreset(name, button) {
  const previous = cloneSettings(state.settings);
  state.settings = settingsForPreset(name, createSeed());
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
    setStatus(`${formatLabel} exported`, 'ready');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Export failed.');
    setStatus('Export error', 'error');
    console.error(error);
  } finally {
    state.isExporting = false;
    elements.exportButton.disabled = false;
    elements.exportFieldset.disabled = false;
    updateExportControls();
    updateHistoryButtons();
  }
}

function commitRangeHistory(range) {
  const previous = rangeHistorySnapshots.get(range);
  if (!previous) return;
  recordHistory(previous);
  rangeHistorySnapshots.delete(range);
}

elements.browseButton.addEventListener('click', (event) => {
  event.stopPropagation();
  openFilePicker();
});
elements.emptyUploadButton.addEventListener('click', openFilePicker);
elements.dropZone.addEventListener('click', openFilePicker);
elements.dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openFilePicker();
  }
});
elements.fileInput.addEventListener('change', () => handleFile(elements.fileInput.files[0]));
elements.resetButton.addEventListener('click', resetEffects);
elements.randomizeButton.addEventListener('click', randomizeEffects);
elements.undoButton.addEventListener('click', undo);
elements.redoButton.addEventListener('click', redo);
elements.exportButton.addEventListener('click', handleExport);

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset, button));
});

document.querySelectorAll('[data-range]').forEach((range) => {
  range.addEventListener('input', () => {
    if (!rangeHistorySnapshots.has(range)) {
      rangeHistorySnapshots.set(range, cloneSettings(state.settings));
    }
    const key = range.dataset.range;
    document.querySelector(`[data-output="${key}"]`).value = range.value;
    state.settings = readSettings(state.settings.seed);
    clearActivePreset();
    scheduleRender();
  });
  range.addEventListener('change', () => commitRangeHistory(range));
  range.addEventListener('blur', () => commitRangeHistory(range));
});

document.querySelectorAll('[data-toggle]').forEach((toggle) => {
  toggle.addEventListener('change', () => {
    const previous = cloneSettings(state.settings);
    const key = toggle.dataset.toggle;
    const range = document.querySelector(`[data-range="${key}"]`);
    range.disabled = !toggle.checked;
    toggle.closest('.effect-control').classList.toggle('is-off', !toggle.checked);
    state.settings = readSettings(state.settings.seed);
    clearActivePreset();
    recordHistory(previous);
    scheduleRender();
  });
});

elements.exportFormat.addEventListener('change', updateExportControls);
elements.exportQuality.addEventListener('input', () => {
  elements.exportQualityOutput.value = elements.exportQuality.value;
});

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
  if (!state.originalImage) return;
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
  target.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
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

window.addEventListener('beforeunload', () => closeImageSource(state.originalImage?.source));

syncControlsFromSettings();
updateExportControls();
enableEditorControls(false);
