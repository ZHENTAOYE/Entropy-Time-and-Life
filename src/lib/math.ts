export const TAU = Math.PI * 2;

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => (x - a) / (b - a);
/** Map x from [a,b] to [c,d], clamped. */
export const remap = (x: number, a: number, b: number, c: number, d: number) =>
  lerp(c, d, clamp(invLerp(a, b, x)));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** Clamped 0..1 progress of `frame` through [start, end). */
export const seg = (frame: number, start: number, end: number) => clamp((frame - start) / (end - start));
/** Fade-in over [a, a+inLen], hold, fade-out over [b-outLen, b]. */
export const window01 = (frame: number, a: number, b: number, inLen = 12, outLen = 12) =>
  Math.min(seg(frame, a, a + inLen), 1 - seg(frame, b - outLen, b));

/** Elastic reflection between walls 0..L: folds an unbounded coordinate into [0, L]. Exact for free particles in a box. */
export const fold = (x: number, L: number) => {
  const p = 2 * L;
  let m = x % p;
  if (m < 0) m += p;
  return m <= L ? m : p - m;
};
/** Fold into [a, b]. */
export const foldRange = (x: number, a: number, b: number) => a + fold(x - a, b - a);

export const fract = (x: number) => x - Math.floor(x);
export const mix = lerp;

// Easings (t in 0..1)
export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t: number) => t * t * t * t,
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t: number) => Math.sin((t * Math.PI) / 2),
  inSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
};

/** Eased progress through [start, end]. */
export const prog = (frame: number, start: number, end: number, e: (t: number) => number = ease.inOutCubic) =>
  e(seg(frame, start, end));

/** Module-level memo cache for expensive deterministic precomputation (shared across mounts within a tab). */
const memoCache = new Map<string, unknown>();
export function memo<T>(key: string, fn: () => T): T {
  if (!memoCache.has(key)) memoCache.set(key, fn());
  return memoCache.get(key) as T;
}

/** Mix two hex colours (#rrggbb) -> rgb() string. */
export function mixHex(a: string, b: string, t: number, alpha = 1): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(lerp(pa[0], pb[0], t));
  const g = Math.round(lerp(pa[1], pb[1], t));
  const bl = Math.round(lerp(pa[2], pb[2], t));
  return alpha >= 1 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${alpha})`;
}
export function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(h: string, a: number): string {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}
