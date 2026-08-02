import { clamp, effectRandom, effectScale, randomSigned, snapshotCanvas } from './effect-utils.js';

export function applyCompressionMelt(context, width, height, settings, sharedSeed) {
  const random = effectRandom(sharedSeed, settings.seed, 'compression-melt');
  const snapshot = snapshotCanvas(context, width, height);
  const scale = effectScale(width, height);
  const iterations = clamp(Math.round(settings.iterations), 1, 8);
  const regions = clamp(Math.round(3 + settings.density * 0.28), 3, 34);
  const spread = settings.spread * scale;
  const alpha = 0.12 + settings.strength / 135;

  context.save();
  context.globalAlpha = clamp(alpha, 0.12, 0.88);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let index = 0; index < regions; index += 1) {
      const orientation = settings.direction === 'mixed'
        ? (random() > 0.5 ? 'horizontal' : 'vertical')
        : settings.direction;
      if (orientation === 'horizontal') {
        const stripHeight = clamp(Math.round((3 + random() * 28) * scale), 1, height);
        const y = Math.floor(random() * Math.max(1, height - stripHeight));
        const shift = Math.round(randomSigned(random) * spread * (0.35 + iteration / iterations));
        context.drawImage(snapshot, 0, y, width, stripHeight, shift, y, width, stripHeight);
      } else {
        const stripWidth = clamp(Math.round((3 + random() * 28) * scale), 1, width);
        const x = Math.floor(random() * Math.max(1, width - stripWidth));
        const shift = Math.round(randomSigned(random) * spread * (0.35 + iteration / iterations));
        context.drawImage(snapshot, x, 0, stripWidth, height, x, shift, stripWidth, height);
      }
    }
  }
  context.restore();
}

