import './styles.css';
import { closeImageSource, formatFileSize, loadImageFile } from './image-io.js';
import { renderImage } from './renderer.js';
import { exportPng } from './export.js';

const avatarHappy = new URL('../assets/avatar-happy.png', import.meta.url).href;
const avatarSurprised = new URL('../assets/avatar-surprised.png', import.meta.url).href;

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
  randomizeButton: document.querySelector('#randomize-button'),
  resetButton: document.querySelector('#reset-button'),
  exportButton: document.querySelector('#export-button'),
  renderStatus: document.querySelector('#render-status'),
  imageMeta: document.querySelector('#image-meta'),
};

document.querySelector('#header-avatar').src = avatarHappy;
document.querySelector('#empty-avatar').src = avatarHappy;
document.querySelector('#random-avatar').src = avatarSurprised;

const state = {
  // This decoded source is never painted into or mutated. All renders copy from it.
  originalImage: null,
  renderFrame: null,
  isExporting: false,
  settings: readSettings(),
};

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

async function handleFile(file) {
  hideError();
  setStatus('Decoding', 'working');
  try {
    const nextImage = await loadImageFile(file);
    closeImageSource(state.originalImage?.source);
    state.originalImage = nextImage;
    elements.imageMeta.textContent = `${nextImage.width} × ${nextImage.height} · ${formatFileSize(nextImage.size)}`;
    elements.effectsFieldset.disabled = false;
    elements.randomizeButton.disabled = false;
    elements.resetButton.disabled = false;
    elements.exportButton.disabled = false;
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
  document.querySelectorAll('[data-effect]').forEach((control) => {
    const key = control.dataset.effect;
    const toggle = control.querySelector(`[data-toggle="${key}"]`);
    const range = control.querySelector(`[data-range="${key}"]`);
    toggle.checked = false;
    range.disabled = true;
    control.classList.add('is-off');
  });
  state.settings = readSettings(state.settings.seed);
  scheduleRender();
}

function randomizeEffects() {
  document.querySelectorAll('[data-effect]').forEach((control) => {
    const key = control.dataset.effect;
    const toggle = control.querySelector(`[data-toggle="${key}"]`);
    const range = control.querySelector(`[data-range="${key}"]`);
    const min = Number(range.min);
    const max = Number(range.max);
    toggle.checked = true;
    range.disabled = false;
    range.value = String(Math.round(min + Math.random() * (max - min) * 0.78));
    control.classList.remove('is-off');
    control.querySelector(`[data-output="${key}"]`).value = range.value;
  });
  state.settings = readSettings(state.settings.seed);
  state.settings.seed = Math.floor(Math.random() * 0xffffffff);
  scheduleRender();
}

async function handleExport() {
  if (!state.originalImage || state.isExporting) return;
  state.isExporting = true;
  elements.exportButton.disabled = true;
  elements.exportButton.textContent = 'Rendering full size…';
  setStatus('Exporting', 'working');
  try {
    await exportPng(state.originalImage, state.settings);
    setStatus('PNG exported', 'ready');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Export failed.');
    setStatus('Export error', 'error');
    console.error(error);
  } finally {
    state.isExporting = false;
    elements.exportButton.disabled = false;
    elements.exportButton.innerHTML = 'Export PNG <span aria-hidden="true">↓</span>';
  }
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
elements.exportButton.addEventListener('click', handleExport);

document.querySelectorAll('[data-range]').forEach((range) => {
  range.addEventListener('input', () => {
    const key = range.dataset.range;
    document.querySelector(`[data-output="${key}"]`).value = range.value;
    state.settings = readSettings(state.settings.seed);
    scheduleRender();
  });
});

document.querySelectorAll('[data-toggle]').forEach((toggle) => {
  toggle.addEventListener('change', () => {
    const key = toggle.dataset.toggle;
    const range = document.querySelector(`[data-range="${key}"]`);
    range.disabled = !toggle.checked;
    toggle.closest('.effect-control').classList.toggle('is-off', !toggle.checked);
    state.settings = readSettings(state.settings.seed);
    scheduleRender();
  });
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

// Reflect initially disabled pixelation in the visual treatment.
document.querySelectorAll('[data-toggle]').forEach((toggle) => {
  toggle.closest('.effect-control').classList.toggle('is-off', !toggle.checked);
});
