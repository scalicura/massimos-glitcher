import { clamp, effectRandom, effectScale, snapshotCanvas } from './effect-utils.js';

function directionVector(direction, random) {
  if (direction === 'mixed') {
    const choices = ['right', 'left', 'up', 'down'];
    direction = choices[Math.floor(random() * choices.length)];
  }
  return {
    right: [1, 0],
    left: [-1, 0],
    up: [0, -1],
    down: [0, 1],
  }[direction] || [1, 0];
}

export function applyBlockEcho(context, width, height, settings, sharedSeed) {
  const random = effectRandom(sharedSeed, settings.seed, 'block-echo');
  const snapshot = snapshotCanvas(context, width, height);
  const scale = effectScale(width, height);
  const blockSize = clamp(Math.round(settings.blockSize * scale), 2, Math.max(width, height));
  const regionCount = clamp(Math.round(2 + settings.density * 0.22), 2, 24);
  const echoCount = clamp(Math.round(settings.echoCount), 1, 10);
  const spacing = settings.spacing * scale;
  const falloff = clamp(settings.opacityFalloff / 100, 0.05, 1);

  context.save();
  for (let region = 0; region < regionCount; region += 1) {
    const sourceWidth = clamp(Math.round(blockSize * (0.65 + random() * 0.7)), 2, width);
    const sourceHeight = clamp(Math.round(blockSize * (0.45 + random() * 0.75)), 2, height);
    const sourceX = Math.floor(random() * Math.max(1, width - sourceWidth));
    const sourceY = Math.floor(random() * Math.max(1, height - sourceHeight));
    const [dx, dy] = directionVector(settings.direction, random);
    for (let echo = 1; echo <= echoCount; echo += 1) {
      context.globalAlpha = clamp(Math.pow(1 - falloff * 0.72, echo), 0.03, 0.9);
      const targetX = sourceX + dx * spacing * echo;
      const targetY = sourceY + dy * spacing * echo;
      context.drawImage(snapshot, sourceX, sourceY, sourceWidth, sourceHeight, targetX, targetY, sourceWidth, sourceHeight);
    }
  }
  context.restore();
}

