import { clamp, effectRandom, effectScale } from './effect-utils.js';

export function applyRegionalColorDrift(context, width, height, settings, sharedSeed) {
  const random = effectRandom(sharedSeed, settings.seed, 'regional-color-drift');
  const scale = effectScale(width, height);
  const regionSize = clamp(Math.round(settings.regionSize * scale), 2, Math.max(width, height));
  const count = clamp(Math.round(2 + settings.density * 0.38), 2, 40);
  const imageData = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(imageData.data);
  const output = imageData.data;

  for (let region = 0; region < count; region += 1) {
    const regionWidth = clamp(Math.round(regionSize * (0.6 + random())), 2, width);
    const regionHeight = clamp(Math.round(regionSize * (0.25 + random() * 0.75)), 2, height);
    const startX = Math.floor(random() * Math.max(1, width - regionWidth));
    const startY = Math.floor(random() * Math.max(1, height - regionHeight));
    const direction = settings.direction === 'mixed'
      ? (random() > 0.5 ? 'horizontal' : 'vertical')
      : settings.direction;
    const xFactor = direction === 'vertical' ? 0 : scale;
    const yFactor = direction === 'horizontal' ? 0 : scale;
    const redX = Math.round(settings.redOffset * xFactor);
    const redY = Math.round(settings.redOffset * yFactor);
    const greenX = Math.round(settings.greenOffset * xFactor);
    const greenY = Math.round(settings.greenOffset * yFactor);
    const blueX = Math.round(settings.blueOffset * xFactor);
    const blueY = Math.round(settings.blueOffset * yFactor);

    for (let y = startY; y < startY + regionHeight; y += 1) {
      for (let x = startX; x < startX + regionWidth; x += 1) {
        const target = (y * width + x) * 4;
        const rIndex = (clamp(y + redY, 0, height - 1) * width + clamp(x + redX, 0, width - 1)) * 4;
        const gIndex = (clamp(y + greenY, 0, height - 1) * width + clamp(x + greenX, 0, width - 1)) * 4;
        const bIndex = (clamp(y + blueY, 0, height - 1) * width + clamp(x + blueX, 0, width - 1)) * 4;
        output[target] = source[rIndex];
        output[target + 1] = source[gIndex + 1];
        output[target + 2] = source[bIndex + 2];
      }
    }
  }
  context.putImageData(imageData, 0, 0);
}

