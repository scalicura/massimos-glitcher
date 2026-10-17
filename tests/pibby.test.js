import test from 'node:test';
import assert from 'node:assert/strict';
import { createPibbyPattern, applyPibbyCorruption } from '../src/effects/pibby-corruption.js';
import { searchPibbyRecipes, settingsForPibbyRecipe, PIBBY_RECIPES } from '../src/pibby/catalog.js';

test('search finds tutorial terminology and handles empty or unmatched queries', () => {
  assert.equal(searchPibbyRecipes('  ').length, 6);
  assert.equal(searchPibbyRecipes('RGB split')[0].id, 'ghost');
  assert.equal(searchPibbyRecipes('DATAMOSH')[0].id, 'melt');
  assert.deepEqual(searchPibbyRecipes('no such look'), []);
});

test('patterns are deterministic, seed-sensitive, and normalized across export sizes', () => {
  const settings = settingsForPibbyRecipe('darkness', 42).pibby;
  const first = createPibbyPattern(800, 600, settings, 42);
  assert.ok(first.length > 0);
  assert.deepEqual(first, createPibbyPattern(800, 600, settings, 42));
  assert.notDeepEqual(first, createPibbyPattern(800, 600, settings, 43));
  const doubled = createPibbyPattern(1600, 1200, settings, 42);
  assert.deepEqual(doubled, first.map((block) => ({ ...block, x: block.x * 2, y: block.y * 2, width: block.width * 2, height: block.height * 2 })));
});

test('zero spread leaves an image untouched and monochrome removes bright colors', () => {
  const settings = settingsForPibbyRecipe('rainbow', 42).pibby;
  assert.deepEqual(createPibbyPattern(800, 600, { ...settings, coverage: 0 }, 42), []);
  assert.ok(createPibbyPattern(800, 600, { ...settings, color: 0 }, 42).every((block) => block.fill === '#090811'));
});

test('all six recipes produce distinct, isolated settings and valid bounded draw calls', () => {
  const patterns = new Set();
  for (const recipe of PIBBY_RECIPES) {
    const settings = settingsForPibbyRecipe(recipe.id, 42);
    const pattern = createPibbyPattern(800, 600, settings.pibby, 42);
    patterns.add(JSON.stringify(pattern));
    assert.ok(pattern.every((block) => block.x >= 0 && block.x < 800 && block.y >= 0 && block.y < 600 && block.width > 0 && block.height > 0));
    settings.pibby.coverage = 0;
    assert.equal(settingsForPibbyRecipe(recipe.id, 42).pibby.coverage, recipe.coverage);
  }
  assert.equal(patterns.size, 6);
  assert.throws(() => settingsForPibbyRecipe('unknown', 42), /Unknown/);
});

test('drawing clips to existing alpha and restores canvas state', () => {
  const operations = [];
  const context = { save() { operations.push('save'); }, restore() { operations.push('restore'); }, fillRect() { assert.equal(this.globalCompositeOperation, 'source-atop'); operations.push('draw'); } };
  applyPibbyCorruption(context, 80, 60, settingsForPibbyRecipe('darkness', 42).pibby, 42);
  assert.equal(operations[0], 'save');
  assert.equal(operations.at(-1), 'restore');
  assert.ok(operations.includes('draw'));
});
