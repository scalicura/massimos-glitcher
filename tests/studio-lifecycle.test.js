import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const exporterSource = await readFile(new URL('../src/studio/exporter.js', import.meta.url), 'utf8');
const cueSource = await readFile(new URL('../src/studio/audio-cues.js', import.meta.url), 'utf8');
const studioSource = await readFile(new URL('../src/studio/glitch-studio.js', import.meta.url), 'utf8');

test('WebM export releases recorder and capture-stream resources in a finally block', () => {
  assert.match(exporterSource, /finally\s*\{[\s\S]*recorder\.state !== 'inactive'[\s\S]*stream\.getTracks\(\)[\s\S]*track\.stop\(\)/);
});

test('preview cue cleanup cancels delayed generated tones', () => {
  assert.match(cueSource, /pendingTimers\.forEach\(\(timer\) => window\.clearTimeout\(timer\)\)/);
  assert.match(cueSource, /pendingTimers\.clear\(\)/);
});

test('project thumbnail object URLs are released after load or error', () => {
  assert.match(studioSource, /addEventListener\('load', releaseUrl/);
  assert.match(studioSource, /addEventListener\('error', releaseUrl/);
});
