const DEFAULT_SEED = 3817;

export function normalizeSeed(value, fallback = DEFAULT_SEED) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 0xffffffff) return fallback >>> 0;
  return Math.trunc(numeric) >>> 0;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mixSeed(seed, salt) {
  return (normalizeSeed(seed) ^ hashText(String(salt))) >>> 0;
}

/** Mulberry32 provides a tiny repeatable stream for deterministic visual regions. */
export function createSeededRandom(seed) {
  let state = normalizeSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveEffectSeed(sharedSeed, localSeed, salt) {
  const base = Number(localSeed) > 0 ? normalizeSeed(localSeed) : normalizeSeed(sharedSeed);
  return mixSeed(base, salt);
}

