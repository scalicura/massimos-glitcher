import { ROM_SYSTEMS, validateRomFile } from './rom-validation.js';
import { DEFAULT_SHADER_PRESET, getShaderPreset, SHADER_PRESETS } from './shader-catalog.js';

const MESSAGE_SOURCE = 'massimo-retro-player';
const STARTUP_TIMEOUT_MS = 45_000;
const EFFECTS_OFF = Object.freeze({ enabled: false, preset: DEFAULT_SHADER_PRESET });

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function cloneEffects(effects) {
  return { enabled: Boolean(effects.enabled), preset: effects.preset || DEFAULT_SHADER_PRESET };
}

function effectsMatch(left, right) {
  return left.enabled === right.enabled && left.preset === right.preset;
}

export function initRetroLab(root) {
  const elements = {
    dropZone: root.querySelector('#rom-drop-zone'),
    fileInput: root.querySelector('#rom-file-input'),
    chooseButton: root.querySelector('#rom-choose-button'),
    system: root.querySelector('#rom-system'),
    loadButton: root.querySelector('#rom-load-button'),
    unloadButton: root.querySelector('#rom-unload-button'),
    fileName: root.querySelector('#rom-file-name'),
    fileMeta: root.querySelector('#rom-file-meta'),
    message: root.querySelector('#retro-message'),
    status: root.querySelector('#retro-status'),
    empty: root.querySelector('#retro-empty'),
    frameHost: root.querySelector('#retro-frame-host'),
    gamepadStatus: root.querySelector('#gamepad-status'),
    effectsEnabled: root.querySelector('#retro-effects-enabled'),
    shaderPreset: root.querySelector('#retro-shader-preset'),
    presetName: root.querySelector('#retro-preset-name'),
    presetCost: root.querySelector('#retro-preset-cost'),
    presetDescription: root.querySelector('#retro-preset-description'),
    effectsApply: root.querySelector('#retro-effects-apply'),
    effectsReset: root.querySelector('#retro-effects-reset'),
    effectsStatus: root.querySelector('#retro-effects-status'),
    effectsWarning: root.querySelector('#retro-effects-warning'),
    restartRequired: root.querySelector('#retro-restart-required'),
    restartDialog: root.querySelector('#shader-restart-dialog'),
    restartSelection: root.querySelector('#shader-restart-selection'),
  };

  let selectedFile = null;
  let validation = null;
  let romUrl = null;
  let frame = null;
  let frameReady = false;
  let destroyed = false;
  let startupTimer = null;
  let appliedEffects = cloneEffects(EFFECTS_OFF);
  let requestedEffects = null;
  let fallbackAttempted = false;

  function announce(message, mode = 'info') {
    elements.message.textContent = message;
    elements.message.dataset.mode = mode;
  }

  function announceEffects(message, mode = 'info') {
    elements.effectsStatus.textContent = message;
    elements.effectsStatus.dataset.mode = mode;
  }

  function setStatus(label, mode = 'idle') {
    elements.status.innerHTML = '<i></i>';
    elements.status.append(document.createTextNode(` ${label}`));
    elements.status.dataset.mode = mode;
  }

  function clearStartupTimer() {
    if (!startupTimer) return;
    window.clearTimeout(startupTimer);
    startupTimer = null;
  }

  function updateGamepads() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    elements.gamepadStatus.textContent = pads.length
      ? `${pads.length} gamepad${pads.length === 1 ? '' : 's'} connected. Map players in Controls.`
      : 'No gamepad detected. Keyboard remains available.';
    elements.gamepadStatus.dataset.mode = pads.length ? 'ready' : 'idle';
  }

  function populateShaderOptions() {
    const groups = new Map();
    SHADER_PRESETS.forEach((preset) => {
      if (!groups.has(preset.group)) {
        const group = document.createElement('optgroup');
        group.label = preset.group;
        groups.set(preset.group, group);
        elements.shaderPreset.append(group);
      }
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = `${preset.label} · ${preset.cost}${preset.aggressive ? ' · aggressive' : ''}`;
      groups.get(preset.group).append(option);
    });
  }

  function readEffectsForm() {
    return {
      enabled: elements.effectsEnabled.checked,
      preset: elements.shaderPreset.value || DEFAULT_SHADER_PRESET,
    };
  }

  function updateEffectControls() {
    const formEffects = readEffectsForm();
    const preset = getShaderPreset(formEffects.preset) || getShaderPreset(DEFAULT_SHADER_PRESET);
    const dirty = !effectsMatch(formEffects, appliedEffects);
    elements.shaderPreset.disabled = !formEffects.enabled;
    elements.presetName.textContent = preset.label;
    elements.presetCost.textContent = preset.cost;
    elements.presetDescription.textContent = preset.description;
    elements.effectsApply.disabled = !dirty;
    elements.restartRequired.hidden = !(frame && dirty);
    elements.effectsWarning.dataset.mode = preset.aggressive && formEffects.enabled ? 'warning' : 'info';
    elements.effectsWarning.textContent = preset.aggressive && formEffects.enabled
      ? `${preset.label} is an aggressive preset. Gameplay visibility may be reduced; ${preset.cost.toLowerCase()}.`
      : `${preset.cost}. Fixed presets use one native-resolution WebGL 1-compatible shader pass.`;
  }

  function syncEffectControls() {
    elements.effectsEnabled.checked = appliedEffects.enabled;
    elements.shaderPreset.value = appliedEffects.preset;
    updateEffectControls();
  }

  async function selectFile(file) {
    if (!file) return;
    try {
      const result = await validateRomFile(file, elements.system.value);
      selectedFile = file;
      validation = result;
      elements.fileName.textContent = file.name;
      elements.fileMeta.textContent = `${ROM_SYSTEMS[result.system].label} · ${formatBytes(file.size)} · ${ROM_SYSTEMS[result.system].core}`;
      elements.loadButton.disabled = false;
      announce(result.warning || 'ROM validated locally. It has not been uploaded or started.', result.warning ? 'warning' : 'success');
    } catch (error) {
      selectedFile = null;
      validation = null;
      elements.fileName.textContent = 'No ROM selected';
      elements.fileMeta.textContent = 'NES: .nes · SNES: .sfc or .smc';
      elements.loadButton.disabled = true;
      announce(error instanceof Error ? error.message : 'The ROM could not be validated.', 'error');
    }
  }

  function postToFrame(message) {
    if (!frame?.contentWindow || !frameReady) return;
    frame.contentWindow.postMessage(message, window.location.origin);
  }

  function unload({ clearSelection = true } = {}) {
    clearStartupTimer();
    if (elements.restartDialog.open) elements.restartDialog.close('cancel');
    requestedEffects = null;
    if (frame) {
      postToFrame({ type: 'pause', reason: 'unload' });
      frame.remove();
      frame = null;
      frameReady = false;
    }
    if (romUrl) {
      URL.revokeObjectURL(romUrl);
      romUrl = null;
    }
    elements.frameHost.replaceChildren();
    elements.frameHost.hidden = true;
    elements.empty.hidden = false;
    elements.unloadButton.disabled = true;
    setStatus('No ROM loaded');
    if (clearSelection) {
      selectedFile = null;
      validation = null;
      elements.fileInput.value = '';
      elements.fileName.textContent = 'No ROM selected';
      elements.fileMeta.textContent = 'NES: .nes · SNES: .sfc or .smc';
      elements.loadButton.disabled = true;
      announce('ROMs run only in this browser tab and are released on unload.');
    } else {
      elements.loadButton.disabled = !selectedFile;
    }
    updateEffectControls();
  }

  function handleStartupTimeout() {
    startupTimer = null;
    const message = 'The emulator did not become ready before the startup timeout.';
    if (appliedEffects.enabled) {
      handleShaderFailure(message);
      return;
    }
    unload({ clearSelection: false });
    setStatus('Emulator error', 'error');
    announce(`${message} The cartridge remains selected so you can retry.`, 'error');
  }

  function start({ recovery = false, recoveryMessage = '' } = {}) {
    if (!selectedFile || !validation) return;
    unload({ clearSelection: false });
    if (!recovery) fallbackAttempted = false;
    romUrl = URL.createObjectURL(selectedFile);
    frame = document.createElement('iframe');
    frame.className = 'retro-frame';
    frame.title = `${ROM_SYSTEMS[validation.system].label} emulator`;
    frame.allow = 'autoplay; fullscreen; gamepad; screen-wake-lock';
    frame.setAttribute('allowfullscreen', '');
    frame.src = '/retro-player.html';
    elements.frameHost.replaceChildren(frame);
    elements.frameHost.hidden = false;
    elements.empty.hidden = true;
    elements.loadButton.disabled = true;
    elements.unloadButton.disabled = false;
    setStatus('Preparing emulator', 'working');
    const preset = getShaderPreset(appliedEffects.preset);
    announce(recovery
      ? 'The visual shader failed. The selected cartridge is being recovered with clean output.'
      : appliedEffects.enabled
        ? `Loading the pinned local core with ${preset.label}. Press Start Game when the player is ready.`
        : 'EmulatorJS is loading the pinned local core with effects off. Press Start Game when ready.', recovery ? 'warning' : 'info');
    announceEffects(recovery
      ? `${recoveryMessage} Restarting once with Effects Off.`
      : appliedEffects.enabled
        ? `${preset.label} is being prepared. The emulator render loop remains unchanged.`
        : 'Effects are off. Clean output is being prepared.', recovery ? 'error' : 'working');
    startupTimer = window.setTimeout(handleStartupTimeout, STARTUP_TIMEOUT_MS);
    updateEffectControls();
  }

  function commitEffects(nextEffects) {
    appliedEffects = cloneEffects(nextEffects);
    fallbackAttempted = false;
    syncEffectControls();
    start();
  }

  function requestEffectsApply(nextEffects = readEffectsForm()) {
    const preset = getShaderPreset(nextEffects.preset);
    if (!preset) {
      announceEffects('The selected shader preset is unavailable. Effects remain unchanged.', 'error');
      return;
    }
    if (effectsMatch(nextEffects, appliedEffects)) {
      announceEffects(nextEffects.enabled ? `${preset.label} is already active.` : 'Effects are already off.');
      updateEffectControls();
      return;
    }
    if (!frame) {
      appliedEffects = cloneEffects(nextEffects);
      fallbackAttempted = false;
      syncEffectControls();
      announceEffects(nextEffects.enabled
        ? `${preset.label} will be used when the next cartridge starts.`
        : 'Effects are off. The next cartridge will use clean output.', 'success');
      return;
    }

    requestedEffects = cloneEffects(nextEffects);
    elements.restartSelection.textContent = nextEffects.enabled
      ? `${preset.label} · ${preset.cost}${preset.aggressive ? ' · aggressive visibility warning' : ''}`
      : 'Effects Off · lowest overhead';
    if (typeof elements.restartDialog.showModal === 'function') {
      elements.restartDialog.showModal();
      return;
    }
    if (window.confirm('Applying this visual preset restarts the emulator and loses unsaved gameplay state. Continue?')) {
      commitEffects(requestedEffects);
    }
    requestedEffects = null;
  }

  function handleShaderFailure(message) {
    clearStartupTimer();
    if (appliedEffects.enabled && !fallbackAttempted && selectedFile && validation) {
      const failedPreset = getShaderPreset(appliedEffects.preset)?.label || 'The shader';
      fallbackAttempted = true;
      appliedEffects = cloneEffects(EFFECTS_OFF);
      syncEffectControls();
      const recoveryMessage = `${failedPreset} failed: ${message}`;
      window.setTimeout(() => start({ recovery: true, recoveryMessage }), 0);
      return;
    }
    unload({ clearSelection: false });
    setStatus('Emulator error', 'error');
    announceEffects(`Visual recovery stopped: ${message}`, 'error');
    announce('The emulator could not recover. The cartridge remains selected for a manual retry.', 'error');
  }

  function handleMessage(event) {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow || event.data?.source !== MESSAGE_SOURCE) return;
    const { type } = event.data;
    if (type === 'frame-ready') {
      frameReady = true;
      postToFrame({
        type: 'init',
        romUrl,
        system: validation.system,
        name: selectedFile.name.replace(/\.[^.]+$/, ''),
        effects: appliedEffects,
      });
    } else if (type === 'ready') {
      clearStartupTimer();
      setStatus('Ready to start', 'ready');
      const preset = getShaderPreset(appliedEffects.preset);
      announceEffects(fallbackAttempted && !appliedEffects.enabled
        ? 'The shader failed, but fallback succeeded. Effects Off is ready; press Start Game for clean output.'
        : appliedEffects.enabled
          ? `${preset.label} is loaded through the EmulatorJS shader chain. Press Start Game.`
          : 'Effects are off. Press Start Game for clean output.', fallbackAttempted ? 'error' : 'success');
    } else if (type === 'started') {
      clearStartupTimer();
      setStatus(`${ROM_SYSTEMS[validation.system].label} running`, 'ready');
      const effectLabel = appliedEffects.enabled ? getShaderPreset(appliedEffects.preset).label : 'Effects Off';
      announce(`Running with ${effectLabel}. The player toolbar controls pause, reset, volume, fullscreen, clean screenshots, states, and input mapping.`, 'success');
    } else if (type === 'paused') {
      setStatus('Paused', 'paused');
      if (event.data.reason !== 'manual') announce('Emulation paused automatically. Resume from the player toolbar.');
    } else if (type === 'state-saved') {
      announce(`Session state saved in memory (${formatBytes(event.data.bytes)}). It will be discarded on unload or refresh.`, 'success');
    } else if (type === 'state-loaded') {
      announce('Session state restored.', 'success');
    } else if (type === 'state-missing') {
      announce('No session state is available yet.', 'warning');
    } else if (type === 'shader-failure' || (type === 'error' && event.data.shaderFailure)) {
      handleShaderFailure(event.data.message || 'The active shader could not render.');
    } else if (type === 'error') {
      clearStartupTimer();
      unload({ clearSelection: false });
      setStatus('Emulator error', 'error');
      announce(event.data.message || 'The emulator could not be initialized. The cartridge remains selected.', 'error');
    }
  }

  function pause(reason) {
    postToFrame({ type: 'pause', reason });
  }

  function handleVisibilityChange() {
    if (document.hidden) pause('page-hidden');
  }

  populateShaderOptions();
  syncEffectControls();

  elements.chooseButton.addEventListener('click', () => elements.fileInput.click());
  elements.dropZone.addEventListener('click', (event) => { if (!event.target.closest('button')) elements.fileInput.click(); });
  elements.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.fileInput.click(); }
  });
  elements.fileInput.addEventListener('change', () => selectFile(elements.fileInput.files[0]));
  elements.system.addEventListener('change', () => { if (selectedFile) selectFile(selectedFile); });
  elements.loadButton.addEventListener('click', () => start());
  elements.unloadButton.addEventListener('click', () => unload());
  elements.effectsEnabled.addEventListener('change', updateEffectControls);
  elements.shaderPreset.addEventListener('change', updateEffectControls);
  elements.effectsApply.addEventListener('click', () => requestEffectsApply());
  elements.effectsReset.addEventListener('click', () => {
    elements.effectsEnabled.checked = true;
    elements.shaderPreset.value = DEFAULT_SHADER_PRESET;
    updateEffectControls();
    requestEffectsApply({ enabled: true, preset: DEFAULT_SHADER_PRESET });
  });
  elements.restartDialog.addEventListener('close', () => {
    if (elements.restartDialog.returnValue === 'restart' && requestedEffects) commitEffects(requestedEffects);
    else {
      syncEffectControls();
      announceEffects('Shader change canceled. The current emulator continues unchanged.');
    }
    requestedEffects = null;
  });
  ['dragenter', 'dragover'].forEach((type) => elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach((type) => elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
    if (type === 'drop') selectFile(event.dataTransfer?.files[0]);
  }));
  window.addEventListener('message', handleMessage);
  window.addEventListener('gamepadconnected', updateGamepads);
  window.addEventListener('gamepaddisconnected', updateGamepads);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  updateGamepads();

  return {
    pause,
    unload,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearStartupTimer();
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('gamepadconnected', updateGamepads);
      window.removeEventListener('gamepaddisconnected', updateGamepads);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unload();
    },
  };
}
