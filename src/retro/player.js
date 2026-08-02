import './player.css';
import { EMULATOR_SHADERS, resolveShaderSelection } from './shader-registry.js';

const parentOrigin = window.location.origin;
let initialized = false;
let sessionState = null;
let activeEffects = { enabled: false, preset: 'clean-pixels', shader: 'disabled' };

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

function compilePreflightShader(gl, type, source, label) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`The browser could not allocate the ${label} shader.`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || `${label} shader compilation failed.`;
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function preflightShader(selection) {
  if (!selection.enabled) return;
  const definition = EMULATOR_SHADERS[selection.shader];
  const presetSource = definition?.shader?.value;
  const shaderReference = presetSource?.match(/^shader0\s*=\s*["']([^"']+)["']/m)?.[1];
  const resource = definition?.resources?.find(({ name }) => name === shaderReference);
  const source = resource?.value;
  if (!presetSource || !shaderReference || !source) throw new Error('The selected shader files are incomplete.');

  // This detached 1x1 context compiles and links once before EmulatorJS starts.
  // It never presents, draws, polls frames, or reads pixels; live rendering still
  // happens exclusively inside the documented EmulatorJS shader pipeline.
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) throw new Error('WebGL 1 is unavailable for the selected visual preset.');
  let vertexShader;
  let fragmentShader;
  let program;
  try {
    vertexShader = compilePreflightShader(gl, gl.VERTEX_SHADER, `#define VERTEX 1\n${source}`, 'vertex');
    fragmentShader = compilePreflightShader(gl, gl.FRAGMENT_SHADER, `#define FRAGMENT 1\n#define PARAMETER_UNIFORM 1\n${source}`, 'fragment');
    program = gl.createProgram();
    if (!program) throw new Error('The browser could not allocate the shader program.');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Shader program linking failed.');
    }
  } finally {
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
  }
}

function configureEmulator({ romUrl, system, name, effects }) {
  try {
    activeEffects = resolveShaderSelection(effects);
    preflightShader(activeEffects);
  } catch (error) {
    error.code = 'SHADER_CONFIGURATION';
    throw error;
  }

  window.EJS_player = '#game';
  window.EJS_core = system;
  window.EJS_controlScheme = system;
  window.EJS_gameUrl = romUrl;
  // RetroArch remains the clean screenshot source, so its filenames are
  // explicitly labeled even while a visible post-processing preset is active.
  window.EJS_gameName = `${name}-clean`;
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
  window.EJS_shaders = EMULATOR_SHADERS;
  window.EJS_defaultOptions = { shader: activeEffects.shader };
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
    notify('ready', { effects: activeEffects });
  };
  window.EJS_onGameStart = () => notify('started', { effects: activeEffects });
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
      notify('error', {
        message: error instanceof Error ? error.message : 'Emulator initialization failed.',
        shaderFailure: error?.code === 'SHADER_CONFIGURATION',
      });
    }
    return;
  }
  if (event.data?.type === 'pause') pauseEmulator(event.data.reason);
}, { passive: true });

// These are standard browser lifecycle events rather than EmulatorJS canvas
// internals. A context failure is reported to the parent so it can perform one
// controlled clean restart instead of leaving a blank player.
document.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  notify('shader-failure', { message: 'The WebGL context was lost while rendering the emulator.' });
}, true);

document.addEventListener('webglcontextcreationerror', () => {
  notify('shader-failure', { message: 'The browser could not create the required WebGL context.' });
}, true);

window.addEventListener('error', (event) => {
  if (!activeEffects.enabled || !/shader|webgl|glsl/i.test(event.message || '')) return;
  notify('shader-failure', { message: event.message || 'The active shader failed.' });
});

window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason || '');
  if (!activeEffects.enabled || !/shader|webgl|glsl/i.test(message)) return;
  notify('shader-failure', { message: message || 'The active shader failed.' });
});

window.addEventListener('pagehide', () => pauseEmulator('pagehide'));
notify('frame-ready');
