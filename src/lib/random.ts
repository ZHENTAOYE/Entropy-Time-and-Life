// Deterministic randomness. NEVER use Math.random() anywhere in this project:
// Remotion renders frames out of order in several browser tabs, so every value
// must be a pure function of (seed, index, frame).

/** Mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash of (i, seed) -> [0, 1). Good for per-particle constants. */
export function hash01(i: number, seed = 0): number {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Hash of a string to a 32-bit seed. */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private next: () => number;
  constructor(seed: number | string) {
    this.next = mulberry32(typeof seed === 'string' ? seedOf(seed) : seed);
  }
  /** float in [0,1) */
  f(): number {
    return this.next();
  }
  /** float in [a,b) */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  /** integer in [a,b] inclusive */
  int(a: number, b: number): number {
    return Math.floor(a + (b - a + 1) * this.next());
  }
  /** standard normal (Box-Muller) */
  gauss(): number {
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** random point in unit disc */
  disc(): [number, number] {
    const r = Math.sqrt(this.next());
    const a = this.next() * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
