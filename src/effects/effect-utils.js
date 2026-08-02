import { createSeededRandom, resolveEffectSeed } from '../random/seeded-random.js';

export function makeBuffer(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function snapshotCanvas(context, width, height) {
  const snapshot = makeBuffer(width, height);
  snapshot.getContext('2d').drawImage(context.canvas, 0, 0);
  return snapshot;
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function effectScale(width, height) {
  return clamp(Math.max(width, height) / 1600, 0.35, 4);
}

export function effectRandom(sharedSeed, localSeed, salt) {
  return createSeededRandom(resolveEffectSeed(sharedSeed, localSeed, salt));
}

export function randomSigned(random) {
  return random() * 2 - 1;
}

