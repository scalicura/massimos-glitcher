import { applyEffects } from './effects.js';

const MAX_PREVIEW_EDGE = 1600;
const MAX_PREVIEW_PIXELS = 2_000_000;

export function getPreviewDimensions(width, height) {
  const edgeScale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(MAX_PREVIEW_PIXELS / (width * height)));
  const scale = Math.min(edgeScale, pixelScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Draw only the immutable source image. This is shared by the processed render
 * path and the before/after comparison so both use identical preview sizing.
 */
export function renderSourceImage(canvas, imageRecord, { fullResolution = false } = {}) {
  const dimensions = fullResolution
    ? { width: imageRecord.width, height: imageRecord.height, scale: 1 }
    : getPreviewDimensions(imageRecord.width, imageRecord.height);

  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(imageRecord.source, 0, 0, dimensions.width, dimensions.height);
  return dimensions;
}

/**
 * Every processed render clears the target and redraws the immutable source
 * before applying effects. This prevents cumulative quality loss when a control
 * changes.
 */
export function renderImage(canvas, imageRecord, settings, { fullResolution = false } = {}) {
  const dimensions = renderSourceImage(canvas, imageRecord, { fullResolution });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  applyEffects(context, dimensions.width, dimensions.height, settings);
  return dimensions;
}
