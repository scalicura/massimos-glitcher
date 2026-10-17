import { defaultSettings } from '../presets.js';

export const PIBBY_RECIPES = [
  { id: 'darkness', label: 'The Darkness', description: 'Black creeping corruption with little bursts of rainbow pixels.', tags: 'pibby black goo infection classic ibis paint', coverage: 48, blockSize: 13, color: 24, direction: 'bottom', style: 'darkness', effects: {} },
  { id: 'rainbow', label: 'Rainbow Static', description: 'A dense patchwork of bright digital noise and black gaps.', tags: 'pibby colorful rainbow texture static noise', coverage: 67, blockSize: 7, color: 78, direction: 'bottom', style: 'static', effects: {} },
  { id: 'infection', label: 'Pixel Infection', description: 'Chunky pixel clusters spread across the image from one side.', tags: 'pibby pixelated mosaic blocks infection ibis paint', coverage: 40, blockSize: 25, color: 43, direction: 'left', style: 'darkness', effects: { pixelation: { enabled: true, value: 5 } } },
  { id: 'ghost', label: 'RGB Ghost', description: 'Split color outlines and displaced echoes around scattered corruption.', tags: 'pibby rgb split chromatic aberration ghost double color shift', coverage: 24, blockSize: 10, color: 50, direction: 'scattered', style: 'darkness', effects: { rgbShift: { enabled: true, value: 17 }, blockEcho: { enabled: true, density: 15, spacing: 18, echoCount: 3 } } },
  { id: 'melt', label: 'Corruption Melt', description: 'Stretched color fragments and smeared blocks trail through the darkness.', tags: 'pibby datamosh smear stretch melt distorted', coverage: 50, blockSize: 11, color: 52, direction: 'right', style: 'melt', effects: { compressionMelt: { enabled: true, strength: 65, spread: 90, density: 32 } } },
  { id: 'takeover', label: 'Signal Takeover', description: 'Broken cartoon transmission with tears, tracking lines, and creeping darkness.', tags: 'pibby broadcast cartoon signal vhs tear glitch', coverage: 35, blockSize: 14, color: 32, direction: 'bottom', style: 'darkness', effects: { slices: { enabled: true, value: 35 }, scanlines: { enabled: true, value: 30 }, signalBand: { enabled: true, bandCount: 6, displacement: 40, noise: 22 } } },
];

export function searchPibbyRecipes(query) {
  const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return PIBBY_RECIPES.filter((recipe) => words.every((word) => `${recipe.label} ${recipe.description} ${recipe.tags}`.toLowerCase().includes(word)));
}

export function settingsForPibbyRecipe(id, seed, overrides = {}) {
  const recipe = PIBBY_RECIPES.find((item) => item.id === id);
  if (!recipe) throw new Error(`Unknown Pibby recipe: ${id}`);
  const settings = defaultSettings(seed);
  for (const [key, values] of Object.entries(recipe.effects)) Object.assign(settings[key], values);
  const { coverage, blockSize, color, direction, style } = recipe;
  settings.pibby = { enabled: true, coverage, blockSize, color, direction, style, ...overrides };
  return settings;
}
