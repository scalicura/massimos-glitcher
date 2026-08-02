import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_SHADER_PRESET, SHADER_PRESETS } from '../src/retro/shader-catalog.js';

const shaderDirectory = path.resolve('src/retro/shaders');

test('publishes the complete fixed Checkpoint 4B preset catalog', () => {
  assert.equal(DEFAULT_SHADER_PRESET, 'clean-pixels');
  assert.equal(SHADER_PRESETS.length, 10);
  assert.equal(new Set(SHADER_PRESETS.map(({ id }) => id)).size, 10);
  assert.deepEqual(new Set(SHADER_PRESETS.map(({ group }) => group)), new Set(['Retro Filters', 'Glitch Mode']));
  assert.ok(SHADER_PRESETS.some(({ cost }) => cost === 'High cost'));
  assert.ok(SHADER_PRESETS.some(({ aggressive }) => aggressive));
});

test('every preset is a local single-pass, nearest-filtered, source-resolution GLSLP asset', async () => {
  const modes = [];
  for (const preset of SHADER_PRESETS) {
    const source = await readFile(path.join(shaderDirectory, `${preset.id}.glslp`), 'utf8');
    assert.match(source, /^shaders = "1"$/m, preset.id);
    assert.match(source, /^shader0 = "massimo-live-effects\.glsl"$/m, preset.id);
    assert.match(source, /^filter_linear0 = "false"$/m, preset.id);
    assert.match(source, /^scale_type0 = "source"$/m, preset.id);
    assert.match(source, /^scale0 = "1\.0"$/m, preset.id);
    const mode = source.match(/^MASSIMO_PRESET = "([0-9]+\.0)"$/m);
    assert.ok(mode, `${preset.id} must set a fixed preset mode`);
    modes.push(mode[1]);
  }
  assert.equal(new Set(modes).size, SHADER_PRESETS.length);
});

test('shared GLSL source targets the RetroArch WebGL compatibility format without frame interception', async () => {
  const source = await readFile(path.join(shaderDirectory, 'massimo-live-effects.glsl'), 'utf8');
  assert.match(source, /defined\(VERTEX\)/);
  assert.match(source, /defined\(FRAGMENT\)/);
  assert.match(source, /precision (highp|mediump) float/);
  assert.match(source, /uniform sampler2D Texture/);
  assert.match(source, /uniform int FrameCount/);
  assert.match(source, /#pragma parameter MASSIMO_PRESET/);
  assert.doesNotMatch(source, /\b(for|while)\s*\(/);
  assert.doesNotMatch(source, /getImageData|putImageData|drawImage|readPixels|texSubImage2D|preserveDrawingBuffer|requestAnimationFrame/);
});

test('player preflight is compile-only and leaves live frames to EmulatorJS', async () => {
  const source = await readFile(path.resolve('src/retro/player.js'), 'utf8');
  assert.match(source, /canvas\.getContext\('webgl'\)/);
  assert.match(source, /gl\.compileShader/);
  assert.match(source, /gl\.linkProgram/);
  assert.doesNotMatch(source, /getImageData|putImageData|drawImage|readPixels|texSubImage2D|preserveDrawingBuffer|requestAnimationFrame/);
});
