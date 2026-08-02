import { ROM_SYSTEMS, validateRomFile } from './rom-validation.js';

const MESSAGE_SOURCE = 'massimo-retro-player';

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  };

  let selectedFile = null;
  let validation = null;
  let romUrl = null;
  let frame = null;
  let frameReady = false;
  let destroyed = false;

  function announce(message, mode = 'info') {
    elements.message.textContent = message;
    elements.message.dataset.mode = mode;
  }

  function setStatus(label, mode = 'idle') {
    elements.status.innerHTML = '<i></i>';
    elements.status.append(document.createTextNode(` ${label}`));
    elements.status.dataset.mode = mode;
  }

  function updateGamepads() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    elements.gamepadStatus.textContent = pads.length
      ? `${pads.length} gamepad${pads.length === 1 ? '' : 's'} connected. Map players in Controls.`
      : 'No gamepad detected. Keyboard remains available.';
    elements.gamepadStatus.dataset.mode = pads.length ? 'ready' : 'idle';
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
    }
  }

  function start() {
    if (!selectedFile || !validation) return;
    unload({ clearSelection: false });
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
    announce('EmulatorJS is loading the pinned local core. Press Start Game inside the player when ready.');
  }

  function handleMessage(event) {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow || event.data?.source !== MESSAGE_SOURCE) return;
    const { type } = event.data;
    if (type === 'frame-ready') {
      frameReady = true;
      postToFrame({ type: 'init', romUrl, system: validation.system, name: selectedFile.name.replace(/\.[^.]+$/, '') });
    } else if (type === 'ready') {
      setStatus('Ready to start', 'ready');
    } else if (type === 'started') {
      setStatus(`${ROM_SYSTEMS[validation.system].label} running`, 'ready');
      announce('Use the player toolbar for pause, reset, volume, mute, fullscreen, clean screenshots, states, and control mapping.', 'success');
    } else if (type === 'paused') {
      setStatus('Paused', 'paused');
      if (event.data.reason !== 'manual') announce('Emulation paused automatically. Resume from the player toolbar.');
    } else if (type === 'state-saved') {
      announce(`Session state saved in memory (${formatBytes(event.data.bytes)}). It will be discarded on unload or refresh.`, 'success');
    } else if (type === 'state-loaded') {
      announce('Session state restored.', 'success');
    } else if (type === 'state-missing') {
      announce('No session state is available yet.', 'warning');
    } else if (type === 'error') {
      setStatus('Emulator error', 'error');
      announce(event.data.message || 'The emulator could not be initialized.', 'error');
    }
  }

  function pause(reason) {
    postToFrame({ type: 'pause', reason });
  }

  function handleVisibilityChange() {
    if (document.hidden) pause('page-hidden');
  }

  elements.chooseButton.addEventListener('click', () => elements.fileInput.click());
  elements.dropZone.addEventListener('click', (event) => { if (!event.target.closest('button')) elements.fileInput.click(); });
  elements.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); elements.fileInput.click(); }
  });
  elements.fileInput.addEventListener('change', () => selectFile(elements.fileInput.files[0]));
  elements.system.addEventListener('change', () => { if (selectedFile) selectFile(selectedFile); });
  elements.loadButton.addEventListener('click', start);
  elements.unloadButton.addEventListener('click', () => unload());
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
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('gamepadconnected', updateGamepads);
      window.removeEventListener('gamepaddisconnected', updateGamepads);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unload();
    },
  };
}
