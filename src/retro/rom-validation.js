export const ROM_SYSTEMS = Object.freeze({
  nes: { label: 'NES / Famicom', core: 'fceumm', extensions: ['nes'], maxBytes: 16 * 1024 * 1024 },
  snes: { label: 'SNES / Super Famicom', core: 'snes9x', extensions: ['sfc', 'smc'], maxBytes: 32 * 1024 * 1024 },
});

const AMBIGUOUS_EXTENSIONS = ['bin', 'rom'];
const MAX_VALIDATION_BYTES = 0x410200;

function extensionOf(name = '') {
  return name.toLowerCase().split('.').pop();
}

function hasINesHeader(bytes) {
  return bytes.length >= 16 && bytes[0] === 0x4e && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1a;
}

function snesHeaderScore(bytes, offset) {
  if (offset < 0 || bytes.length < offset + 0x40) return -1;
  let score = 0;
  const title = bytes.subarray(offset, offset + 21);
  const printable = [...title].filter((value) => value === 0 || (value >= 0x20 && value <= 0x7e)).length;
  if (printable >= 17) score += 1;
  const mapMode = bytes[offset + 0x15] & 0x2f;
  if ([0x20, 0x21, 0x22, 0x23, 0x25].includes(mapMode)) score += 2;
  const complement = bytes[offset + 0x1c] | (bytes[offset + 0x1d] << 8);
  const checksum = bytes[offset + 0x1e] | (bytes[offset + 0x1f] << 8);
  if (checksum !== 0 && ((checksum + complement) & 0xffff) === 0xffff) score += 2;
  const resetVector = bytes[offset + 0x3c] | (bytes[offset + 0x3d] << 8);
  if (resetVector >= 0x8000) score += 2;
  return score;
}

function hasSnesHeader(bytes, fileSize) {
  const copierOffset = fileSize % 0x8000 === 512 ? 512 : 0;
  const candidates = [0x7fc0, 0xffc0, 0x40ffc0].map((offset) => offset + copierOffset);
  return Math.max(...candidates.map((offset) => snesHeaderScore(bytes, offset))) >= 4;
}

export function detectRomSystem(bytes, fileName = '', fileSize = bytes.length) {
  if (hasINesHeader(bytes)) return 'nes';
  if (hasSnesHeader(bytes, fileSize)) return 'snes';
  return null;
}

export function validateRomBytes(bytes, { name, size }, override = 'auto') {
  const extension = extensionOf(name);
  const supportedExtensions = [...ROM_SYSTEMS.nes.extensions, ...ROM_SYSTEMS.snes.extensions, ...AMBIGUOUS_EXTENSIONS];
  if (!supportedExtensions.includes(extension)) throw new Error('Choose a .nes, .sfc, or .smc ROM file. .bin and .rom require a system override.');
  if (size < 16) throw new Error('The selected file is too small to be a valid ROM.');

  const detected = detectRomSystem(bytes, name, size);
  let system = override === 'auto' ? detected : override;
  if (override === 'auto' && AMBIGUOUS_EXTENSIONS.includes(extension)) {
    throw new Error('Select NES or SNES manually for .bin and .rom files.');
  }
  if (!system || !ROM_SYSTEMS[system]) throw new Error('The ROM system could not be detected. Select NES or SNES manually.');
  if (size > ROM_SYSTEMS[system].maxBytes) throw new Error(`${ROM_SYSTEMS[system].label} ROMs are limited to ${ROM_SYSTEMS[system].maxBytes / 1024 / 1024} MB.`);
  if (system === 'nes' && !hasINesHeader(bytes)) throw new Error('The file does not contain a valid iNES or NES 2.0 header.');
  if (system === 'snes' && !hasSnesHeader(bytes, size)) throw new Error('The file does not contain a plausible SNES ROM header.');

  const expectedByExtension = Object.entries(ROM_SYSTEMS).find(([, config]) => config.extensions.includes(extension))?.[0];
  const warning = expectedByExtension && expectedByExtension !== system
    ? `System override is using ${ROM_SYSTEMS[system].label} despite the .${extension} extension.`
    : '';
  return { system, detected, extension, warning };
}

export async function validateRomFile(file, override = 'auto') {
  if (!(file instanceof File)) throw new Error('Choose a local ROM file first.');
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, MAX_VALIDATION_BYTES)).arrayBuffer());
  return validateRomBytes(bytes, file, override);
}
