import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANIMATION_PRESETS, BROADCAST_TEMPLATES, EFFECT_DEFINITIONS, STUDIO_SCHEMA_VERSION,
  clampTimelineEvent, defaultStudioSettings, parseProjectImport, randomizeStudioSettings,
  sanitizeFilename, validateDuration, validateFrameRate, validateProjectRecord,
} from '../src/studio/model.js';
import { fitStudioDimensions } from '../src/studio/renderer.js';

test('animation settings are reproducible for the same deterministic seed', () => {
  assert.deepEqual(randomizeStudioSettings(3817), randomizeStudioSettings(3817));
  assert.notDeepEqual(randomizeStudioSettings(3817), randomizeStudioSettings(3818));
});

test('timeline event positions are clamped to the animation duration', () => {
  assert.equal(clampTimelineEvent({ id: 'a', type: 'flash', time: -2 }, 3).time, 0);
  assert.equal(clampTimelineEvent({ id: 'b', type: 'freeze', time: 9 }, 3).time, 3);
  assert.equal(clampTimelineEvent({ id: 'c', type: 'text', time: 1.2348, label: '<b>ALERT</b>' }, 3).time, 1.235);
  assert.equal(clampTimelineEvent({ id: 'c', type: 'text', time: 1, label: '<b>ALERT</b>' }, 3).label, 'bALERT/b');
});

test('all ten broadcast templates use local fictional text and valid presets', () => {
  assert.equal(Object.keys(BROADCAST_TEMPLATES).length, 10);
  Object.values(BROADCAST_TEMPLATES).forEach((template) => {
    assert.ok(template.label && template.headline && template.station);
    assert.ok(ANIMATION_PRESETS[template.presetKey]);
    assert.doesNotMatch(JSON.stringify(template), /https?:\/\//i);
  });
});

test('project schema validation normalizes safe stored data', () => {
  const record = validateProjectRecord({
    id: 'project-1', name: 'Signal <One>', type: 'broadcast', schemaVersion: STUDIO_SCHEMA_VERSION,
    createdAt: '2026-08-03T00:00:00.000Z', modifiedAt: '2026-08-03T00:00:00.000Z', settings: defaultStudioSettings(),
  });
  assert.equal(record.name, 'Signal One');
  assert.equal(record.settings.duration, 3);
  assert.equal(record.settings.fps, 15);
});

test('project imports reject malformed JSON, remote URLs, and incompatible schemas', () => {
  assert.throws(() => parseProjectImport('{broken'), /valid JSON/);
  assert.throws(() => parseProjectImport(JSON.stringify({ schemaVersion: 99, type: 'broadcast', name: 'Old', settings: defaultStudioSettings() })), /Unsupported project schema/);
  assert.throws(() => parseProjectImport(JSON.stringify({ schemaVersion: 1, type: 'broadcast', name: 'Remote', remote: 'https://example.com', settings: defaultStudioSettings() })), /Remote URLs/);
});

test('animation preset catalog is complete and every effect has bounded values', () => {
  assert.equal(Object.keys(ANIMATION_PRESETS).length, 10);
  Object.values(ANIMATION_PRESETS).forEach((preset) => {
    assert.ok(['Mild', 'Strange', 'Severe'].includes(preset.intensity));
    assert.doesNotThrow(() => validateDuration(preset.recommendedDuration));
    assert.doesNotThrow(() => validateFrameRate(preset.recommendedFps));
    EFFECT_DEFINITIONS.forEach(({ key, fields }) => fields.forEach(([field, , minimum, maximum]) => {
      assert.ok(preset.effects[key][field] >= minimum && preset.effects[key][field] <= maximum, `${preset.label}.${key}.${field}`);
    }));
  });
});

test('filenames are sanitized for local downloads', () => {
  assert.equal(sanitizeFilename('  Project: GLITCH / 08?  '), 'Project-GLITCH-08');
  assert.equal(sanitizeFilename('<>'), 'massimos-glitch');
});

test('duration and frame-rate validation accept only supported values', () => {
  [2, 3, 5, 8, 10].forEach((value) => assert.equal(validateDuration(value), value));
  [12, 15, 24, 30].forEach((value) => assert.equal(validateFrameRate(value), value));
  assert.throws(() => validateDuration(4), /Duration/);
  assert.throws(() => validateFrameRate(60), /Frame rate/);
});

test('720p and 1080p export bounds preserve landscape and portrait aspect ratios', () => {
  assert.deepEqual(fitStudioDimensions(3000, 2000, '720'), { width: 1080, height: 720, scale: 0.36 });
  assert.deepEqual(fitStudioDimensions(2000, 3000, '1080'), { width: 1080, height: 1620, scale: 0.54 });
});
