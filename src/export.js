import { renderImage } from './renderer.js';

const FORMAT_OPTIONS = {
  png: { mime: 'image/png', extension: 'png' },
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  webp: { mime: 'image/webp', extension: 'webp' },
};

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(`The browser could not create a ${mime} image.`));
    }, mime, quality);
  });
}

function flattenForJpeg(canvas) {
  const context = canvas.getContext('2d');
  context.save();
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#080b10';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

async function renderOnMainThread(imageRecord, settings, mime, quality) {
  const outputCanvas = document.createElement('canvas');
  renderImage(outputCanvas, imageRecord, settings, { fullResolution: true });
  if (mime === 'image/jpeg') flattenForJpeg(outputCanvas);
  return canvasToBlob(outputCanvas, mime, quality);
}

async function renderInWorker(imageRecord, settings, mime, quality) {
  const bitmap = await createImageBitmap(imageRecord.source);
  const worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });

  return new Promise((resolve, reject) => {
    worker.addEventListener('message', (event) => {
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.blob);
    }, { once: true });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Background export failed.'));
    }, { once: true });
    worker.postMessage({ bitmap, settings, format: mime, quality }, [bitmap]);
  });
}

function downloadBlob(blob, imageRecord, extension) {
  const url = URL.createObjectURL(blob);
  const baseName = imageRecord.name.replace(/\.[^.]+$/, '') || 'glitched-image';
  const downloadName = `${baseName}-massimos-glitch.${extension}`;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = downloadName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return downloadName;
}

/**
 * Render from the immutable source at full resolution. Modern browsers use an
 * OffscreenCanvas worker so expensive exports do not freeze the editor; other
 * browsers fall back to the same deterministic pipeline on the main thread.
 */
export async function exportImage(imageRecord, settings, { format = 'png', quality = 0.92 } = {}) {
  const selectedFormat = FORMAT_OPTIONS[format];
  if (!selectedFormat) throw new Error(`Unsupported export format: ${format}`);

  // Give the browser one paint so the busy state is visible before processing.
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));

  let blob;
  let engine = 'main-thread';
  const canUseWorker = typeof Worker !== 'undefined'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof createImageBitmap === 'function';

  if (canUseWorker) {
    try {
      blob = await renderInWorker(imageRecord, settings, selectedFormat.mime, quality);
      engine = 'worker';
    } catch {
      blob = await renderOnMainThread(imageRecord, settings, selectedFormat.mime, quality);
    }
  } else {
    blob = await renderOnMainThread(imageRecord, settings, selectedFormat.mime, quality);
  }

  const name = downloadBlob(blob, imageRecord, selectedFormat.extension);
  return { name, size: blob.size, format: selectedFormat.mime, engine };
}
