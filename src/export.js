import { renderImage } from './renderer.js';

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not create a PNG from this image.'));
    }, 'image/png');
  });
}

/** Re-render at original dimensions and download a valid, full-resolution PNG. */
export async function exportPng(imageRecord, settings) {
  const outputCanvas = document.createElement('canvas');
  renderImage(outputCanvas, imageRecord, settings, { fullResolution: true });
  const blob = await canvasToBlob(outputCanvas);
  const url = URL.createObjectURL(blob);
  const baseName = imageRecord.name.replace(/\.[^.]+$/, '') || 'glitched-image';
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${baseName}-massimos-glitch.png`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name: anchor.download, size: blob.size };
}
