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
];

const setting = (enabled, value) => ({ enabled, value });

export const PRESETS = {
  vhsTape: {
    label: 'VHS 1995',
    rgbShift: setting(true, 9),
    slices: setting(true, 22),
    pixelation: setting(false, 8),
    scanlines: setting(true, 34),
    noise: setting(true, 24),
    vhs: setting(true, 76),
    crt: setting(true, 18),
    retroGame: setting(false, 64),
    corruption: setting(false, 48),
  },
  crtTerminal: {
    label: 'CRT Terminal',
    rgbShift: setting(true, 4),
    slices: setting(false, 36),
    pixelation: setting(false, 8),
    scanlines: setting(true, 52),
    noise: setting(true, 10),
    vhs: setting(false, 52),
    crt: setting(true, 82),
    retroGame: setting(false, 64),
    corruption: setting(false, 48),
  },
  arcade: {
    label: '8-bit Arcade',
    rgbShift: setting(false, 12),
    slices: setting(false, 36),
    pixelation: setting(true, 10),
    scanlines: setting(true, 18),
    noise: setting(false, 16),
    vhs: setting(false, 52),
    crt: setting(true, 30),
    retroGame: setting(true, 78),
    corruption: setting(false, 48),
  },
  dataRot: {
    label: 'Data Rot',
    rgbShift: setting(true, 27),
    slices: setting(true, 78),
    pixelation: setting(true, 5),
    scanlines: setting(true, 12),
    noise: setting(true, 38),
    vhs: setting(true, 26),
    crt: setting(false, 58),
    retroGame: setting(true, 24),
    corruption: setting(true, 86),
  },
};

export function cloneSettings(settings) {
  return structuredClone(settings);
}

export function settingsForPreset(name, seed) {
  const preset = PRESETS[name];
  if (!preset) throw new Error(`Unknown preset: ${name}`);
  const settings = { seed };
  EFFECT_KEYS.forEach((key) => {
    settings[key] = { ...preset[key] };
  });
  return settings;
}
