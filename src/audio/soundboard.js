import { createPadRecord, MAX_SOUND_PADS, normalizeShortcut, validateAudioFile } from './audio-state.js';
import { createSoundPadElement, updateSoundPadElement } from './sound-pad.js';

function isTypingTarget(target) {
  return target instanceof HTMLElement
    && (target.matches('input, textarea, select') || target.isContentEditable);
}

export function initSoundboard(root) {
  const elements = {
    input: root.querySelector('#audio-file-input'),
    browse: root.querySelector('#audio-browse-button'),
    dropZone: root.querySelector('#audio-drop-zone'),
    grid: root.querySelector('#sound-pad-grid'),
    empty: root.querySelector('#soundboard-empty'),
    status: root.querySelector('#soundboard-status'),
    stopAll: root.querySelector('#soundboard-stop-all'),
    clearAll: root.querySelector('#soundboard-clear'),
    masterVolume: root.querySelector('#master-volume'),
    masterVolumeOutput: root.querySelector('#master-volume-output'),
    masterMute: root.querySelector('#master-mute'),
  };
  const state = { pads: new Map(), nextId: 1, masterVolume: 1, muted: false };
  let clearConfirmationTimer = null;

  function announce(message, mode = 'ready') {
    elements.status.textContent = message;
    elements.status.dataset.mode = mode;
  }

  function updateBoardState() {
    const hasPads = state.pads.size > 0;
    if (!hasPads) resetClearConfirmation();
    elements.empty.hidden = hasPads;
    elements.stopAll.disabled = !hasPads;
    elements.clearAll.disabled = !hasPads;
  }

  function elementFor(pad) {
    return elements.grid.querySelector(`[data-pad-id="${pad.id}"]`);
  }

  function syncPad(pad) {
    const element = elementFor(pad);
    if (element) updateSoundPadElement(element, pad);
  }

  function applyAudioSettings(pad) {
    pad.audio.loop = pad.loop;
    pad.audio.playbackRate = pad.rate;
    pad.audio.volume = Math.min(1, Math.max(0, pad.volume * state.masterVolume));
    pad.audio.muted = state.muted;
  }

  function attachAudioEvents(pad) {
    pad.audio.addEventListener('loadedmetadata', () => {
      if (pad.status === 'loading') pad.status = 'stopped';
      syncPad(pad);
    });
    pad.audio.addEventListener('play', () => { pad.status = 'playing'; pad.error = ''; syncPad(pad); });
    pad.audio.addEventListener('pause', () => {
      if (pad.status !== 'stopped' && pad.status !== 'error') pad.status = pad.audio.currentTime > 0 ? 'paused' : 'stopped';
      syncPad(pad);
    });
    pad.audio.addEventListener('ended', () => { if (!pad.loop) { pad.status = 'stopped'; syncPad(pad); } });
    pad.audio.addEventListener('error', () => {
      pad.status = 'error';
      pad.error = `${pad.name}: the browser could not decode this audio file.`;
      syncPad(pad);
      announce(pad.error, 'error');
    });
  }

  function mountPad(pad) {
    state.pads.set(pad.id, pad);
    attachAudioEvents(pad);
    applyAudioSettings(pad);
    elements.grid.append(createSoundPadElement(pad));
    pad.audio.load();
    updateBoardState();
    syncPad(pad);
  }

  function addFile(file, configuration = {}) {
    if (state.pads.size >= MAX_SOUND_PADS) throw new Error(`The practical session limit is ${MAX_SOUND_PADS} pads. Remove a pad before adding another.`);
    validateAudioFile(file);
    const pad = createPadRecord(file, String(state.nextId++));
    Object.assign(pad, configuration, { id: pad.id, file, objectUrl: pad.objectUrl, audio: pad.audio, playRequest: 0 });
    mountPad(pad);
    return pad;
  }

  async function addFiles(files) {
    let added = 0;
    const errors = [];
    for (const file of files) {
      try { addFile(file); added += 1; } catch (error) { errors.push(error.message); }
    }
    if (errors.length) announce(errors.join(' '), 'error');
    else if (added) announce(`${added} sound pad${added === 1 ? '' : 's'} added.`, 'ready');
    elements.input.value = '';
  }

  function playPad(pad) {
    if (pad.status === 'error') { pad.audio.load(); pad.status = 'loading'; }
    const request = ++pad.playRequest;
    if (pad.status !== 'paused') {
      try { pad.audio.currentTime = 0; } catch { /* Metadata may still be loading. */ }
    }
    applyAudioSettings(pad);
    const playPromise = pad.audio.play();
    if (playPromise) playPromise.catch((error) => {
      if (request !== pad.playRequest) return;
      pad.status = 'error';
      pad.error = `${pad.name}: playback was blocked or the file is unavailable.`;
      syncPad(pad);
      announce(`${pad.error} ${error?.message || ''}`.trim(), 'error');
    });
  }

  function pausePad(pad) {
    pad.playRequest += 1;
    pad.audio.pause();
    pad.status = pad.audio.currentTime > 0 ? 'paused' : 'stopped';
    syncPad(pad);
  }

  function stopPad(pad) {
    pad.playRequest += 1;
    pad.audio.pause();
    try { pad.audio.currentTime = 0; } catch { /* No decoded timeline yet. */ }
    pad.status = 'stopped';
    pad.error = '';
    syncPad(pad);
  }

  // Object URLs are revoked at every ownership boundary so deleted/replaced pads
  // cannot retain browser memory for the lifetime of the page.
  function cleanupPad(pad) {
    stopPad(pad);
    pad.audio.removeAttribute('src');
    pad.audio.load();
    URL.revokeObjectURL(pad.objectUrl);
  }

  function deletePad(pad) {
    cleanupPad(pad);
    state.pads.delete(pad.id);
    elementFor(pad)?.remove();
    updateBoardState();
    announce(`${pad.name} removed.`);
  }

  function duplicatePad(pad) {
    try {
      addFile(pad.file, { name: `${pad.name} copy`, loop: pad.loop, volume: pad.volume, rate: pad.rate, shortcut: '' });
      announce(`${pad.name} duplicated.`);
    } catch (error) { announce(error.message, 'error'); }
  }

  function replacePad(pad, file) {
    try {
      validateAudioFile(file);
      const replacement = createPadRecord(file, pad.id);
      cleanupPad(pad);
      pad.file = file;
      pad.objectUrl = replacement.objectUrl;
      pad.audio = replacement.audio;
      pad.status = 'loading';
      pad.error = '';
      pad.playRequest = 0;
      attachAudioEvents(pad);
      applyAudioSettings(pad);
      pad.audio.load();
      syncPad(pad);
      announce(`${pad.name} now uses ${file.name}.`);
    } catch (error) { announce(error.message, 'error'); }
  }

  function stopAll() {
    state.pads.forEach(stopPad);
    if (state.pads.size) announce('All sound pads stopped.');
  }

  function resetClearConfirmation() {
    if (clearConfirmationTimer) window.clearTimeout(clearConfirmationTimer);
    clearConfirmationTimer = null;
    delete elements.clearAll.dataset.confirming;
    elements.clearAll.textContent = 'Clear All';
  }

  function clearAll() {
    if (!state.pads.size) return;
    resetClearConfirmation();
    state.pads.forEach(cleanupPad);
    state.pads.clear();
    elements.grid.replaceChildren();
    updateBoardState();
    announce('Soundboard cleared.');
  }

  function requestClearAll() {
    if (elements.clearAll.dataset.confirming === 'true') {
      clearAll();
      return;
    }
    elements.clearAll.dataset.confirming = 'true';
    elements.clearAll.textContent = 'Confirm Clear';
    announce('Select Confirm Clear within five seconds to remove every pad.', 'working');
    clearConfirmationTimer = window.setTimeout(resetClearConfirmation, 5000);
  }

  function assignShortcut(pad, input) {
    const next = normalizeShortcut(input.value);
    if (input.value && !next) {
      input.value = pad.shortcut;
      announce('Shortcuts must be one letter or number.', 'error');
      return;
    }
    const duplicate = [...state.pads.values()].find((candidate) => candidate.id !== pad.id && candidate.shortcut === next && next);
    if (duplicate) {
      input.value = pad.shortcut;
      announce(`${next} is already assigned to ${duplicate.name}.`, 'error');
      return;
    }
    pad.shortcut = next;
    input.value = next;
    announce(next ? `${next} assigned to ${pad.name}.` : `Shortcut removed from ${pad.name}.`);
  }

  elements.browse.addEventListener('click', (event) => { event.stopPropagation(); elements.input.click(); });
  elements.dropZone.addEventListener('click', () => elements.input.click());
  elements.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.input.click(); }
  });
  elements.input.addEventListener('change', () => addFiles(elements.input.files));
  ['dragenter', 'dragover'].forEach((type) => elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); elements.dropZone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((type) => elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); elements.dropZone.classList.remove('is-dragging'); }));
  elements.dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files || []));
  elements.stopAll.addEventListener('click', stopAll);
  elements.clearAll.addEventListener('click', requestClearAll);
  elements.masterVolume.addEventListener('input', () => {
    state.masterVolume = Number(elements.masterVolume.value) / 100;
    elements.masterVolumeOutput.value = elements.masterVolume.value;
    state.pads.forEach(applyAudioSettings);
  });
  elements.masterMute.addEventListener('click', () => {
    state.muted = !state.muted;
    elements.masterMute.setAttribute('aria-pressed', String(state.muted));
    elements.masterMute.textContent = state.muted ? 'Unmute' : 'Mute';
    state.pads.forEach(applyAudioSettings);
    announce(state.muted ? 'Soundboard muted.' : 'Soundboard unmuted.');
  });

  elements.grid.addEventListener('click', (event) => {
    const action = event.target.closest('[data-pad-action]')?.dataset.padAction;
    const padElement = event.target.closest('[data-pad-id]');
    const pad = padElement ? state.pads.get(padElement.dataset.padId) : null;
    if (!action || !pad) return;
    if (action === 'play') playPad(pad);
    if (action === 'pause') pausePad(pad);
    if (action === 'stop') stopPad(pad);
    if (action === 'loop') { pad.loop = !pad.loop; applyAudioSettings(pad); syncPad(pad); }
    if (action === 'replace') padElement.querySelector('[data-pad-replace]').click();
    if (action === 'duplicate') duplicatePad(pad);
    if (action === 'delete') deletePad(pad);
  });
  elements.grid.addEventListener('input', (event) => {
    const padElement = event.target.closest('[data-pad-id]');
    const pad = padElement ? state.pads.get(padElement.dataset.padId) : null;
    if (!pad) return;
    const field = event.target.dataset.padField;
    if (field === 'name') pad.name = event.target.value.trim() || 'Untitled sound';
    if (field === 'shortcut') assignShortcut(pad, event.target);
    if (field === 'volume') pad.volume = Number(event.target.value) / 100;
    if (field === 'rate') pad.rate = Number(event.target.value);
    if (field === 'volume' || field === 'rate') { applyAudioSettings(pad); syncPad(pad); }
  });
  elements.grid.addEventListener('change', (event) => {
    const padElement = event.target.closest('[data-pad-id]');
    const pad = padElement ? state.pads.get(padElement.dataset.padId) : null;
    if (!pad) return;
    if (event.target.matches('[data-pad-replace]') && event.target.files[0]) replacePad(pad, event.target.files[0]);
  });

  const keyboardHandler = (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    const key = normalizeShortcut(event.key);
    const pad = [...state.pads.values()].find((candidate) => candidate.shortcut === key && key);
    if (pad) { event.preventDefault(); playPad(pad); }
  };
  document.addEventListener('keydown', keyboardHandler);

  updateBoardState();
  return {
    stopAll,
    clearAll,
    destroy() {
      resetClearConfirmation();
      clearAll();
      document.removeEventListener('keydown', keyboardHandler);
    },
    getState: () => state,
  };
}
