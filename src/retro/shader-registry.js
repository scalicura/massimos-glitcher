import shaderSource from './shaders/massimo-live-effects.glsl?raw';
import cleanPixels from './shaders/clean-pixels.glslp?raw';
import consumerCrt from './shaders/consumer-crt.glslp?raw';
import arcadeMonitor from './shaders/arcade-monitor.glslp?raw';
import badCompositeCable from './shaders/bad-composite-cable.glslp?raw';
import vhsGameCapture from './shaders/vhs-game-capture.glslp?raw';
import monochromeTerminal from './shaders/monochrome-terminal.glslp?raw';
import handheldLcd from './shaders/handheld-lcd.glslp?raw';
import brokenCartridge from './shaders/broken-cartridge.glslp?raw';
import corruptedBroadcast from './shaders/corrupted-broadcast.glslp?raw';
import glitchBoss from './shaders/glitch-boss.glslp?raw';
import { DEFAULT_SHADER_PRESET, getShaderPreset } from './shader-catalog.js';

const SHADER_FILE = 'massimo-live-effects.glsl';
const presetSources = {
  'clean-pixels': cleanPixels,
  'consumer-crt': consumerCrt,
  'arcade-monitor': arcadeMonitor,
  'bad-composite-cable': badCompositeCable,
  'vhs-game-capture': vhsGameCapture,
  'monochrome-terminal': monochromeTerminal,
  'handheld-lcd': handheldLcd,
  'broken-cartridge': brokenCartridge,
  'corrupted-broadcast': corruptedBroadcast,
  'glitch-boss': glitchBoss,
};

function shaderKey(id) {
  return `massimo-${id}.glslp`;
}

// EmulatorJS 4.2.3 writes these documented EJS_shaders entries into the
// RetroArch virtual filesystem. Every preset is one pass and shares the same
// original WebGL 1-compatible fragment shader resource.
export const EMULATOR_SHADERS = Object.freeze(Object.fromEntries(
  Object.entries(presetSources).map(([id, source]) => [shaderKey(id), {
    shader: { type: 'text', value: source },
    resources: [{ name: SHADER_FILE, type: 'text', value: shaderSource }],
  }]),
));

export function resolveShaderSelection({ enabled = false, preset = DEFAULT_SHADER_PRESET } = {}) {
  if (!enabled) return { enabled: false, preset: DEFAULT_SHADER_PRESET, shader: 'disabled' };
  if (!getShaderPreset(preset) || !presetSources[preset]) {
    throw new Error(`The shader preset “${preset}” is unavailable.`);
  }
  return { enabled: true, preset, shader: shaderKey(preset) };
}
