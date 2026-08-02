import { normalizeSeed } from './random/seeded-random.js';

export const EFFECT_KEYS = [
  'rgbShift',
  'slices',
  'pixelation',
  'scanlines',
  'noise',
  'vhs',
  'crt',
  'retroGame',
  'corruption',
  'macroblock',
  'compressionMelt',
  'frameTear',
  'regionalColorDrift',
  'blockEcho',
  'signalBand',
];

const setting = (enabled, value) => ({ enabled, value });

export const EFFECT_DEFAULTS = {
  rgbShift: setting(false, 12),
  slices: setting(false, 36),
  pixelation: setting(false, 8),
  scanlines: setting(false, 28),
  noise: setting(false, 16),
  vhs: setting(false, 52),
  crt: setting(false, 58),
  retroGame: setting(false, 64),
  corruption: setting(false, 48),
  macroblock: { enabled: false, blockWidth: 48, blockHeight: 32, displacement: 60, density: 28, horizontalBias: 45, verticalBias: 0, seed: 0 },
  compressionMelt: { enabled: false, strength: 54, direction: 'horizontal', spread: 72, density: 30, iterations: 3, seed: 0 },
  frameTear: { enabled: false, count: 7, thickness: 24, offset: 76, orientation: 'horizontal', opacity: 72, blend: 52, seed: 0 },
  regionalColorDrift: { enabled: false, redOffset: 14, greenOffset: 0, blueOffset: -14, regionSize: 92, density: 26, direction: 'horizontal', seed: 0 },
  blockEcho: { enabled: false, echoCount: 4, spacing: 24, blockSize: 72, opacityFalloff: 58, direction: 'right', density: 24, seed: 0 },
  signalBand: { enabled: false, bandCount: 8, bandThickness: 14, displacement: 64, noise: 28, colorDrift: 26, seed: 0 },
};

function buildSettings(overrides = {}) {
  const settings = structuredClone(EFFECT_DEFAULTS);
  Object.entries(overrides).forEach(([key, value]) => {
    settings[key] = { ...settings[key], ...value };
  });
  return settings;
}

const preset = (label, description, overrides, options = {}) => ({
  label,
  description,
  aggressive: Boolean(options.aggressive),
  seed: options.seed,
  settings: buildSettings(overrides),
});

export const PRESETS = {
  vhsTape: preset('VHS 1995', 'Soft tape tracking and analog noise.', {
    rgbShift: setting(true, 9), slices: setting(true, 22), scanlines: setting(true, 34),
    noise: setting(true, 24), vhs: setting(true, 76), crt: setting(true, 18),
  }),
  crtTerminal: preset('CRT Terminal', 'Cool phosphor bloom with tight scanlines.', {
    rgbShift: setting(true, 4), scanlines: setting(true, 52), noise: setting(true, 10), crt: setting(true, 82),
  }),
  arcade: preset('8-bit Arcade', 'Quantized color, pixels, and restrained glow.', {
    pixelation: setting(true, 10), scanlines: setting(true, 18), crt: setting(true, 30), retroGame: setting(true, 78),
  }),
  dataRot: preset('Data Rot', 'Layered legacy corruption and color damage.', {
    rgbShift: setting(true, 27), slices: setting(true, 78), pixelation: setting(true, 5),
    scanlines: setting(true, 12), noise: setting(true, 38), vhs: setting(true, 26),
    retroGame: setting(true, 24), corruption: setting(true, 86),
  }, { aggressive: true }),
  datamoshLite: preset('Datamosh Lite', 'Readable block motion with gentle local color drift.', {
    macroblock: { enabled: true, displacement: 32, density: 15, horizontalBias: 40 },
    regionalColorDrift: { enabled: true, redOffset: 7, blueOffset: -7, regionSize: 78, density: 12 },
    frameTear: { enabled: true, count: 3, thickness: 12, offset: 24, opacity: 42, blend: 28 },
  }, { seed: 10391 }),
  datamoshMeltdown: preset('Datamosh Meltdown', 'Heavy compression melt, echoes, and channel drift.', {
    macroblock: { enabled: true, blockWidth: 56, blockHeight: 34, displacement: 172, density: 58, horizontalBias: 72, verticalBias: 18 },
    compressionMelt: { enabled: true, strength: 88, direction: 'mixed', spread: 164, density: 72, iterations: 6 },
    regionalColorDrift: { enabled: true, redOffset: 28, greenOffset: -8, blueOffset: -30, regionSize: 128, density: 62, direction: 'mixed' },
    blockEcho: { enabled: true, echoCount: 7, spacing: 38, blockSize: 96, opacityFalloff: 42, direction: 'mixed', density: 54 },
  }, { aggressive: true, seed: 733103 }),
  brokenCodec: preset('Broken Codec', 'Block corruption and noisy signal-band failures.', {
    corruption: setting(true, 58), noise: setting(true, 26), pixelation: setting(true, 4),
    macroblock: { enabled: true, displacement: 94, density: 38, horizontalBias: 52, verticalBias: 8 },
    signalBand: { enabled: true, bandCount: 10, bandThickness: 13, displacement: 82, noise: 46, colorDrift: 34 },
  }, { seed: 404404 }),
  frozenMotion: preset('Frozen Motion', 'Persistent echoes and frame offsets with mild scanlines.', {
    scanlines: setting(true, 18),
    frameTear: { enabled: true, count: 6, thickness: 28, offset: 62, orientation: 'mixed', opacity: 58, blend: 42 },
    regionalColorDrift: { enabled: true, redOffset: 6, blueOffset: -6, regionSize: 70, density: 14 },
    blockEcho: { enabled: true, echoCount: 6, spacing: 22, blockSize: 88, opacityFalloff: 64, direction: 'right', density: 40 },
  }, { seed: 110011 }),
  panicBroadcast: preset('Panic Broadcast', 'Severe broadcast bands, channel failure, and static.', {
    rgbShift: setting(true, 31), scanlines: setting(true, 46), noise: setting(true, 52),
    frameTear: { enabled: true, count: 12, thickness: 18, offset: 118, orientation: 'horizontal', opacity: 82, blend: 70 },
    regionalColorDrift: { enabled: true, redOffset: 34, greenOffset: -12, blueOffset: -36, regionSize: 114, density: 48, direction: 'horizontal' },
    signalBand: { enabled: true, bandCount: 18, bandThickness: 18, displacement: 146, noise: 74, colorDrift: 72 },
  }, { aggressive: true, seed: 911911 }),
};

export function cloneSettings(settings) {
  return structuredClone(settings);
}

export function defaultSettings(seed = 3817) {
  return { seed: normalizeSeed(seed), ...structuredClone(EFFECT_DEFAULTS) };
}

export function settingsForPreset(name, currentSeed) {
  const selected = PRESETS[name];
  if (!selected) throw new Error(`Unknown preset: ${name}`);
  return {
    seed: selected.seed === undefined ? normalizeSeed(currentSeed) : normalizeSeed(selected.seed),
    ...structuredClone(selected.settings),
  };
}
