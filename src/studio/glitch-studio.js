import { closeImageSource, formatFileSize, loadImageFile } from '../image-io.js';
import {
  ANIMATION_PRESETS, BROADCAST_TEMPLATES, CUE_TYPES, EFFECT_DEFINITIONS, TEXT_EFFECTS, TIMELINE_EVENT_LABELS,
  applyPresetSettings, clampTimelineEvent, defaultStudioSettings, guidedConfiguration, parseProjectImport,
  randomizeStudioSettings, sanitizeFilename, sanitizeText, validateDuration, validateFrameRate, validateStudioSnapshot,
} from './model.js';
import { createStudioRenderer } from './renderer.js';
import { createCueEngine } from './audio-cues.js';
import { createProjectId, deleteProject, duplicateProject, listProjects, loadProject, saveProject } from './storage.js';
import { exportCurrentFrame, exportDimensions, exportWebM } from './exporter.js';

const MAX_MARKERS = 24;
const AUTOSAVE_DELAY = 900;
const CUE_LABELS = Object.freeze({
  'warning-beep': 'Warning beep', 'low-alarm': 'Low alarm', 'static-burst': 'Static burst', 'signal-chirp': 'Signal chirp',
  'impact-hit': 'Impact hit', 'rising-tone': 'Rising tone', 'power-down': 'Descending power-down',
});

function createElement(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function cloneSettings(settings) {
  return validateStudioSnapshot(JSON.parse(JSON.stringify(settings)));
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds); const whole = Math.floor(safe); const milliseconds = Math.floor((safe - whole) * 1000);
  return `00:${String(whole).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function downloadJson(record) {
  const extension = record.type === 'broadcast' ? 'massimo-broadcast.json' : 'massimo-glitch.json';
  const data = { ...record, sourceBlob: undefined, thumbnail: undefined };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${sanitizeFilename(record.name)}.${extension}`; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function initGlitchStudio(root, { getSoundboardPads = () => [] } = {}) {
  const elements = Object.fromEntries([
    'image-input', 'browse', 'guided-upload', 'drop-zone', 'source-meta', 'canvas', 'empty', 'stage', 'status', 'monitor-title',
    'preview', 'stop', 'time-output', 'duration', 'fps', 'seed', 'loop', 'reduced-flash', 'flash-warning', 'advanced',
    'advanced-toggle', 'preset-list', 'effect-controls', 'effects-off', 'reset', 'randomize', 'broadcast-controls',
    'broadcast-template', 'guided-theme', 'guided-intensity', 'guided-warning', 'guided-apply', 'scrubber', 'timeline-track',
    'timeline-playhead', 'timeline-markers', 'timeline-ruler', 'timeline-count', 'timeline-event-type', 'timeline-add',
    'timeline-duplicate', 'timeline-delete', 'cue', 'cue-volume', 'cue-volume-output', 'cue-muted', 'add-cue',
    'project-name', 'unsaved', 'new-project', 'save-project', 'save-as', 'load-projects', 'autosave', 'project-browser',
    'project-list', 'rename-project', 'duplicate-project', 'delete-project', 'export-project', 'import-project', 'project-file',
    'delete-dialog', 'delete-confirm', 'export-resolution', 'export-dimensions', 'export-webm', 'export-frame', 'export-progress', 'export-status',
  ].map((name) => [name, root.querySelector(`#studio-${name}`) || root.querySelector(`#${name}`)]));
  const renderer = createStudioRenderer();
  const cueEngine = createCueEngine(getSoundboardPads);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    mode: 'animated', source: null, sourceBlob: null, settings: defaultStudioSettings(), currentTime: 0,
    playing: false, previewFrame: 0, previewStartedAt: 0, previousCueTime: -1, exporting: false, advanced: false,
    currentProjectId: '', currentCreatedAt: '', selectedProjectId: '', projects: [], selectedEventId: '', dirty: false,
    autosaveTimer: 0, deleteProjectId: '', destroyed: false,
  };
  const visibilityHandler = () => { if (document.hidden) stopPreview('Preview paused while page is hidden'); };

  function setStatus(message, mode = 'ready') {
    elements.status.lastChild.textContent = ` ${message}`; elements.status.dataset.mode = mode;
  }

  function announce(message, mode = 'ready') {
    elements['export-status'].textContent = message; elements['export-status'].dataset.mode = mode;
  }

  function createSeed() {
    const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0];
  }

  function studioSettings() {
    return validateStudioSnapshot(state.settings);
  }

  function updateDirty(saved = false) {
    state.dirty = !saved;
    elements.unsaved.textContent = saved ? 'Saved' : 'Unsaved'; elements.unsaved.dataset.saved = String(saved);
    if (!saved && elements.autosave.checked && state.currentProjectId) {
      window.clearTimeout(state.autosaveTimer);
      state.autosaveTimer = window.setTimeout(() => saveCurrentProject(false, true), AUTOSAVE_DELAY);
    }
  }

  function setControlsEnabled(enabled) {
    elements.preview.disabled = !enabled || state.exporting;
    elements.stop.disabled = !state.playing;
    elements['export-webm'].disabled = !enabled || state.exporting;
    elements['export-frame'].disabled = !enabled || state.exporting;
  }

  function updateTimeUi() {
    elements.scrubber.max = String(state.settings.duration); elements.scrubber.value = String(state.currentTime);
    elements['timeline-playhead'].style.left = `${(state.currentTime / state.settings.duration) * 100}%`;
    elements['time-output'].value = `${formatTime(state.currentTime)} / ${formatTime(state.settings.duration)}`;
  }

  function renderCurrent() {
    updateTimeUi();
    if (!state.source) return;
    renderer.render({
      canvas: elements.canvas, source: state.source.source, sourceWidth: state.source.width, sourceHeight: state.source.height,
      settings: state.settings, time: state.currentTime, mode: state.mode, resolution: 'preview',
    });
    elements.canvas.hidden = false; elements.empty.hidden = true;
  }

  function playDueCues(previousTime, currentTime) {
    if (state.settings.muted || currentTime < previousTime) return;
    state.settings.events.filter((event) => event.type === 'audio' && event.cue && event.time > previousTime && event.time <= currentTime)
      .forEach((event) => { try { cueEngine.playCue(event.cue, state.settings.cueVolume / 100); } catch (error) { announce(error.message, 'error'); } });
  }

  function stopPreview(message = 'Preview stopped') {
    if (state.previewFrame) cancelAnimationFrame(state.previewFrame);
    state.previewFrame = 0; state.playing = false; state.previousCueTime = -1; cueEngine.stopAll();
    elements.preview.textContent = 'Preview'; elements.stop.disabled = true; elements.preview.disabled = !state.source || state.exporting;
    if (message) setStatus(message, state.source ? 'ready' : 'idle');
  }

  function previewTick(timestamp) {
    if (!state.playing || state.destroyed) return;
    const previous = state.currentTime;
    let elapsed = (timestamp - state.previewStartedAt) / 1000;
    if (elapsed >= state.settings.duration) {
      if (!state.settings.loop) { state.currentTime = state.settings.duration; renderCurrent(); stopPreview('Preview complete'); return; }
      elapsed %= state.settings.duration; state.previewStartedAt = timestamp - elapsed * 1000; state.previousCueTime = -1;
    }
    state.currentTime = elapsed; renderCurrent(); playDueCues(state.previousCueTime < 0 ? -0.001 : state.previousCueTime, state.currentTime); state.previousCueTime = state.currentTime;
    state.previewFrame = requestAnimationFrame(previewTick);
  }

  function startPreview() {
    if (!state.source || state.playing || state.exporting) return;
    state.playing = true; state.previewStartedAt = performance.now() - (state.currentTime >= state.settings.duration ? 0 : state.currentTime * 1000);
    if (state.currentTime >= state.settings.duration) state.currentTime = 0;
    state.previousCueTime = state.currentTime - 0.001; elements.preview.textContent = 'Previewing…'; elements.preview.disabled = true; elements.stop.disabled = false;
    setStatus(prefersReducedMotion.matches ? 'Previewing · reduced-motion safeguards' : 'Previewing', 'working');
    state.previewFrame = requestAnimationFrame(previewTick);
  }

  function updateFlashWarning() {
    const risky = state.settings.effects.frameFlash.enabled && state.settings.effects.frameFlash.intensity > 60
      || state.settings.broadcast.textFlicker > 60;
    elements['flash-warning'].hidden = state.settings.reducedFlash || !risky;
  }

  function updateExportEstimate() {
    if (!state.source) { elements['export-dimensions'].textContent = 'Load an image to estimate output size.'; return; }
    const result = exportDimensions(state.source.width, state.source.height, state.settings.exportResolution);
    const memory = result.width * result.height * 4 * 3 / (1024 * 1024);
    elements['export-dimensions'].textContent = `${result.width} × ${result.height} · about ${memory.toFixed(0)} MB working memory${memory > 180 ? ' · large export warning' : ''}`;
  }

  function renderTimeline() {
    const markerHost = elements['timeline-markers']; markerHost.replaceChildren();
    elements['timeline-count'].textContent = `${state.settings.events.length} / ${MAX_MARKERS} markers`;
    elements['timeline-duplicate'].disabled = !state.selectedEventId; elements['timeline-delete'].disabled = !state.selectedEventId;
    state.settings.events.forEach((event) => {
      const button = createElement('button', 'timeline-marker', TIMELINE_EVENT_LABELS[event.type].slice(0, 1));
      button.type = 'button'; button.dataset.type = event.type; button.dataset.eventId = event.id;
      button.classList.toggle('is-selected', event.id === state.selectedEventId); button.style.left = `${event.time / state.settings.duration * 100}%`;
      button.setAttribute('aria-label', `${TIMELINE_EVENT_LABELS[event.type]} at ${event.time.toFixed(2)} seconds`);
      button.title = `${TIMELINE_EVENT_LABELS[event.type]} · ${event.time.toFixed(2)}s`;
      button.addEventListener('click', () => { state.selectedEventId = event.id; state.currentTime = event.time; renderTimeline(); renderCurrent(); });
      button.addEventListener('keydown', (input) => {
        if (input.key === 'Delete' || input.key === 'Backspace') { input.preventDefault(); removeSelectedEvent(); return; }
        if (!['ArrowLeft', 'ArrowRight'].includes(input.key)) return;
        input.preventDefault(); const delta = input.shiftKey ? 1 : 1 / state.settings.fps;
        event.time += input.key === 'ArrowRight' ? delta : -delta; Object.assign(event, clampTimelineEvent(event, state.settings.duration));
        state.currentTime = event.time; updateDirty(); renderTimeline(); renderCurrent(); markerHost.querySelector(`[data-event-id="${event.id}"]`)?.focus();
      });
      button.addEventListener('pointerdown', (input) => { state.selectedEventId = event.id; button.setPointerCapture(input.pointerId); });
      button.addEventListener('pointermove', (input) => {
        if (!button.hasPointerCapture(input.pointerId)) return; const rect = elements['timeline-track'].getBoundingClientRect();
        event.time = Math.max(0, Math.min(state.settings.duration, (input.clientX - rect.left) / rect.width * state.settings.duration));
        state.currentTime = event.time; button.style.left = `${event.time / state.settings.duration * 100}%`; updateTimeUi(); renderCurrent();
      });
      button.addEventListener('pointerup', (input) => { if (button.hasPointerCapture(input.pointerId)) button.releasePointerCapture(input.pointerId); Object.assign(event, clampTimelineEvent(event, state.settings.duration)); updateDirty(); renderTimeline(); });
      markerHost.append(button);
    });
    elements['timeline-ruler'].replaceChildren();
    for (let tick = 0; tick <= state.settings.duration; tick += 1) elements['timeline-ruler'].append(createElement('span', '', `${tick}s`));
  }

  function addEvent(type = elements['timeline-event-type'].value, cue = '') {
    if (state.settings.events.length >= MAX_MARKERS) { announce(`Timeline limit reached: ${MAX_MARKERS} markers.`, 'error'); return; }
    const label = type === 'text' ? sanitizeText(elements['guided-warning'].value, 80) || 'SIGNAL WARNING' : TIMELINE_EVENT_LABELS[type];
    const event = clampTimelineEvent({ id: createProjectId(), type, time: state.currentTime, label, cue }, state.settings.duration);
    state.settings.events.push(event); state.selectedEventId = event.id; updateDirty(); renderTimeline(); renderCurrent();
  }

  function removeSelectedEvent() {
    if (!state.selectedEventId) return; state.settings.events = state.settings.events.filter((event) => event.id !== state.selectedEventId);
    state.selectedEventId = ''; updateDirty(); renderTimeline(); renderCurrent();
  }

  function duplicateSelectedEvent() {
    const selected = state.settings.events.find((event) => event.id === state.selectedEventId); if (!selected) return;
    const duplicate = clampTimelineEvent({ ...selected, id: createProjectId(), time: selected.time + 0.25 }, state.settings.duration);
    state.settings.events.push(duplicate); state.selectedEventId = duplicate.id; updateDirty(); renderTimeline(); renderCurrent();
  }

  function syncEffectControls() {
    elements['effect-controls'].querySelectorAll('[data-studio-effect]').forEach((control) => {
      const setting = state.settings.effects[control.dataset.studioEffect]; const toggle = control.querySelector('[data-effect-toggle]');
      toggle.checked = setting.enabled; control.classList.toggle('is-off', !setting.enabled); control.querySelector('[data-effect-status]').textContent = setting.enabled ? 'On' : 'Off';
      control.querySelectorAll('[data-effect-field]').forEach((input) => { input.value = String(setting[input.dataset.effectField]); control.querySelector(`[data-effect-output="${input.dataset.effectField}"]`).value = input.value; });
    });
    updateFlashWarning();
  }

  function buildEffects() {
    EFFECT_DEFINITIONS.forEach(({ key, label, fields }) => {
      const details = createElement('details', 'studio-effect'); details.dataset.studioEffect = key;
      const summary = createElement('summary'); const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.dataset.effectToggle = ''; toggle.setAttribute('aria-label', `Enable ${label}`);
      const title = createElement('strong', '', label); const status = createElement('span', '', 'Off'); status.dataset.effectStatus = ''; summary.append(toggle, title, status);
      const body = createElement('div', 'studio-effect__body');
      fields.forEach(([field, fieldLabel, min, max, step]) => {
        const row = createElement('div', 'studio-effect-row'); const labelElement = createElement('label', '', fieldLabel); const input = document.createElement('input');
        input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.dataset.effectField = field; input.setAttribute('aria-label', `${label} ${fieldLabel}`);
        const output = document.createElement('output'); output.dataset.effectOutput = field; labelElement.append(input); row.append(labelElement, output); body.append(row);
        input.addEventListener('input', () => { state.settings.effects[key][field] = Number(input.value); output.value = input.value; updateDirty(); updateFlashWarning(); renderCurrent(); });
      });
      toggle.addEventListener('click', (event) => event.stopPropagation());
      toggle.addEventListener('change', () => { state.settings.effects[key].enabled = toggle.checked; details.classList.toggle('is-off', !toggle.checked); status.textContent = toggle.checked ? 'On' : 'Off'; updateDirty(); updateFlashWarning(); renderCurrent(); });
      details.append(summary, body); elements['effect-controls'].append(details);
    });
  }

  function applyPreset(key) {
    const preset = applyPresetSettings(key, state.settings.seed); state.settings.effects = preset.effects; state.settings.duration = preset.duration; state.settings.fps = preset.fps; state.settings.seed = preset.seed;
    elements.duration.value = String(state.settings.duration); elements.fps.value = String(state.settings.fps); elements.seed.value = String(state.settings.seed);
    elements['preset-list'].querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.preset === key));
    state.settings.events = state.settings.events.map((event) => clampTimelineEvent(event, state.settings.duration)); state.currentTime = Math.min(state.currentTime, state.settings.duration);
    syncEffectControls(); renderTimeline(); updateDirty(); renderCurrent(); setStatus(`${ANIMATION_PRESETS[key].label} loaded`, 'ready');
  }

  function buildPresets() {
    Object.entries(ANIMATION_PRESETS).forEach(([key, preset]) => {
      const button = createElement('button'); button.type = 'button'; button.dataset.preset = key; button.title = preset.description;
      button.append(createElement('strong', '', preset.label), createElement('small', '', `${preset.intensity} · ${preset.recommendedDuration}s · ${preset.recommendedFps} FPS`));
      button.addEventListener('click', () => applyPreset(key)); elements['preset-list'].append(button);
    });
  }

  function syncBroadcastControls() {
    root.querySelectorAll('[data-broadcast-field]').forEach((input) => {
      const value = state.settings.broadcast[input.dataset.broadcastField]; input[input.type === 'checkbox' ? 'checked' : 'value'] = value;
      const output = root.querySelector(`[data-output-for="${input.dataset.broadcastField}"]`); if (output) output.value = String(value);
    });
    elements['broadcast-template'].value = state.settings.broadcast.templateKey;
  }

  function applyBroadcastTemplate(key) {
    const template = BROADCAST_TEMPLATES[key]; if (!template) return;
    state.settings.broadcast = { ...state.settings.broadcast, templateKey: key, headline: template.headline, subtitle: template.subtitle, ticker: template.ticker, station: template.station, channel: template.channel, camera: template.camera, theme: template.theme, textEffect: template.textEffect };
    syncBroadcastControls(); applyPreset(template.presetKey); updateDirty(); renderCurrent();
  }

  function buildBroadcastOptions() {
    Object.entries(BROADCAST_TEMPLATES).forEach(([key, template]) => { const option = createElement('option', '', template.label); option.value = key; elements['broadcast-template'].append(option); });
    const textEffect = root.querySelector('[data-broadcast-field="textEffect"]');
    TEXT_EFFECTS.forEach((value) => { const option = createElement('option', '', value.replace(/(^|-)([a-z])/g, (_, prefix, letter) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`)); option.value = value; textEffect.append(option); });
  }

  function switchMode(mode) {
    if (!['animated', 'broadcast'].includes(mode)) return; stopPreview('Preview paused'); state.mode = mode;
    root.querySelectorAll('[data-studio-mode]').forEach((button) => { const active = button.dataset.studioMode === mode; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); });
    elements['broadcast-controls'].hidden = mode !== 'broadcast'; elements['monitor-title'].textContent = mode === 'broadcast' ? 'Corrupted Broadcast Monitor' : 'Animated Glitch Monitor';
    updateDirty(); renderCurrent();
  }

  function syncTimingControls() {
    elements.duration.value = String(state.settings.duration); elements.fps.value = String(state.settings.fps); elements.seed.value = String(state.settings.seed);
    elements.loop.checked = state.settings.loop; elements['reduced-flash'].checked = state.settings.reducedFlash;
    elements['export-resolution'].value = state.settings.exportResolution; elements['cue-volume'].value = String(state.settings.cueVolume); elements['cue-volume-output'].value = String(state.settings.cueVolume); elements['cue-muted'].checked = state.settings.muted;
  }

  async function handleImage(file) {
    if (!file) return;
    try {
      setStatus('Decoding local image', 'working'); const next = await loadImageFile(file); closeImageSource(state.source?.source);
      state.source = next; state.sourceBlob = file; elements['source-meta'].textContent = `${next.name} · ${next.width} × ${next.height} · ${formatFileSize(next.size)}`;
      state.currentTime = 0; setControlsEnabled(true); updateExportEstimate(); updateDirty(); renderCurrent(); setStatus('Source ready', 'ready');
    } catch (error) { elements['source-meta'].textContent = error.message; elements['source-meta'].dataset.mode = 'error'; setStatus('Image error', 'error'); }
    finally { elements['image-input'].value = ''; }
  }

  function newProject() {
    stopPreview('New project'); closeImageSource(state.source?.source); state.source = null; state.sourceBlob = null; state.settings = defaultStudioSettings();
    state.currentTime = 0; state.currentProjectId = ''; state.currentCreatedAt = ''; state.selectedProjectId = ''; state.selectedEventId = ''; state.mode = 'animated';
    elements['project-name'].value = 'Untitled transmission'; elements.canvas.hidden = true; elements.empty.hidden = false; elements['source-meta'].textContent = 'No source image loaded.';
    syncTimingControls(); syncEffectControls(); syncBroadcastControls(); renderTimeline(); switchMode('animated'); setControlsEnabled(false); updateExportEstimate(); updateDirty();
  }

  async function makeThumbnail() {
    if (!state.source) return null; const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 135; const context = canvas.getContext('2d');
    context.drawImage(elements.canvas, 0, 0, canvas.width, canvas.height); return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.72));
  }

  function currentProjectRecord(id = state.currentProjectId || createProjectId()) {
    const now = new Date().toISOString(); return {
      id, name: sanitizeText(elements['project-name'].value, 80) || 'Untitled transmission', type: state.mode === 'broadcast' ? 'broadcast' : 'animated-glitch', schemaVersion: 1,
      createdAt: state.currentCreatedAt || now, modifiedAt: now, settings: studioSettings(), sourceBlob: state.sourceBlob,
      sourceName: state.source?.name || 'source-image', thumbnail: null,
    };
  }

  async function saveCurrentProject(saveAs = false, quiet = false) {
    try {
      const id = saveAs || !state.currentProjectId ? createProjectId() : state.currentProjectId; const record = currentProjectRecord(id); record.thumbnail = await makeThumbnail();
      const saved = await saveProject(record); state.currentProjectId = saved.id; state.currentCreatedAt = saved.createdAt; state.selectedProjectId = saved.id; updateDirty(true); await refreshProjects();
      if (!quiet) announce(`Saved locally: ${saved.name}.`, 'ready');
    } catch (error) { announce(error.message, 'error'); }
  }

  async function refreshProjects() {
    try { state.projects = await listProjects(); renderProjectList(); } catch (error) { announce(error.message, 'error'); }
  }

  function renderProjectList() {
    elements['project-list'].replaceChildren();
    if (!state.projects.length) { elements['project-list'].append(createElement('p', 'microcopy', 'No local projects saved.')); return; }
    state.projects.forEach((project) => {
      const button = createElement('button'); button.type = 'button'; button.classList.toggle('is-selected', project.id === state.selectedProjectId);
      if (project.thumbnail) { const image = document.createElement('img'); const url = URL.createObjectURL(project.thumbnail); image.src = url; image.alt = ''; image.addEventListener('load', () => URL.revokeObjectURL(url), { once: true }); button.append(image); }
      const copy = createElement('span', '', `${project.name} · ${project.type === 'broadcast' ? 'Broadcast' : 'Animation'}`); button.append(copy);
      button.addEventListener('click', () => { state.selectedProjectId = project.id; renderProjectList(); });
      button.addEventListener('dblclick', () => loadSelectedProject()); elements['project-list'].append(button);
    });
  }

  async function loadSelectedProject() {
    if (!state.selectedProjectId) return;
    try {
      const project = await loadProject(state.selectedProjectId); stopPreview('Loading project'); state.settings = cloneSettings(project.settings);
      state.currentProjectId = project.id; state.currentCreatedAt = project.createdAt; state.selectedEventId = ''; elements['project-name'].value = project.name;
      switchMode(project.type === 'broadcast' ? 'broadcast' : 'animated'); syncTimingControls(); syncEffectControls(); syncBroadcastControls(); renderTimeline();
      if (project.sourceBlob) await handleImage(new File([project.sourceBlob], project.sourceName, { type: project.sourceBlob.type || 'image/png' }));
      else { closeImageSource(state.source?.source); state.source = null; state.sourceBlob = null; elements.canvas.hidden = true; elements.empty.hidden = false; setControlsEnabled(false); }
      updateDirty(true); announce(`Loaded ${project.name}.`, 'ready');
    } catch (error) { announce(error.message, 'error'); }
  }

  async function renameSelectedProject() {
    if (!state.selectedProjectId) return;
    try { const project = await loadProject(state.selectedProjectId); project.name = sanitizeText(elements['project-name'].value, 80) || project.name; project.modifiedAt = new Date().toISOString(); await saveProject(project); await refreshProjects(); announce('Project renamed.'); }
    catch (error) { announce(error.message, 'error'); }
  }

  async function duplicateSelected() {
    if (!state.selectedProjectId) return;
    try { const copy = await duplicateProject(state.selectedProjectId, createProjectId()); state.selectedProjectId = copy.id; await refreshProjects(); announce('Project duplicated.'); }
    catch (error) { announce(error.message, 'error'); }
  }

  function requestDeleteSelected() {
    if (!state.selectedProjectId) return; state.deleteProjectId = state.selectedProjectId; elements['delete-dialog'].showModal();
  }

  async function confirmDelete() {
    if (!state.deleteProjectId) return;
    try { await deleteProject(state.deleteProjectId); if (state.currentProjectId === state.deleteProjectId) state.currentProjectId = ''; state.selectedProjectId = ''; state.deleteProjectId = ''; await refreshProjects(); announce('Local project deleted.'); }
    catch (error) { announce(error.message, 'error'); }
  }

  async function exportProjectJson() {
    const record = currentProjectRecord(state.currentProjectId || createProjectId()); downloadJson(record); announce('Project JSON exported without executable code or embedded media.');
  }

  async function importProjectJson(file) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Project file is larger than 1 MB.');
      const imported = parseProjectImport(await file.text()); const now = new Date().toISOString(); imported.id = createProjectId(); imported.createdAt = now; imported.modifiedAt = now; imported.sourceBlob = null; imported.thumbnail = null;
      const saved = await saveProject(imported); state.selectedProjectId = saved.id; await refreshProjects(); await loadSelectedProject(); announce('Project imported. Source images are not embedded in project JSON.');
    } catch (error) { announce(error.message, 'error'); }
    finally { elements['project-file'].value = ''; }
  }

  async function runWebMExport() {
    if (!state.source || state.exporting) return; stopPreview('Preparing export'); state.exporting = true; setControlsEnabled(true); elements['export-progress'].hidden = false; elements['export-progress'].value = 0;
    announce('Recording deterministic silent WebM…', 'working');
    try {
      const result = await exportWebM({ renderer, source: state.source.source, sourceWidth: state.source.width, sourceHeight: state.source.height, settings: studioSettings(), mode: state.mode, resolution: state.settings.exportResolution, name: elements['project-name'].value, onProgress: (progress) => { elements['export-progress'].value = Math.round(progress * 100); } });
      announce(`${result.filename} exported · ${result.width} × ${result.height} · ${formatFileSize(result.size)} · silent WebM`, 'ready');
    } catch (error) { announce(error.message, 'error'); }
    finally { state.exporting = false; elements['export-progress'].hidden = true; setControlsEnabled(true); }
  }

  async function runFrameExport() {
    if (!state.source || state.exporting) return; state.exporting = true; setControlsEnabled(true); announce('Rendering current frame…', 'working');
    try {
      const result = await exportCurrentFrame({ renderer, source: state.source.source, sourceWidth: state.source.width, sourceHeight: state.source.height, settings: studioSettings(), time: state.currentTime, mode: state.mode, resolution: state.settings.exportResolution, name: elements['project-name'].value });
      announce(`${result.filename} exported · ${result.width} × ${result.height} · ${formatFileSize(result.size)}`, 'ready');
    } catch (error) { announce(error.message, 'error'); }
    finally { state.exporting = false; setControlsEnabled(true); }
  }

  function populateCueOptions() {
    const selected = elements.cue.value; elements.cue.replaceChildren(new Option('No cue', ''));
    const generated = document.createElement('optgroup'); generated.label = 'Generated locally';
    CUE_TYPES.forEach((cue) => generated.append(new Option(CUE_LABELS[cue], cue))); elements.cue.append(generated);
    const pads = [...getSoundboardPads()];
    if (pads.length) { const group = document.createElement('optgroup'); group.label = 'Soundboard pads'; pads.forEach((pad) => group.append(new Option(pad.name, `pad:${pad.id}`))); elements.cue.append(group); }
    if ([...elements.cue.options].some((option) => option.value === selected)) elements.cue.value = selected;
  }

  buildEffects(); buildPresets(); buildBroadcastOptions(); syncEffectControls(); syncBroadcastControls(); syncTimingControls(); renderTimeline(); populateCueOptions(); setControlsEnabled(false);

  root.querySelectorAll('[data-studio-mode]').forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.studioMode)));
  elements.browse.addEventListener('click', (event) => { event.stopPropagation(); elements['image-input'].click(); });
  elements['guided-upload'].addEventListener('click', () => elements['image-input'].click());
  elements['drop-zone'].addEventListener('click', () => elements['image-input'].click());
  elements['drop-zone'].addEventListener('keydown', (event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); elements['image-input'].click(); } });
  elements['image-input'].addEventListener('change', () => handleImage(elements['image-input'].files[0]));
  ['dragenter', 'dragover'].forEach((type) => elements['drop-zone'].addEventListener(type, (event) => { event.preventDefault(); elements['drop-zone'].classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((type) => elements['drop-zone'].addEventListener(type, (event) => { event.preventDefault(); elements['drop-zone'].classList.remove('is-dragging'); }));
  elements['drop-zone'].addEventListener('drop', (event) => handleImage(event.dataTransfer?.files[0]));
  elements.preview.addEventListener('click', startPreview); elements.stop.addEventListener('click', () => stopPreview());
  elements.scrubber.addEventListener('input', () => { stopPreview('Scrubbing'); state.currentTime = Number(elements.scrubber.value); renderCurrent(); });
  elements['timeline-track'].addEventListener('click', (event) => { if (event.target.closest('.timeline-marker')) return; const rect = elements['timeline-track'].getBoundingClientRect(); state.currentTime = Math.max(0, Math.min(state.settings.duration, (event.clientX - rect.left) / rect.width * state.settings.duration)); renderCurrent(); });
  elements['timeline-add'].addEventListener('click', () => addEvent()); elements['timeline-duplicate'].addEventListener('click', duplicateSelectedEvent); elements['timeline-delete'].addEventListener('click', removeSelectedEvent);
  elements['add-cue'].addEventListener('click', () => { if (!elements.cue.value) { announce('Choose a cue source first.', 'error'); return; } addEvent('audio', elements.cue.value); });
  elements.duration.addEventListener('change', () => { state.settings.duration = validateDuration(elements.duration.value); state.settings.events = state.settings.events.map((event) => clampTimelineEvent(event, state.settings.duration)); state.currentTime = Math.min(state.currentTime, state.settings.duration); updateDirty(); renderTimeline(); renderCurrent(); });
  elements.fps.addEventListener('change', () => { state.settings.fps = validateFrameRate(elements.fps.value); updateDirty(); renderCurrent(); });
  elements.seed.addEventListener('change', () => { state.settings.seed = Math.max(0, Math.min(0xffffffff, Number(elements.seed.value) || 3817)) >>> 0; elements.seed.value = String(state.settings.seed); updateDirty(); renderCurrent(); });
  elements.loop.addEventListener('change', () => { state.settings.loop = elements.loop.checked; updateDirty(); });
  elements['reduced-flash'].addEventListener('change', () => { state.settings.reducedFlash = elements['reduced-flash'].checked; updateFlashWarning(); updateDirty(); renderCurrent(); });
  elements['cue-volume'].addEventListener('input', () => { state.settings.cueVolume = Number(elements['cue-volume'].value); elements['cue-volume-output'].value = elements['cue-volume'].value; updateDirty(); });
  elements['cue-muted'].addEventListener('change', () => { state.settings.muted = elements['cue-muted'].checked; if (state.settings.muted) cueEngine.stopAll(); updateDirty(); });
  elements['export-resolution'].addEventListener('change', () => { state.settings.exportResolution = elements['export-resolution'].value; updateExportEstimate(); updateDirty(); });
  elements['effects-off'].addEventListener('click', () => { Object.values(state.settings.effects).forEach((effect) => { effect.enabled = false; }); syncEffectControls(); updateDirty(); renderCurrent(); setStatus('Effects off'); });
  elements.reset.addEventListener('click', () => { const seed = state.settings.seed; const duration = state.settings.duration; const fps = state.settings.fps; state.settings = defaultStudioSettings(seed); state.settings.duration = duration; state.settings.fps = fps; syncTimingControls(); syncEffectControls(); syncBroadcastControls(); renderTimeline(); updateDirty(); renderCurrent(); setStatus('Studio controls reset'); });
  elements.randomize.addEventListener('click', () => { state.settings.seed = createSeed(); state.settings.effects = randomizeStudioSettings(state.settings.seed); elements.seed.value = String(state.settings.seed); syncEffectControls(); updateDirty(); renderCurrent(); setStatus('Deterministic random configuration ready'); });
  elements['advanced-toggle'].addEventListener('click', () => { state.advanced = !state.advanced; elements.advanced.hidden = !state.advanced; elements['advanced-toggle'].setAttribute('aria-expanded', String(state.advanced)); elements['advanced-toggle'].textContent = state.advanced ? 'Hide Advanced Mode' : 'Open Advanced Mode'; });
  elements['guided-apply'].addEventListener('click', () => {
    const generated = guidedConfiguration(elements['guided-theme'].value, elements['guided-intensity'].value, state.settings.seed); state.settings.effects = generated.effects; state.settings.duration = generated.duration; state.settings.fps = generated.fps; state.settings.seed = generated.seed;
    const warning = sanitizeText(elements['guided-warning'].value, 80); if (warning) { state.settings.events = state.settings.events.filter((event) => event.type !== 'text'); state.settings.events.push(clampTimelineEvent({ id: createProjectId(), type: 'text', time: state.settings.duration * 0.55, label: warning }, state.settings.duration)); }
    syncTimingControls(); syncEffectControls(); renderTimeline(); updateDirty(); renderCurrent(); setStatus('Guided signal configured');
  });
  elements['broadcast-template'].addEventListener('change', () => applyBroadcastTemplate(elements['broadcast-template'].value));
  root.querySelectorAll('[data-broadcast-field]').forEach((input) => input.addEventListener('input', () => {
    const key = input.dataset.broadcastField; const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : sanitizeText(input.value, key === 'ticker' ? 180 : 100);
    state.settings.broadcast[key] = value; if (input.type === 'text') input.value = value;
    const output = root.querySelector(`[data-output-for="${key}"]`); if (output) output.value = String(value); updateFlashWarning(); updateDirty(); renderCurrent();
  }));
  elements['new-project'].addEventListener('click', newProject); elements['save-project'].addEventListener('click', () => saveCurrentProject(false)); elements['save-as'].addEventListener('click', () => saveCurrentProject(true));
  elements['load-projects'].addEventListener('click', async () => {
    if (elements['project-browser'].hidden) { elements['project-browser'].hidden = false; await refreshProjects(); }
    else if (state.selectedProjectId) await loadSelectedProject();
    else elements['project-browser'].hidden = true;
  });
  elements['project-list'].addEventListener('keydown', (event) => { if (event.key === 'Enter') loadSelectedProject(); });
  elements['rename-project'].addEventListener('click', renameSelectedProject); elements['duplicate-project'].addEventListener('click', duplicateSelected); elements['delete-project'].addEventListener('click', requestDeleteSelected);
  elements['delete-confirm'].addEventListener('click', confirmDelete); elements['export-project'].addEventListener('click', exportProjectJson); elements['import-project'].addEventListener('click', () => elements['project-file'].click());
  elements['project-file'].addEventListener('change', () => importProjectJson(elements['project-file'].files[0])); elements['project-name'].addEventListener('input', () => updateDirty());
  elements['export-webm'].addEventListener('click', runWebMExport); elements['export-frame'].addEventListener('click', runFrameExport);
  document.addEventListener('visibilitychange', visibilityHandler);

  return {
    pause(reason = 'workspace-switch') { if (state.playing) stopPreview(reason === 'workspace-switch' ? 'Preview paused on workspace switch' : 'Preview paused'); cueEngine.stopAll(); },
    onShow() { populateCueOptions(); renderCurrent(); },
    destroy() { state.destroyed = true; stopPreview(''); window.clearTimeout(state.autosaveTimer); document.removeEventListener('visibilitychange', visibilityHandler); cueEngine.destroy(); closeImageSource(state.source?.source); },
    getState: () => state,
  };
}
