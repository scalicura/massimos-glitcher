export const MAX_SOUND_PADS = 24;
export const MAX_AUDIO_SIZE = 40 * 1024 * 1024;

const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]);
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a)$/i;

export function validateAudioFile(file) {
  if (!(file instanceof File)) throw new Error('Choose an audio file to continue.');
  if (!AUDIO_EXTENSIONS.test(file.name) || (file.type && !AUDIO_TYPES.has(file.type))) {
    throw new Error(`${file.name}: unsupported audio. Use MP3, WAV, OGG, or browser-supported M4A.`);
  }
  if (/\.m4a$/i.test(file.name) && !new Audio().canPlayType(file.type || 'audio/mp4')) {
    throw new Error(`${file.name}: this browser cannot play M4A audio.`);
  }
  if (file.size > MAX_AUDIO_SIZE) throw new Error(`${file.name}: files must be 40 MB or smaller.`);
}

export function fileBaseName(name) {
  return name.replace(/\.[^.]+$/, '') || 'Untitled sound';
}

export function normalizeShortcut(value) {
  const key = String(value || '').trim().toUpperCase();
  return key.length === 1 && /[A-Z0-9]/.test(key) ? key : '';
}

export function createPadRecord(file, id) {
  validateAudioFile(file);
  const objectUrl = URL.createObjectURL(file);
  const audio = new Audio(objectUrl);
  audio.preload = 'metadata';
  return {
    id,
    file,
    objectUrl,
    audio,
    name: fileBaseName(file.name),
    shortcut: '',
    loop: false,
    volume: 1,
    rate: 1,
    status: 'loading',
    error: '',
    playRequest: 0,
  };
}
