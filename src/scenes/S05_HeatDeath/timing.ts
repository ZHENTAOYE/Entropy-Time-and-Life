// S05 热寂 / Heat Death — beat sheet (scene-local frames, 30 fps, 522 frames) and every time curve of the scene.
//
// Visual language: THE PICTURE ITSELF REACHES EQUILIBRIUM, read by instruments that die with it.
// Reading time: every narration line is fully crisp for >= (characters / 5) s where the locked card table allows it
// (fast condense: stagger 0.8-1, enterLen 12; diffuse exit 13-16 f); text only overlaps across lanes, never in one lane.
//  B1  f0-50    IN = WEB_FINAL (S04's lit web). ▶▶ engages (f2): chromatic fringes + radial time-smear, sparks race,
//               the camera breathes out (zoom 0.8 → 0.74). S-gauge fades in.      C1 「滚到最后呢？」 f3-70 (crisp f20-56)
//  B2  f10-108  Stars burn out in hash order (redden → ember → gone); every death exhales a LIGHT SHELL that expands
//               and dilutes (its energy is not lost — it spreads). One-line lockup (the screenplay's own string):
//               「~10¹⁴ 年 · 最后的恒星熄灭」: number in f50, odometer 10 → 14 f56-98, label f60-132 (crisp f78-118);
//               the reticle locks on the last star; it goes out at f≈98 as the odometer lands.
//  B3  f62-170  Six black holes form on the heaviest clusters (lensing, photon rings), glow hotter as they shrink
//               (Hawking), pop lightest-first f108-128, the largest last (f150). The exponent whirrs 14 → 100
//               (f118-146) while the line re-centres; 「~10¹⁰⁰ 年 · 最大的黑洞蒸发殆尽」 label f136 (crisp f155-206),
//               the numerals lose contrast as they display, then the line random-walks into the noise (f206-232).
//  B4  f146-282 THE IMAGE DIFFUSES: every pixel random-walks (cosmos eq), colour drains, the vignette goes to 0.
//               A temperature histogram measured from the frame itself collapses into one needle (f214-262).
//               ▶▶ loses its direction (the arrows spin aimlessly) and dissolves.  C4 「温度处处相同。」 f192-260
//  B5  f260-350 LOUPE at the gold point's place: the grey, magnified, is a gas — a coherent stream thermalises,
//               speeds unchanged (能量 100 %), the net-flow arrow shrinks to nothing. The S-gauge pegs at the top.
//                                                       C5 「能量都还在，/ 却再也做不了任何事。」 f260-370 (crisp f285-354)
//  B6  f348-402 「这叫——」 (crisp f366) + 「热寂。」 (in f358-364) NOISE-DEATH from f372: 热寂 fades to exactly the
//               background grey while its pixels random-walk into the noise (still legible to ~f390, gone by f400).
//               The S-gauge random-walks away.
//  B7  f402-442 Pure grey boiling noise. The film's only true silence (1.33 s; nothing else on screen).
//  B8  f442-521 One gold point (#FFC94A) flickers alive at GOLD_POINT.  C8 「但在滚落的路上——」 f444-519 (crisp f463-506)
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
  c1: { at: 3, dur: 67 },
  lockIn: 50, // the number "~10¹⁰ 年" condenses in as C1 starts to leave
  roll1: [56, 98] as const, // exponent 10 → 14 (ticks); lands as the last star goes out
  label1: { at: 60, dur: 72 },
  lastStar: 98,
  relayout: [114, 138] as const, // the line re-centres for the longer card-3 label
  roll2: [118, 146] as const, // exponent 14 → 100 (whirr); the largest black hole pops just after (f150)
  label2: { at: 136 },
  lockDie: [206, 232] as const, // the lockup random-walks into the noise with the image
  lastPop: 150,
  eq0: 146,
  c4: { at: 192, dur: 68 },
  hist: [214, 262] as const,
  hudLose: [176, 246] as const,
  hudDie: [238, 286] as const,
  c5: { at: 260, dur: 110 },
  loupe: [260, 350] as const,
  gaugePeg: 262,
  gaugeDie: [334, 384] as const,
  c6: { at: 348 }, // 「这叫——」; 「热寂。」 at +10; pure grey again at T.silence[0]
  silence: [402, 442] as const,
  gold: 442,
  c8: { at: 444, dur: 75 },
} as const;

// ───────────── cosmos parameters ─────────────
/** stars burn out: the last star on screen is gone at f≈98, as the odometer lands on 10¹⁴ */
export const dieAt = knots([
  [10, 0],
  [24, 0.035],
  [38, 0.09],
  [50, 0.2],
  [63, 0.42],
  [76, 0.7],
  [87, 0.875],
  [92, 0.918],
  [99, 0.978],
  [106, 1],
]);

/** black holes: form f62–88, pop lightest-first (evap 0.537, 0.566, 0.573, 0.663, 0.705 → f108–128); the largest
 *  (0.940) pops at f150, exactly as the exponent lands on 100 */
export const bhAt = knots([
  [62, 0],
  [88, 0.24],
  [102, 0.47],
  [108, 0.539],
  [113, 0.5675],
  [117, 0.5745],
  [123, 0.6645],
  [128, 0.7065],
  [136, 0.84],
  [150, 0.9415],
  [170, 1],
]);

/** heat death: σ of the per-pixel random walk ≈ 650·eq² px; grey reached at eq ≈ 0.97. A slow start (the web lingers
 *  as a ghost for ~2 s after the last black hole), then the last gradients smooth out. */
export const eqAt = knots([
  [146, 0],
  [162, 0.05],
  [180, 0.12],
  [198, 0.22],
  [216, 0.35],
  [234, 0.52],
  [250, 0.72],
  [266, 0.9],
  [280, 1],
]);

/** fast-forward speed of the simulation clock (× real time) */
export const ffSpeed = (f: number) => 1 + 3 * ease.inOutSine(seg(f, 2, 30)) - 3 * ease.inOutSine(seg(f, 130, 210));
/** 0..1 how strongly time is being tampered with (chromatic fringes, time smear) */
export const ffK = (f: number) => ease.outCubic(seg(f, 2, 14)) * (1 - ease.inOutSine(seg(f, 130, 220)));

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
    sparks: 1 - ease.inOutSine(seg(f, 40, 100)),
  };
}

/** after this frame the cosmos is pure equilibrium grey: we render the grey ourselves (cheap) */
export const GREY_FROM = 282;

/** vignette strength: none on frame 0 (exact WEB_FINAL), a lens breath with ▶▶, gone at equilibrium */
export const vignetteAt = (f: number) => 0.42 * ease.inOutSine(seg(f, 2, 34)) * (1 - ease.inOutSine(seg(f, 166, 250)));
