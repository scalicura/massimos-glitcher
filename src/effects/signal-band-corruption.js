import { clamp, effectRandom, effectScale, randomSigned, snapshotCanvas } from './effect-utils.js';

export function applySignalBandCorruption(context, width, height, settings, sharedSeed) {
  const random = effectRandom(sharedSeed, settings.seed, 'signal-band-corruption');
  const snapshot = snapshotCanvas(context, width, height);
  const scale = effectScale(width, height);
  const count = clamp(Math.round(settings.bandCount), 1, 36);
  const thickness = clamp(Math.round(settings.bandThickness * scale), 1, height);
  const displacement = settings.displacement * scale;

  context.save();
  for (let index = 0; index < count; index += 1) {
    const bandHeight = clamp(Math.round(thickness * (0.55 + random() * 0.9)), 1, height);
    const y = Math.floor(random() * Math.max(1, height - bandHeight));
    const shift = Math.round(randomSigned(random) * displacement);
    context.globalAlpha = 0.45 + random() * 0.5;
    context.drawImage(snapshot, 0, y, width, bandHeight, shift, y, width, bandHeight);
    context.drawImage(snapshot, 0, y, width, bandHeight, shift - width, y, width, bandHeight);
    context.drawImage(snapshot, 0, y, width, bandHeight, shift + width, y, width, bandHeight);

    context.globalCompositeOperation = 'source-atop';
    context.globalAlpha = settings.colorDrift / 650;
    context.fillStyle = random() > 0.5 ? '#ff2b93' : '#39e9e2';
    context.fillRect(0, y, width, bandHeight);
    context.globalCompositeOperation = 'source-over';

    const noiseLines = Math.round(settings.noise / 11);
    context.globalCompositeOperation = 'source-atop';
    context.globalAlpha = 0.12 + settings.noise / 250;
    context.fillStyle = '#edf8ef';
    for (let line = 0; line < noiseLines; line += 1) {
      context.fillRect(Math.floor(random() * width), y + Math.floor(random() * bandHeight), Math.max(1, Math.floor(random() * width * 0.25)), 1);
    }
    context.globalCompositeOperation = 'source-over';
  }
  context.restore();
}
