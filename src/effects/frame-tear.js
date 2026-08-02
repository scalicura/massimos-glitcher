import { clamp, effectRandom, effectScale, randomSigned, snapshotCanvas } from './effect-utils.js';

export function applyFrameTear(context, width, height, settings, sharedSeed) {
  const random = effectRandom(sharedSeed, settings.seed, 'frame-tear');
  const snapshot = snapshotCanvas(context, width, height);
  const scale = effectScale(width, height);
  const count = clamp(Math.round(settings.count), 1, 32);
  const thickness = Math.max(1, Math.round(settings.thickness * scale));
  const offset = settings.offset * scale;

  context.save();
  context.globalAlpha = clamp((settings.opacity / 100) * (0.45 + settings.blend / 180), 0.05, 1);
  for (let index = 0; index < count; index += 1) {
    const orientation = settings.orientation === 'mixed'
      ? (random() > 0.5 ? 'horizontal' : 'vertical')
      : settings.orientation;
    const signedOffset = Math.round(randomSigned(random) * offset);
    if (orientation === 'horizontal') {
      const bandHeight = Math.min(thickness, height);
      const y = Math.floor(random() * Math.max(1, height - bandHeight));
      context.drawImage(snapshot, 0, y, width, bandHeight, signedOffset, y, width, bandHeight);
    } else {
      const bandWidth = Math.min(thickness, width);
      const x = Math.floor(random() * Math.max(1, width - bandWidth));
      context.drawImage(snapshot, x, 0, bandWidth, height, x, signedOffset, bandWidth, height);
    }
  }
  context.restore();
}

