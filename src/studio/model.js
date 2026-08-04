import { createSeededRandom, normalizeSeed } from '../random/seeded-random.js';

export const STUDIO_SCHEMA_VERSION = 1;
export const PROJECT_TYPES = Object.freeze(['animated-glitch', 'broadcast']);
export const VALID_DURATIONS = Object.freeze([2, 3, 5, 8, 10]);
export const VALID_FRAME_RATES = Object.freeze([12, 15, 24, 30]);
export const TIMELINE_EVENT_TYPES = Object.freeze(['glitch', 'freeze', 'blackout', 'flash', 'text', 'audio']);
export const TIMELINE_EVENT_LABELS = Object.freeze({
  glitch: 'Glitch Burst', freeze: 'Freeze', blackout: 'Blackout', flash: 'Flash', text: 'Text Warning', audio: 'Audio Cue',
});
export const TEXT_EFFECTS = Object.freeze([
  'none', 'flicker', 'scramble', 'tear', 'missing', 'shadow', 'typing', 'pulse', 'reveal', 'redaction', 'dropout',
]);
export const CUE_TYPES = Object.freeze(['warning-beep', 'low-alarm', 'static-burst', 'signal-chirp', 'impact-hit', 'rising-tone', 'power-down']);

export const EFFECT_DEFINITIONS = Object.freeze([
  { key: 'rgbFlicker', label: 'RGB Flicker', fields: [['intensity', 'Intensity', 0, 100, 1], ['frequency', 'Frequency', 1, 12, 1]] },
  { key: 'signalTear', label: 'Signal Tear', fields: [['bandCount', 'Band count', 1, 18, 1], ['displacement', 'Displacement', 0, 100, 1], ['speed', 'Speed', 1, 12, 1]] },
  { key: 'macroblock', label: 'Macroblock Corruption', fields: [['blockSize', 'Block size', 8, 96, 1], ['density', 'Density', 0, 100, 1], ['motion', 'Motion', 0, 100, 1]] },
  { key: 'vhsTracking', label: 'VHS Tracking', fields: [['verticalDrift', 'Vertical drift', 0, 100, 1], ['linePosition', 'Tracking line', 0, 100, 1], ['intensity', 'Intensity', 0, 100, 1], ['jitter', 'Jitter', 0, 100, 1]] },
  { key: 'freezePulse', label: 'Freeze Pulse', fields: [['frequency', 'Pulse frequency', 1, 10, 1], ['duration', 'Freeze frames', 1, 12, 1]] },
  { key: 'staticBurst', label: 'Static Burst', fields: [['intensity', 'Intensity', 0, 100, 1], ['probability', 'Probability', 0, 100, 1], ['duration', 'Burst length', 1, 12, 1]] },
  { key: 'colorDropout', label: 'Color Dropout', fields: [['amount', 'Desaturation', 0, 100, 1], ['frequency', 'Frequency', 1, 12, 1], ['suppression', 'Channel suppression', 0, 100, 1]] },
  { key: 'frameFlash', label: 'Frame Flash', fields: [['frequency', 'Frequency', 1, 12, 1], ['intensity', 'Intensity', 0, 100, 1], ['tint', 'Warning tint', 0, 100, 1]] },
  { key: 'zoomJolt', label: 'Zoom Jolt', fields: [['intensity', 'Intensity', 0, 100, 1], ['frequency', 'Frequency', 1, 12, 1], ['horizontal', 'Horizontal shake', 0, 100, 1], ['vertical', 'Vertical shake', 0, 100, 1]] },
  { key: 'scanlineDrift', label: 'Scanline Drift', fields: [['spacing', 'Spacing', 2, 16, 1], ['opacity', 'Opacity', 0, 100, 1], ['speed', 'Speed', 0, 12, 1]] },
]);

const BASE_EFFECTS = Object.freeze({
  rgbFlicker: { enabled: true, intensity: 36, frequency: 5 },
  signalTear: { enabled: true, bandCount: 5, displacement: 42, speed: 5 },
  macroblock: { enabled: false, blockSize: 34, density: 26, motion: 42 },
  vhsTracking: { enabled: true, verticalDrift: 24, linePosition: 58, intensity: 34, jitter: 28 },
  freezePulse: { enabled: false, frequency: 4, duration: 4 },
  staticBurst: { enabled: true, intensity: 22, probability: 28, duration: 3 },
  colorDropout: { enabled: false, amount: 62, frequency: 5, suppression: 35 },
  frameFlash: { enabled: false, frequency: 6, intensity: 42, tint: 55 },
  zoomJolt: { enabled: false, intensity: 24, frequency: 5, horizontal: 28, vertical: 18 },
  scanlineDrift: { enabled: true, spacing: 5, opacity: 26, speed: 4 },
});

export function cloneEffects(effects = BASE_EFFECTS) {
  return Object.fromEntries(EFFECT_DEFINITIONS.map(({ key }) => [key, { ...BASE_EFFECTS[key], ...(effects[key] || {}) }]));
}

function preset(label, intensity, description, duration, fps, overrides, seedBehavior = 'preserve') {
  return Object.freeze({ label, intensity, description, recommendedDuration: duration, recommendedFps: fps, seedBehavior, effects: cloneEffects(overrides) });
}

export const ANIMATION_PRESETS = Object.freeze({
  brokenCartoon: preset('Broken Cartoon', 'Strange', 'Color slips and paper-cut signal tears.', 3, 15, { rgbFlicker: { enabled: true, intensity: 42 }, signalTear: { enabled: true, displacement: 34 }, staticBurst: { enabled: false }, colorDropout: { enabled: true, amount: 32 } }),
  hauntedVhs: preset('Haunted VHS', 'Strange', 'Unsteady tracking with quiet monochrome dropouts.', 5, 15, { rgbFlicker: { enabled: false }, vhsTracking: { enabled: true, intensity: 58, jitter: 46 }, colorDropout: { enabled: true, amount: 76 }, scanlineDrift: { enabled: true, opacity: 36 } }),
  abandonedArcade: preset('Abandoned Arcade', 'Severe', 'Hard scanlines, jolts, and unstable cartridge blocks.', 3, 24, { macroblock: { enabled: true, density: 48, motion: 64 }, zoomJolt: { enabled: true, intensity: 46 }, scanlineDrift: { enabled: true, opacity: 48 }, frameFlash: { enabled: true, intensity: 34 } }, 'refresh'),
  corruptedMascot: preset('Corrupted Mascot', 'Severe', 'Aggressive blocks and repeating frozen expressions.', 3, 15, { macroblock: { enabled: true, density: 58, motion: 72 }, freezePulse: { enabled: true, frequency: 4, duration: 6 }, rgbFlicker: { enabled: true, intensity: 61 }, signalTear: { enabled: true, displacement: 72 } }, 'refresh'),
  lostBroadcast: preset('Lost Broadcast', 'Strange', 'A drifting station signal with intermittent bursts.', 5, 15, { vhsTracking: { enabled: true, intensity: 68 }, staticBurst: { enabled: true, intensity: 58, probability: 45 }, colorDropout: { enabled: true, amount: 68 } }),
  damagedCartridge: preset('Damaged Cartridge', 'Severe', 'Block relocation, hard tears, and warning flashes.', 3, 24, { macroblock: { enabled: true, density: 64, motion: 78 }, signalTear: { enabled: true, bandCount: 11, displacement: 82 }, frameFlash: { enabled: true, intensity: 52 } }, 'refresh'),
  securityFeed: preset('Security Feed', 'Mild', 'Restrained monochrome surveillance drift.', 8, 12, { rgbFlicker: { enabled: false }, signalTear: { enabled: false }, vhsTracking: { enabled: true, intensity: 24 }, staticBurst: { enabled: true, intensity: 16, probability: 15 }, colorDropout: { enabled: true, amount: 82 }, scanlineDrift: { enabled: true, opacity: 20 } }),
  dreamTransmission: preset('Dream Transmission', 'Mild', 'Slow color ghosts with gentle breathing zooms.', 5, 15, { rgbFlicker: { enabled: true, intensity: 20, frequency: 3 }, signalTear: { enabled: false }, zoomJolt: { enabled: true, intensity: 14, frequency: 2 }, scanlineDrift: { enabled: true, opacity: 16 } }),
  signalCollapse: preset('Signal Collapse', 'Severe', 'Dense corruption escalating across the whole frame.', 2, 30, { rgbFlicker: { enabled: true, intensity: 78 }, signalTear: { enabled: true, bandCount: 14, displacement: 90 }, macroblock: { enabled: true, density: 72, motion: 88 }, staticBurst: { enabled: true, intensity: 76, probability: 68 }, frameFlash: { enabled: true, intensity: 64 } }, 'refresh'),
  quietBeforeScare: preset('Quiet Before the Scare', 'Mild', 'Mostly clean output punctuated by one sharp interruption.', 8, 12, { rgbFlicker: { enabled: false }, signalTear: { enabled: true, bandCount: 2, displacement: 22, speed: 2 }, vhsTracking: { enabled: true, intensity: 14 }, staticBurst: { enabled: true, intensity: 28, probability: 8 }, frameFlash: { enabled: true, frequency: 9, intensity: 28 } }),
});

function template(label, theme, headline, subtitle, ticker, station, channel, camera, presetKey, textEffect = 'flicker') {
  return Object.freeze({ label, theme, headline, subtitle, ticker, station, channel, camera, presetKey, textEffect });
}

export const BROADCAST_TEMPLATES = Object.freeze({
  signalLost: template('Signal Lost', 'cyan', 'SIGNAL LOST', 'REACQUIRING CARRIER', 'PLEASE STAND BY // DO NOT ADJUST', 'MASSIMO BROADCAST NETWORK', '8X', 'RELAY 04', 'lostBroadcast', 'dropout'),
  emergencyAlert: template('Emergency Alert', 'red', 'EMERGENCY SIGNAL', 'SHELTER PROTOCOL ACTIVE', 'AWAIT VERIFIED INSTRUCTIONS FROM SIGNAL AUTHORITY', 'SIGNAL AUTHORITY', '12', 'ALERT DESK', 'signalCollapse', 'pulse'),
  interceptedTransmission: template('Intercepted Transmission', 'lime', 'TRANSMISSION INTERCEPTED', 'SOURCE UNVERIFIED', 'PROJECT GLITCH // PACKET 3817', 'CHANNEL 8X', '8X', 'LISTENER 03', 'damagedCartridge', 'scramble'),
  corruptedChildrensProgram: template('Corrupted Children’s Program', 'magenta', 'FRIENDS FOREVER HOUR', 'PROGRAM MEMORY INCOMPLETE', 'SMILE FOR THE RESTORATION CAMERA', 'SUNBEAM LEARNING NETWORK', '4B', 'STUDIO C', 'corruptedMascot', 'missing'),
  securityCameraFeed: template('Security Camera Feed', 'mono', 'MOTION DETECTED', 'ARCHIVE PLAYBACK', 'CAMERA FEED MAY BE INCOMPLETE', 'MASCOT OBSERVATION UNIT', 'SEC', 'CAM 12', 'securityFeed', 'typing'),
  abandonedArcadeRecording: template('Abandoned Arcade Recording', 'amber', 'ARCADE SECTOR 12', 'CABINET NETWORK OFFLINE', 'TOKEN SYSTEM LOCKED // TECHNICIAN REQUIRED', 'NIGHT SHIFT SYSTEMS', '12', 'AISLE 07', 'abandonedArcade', 'tear'),
  testPattern: template('Test Pattern', 'cyan', 'TECHNICAL ALIGNMENT', 'COLOR / SYNC / AUDIO', 'MASSIMO BROADCAST NETWORK TEST TRANSMISSION', 'MBN ENGINEERING', '8X', 'TEST BAY', 'brokenCartoon', 'reveal'),
  classifiedTrainingTape: template('Classified Training Tape', 'lime', 'TRAINING MATERIAL 06', 'AUTHORIZED STAFF ONLY', 'DUPLICATION PROHIBITED // ARCHIVE COPY', 'PROJECT GLITCH', '06', 'VAULT B', 'hauntedVhs', 'redaction'),
  stationInterruption: template('Station Interruption', 'red', 'PROGRAM INTERRUPTED', 'UNSCHEDULED SIGNAL EVENT', 'REGULAR PROGRAMMING WILL NOT RESUME', 'MASSIMO BROADCAST NETWORK', '8X', 'MASTER CTRL', 'lostBroadcast', 'shadow'),
  unknownEntityDetected: template('Unknown Entity Detected', 'magenta', 'UNKNOWN ENTITY DETECTED', 'IDENTITY MATCH FAILED', 'DO NOT APPROACH THE OBSERVATION ZONE', 'MASCOT OBSERVATION UNIT', '13', 'CAM 00', 'quietBeforeScare', 'flicker'),
});

export function validateDuration(value) {
  const numeric = Number(value);
  if (!VALID_DURATIONS.includes(numeric)) throw new Error(`Duration must be one of: ${VALID_DURATIONS.join(', ')} seconds.`);
  return numeric;
}

export function validateFrameRate(value) {
  const numeric = Number(value);
  if (!VALID_FRAME_RATES.includes(numeric)) throw new Error(`Frame rate must be one of: ${VALID_FRAME_RATES.join(', ')} FPS.`);
  return numeric;
}

export function clampNumber(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

export function sanitizeText(value, maximum = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

export function sanitizeFilename(value, fallback = 'massimos-glitch') {
  const clean = sanitizeText(value, 80).replace(/[\\/:*?"|]+/g, '-').replace(/\.+$/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || fallback;
}

export function clampTimelineEvent(event, duration) {
  const safeDuration = validateDuration(duration);
  const type = TIMELINE_EVENT_TYPES.includes(event?.type) ? event.type : 'glitch';
  return {
    id: sanitizeText(event?.id, 64) || `event-${Date.now()}`,
    type,
    time: Math.round(clampNumber(event?.time, 0, safeDuration, 0) * 1000) / 1000,
    label: sanitizeText(event?.label, 80) || TIMELINE_EVENT_LABELS[type],
    cue: CUE_TYPES.includes(event?.cue) || String(event?.cue || '').startsWith('pad:') ? String(event.cue) : '',
  };
}

export function defaultBroadcast(templateKey = 'signalLost') {
  const selected = BROADCAST_TEMPLATES[templateKey] || BROADCAST_TEMPLATES.signalLost;
  return {
    templateKey: BROADCAST_TEMPLATES[templateKey] ? templateKey : 'signalLost', headline: selected.headline, subtitle: selected.subtitle,
    ticker: selected.ticker, station: selected.station, channel: selected.channel, camera: selected.camera,
    timestamp: '23:17:08', alignment: 'center', textSize: 100, textEffect: selected.textEffect,
    textFlicker: 28, textCorruption: 24, overlayOpacity: 78, theme: selected.theme, safeArea: true,
  };
}

export function defaultStudioSettings(seed = 3817) {
  return {
    duration: 3, fps: 15, loop: true, seed: normalizeSeed(seed), reducedFlash: true,
    effects: cloneEffects(), events: [], broadcast: defaultBroadcast(),
    exportResolution: '720', cueVolume: 35, muted: false,
  };
}

export function normalizedEffects(value = {}) {
  const result = cloneEffects();
  EFFECT_DEFINITIONS.forEach(({ key, fields }) => {
    const candidate = value[key] || {};
    result[key].enabled = Boolean(candidate.enabled);
    fields.forEach(([field, , min, max]) => { result[key][field] = clampNumber(candidate[field], min, max, result[key][field]); });
  });
  return result;
}

export function applyPresetSettings(key, seed = 3817) {
  const selected = ANIMATION_PRESETS[key];
  if (!selected) throw new Error('Unknown animation preset.');
  return {
    effects: cloneEffects(selected.effects), duration: selected.recommendedDuration, fps: selected.recommendedFps,
    seed: selected.seedBehavior === 'refresh' ? normalizeSeed(seed ^ 0x9e3779b9) : normalizeSeed(seed),
  };
}

export function guidedConfiguration(theme, intensity, seed = 3817) {
  const map = {
    brokenCartoon: 'brokenCartoon', abandonedArcade: 'abandonedArcade', hauntedTape: 'hauntedVhs', securityCamera: 'securityFeed',
    corruptedMascot: 'corruptedMascot', lostTransmission: 'lostBroadcast', damagedGame: 'damagedCartridge', strangeDream: 'dreamTransmission',
  };
  const presetKey = map[theme] || 'brokenCartoon';
  const config = applyPresetSettings(presetKey, seed);
  const multiplier = intensity === 'Destroyed' ? 1.35 : intensity === 'Mild' ? 0.72 : 1;
  EFFECT_DEFINITIONS.forEach(({ key, fields }) => fields.forEach(([field, , min, max]) => {
    if (field === 'frequency' || field === 'spacing' || field === 'linePosition' || field === 'blockSize') return;
    config.effects[key][field] = Math.round(clampNumber(config.effects[key][field] * multiplier, min, max));
  }));
  return { ...config, presetKey };
}

export function randomizeStudioSettings(seed) {
  const safeSeed = normalizeSeed(seed);
  const random = createSeededRandom(safeSeed);
  const effects = cloneEffects();
  EFFECT_DEFINITIONS.forEach(({ key, fields }) => {
    effects[key].enabled = random() > 0.28;
    fields.forEach(([field, , min, max, step]) => {
      const raw = min + random() * (max - min) * 0.82;
      effects[key][field] = Math.round(raw / step) * step;
    });
  });
  return effects;
}

export function validateStudioSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Project data must be an object.');
  const duration = validateDuration(value.duration);
  const fps = validateFrameRate(value.fps);
  const broadcast = { ...defaultBroadcast(value.broadcast?.templateKey) };
  for (const key of ['headline', 'subtitle', 'ticker', 'station', 'channel', 'camera', 'timestamp']) broadcast[key] = sanitizeText(value.broadcast?.[key] ?? broadcast[key], key === 'ticker' ? 180 : 100);
  broadcast.alignment = ['left', 'center', 'right'].includes(value.broadcast?.alignment) ? value.broadcast.alignment : 'center';
  broadcast.textSize = clampNumber(value.broadcast?.textSize, 60, 140, 100);
  broadcast.textEffect = TEXT_EFFECTS.includes(value.broadcast?.textEffect) ? value.broadcast.textEffect : 'none';
  broadcast.textFlicker = clampNumber(value.broadcast?.textFlicker, 0, 100, 20);
  broadcast.textCorruption = clampNumber(value.broadcast?.textCorruption, 0, 100, 20);
  broadcast.overlayOpacity = clampNumber(value.broadcast?.overlayOpacity, 10, 100, 78);
  broadcast.theme = ['cyan', 'red', 'lime', 'magenta', 'mono', 'amber'].includes(value.broadcast?.theme) ? value.broadcast.theme : 'cyan';
  broadcast.safeArea = value.broadcast?.safeArea !== false;
  return {
    duration, fps, loop: value.loop !== false, seed: normalizeSeed(value.seed), reducedFlash: value.reducedFlash !== false,
    effects: normalizedEffects(value.effects), events: Array.isArray(value.events) ? value.events.slice(0, 24).map((event) => clampTimelineEvent(event, duration)) : [],
    broadcast, exportResolution: ['original', '1080', '720'].includes(value.exportResolution) ? value.exportResolution : '720',
    cueVolume: clampNumber(value.cueVolume, 0, 65, 35), muted: Boolean(value.muted),
  };
}

export function validateProjectRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Project record is malformed.');
  if (Number(value.schemaVersion) !== STUDIO_SCHEMA_VERSION) throw new Error(`Unsupported project schema version: ${value.schemaVersion ?? 'missing'}.`);
  if (!PROJECT_TYPES.includes(value.type)) throw new Error('Unsupported project type.');
  const name = sanitizeText(value.name, 80);
  if (!name) throw new Error('Project name is required.');
  const createdAt = Number.isFinite(Date.parse(value.createdAt)) ? value.createdAt : new Date().toISOString();
  const modifiedAt = Number.isFinite(Date.parse(value.modifiedAt)) ? value.modifiedAt : createdAt;
  return {
    id: sanitizeText(value.id, 80) || `project-${Date.now()}`,
    name, type: value.type, schemaVersion: STUDIO_SCHEMA_VERSION, createdAt, modifiedAt,
    settings: validateStudioSnapshot(value.settings || value), sourceBlob: typeof Blob !== 'undefined' && value.sourceBlob instanceof Blob ? value.sourceBlob : null,
    sourceName: sanitizeFilename(value.sourceName || 'source-image', 'source-image'), thumbnail: typeof Blob !== 'undefined' && value.thumbnail instanceof Blob ? value.thumbnail : null,
  };
}

export function parseProjectImport(text, maximumBytes = 1024 * 1024) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > maximumBytes) throw new Error('Project file is larger than 1 MB.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Project file is not valid JSON.'); }
  if (JSON.stringify(data).includes('http://') || JSON.stringify(data).includes('https://')) throw new Error('Remote URLs are not allowed in project files.');
  return validateProjectRecord(data);
}
