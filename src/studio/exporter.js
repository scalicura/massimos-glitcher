import { sanitizeFilename } from './model.js';
import { fitStudioDimensions } from './renderer.js';

function canvasBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`The browser could not encode ${type}.`)), type, quality));
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function exportDimensions(sourceWidth, sourceHeight, resolution) {
  return fitStudioDimensions(sourceWidth, sourceHeight, resolution);
}

export async function exportCurrentFrame({ renderer, source, sourceWidth, sourceHeight, settings, time, mode, resolution, name }) {
  const canvas = document.createElement('canvas');
  renderer.render({ canvas, source, sourceWidth, sourceHeight, settings, time, mode, resolution });
  const blob = await canvasBlob(canvas);
  const filename = `${sanitizeFilename(name)}-frame.png`; download(blob, filename);
  return { filename, size: blob.size, width: canvas.width, height: canvas.height };
}

export async function exportWebM({ renderer, source, sourceWidth, sourceHeight, settings, mode, resolution, name, onProgress }) {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('This browser does not support canvas WebM recording.');
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((value) => MediaRecorder.isTypeSupported(value));
  if (!mime) throw new Error('This browser does not expose a compatible WebM encoder.');
  const canvas = document.createElement('canvas');
  renderer.render({ canvas, source, sourceWidth, sourceHeight, settings, time: 0, mode, resolution });
  const stream = canvas.captureStream(settings.fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.min(12_000_000, Math.max(2_500_000, canvas.width * canvas.height * settings.fps * 0.18)) });
  const chunks = [];
  recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
  const finished = new Promise((resolve, reject) => {
    recorder.addEventListener('stop', resolve, { once: true });
    recorder.addEventListener('error', () => reject(new Error('The browser WebM recorder failed.')), { once: true });
  });
  recorder.start(250);
  const totalFrames = settings.duration * settings.fps;
  const start = performance.now();
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const target = start + frame * (1000 / settings.fps);
    const delay = Math.max(0, target - performance.now());
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    renderer.render({ canvas, source, sourceWidth, sourceHeight, settings, time: frame / settings.fps, mode, resolution });
    onProgress?.((frame + 1) / totalFrames);
  }
  await new Promise((resolve) => window.setTimeout(resolve, Math.ceil(1000 / settings.fps)));
  recorder.stop(); await finished; stream.getTracks().forEach((track) => track.stop());
  const blob = new Blob(chunks, { type: mime });
  if (!blob.size) throw new Error('The browser produced an empty WebM recording.');
  const filename = `${sanitizeFilename(name)}.webm`; download(blob, filename);
  return { filename, size: blob.size, width: canvas.width, height: canvas.height, mime };
}

