/** Create a repeatable pseudo-random stream so a preview does not flicker. */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBuffer(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Pixelation is done by shrinking a snapshot, then scaling it back with smoothing off. */
export function applyPixelation(context, width, height, blockSize) {
  if (blockSize < 2) return;
  const smallWidth = Math.max(1, Math.ceil(width / blockSize));
  const smallHeight = Math.max(1, Math.ceil(height / blockSize));
  const buffer = makeBuffer(smallWidth, smallHeight);
  const bufferContext = buffer.getContext('2d');

  bufferContext.imageSmoothingEnabled = true;
  bufferContext.drawImage(context.canvas, 0, 0, smallWidth, smallHeight);
  context.save();
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);
  context.drawImage(buffer, 0, 0, smallWidth, smallHeight, 0, 0, width, height);
  context.restore();
}

/**
 * Replace randomly selected horizontal bands with offset copies. Drawing wrapped
 * copies on both edges prevents empty gaps when a slice moves off the canvas.
 */
export function applySliceDisplacement(context, width, height, amount, seed) {
  if (amount <= 0) return;
  const random = createRandom(seed ^ 0xa451);
  const snapshot = makeBuffer(width, height);
  snapshot.getContext('2d').drawImage(context.canvas, 0, 0);
  const sliceCount = Math.round(2 + amount * 0.18);
  const maxShift = Math.max(3, Math.round(width * (0.015 + amount * 0.0016)));

  for (let index = 0; index < sliceCount; index += 1) {
    const sliceHeight = Math.max(1, Math.round((2 + random() * 24) * (height / 900)));
    const y = Math.floor(random() * Math.max(1, height - sliceHeight));
    const shift = Math.round((random() * 2 - 1) * maxShift);
    context.clearRect(0, y, width, sliceHeight);
    context.drawImage(snapshot, 0, y, width, sliceHeight, shift, y, width, sliceHeight);
    context.drawImage(snapshot, 0, y, width, sliceHeight, shift - width, y, width, sliceHeight);
    context.drawImage(snapshot, 0, y, width, sliceHeight, shift + width, y, width, sliceHeight);
  }
}

/**
 * Separate RGB channels by sampling red and blue from opposite horizontal offsets.
 * We edit a copy of ImageData; the source image object is never touched.
 */
export function applyRgbShift(context, width, height, shift) {
  const pixelShift = Math.round(shift * Math.max(0.65, width / 1400));
  if (pixelShift <= 0) return;

  const imageData = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(imageData.data);
  const output = imageData.data;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) {
      const index = (rowStart + x) * 4;
      const redX = Math.min(width - 1, x + pixelShift);
      const blueX = Math.max(0, x - pixelShift);
      output[index] = source[(rowStart + redX) * 4];
      output[index + 1] = source[index + 1];
      output[index + 2] = source[(rowStart + blueX) * 4 + 2];
    }
  }

  context.putImageData(imageData, 0, 0);
}

/** Overlay dark CRT-style horizontal lines without changing canvas dimensions. */
export function applyScanlines(context, width, height, amount) {
  if (amount <= 0) return;
  const spacing = Math.max(3, Math.round(height / 320));
  const lineHeight = Math.max(1, Math.floor(spacing / 2));
  context.save();
  // Draw only where the current image already has alpha. Without source-atop,
  // scanlines would add dark, semi-opaque rows to transparent PNG backgrounds.
  context.globalCompositeOperation = 'source-atop';
  context.globalAlpha = 0.08 + (amount / 100) * 0.32;
  context.fillStyle = '#030407';
  for (let y = 0; y < height; y += spacing) {
    context.fillRect(0, y, width, lineHeight);
  }
  context.restore();
}

/** Add seeded monochrome static. The seed keeps a render visually stable. */
export function applyNoise(context, width, height, amount, seed) {
  if (amount <= 0) return;
  const random = createRandom(seed ^ 0x91ef);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const strength = (amount / 100) * 58;

  for (let index = 0; index < pixels.length; index += 4) {
    const grain = (random() * 2 - 1) * strength;
    pixels[index] += grain;
    pixels[index + 1] += grain;
    pixels[index + 2] += grain;
  }

  context.putImageData(imageData, 0, 0);
}

/** Run enabled effects in a deliberate order on a freshly drawn source frame. */
export function applyEffects(context, width, height, settings) {
  if (settings.pixelation.enabled) applyPixelation(context, width, height, settings.pixelation.value);
  if (settings.slices.enabled) applySliceDisplacement(context, width, height, settings.slices.value, settings.seed);
  if (settings.rgbShift.enabled) applyRgbShift(context, width, height, settings.rgbShift.value);
  if (settings.scanlines.enabled) applyScanlines(context, width, height, settings.scanlines.value);
  if (settings.noise.enabled) applyNoise(context, width, height, settings.noise.value, settings.seed);
}
