export type RandomSource = {
  between: (min: number, max: number) => number;
  float: () => number;
  floatBetween: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
};

export function createSeededRandom(seed: string): RandomSource {
  let state = hashSeed(seed);
  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    between: (min, max) => Math.floor(min + next() * (max - min + 1)),
    float: next,
    floatBetween: (min, max) => min + next() * (max - min),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

export function createMathRandomSource(): RandomSource {
  return {
    between: (min, max) => Math.floor(min + Math.random() * (max - min + 1)),
    float: Math.random,
    floatBetween: (min, max) => min + Math.random() * (max - min),
    pick: (items) => items[Math.floor(Math.random() * items.length)],
  };
}

export function pickWeighted<T>(entries: { value: T; weight: number }[], random: RandomSource): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let roll = random.floatBetween(0, total);
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

function hashSeed(seed: string): number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}
