import { createSeededRandom, mixSeed } from '../random/seeded-random.js';

const PALETTE = ['#ff278c', '#22efff', '#c3ff32', '#713dff', '#fff15c', '#fa693b', '#f5edff'];

/** A bounded grid keeps preview and full-size export on the same normalized pattern. */
export function createPibbyPattern(width, height, settings, seed) {
  if (width <= 0 || height <= 0 || settings.coverage <= 0) return [];
  const random = createSeededRandom(mixSeed(seed, 'pibby-corruption'));
  const unit = Math.max(width, height) / 1000;
  const size = Math.max(3, settings.blockSize) * unit;
  const columns = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const coverage = Math.min(1, settings.coverage / 100);
  const color = settings.color / 100;
  const blocks = [];
  // Slowly varying wave plus per-column steps makes a connected, jagged infection edge.
  const phase = random() * Math.PI * 2;
  for (let x = 0; x < columns; x += 1) {
    const edge = Math.sin(x * .23 + phase) * .07 + Math.sin(x * .71 + phase) * .035;
    for (let y = 0; y < rows; y += 1) {
      const jitter = random();
      const distance = settings.direction === 'top' ? y / rows
        : settings.direction === 'left' ? x / columns
          : settings.direction === 'right' ? 1 - (x + 1) / columns : 1 - (y + 1) / rows;
      const scattered = settings.direction === 'scattered';
      const threshold = coverage + edge + (jitter - .5) * .1;
      if (scattered ? jitter > coverage * .7 : distance > threshold) continue;
      const bright = random() < color;
      const fill = bright ? PALETTE[Math.floor(random() * PALETTE.length)] : '#090811';
      const streak = settings.style === 'melt' ? 1 + Math.floor(random() * 6) : 1;
      const inset = settings.style === 'static' ? .12 : 0;
      blocks.push({ x: (x + inset) * size, y: (y + inset) * size,
        width: Math.min((streak - inset) * size, width - x * size),
        height: (1 - inset) * size, fill });
      if (bright && random() < .22) {
        blocks.push({ x: Math.max(0, (x - 2) * size), y: (y + .32) * size,
          width: Math.min(size * 5, width - Math.max(0, (x - 2) * size)), height: size * .18, fill });
      }
    }
  }
  return blocks.filter((block) => block.x < width && block.y < height).map((block) => ({
    ...block, width: Math.min(block.width, width - block.x), height: Math.min(block.height, height - block.y),
  }));
}

export function applyPibbyCorruption(context, width, height, settings, seed) {
  const blocks = createPibbyPattern(width, height, settings, seed);
  context.save();
  // Clip every mark to existing alpha, including transparent character cutouts.
  context.globalCompositeOperation = 'source-atop';
  for (const block of blocks) {
    context.fillStyle = block.fill;
    context.fillRect(block.x, block.y, block.width, block.height);
  }
  context.restore();
}
