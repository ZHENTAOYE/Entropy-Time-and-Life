// S05 热寂 / Heat Death — beat sheet (scene-local frames, 30 fps, 522 frames) and every time curve of the scene.
//
// Visual language: THE PICTURE ITSELF REACHES EQUILIBRIUM, read by instruments that die with it.
//  B1  f0–56    IN = WEB_FINAL (S04's lit web). ▶▶ engages (f2): chromatic fringes + radial time-smear, sparks race,
//               the camera breathes out (zoom 0.8 → 0.74). S-gauge fades in.            C1 「滚到最后呢？」 f4–58
//  B2  f36–124  Stars burn out in hash order (redden → ember → gone); every death exhales a LIGHT SHELL that expands
//               and dilutes (its energy is not lost — it spreads). Year odometer ~10¹⁰ → ~10¹⁴ 年 (lands f100),
//               reticle locks on the last star; it goes out at f~112.      lockup 「~10¹⁴ 年 · 最后的恒星熄灭」
//  B3  f86–190  Six black holes form on the heaviest clusters (lensing, photon rings), glow hotter as they shrink
//               (Hawking), pop lightest-first in pin-prick flashes, each releasing its own shell. Exponent whirrs
//               14 → 100 (f128–166). The largest pops last (f176).          lockup 「~10¹⁰⁰ 年 · 最大的黑洞蒸发殆尽」
//               — the numerals lose contrast and random-walk with the image (f180–214).
//  B4  f172–292 THE IMAGE DIFFUSES: every pixel random-walks (cosmos eq), colour drains, the vignette goes to 0.
//               A temperature histogram measured from the frame itself collapses into one needle.  C4 f186–250
//               ▶▶ loses its direction (the arrows spin aimlessly) and dissolves. The S-gauge pegs at the top.
//  B5  f248–346 LOUPE at the gold point's place: the grey, magnified, is a gas — a coherent stream thermalises,
//               speeds unchanged (能量 100 %), the net-flow arrow shrinks to nothing.          C5 f248–346
//  B6  f344–408 「这叫——热寂。」 NOISE-DEATH: 热寂 fades to exactly the background grey while its pixels
//               random-walk into the noise. The S-gauge random-walks away.
//  B7  f408–444 Pure grey boiling noise. The film's only true silence.
//  B8  f444–521 One gold point (#FFC94A) flickers alive at GOLD_POINT.            C8 「但在滚落的路上——」 f448–514
//  OUT f521     #5C5C5C ± 6 % boiling noise + the gold point (r 3.5), no caption, no vignette.
import { WEB_FINAL, WebParams } from '../../lib/cosmos';
import { clamp, ease, memo, seg } from '../../lib/math';

export const DUR = 522;

/** Monotone cubic (Fritsch–Carlson) through knots [frame, value]; clamped outside. */
export function knots(pts: ReadonlyArray<readonly [number, number]>): (x: number) => number {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[0] = 0;
  m[n - 1] = 0;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export const T = {
  ffOn: 2,
  c1: { at: 4, dur: 62 },
  lockIn: 52,
  roll1: [58, 100] as const, // exponent 10 → 14
  label1: { at: 92, out: 130 },
  lastStar: 112,
  roll2: [134, 170] as const, // exponent 14 → 100
  label2: { at: 148 },
  lockDie: [188, 222] as const,
  lastPop: 176,
  eq0: 172,
  c4: { at: 184, dur: 62 },
  hist: [184, 250] as const,
  hudLose: [196, 270] as const,
  hudDie: [262, 312] as const,
  c5: { at: 247, dur: 99 },
  loupe: [248, 346] as const,
  gaugePeg: 284,
  gaugeDie: [338, 392] as const,
  c6: { at: 344, dur: 64 },
  silence: [408, 444] as const,
  gold: 444,
  c8: { at: 448, dur: 66 },
} as const;

// ───────────── cosmos parameters ─────────────
/** stars burn out: the last star (die-rank 0.927) is gone at f≈112 */
export const dieAt = knots([
  [12, 0],
  [30, 0.035],
  [46, 0.09],
  [60, 0.2],
  [74, 0.42],
  [88, 0.7],
  [100, 0.875],
  [106, 0.918],
  [113, 0.978],
  [120, 1],
]);

/** black holes: form f86–112, pop lightest-first (evap 0.537, 0.566, 0.573, 0.663, 0.705, 0.940) */
export const bhAt = knots([
  [86, 0],
  [112, 0.24],
  [126, 0.47],
  [132, 0.539],
  [139, 0.5675],
  [145, 0.5745],
  [152, 0.6645],
  [159, 0.7065],
  [164, 0.84],
  [176, 0.9415],
  [196, 1],
]);

/** heat death: σ of the per-pixel random walk ≈ 650·eq² px; grey reached at eq ≈ 0.97 */
export const eqAt = knots([
  [172, 0],
  [186, 0.06],
  [200, 0.14],
  [216, 0.25],
  [232, 0.38],
  [250, 0.55],
  [268, 0.75],
  [284, 0.92],
  [296, 1],
]);

/** fast-forward speed of the simulation clock (× real time) */
export const ffSpeed = (f: number) => 1 + 3 * ease.inOutSine(seg(f, 2, 30)) - 3 * ease.inOutSine(seg(f, 150, 230));
/** 0..1 how strongly time is being tampered with (chromatic fringes, time smear) */
export const ffK = (f: number) => ease.outCubic(seg(f, 2, 14)) * (1 - ease.inOutSine(seg(f, 150, 236)));

const simTimes = () =>
  memo('s05:simt', () => {
    const a = new Float64Array(DUR + 2);
    for (let f = 1; f < a.length; f++) a[f] = a[f - 1] + (ffSpeed(f - 0.5) / 30);
    return a;
  });
/** seconds of simulation clock elapsed since frame 0 */
export function simTime(f: number): number {
  const a = simTimes();
  const i = clamp(Math.floor(f), 0, DUR);
  return a[i] + (a[i + 1] - a[i]) * (f - i);
}

export const zoomAt = (f: number) => 0.8 - 0.025 * ease.inOutSine(seg(f, 0, 70)) - 0.035 * ease.inOutSine(seg(f, 30, 280));

/** the cosmic web at scene frame f (frame 0 == WEB_FINAL exactly) */
export function webAt(f: number): Required<WebParams> {
  if (f <= 0) return { ...WEB_FINAL };
  return {
    ...WEB_FINAL,
    t: WEB_FINAL.t + simTime(f),
    zoom: zoomAt(f),
    roll: WEB_FINAL.roll + ((2.5 * Math.PI) / 180) * ease.inOutSine(seg(f, 0, 220)),
    die: dieAt(f),
    bh: bhAt(f),
    eq: eqAt(f),
    sparks: 1 - ease.inOutSine(seg(f, 50, 112)),
  };
}

/** after this frame the cosmos is pure equilibrium grey: we render the grey ourselves (cheap) */
export const GREY_FROM = 292;

/** vignette strength: none on frame 0 (exact WEB_FINAL), a lens breath with ▶▶, gone at equilibrium */
export const vignetteAt = (f: number) => 0.42 * ease.inOutSine(seg(f, 2, 34)) * (1 - ease.inOutSine(seg(f, 186, 262)));
