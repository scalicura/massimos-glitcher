export const SHADER_PRESETS = Object.freeze([
  {
    id: 'clean-pixels',
    label: 'Clean Pixels',
    group: 'Retro Filters',
    cost: 'Low cost',
    description: 'Nearest-neighbor presentation with no color or geometry changes.',
    aggressive: false,
  },
  {
    id: 'consumer-crt',
    label: 'Consumer CRT',
    group: 'Retro Filters',
    cost: 'Low cost',
    description: 'Subtle scanlines, mild curvature, a restrained vignette, and a light RGB mask.',
    aggressive: false,
  },
  {
    id: 'arcade-monitor',
    label: 'Arcade Monitor',
    group: 'Retro Filters',
    cost: 'Low cost',
    description: 'Stronger scanlines, brighter saturation, and a sharper phosphor mask.',
    aggressive: false,
  },
  {
    id: 'monochrome-terminal',
    label: 'Monochrome Terminal',
    group: 'Retro Filters',
    cost: 'Low cost',
    description: 'High-readability green monochrome conversion with a restrained local glow.',
    aggressive: false,
  },
  {
    id: 'handheld-lcd',
    label: 'Handheld LCD',
    group: 'Retro Filters',
    cost: 'Low cost',
    description: 'Reduced saturation and a lightweight LCD pixel-grid mask.',
    aggressive: false,
  },
  {
    id: 'bad-composite-cable',
    label: 'Bad Composite Cable',
    group: 'Glitch Mode',
    cost: 'Moderate cost',
    description: 'Horizontal color bleed, chromatic offset, signal softness, and subtle jitter.',
    aggressive: false,
  },
  {
    id: 'vhs-game-capture',
    label: 'VHS Game Capture',
    group: 'Glitch Mode',
    cost: 'Moderate cost',
    description: 'Mild band displacement, scanline instability, restrained noise, and color drift.',
    aggressive: false,
  },
  {
    id: 'broken-cartridge',
    label: 'Broken Cartridge',
    group: 'Glitch Mode',
    cost: 'Moderate cost',
    description: 'RGB separation and deterministic block and band displacement.',
    aggressive: true,
  },
  {
    id: 'corrupted-broadcast',
    label: 'Corrupted Broadcast',
    group: 'Glitch Mode',
    cost: 'Moderate cost',
    description: 'Regional color shifts, unstable scanlines, and horizontal signal corruption.',
    aggressive: true,
  },
  {
    id: 'glitch-boss',
    label: 'Glitch Boss',
    group: 'Glitch Mode',
    cost: 'High cost',
    description: 'The strongest playable preset, with aggressive bands, RGB separation, and noise.',
    aggressive: true,
  },
]);

export const DEFAULT_SHADER_PRESET = 'clean-pixels';

export function getShaderPreset(id) {
  return SHADER_PRESETS.find((preset) => preset.id === id) || null;
}
