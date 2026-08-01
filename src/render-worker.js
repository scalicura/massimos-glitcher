import { renderImage } from './renderer.js';

self.addEventListener('message', async (event) => {
  const { bitmap, settings, format, quality } = event.data;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    renderImage(
      canvas,
      { source: bitmap, width: bitmap.width, height: bitmap.height },
      settings,
      { fullResolution: true },
    );

    if (format === 'image/jpeg') {
      const context = canvas.getContext('2d');
      context.save();
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#080b10';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }

    const blob = await canvas.convertToBlob({ type: format, quality });
    bitmap.close();
    self.postMessage({ blob });
  } catch (error) {
    bitmap.close();
    self.postMessage({ error: error instanceof Error ? error.message : 'Worker export failed.' });
  }
});
