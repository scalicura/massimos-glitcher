import { createSeededRandom, mixSeed } from '../random/seeded-random.js';
import { clampNumber } from './model.js';

const PREVIEW_MAX_EDGE = 960;
const PREVIEW_MAX_PIXELS = 720_000;
const THEME_COLORS = Object.freeze({ cyan: '#55e5df', red: '#ff526c', lime: '#b8ff5a', magenta: '#ff4ca0', mono: '#eef4ed', amber: '#ffb84d' });

export function fitStudioDimensions(width, height, resolution = 'preview') {
  if (resolution === 'original') return { width, height, scale: 1 };
  if (resolution === '1080' || resolution === '720') {
    const longEdge = resolution === '1080' ? 1920 : 1280;
    const shortEdge = resolution === '1080' ? 1080 : 720;
    const landscape = width >= height;
    const maxWidth = landscape ? longEdge : shortEdge;
    const maxHeight = landscape ? shortEdge : longEdge;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
  }
  const edge = PREVIEW_MAX_EDGE;
  const pixels = PREVIEW_MAX_PIXELS;
  const scale = Math.min(1, edge / Math.max(width, height), Math.sqrt(pixels / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

function ensureCanvas(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return canvas.getContext('2d', { alpha: true, willReadFrequently: false });
}

function activeEvent(events, type, time, windowSize = 0.13) {
  return events.find((event) => event.type === type && Math.abs(event.time - time) <= windowSize);
}

function freezeFrame(frameIndex, settings, events) {
  const explicit = events.find((event) => event.type === 'freeze' && Math.abs(event.time * settings.fps - frameIndex) <= 4);
  if (explicit) return Math.max(0, Math.round(explicit.time * settings.fps) - 3);
  const effect = settings.effects.freezePulse;
  if (!effect.enabled) return frameIndex;
  const period = Math.max(2, Math.round(settings.fps / Math.max(1, effect.frequency / 2)));
  const local = frameIndex % period;
  return local < effect.duration ? frameIndex - local : frameIndex;
}

function copyWrappedBand(context, snapshot, y, height, shift, width) {
  context.drawImage(snapshot, 0, y, width, height, shift, y, width, height);
  context.drawImage(snapshot, 0, y, width, height, shift - width, y, width, height);
  context.drawImage(snapshot, 0, y, width, height, shift + width, y, width, height);
}

function corruptedText(original, effect, progress, seed, amount) {
  if (!original || effect === 'none') return original;
  const random = createSeededRandom(mixSeed(seed, `${effect}:${Math.floor(progress * 24)}`));
  const characters = [...original];
  if (effect === 'typing') return characters.slice(0, Math.max(1, Math.floor(characters.length * Math.min(1, progress * 1.5)))).join('');
  if (effect === 'dropout' && random() < amount / 180) return '';
  if (effect === 'scramble' || effect === 'missing') {
    return characters.map((character) => {
      if (character === ' ' || random() > amount / 100) return character;
      if (effect === 'missing') return random() > 0.4 ? ' ' : '·';
      return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%?/'[Math.floor(random() * 40)];
    }).join('');
  }
  return original;
}

function drawBroadcast(context, width, height, broadcast, time, duration, seed, reducedFlash, events) {
  const color = THEME_COLORS[broadcast.theme] || THEME_COLORS.cyan;
  const progress = duration ? time / duration : 0;
  const amount = broadcast.textCorruption;
  const frame = Math.floor(time * 15);
  const random = createSeededRandom(mixSeed(seed, `broadcast:${frame}`));
  let opacity = broadcast.overlayOpacity / 100;
  if (broadcast.textEffect === 'flicker' && !reducedFlash) opacity *= random() < broadcast.textFlicker / 180 ? 0.25 : 1;
  if (broadcast.textEffect === 'pulse') opacity *= 0.72 + Math.sin(time * 4) * 0.18;
  if (broadcast.textEffect === 'reveal') opacity *= clampNumber(progress * 2, 0, 1, 1);

  const inset = broadcast.safeArea ? Math.max(18, Math.round(Math.min(width, height) * 0.055)) : 12;
  const alignX = broadcast.alignment === 'left' ? inset : broadcast.alignment === 'right' ? width - inset : width / 2;
  context.save();
  context.globalAlpha = opacity;
  context.textAlign = broadcast.alignment;
  context.textBaseline = 'top';
  context.fillStyle = 'rgba(1, 5, 8, .72)';
  context.fillRect(0, 0, width, Math.max(48, height * 0.14));
  context.fillRect(0, height - Math.max(38, height * 0.11), width, Math.max(38, height * 0.11));
  context.strokeStyle = color;
  context.lineWidth = Math.max(1, width / 900);
  if (broadcast.safeArea) context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  const base = Math.max(12, Math.min(width, height) * 0.035) * (broadcast.textSize / 100);
  const headline = corruptedText(broadcast.headline, broadcast.textEffect, progress, seed, amount);
  const subtitle = corruptedText(broadcast.subtitle, broadcast.textEffect, progress, seed ^ 0x44, amount * 0.65);
  context.font = `700 ${Math.round(base * 1.45)}px ui-monospace, Consolas, monospace`;
  context.fillStyle = color;
  if (broadcast.textEffect === 'shadow') {
    context.save(); context.fillStyle = '#ff3c8f'; context.globalAlpha *= 0.5; context.fillText(headline, alignX + 5, inset + 5); context.restore();
  }
  context.fillText(headline, alignX, inset);
  context.font = `600 ${Math.round(base * 0.72)}px ui-monospace, Consolas, monospace`;
  context.fillStyle = '#f1f6ef';
  context.fillText(subtitle, alignX, inset + base * 1.9);

  context.font = `600 ${Math.max(9, Math.round(base * 0.55))}px ui-monospace, Consolas, monospace`;
  context.textAlign = 'left';
  context.fillStyle = color;
  context.fillText(`${broadcast.station} // CH ${broadcast.channel}`, inset, height - inset - base * 0.6);
  context.textAlign = 'right';
  context.fillText(`${broadcast.camera} // ${broadcast.timestamp}`, width - inset, height - inset - base * 0.6);
  context.textAlign = 'center';
  context.fillStyle = '#f1f6ef';
  context.fillText(corruptedText(broadcast.ticker, broadcast.textEffect, progress, seed ^ 0x88, amount * 0.45), width / 2, height - Math.max(34, height * 0.085));

  if (broadcast.textEffect === 'redaction') {
    context.fillStyle = '#020304';
    for (let index = 0; index < 3; index += 1) context.fillRect(inset + random() * width * 0.5, inset + base * (2.6 + index * 0.65), width * (0.12 + random() * 0.25), Math.max(4, base * 0.18));
  }
  if (broadcast.textEffect === 'tear') {
    context.globalAlpha *= 0.65;
    context.fillStyle = color;
    context.fillRect(0, Math.floor(height * (0.24 + random() * 0.3)), width, Math.max(2, height * 0.008));
  }
  const warning = activeEvent(events, 'text', time, 0.35);
  if (warning) {
    context.fillStyle = 'rgba(0,0,0,.78)'; context.fillRect(0, height * 0.42, width, height * 0.16);
    context.fillStyle = color; context.font = `800 ${Math.round(base * 1.2)}px ui-monospace, Consolas, monospace`; context.textAlign = 'center';
    context.fillText(warning.label, width / 2, height * 0.46);
  }
  context.restore();
}

export function createStudioRenderer() {
  const sourceCanvas = document.createElement('canvas');
  const sourceContext = sourceCanvas.getContext('2d');

  function render({ canvas, source, sourceWidth, sourceHeight, settings, time = 0, mode = 'animated', resolution = 'preview' }) {
    const dimensions = fitStudioDimensions(sourceWidth, sourceHeight, resolution);
    const context = ensureCanvas(canvas, dimensions.width, dimensions.height);
    ensureCanvas(sourceCanvas, dimensions.width, dimensions.height);
    const { width, height } = dimensions;
    const frameIndex = Math.floor(time * settings.fps);
    const effectiveFrame = freezeFrame(frameIndex, settings, settings.events);
    const random = createSeededRandom(mixSeed(settings.seed, `studio-frame:${effectiveFrame}`));
    const burst = Boolean(activeEvent(settings.events, 'glitch', time, 0.2));
    const multiplier = burst ? 1.65 : 1;

    sourceContext.clearRect(0, 0, width, height);
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = 'high';
    sourceContext.drawImage(source, 0, 0, width, height);
    context.clearRect(0, 0, width, height);

    const zoom = settings.effects.zoomJolt;
    const zoomPulse = zoom.enabled && Math.floor(time * zoom.frequency) % 5 === 0 ? zoom.intensity / 500 : 0;
    const shakeX = zoom.enabled ? (random() * 2 - 1) * width * zoom.horizontal / 9000 : 0;
    const shakeY = zoom.enabled ? (random() * 2 - 1) * height * zoom.vertical / 9000 : 0;
    context.save();
    context.translate(width / 2 + shakeX, height / 2 + shakeY);
    context.scale(1 + zoomPulse, 1 + zoomPulse);
    context.drawImage(sourceCanvas, -width / 2, -height / 2);
    context.restore();

    const tracking = settings.effects.vhsTracking;
    if (tracking.enabled) {
      const drift = Math.sin(time * 2.1) * height * tracking.verticalDrift / 2200;
      const jitter = (random() * 2 - 1) * width * tracking.jitter / 7000;
      context.save(); context.globalAlpha = 0.32 + tracking.intensity / 180; context.drawImage(sourceCanvas, jitter, drift); context.restore();
      const lineY = ((tracking.linePosition / 100 + time * 0.08) % 1) * height;
      context.fillStyle = `rgba(235,245,240,${tracking.intensity / 500})`;
      context.fillRect(0, lineY, width, Math.max(2, height * 0.018));
    }

    const tear = settings.effects.signalTear;
    if (tear.enabled) {
      const count = Math.min(24, Math.round(tear.bandCount * multiplier));
      for (let index = 0; index < count; index += 1) {
        const bandHeight = Math.max(1, Math.round(height * (0.005 + random() * 0.035)));
        const y = Math.floor(random() * Math.max(1, height - bandHeight));
        const phase = Math.sin(time * tear.speed + index * 2.17);
        const shift = Math.round(phase * width * tear.displacement * multiplier / 1400);
        copyWrappedBand(context, sourceCanvas, y, bandHeight, shift, width);
      }
    }

    const blocks = settings.effects.macroblock;
    if (blocks.enabled) {
      const scale = dimensions.scale;
      const size = Math.max(4, Math.round(blocks.blockSize * Math.max(0.45, scale)));
      const count = Math.min(180, Math.round((width * height) / (size * size) * blocks.density / 360));
      for (let index = 0; index < count * multiplier; index += 1) {
        const sx = Math.floor(random() * Math.max(1, width - size));
        const sy = Math.floor(random() * Math.max(1, height - size));
        const dx = Math.max(0, Math.min(width - size, sx + (random() * 2 - 1) * width * blocks.motion / 900));
        const dy = Math.max(0, Math.min(height - size, sy + (random() * 2 - 1) * height * blocks.motion / 1800));
        context.drawImage(sourceCanvas, sx, sy, size, size, dx, dy, size, size);
      }
    }

    const rgb = settings.effects.rgbFlicker;
    if (rgb.enabled) {
      const offset = width * rgb.intensity * (0.4 + Math.abs(Math.sin(time * rgb.frequency))) / 3200;
      context.save(); context.globalCompositeOperation = 'screen'; context.globalAlpha = Math.min(0.32, rgb.intensity / 310);
      context.filter = 'sepia(1) saturate(8) hue-rotate(285deg)'; context.drawImage(sourceCanvas, -offset, 0);
      context.filter = 'sepia(1) saturate(8) hue-rotate(125deg)'; context.drawImage(sourceCanvas, offset, 0);
      context.restore();
    }

    const dropout = settings.effects.colorDropout;
    if (dropout.enabled && Math.floor(time * dropout.frequency) % 4 === 0) {
      context.save(); context.globalCompositeOperation = 'color'; context.globalAlpha = dropout.amount / 100;
      context.fillStyle = dropout.suppression > 60 ? '#87cbd0' : '#777'; context.fillRect(0, 0, width, height); context.restore();
    }

    const staticBurst = settings.effects.staticBurst;
    const burstWindow = Math.floor(effectiveFrame / Math.max(1, staticBurst.duration));
    const burstRandom = createSeededRandom(mixSeed(settings.seed, `static-burst:${burstWindow}`));
    const burstActive = staticBurst.enabled && burstRandom() < staticBurst.probability / 100;
    if (burstActive) {
      const count = Math.min(1200, Math.round(width * height * staticBurst.intensity / 180000));
      context.save(); context.globalAlpha = 0.18 + staticBurst.intensity / 180;
      for (let index = 0; index < count * multiplier; index += 1) {
        const shade = Math.floor(random() * 255); context.fillStyle = `rgb(${shade},${shade},${shade})`;
        context.fillRect(random() * width, random() * height, 1 + random() * 4, 1 + random() * 2);
      }
      context.restore();
    }

    const scanlines = settings.effects.scanlineDrift;
    if (scanlines.enabled) {
      context.save(); context.globalAlpha = scanlines.opacity / 100;
      context.fillStyle = '#020304';
      const offset = Math.floor(time * scanlines.speed * 2) % scanlines.spacing;
      for (let y = offset; y < height; y += scanlines.spacing) context.fillRect(0, y, width, 1);
      context.restore();
    }

    const blackout = activeEvent(settings.events, 'blackout', time, 0.14);
    const timelineFlash = activeEvent(settings.events, 'flash', time, settings.reducedFlash ? 0.04 : 0.08);
    const flash = settings.effects.frameFlash;
    const automaticFlash = flash.enabled && Math.floor(time * flash.frequency) % Math.max(3, Math.round(settings.fps / 2)) === 0;
    if (blackout) { context.fillStyle = '#000'; context.fillRect(0, 0, width, height); }
    else if (timelineFlash || automaticFlash) {
      context.save(); context.globalAlpha = settings.reducedFlash ? 0.14 : Math.min(0.7, flash.intensity / 100);
      context.fillStyle = flash.tint > 66 ? '#ff294f' : flash.tint > 33 ? '#fff' : '#000'; context.fillRect(0, 0, width, height); context.restore();
    }

    if (mode === 'broadcast') drawBroadcast(context, width, height, settings.broadcast, time, settings.duration, settings.seed, settings.reducedFlash, settings.events);
    return { ...dimensions, frameIndex, effectiveFrame };
  }

  return { render };
}
