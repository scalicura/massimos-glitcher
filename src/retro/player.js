import './player.css';

const parentOrigin = window.location.origin;
let initialized = false;
let sessionState = null;

function notify(type, detail = {}) {
  window.parent.postMessage({ source: 'massimo-retro-player', type, ...detail }, parentOrigin);
}

function loadRuntime() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/emulatorjs/loader.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('The local EmulatorJS runtime could not be loaded.'));
    document.head.appendChild(script);
  });
}

function pauseEmulator(reason = 'manual') {
  const emulator = window.EJS_emulator;
  if (!emulator?.started || emulator.paused) return;
  emulator.pause();
  notify('paused', { reason });
}

// EmulatorJS asks for a screen wake lock after a game starts. The Retro Lab
// already pauses on page/workspace visibility changes, so an inert local
// implementation avoids noisy permission failures in embedded or locked-down
// browsers without changing emulation, audio, or input behavior.
function installInertWakeLock() {
  try {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          const listeners = new Set();
          return {
            released: false,
            onrelease: null,
            addEventListener(type, listener) {
              if (type === 'release') listeners.add(listener);
            },
            removeEventListener(type, listener) {
              if (type === 'release') listeners.delete(listener);
            },
            async release() {
              if (this.released) return;
              this.released = true;
              const event = new Event('release');
              listeners.forEach((listener) => listener.call(this, event));
              this.onrelease?.call(this, event);
            },
          };
        },
      },
    });
  } catch {
    // A non-configurable browser implementation is safe to leave untouched.
  }
}

function configureEmulator({ romUrl, system, name }) {
  window.EJS_player = '#game';
  window.EJS_core = system;
  window.EJS_controlScheme = system;
  window.EJS_gameUrl = romUrl;
  window.EJS_gameName = name;
  window.EJS_pathtodata = `${window.location.origin}/emulatorjs/`;
  window.EJS_DEBUG_XX = true;
  window.EJS_disableAutoLang = false;
  window.EJS_language = 'en-US';
  window.EJS_startOnLoaded = false;
  window.EJS_fullscreenOnLoaded = false;
  window.EJS_threads = false;
  window.EJS_disableDatabases = true;
  window.EJS_disableLocalStorage = true;
  window.EJS_noAutoFocus = false;
  window.EJS_volume = 0.65;
  window.EJS_color = '#55e5df';
  window.EJS_screenCapture = {
    photo: { source: 'retroarch', format: 'png', upscale: 0 },
  };
  window.EJS_Buttons = {
    playPause: { visible: true },
    restart: { visible: true },
    mute: { visible: true },
    settings: { visible: true },
    fullscreen: { visible: true },
    saveState: { visible: true },
    loadState: { visible: true },
    screenRecord: { visible: false },
    gamepad: { visible: true },
    cheat: { visible: false },
    volume: { visible: true },
    saveSavFiles: { visible: false },
    loadSavFiles: { visible: false },
    quickSave: { visible: false },
    quickLoad: { visible: false },
    screenshot: { visible: true },
    cacheManager: { visible: false },
    exitEmulation: { visible: false },
  };

  window.EJS_ready = () => {
    const emulator = window.EJS_emulator;
    emulator?.on('exit', () => notify('exit'));
    notify('ready');
  };
  window.EJS_onGameStart = () => notify('started');
  window.EJS_onSaveState = (payload) => {
    sessionState = payload?.state ? new Uint8Array(payload.state) : null;
    if (sessionState) {
      window.EJS_emulator?.displayMessage('Session state saved');
      notify('state-saved', { bytes: sessionState.byteLength });
    }
  };
  window.EJS_onLoadState = () => {
    if (!sessionState) {
      window.EJS_emulator?.displayMessage('No session state has been saved');
      notify('state-missing');
      return;
    }
    window.EJS_emulator?.gameManager?.loadState(new Uint8Array(sessionState));
    window.EJS_emulator?.displayMessage('Session state loaded');
    notify('state-loaded');
  };
}

window.addEventListener('message', async (event) => {
  if (event.origin !== parentOrigin || event.source !== window.parent) return;
  if (event.data?.type === 'init') {
    if (initialized) {
      notify('error', { message: 'An emulator instance is already active.' });
      return;
    }
    initialized = true;
    try {
      installInertWakeLock();
      configureEmulator(event.data);
      await loadRuntime();
    } catch (error) {
      notify('error', { message: error instanceof Error ? error.message : 'Emulator initialization failed.' });
    }
    return;
  }
  if (event.data?.type === 'pause') pauseEmulator(event.data.reason);
}, { passive: true });

window.addEventListener('pagehide', () => pauseEmulator('pagehide'));
notify('frame-ready');
