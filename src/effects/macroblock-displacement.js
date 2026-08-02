import { clamp, effectRandom, effectScale, randomSigned, snapshotCanvas } from './effect-utils.js';

/** Select deterministic codec-like blocks and copy them to displaced destinations. */
export function applyMacroblockDisplacement(context, width, height, settings, sharedSeed) {
  const scale = effectScale(width, height);
  const blockWidth = clamp(Math.round(settings.blockWidth * scale), 2, width);
  const blockHeight = clamp(Math.round(settings.blockHeight * scale), 2, height);
  const columns = Math.max(1, Math.ceil(width / blockWidth));
  const rows = Math.max(1, Math.ceil(height / blockHeight));
  const count = clamp(Math.round(columns * rows * settings.density / 100), 1, 2500);
  const displacement = settings.displacement * scale;
  const horizontalBias = settings.horizontalBias / 100;
  const verticalBias = settings.verticalBias / 100;
  const random = effectRandom(sharedSeed, settings.seed, 'macroblock-displacement');
  const snapshot = snapshotCanvas(context, width, height);

  context.save();
  for (let index = 0; index < count; index += 1) {
    const sourceX = Math.min(width - blockWidth, Math.floor(random() * columns) * blockWidth);
    const sourceY = Math.min(height - blockHeight, Math.floor(random() * rows) * blockHeight);
    const deltaX = (randomSigned(random) * 0.55 + horizontalBias * 0.8) * displacement;
    const deltaY = (randomSigned(random) * 0.55 + verticalBias * 0.8) * displacement;
    const targetX = clamp(Math.round(sourceX + deltaX), 0, Math.max(0, width - blockWidth));
    const targetY = clamp(Math.round(sourceY + deltaY), 0, Math.max(0, height - blockHeight));
    context.drawImage(snapshot, sourceX, sourceY, blockWidth, blockHeight, targetX, targetY, blockWidth, blockHeight);
  }
  context.restore();
}

