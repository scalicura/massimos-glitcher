import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRomSystem, validateRomBytes } from '../src/retro/rom-validation.js';

function nesRom(size = 16 + 16_384) {
  const bytes = new Uint8Array(size);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 1, 0, 0, 0], 0);
  return bytes;
}

function snesRom(size = 0x8000) {
  const bytes = new Uint8Array(size);
  const header = 0x7fc0;
  bytes.set(new TextEncoder().encode('MASSIMO TEST SIGNAL  '), header);
  bytes[header + 0x15] = 0x20;
  bytes[header + 0x1c] = 0xcb;
  bytes[header + 0x1d] = 0xed;
  bytes[header + 0x1e] = 0x34;
  bytes[header + 0x1f] = 0x12;
  bytes[header + 0x3c] = 0x00;
  bytes[header + 0x3d] = 0x80;
  return bytes;
}

test('detects and validates an iNES ROM', () => {
  const bytes = nesRom();
  assert.equal(detectRomSystem(bytes, 'test.nes'), 'nes');
  assert.equal(validateRomBytes(bytes, { name: 'test.nes', size: bytes.length }).system, 'nes');
});

test('detects and validates a LoROM SNES header', () => {
  const bytes = snesRom();
  assert.equal(detectRomSystem(bytes, 'test.sfc'), 'snes');
  assert.equal(validateRomBytes(bytes, { name: 'test.sfc', size: bytes.length }).system, 'snes');
});

test('requires a manual override for ambiguous extensions', () => {
  const bytes = snesRom();
  assert.throws(() => validateRomBytes(bytes, { name: 'test.bin', size: bytes.length }), /manually/);
  assert.equal(validateRomBytes(bytes, { name: 'test.bin', size: bytes.length }, 'snes').system, 'snes');
});

test('rejects invalid NES headers and cross-system overrides', () => {
  const invalid = new Uint8Array(128);
  assert.throws(() => validateRomBytes(invalid, { name: 'bad.nes', size: invalid.length }, 'nes'), /valid iNES/);
  const nes = nesRom();
  assert.throws(() => validateRomBytes(nes, { name: 'wrong.sfc', size: nes.length }, 'snes'), /plausible SNES/);
  const randomSnes = new Uint8Array(0x8000);
  assert.throws(() => validateRomBytes(randomSnes, { name: 'bad.sfc', size: randomSnes.length }), /could not be detected/);
});

test('rejects unsupported extensions and oversized files', () => {
  const nes = nesRom();
  assert.throws(() => validateRomBytes(nes, { name: 'test.zip', size: nes.length }), /Choose a/);
  assert.throws(() => validateRomBytes(nes, { name: 'huge.nes', size: 17 * 1024 * 1024 }), /limited to 16 MB/);
});
