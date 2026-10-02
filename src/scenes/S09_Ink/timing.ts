// S09 墨的形状 / The Shape of Ink — FINALE. 848 frames (28.3 s). The scene's single source of time.
//
// Visual language: ONE NETWORK AT EVERY SCALE, THEN ONE INK. A powers-of-ten pull-back where neurons, city lights,
// the night side of the Earth, the galaxy and the cosmic web rhyme as the same branching network of light; three
// hard-cut punch-ins (星系 / 细胞 / 你) on circles of identical size; a dive through the pupil back into the web; then
// the INVERSION (emissive → transmission): the cosmic web turns negative and is ink in water (S01's tank). The ink,
// still spreading (the S-gauge never falls), flows along a contour and draws you as a 水墨 figure — then lets you go.
// ◀◀ tries to rewind and dissolves into ink. Title. A last drop. The light table goes out; the hairline of light
// contracts to a point. Black.
//
// Beats (scene-local frames, 30 fps; screenplay S09 card table, ±0.5 s nudges):
//   B1  0–209   PULL-BACK, Z = log10(frame width in metres) 0.16 → 24.7 (knots below). FIGURE_S08 (f0 = S08's last
//               frame, continuing) → warm dot in a sodium-lit street grid → the metro area by a dark sea → city
//               clusters & highways on the Earth's night side (limb, airglow, a sunlit crescent) → pale dot, Moon and
//               planet orbits → stars (log-space tunnel) → the Milky Way (you on an arm) → Local Group → the web.
//               A gold "you are here" point rides the anchor the whole way. Odometer 10ⁿ m + scale name (rhymes S03).
//               C2 「宇宙，一路滚向平衡。」 · C3 「途中，它在一些角落，/ 暂时织出了结构：」 (killed by the hard cut)
//   B2  210     HIT 1 galaxy 「星系。」 · 240 HIT 2 cell 「细胞。」 · 270 HIT 3 eye 「你。」 — hard cuts, 2-frame flash,
//               1.12 → 1.0 settle, the three circles share centre & radius (graphic match). Silence after f270.
//   B3  270–427 the eye: it looks up (gaze shift), the web glints in its cornea; push into the pupil — its dark
//               becomes the night sky with the web. C7 「然后，其中最小的一块，/ 抬起头问：时间是什么？」
//   B4  420–500 INVERSION (pure picture): the web drains into ink from the water line (y 300) down; the tank's air,
//               bokeh and silver hairline (drawn from the centre outward) appear: we are back in S01's tank.
//   B5  470–790 THE INK: web-seeded ink tendrils sink, curl, widen and pale (Beer–Lambert dilution); the haze grows.
//               C9 「墨，终将散开。」 · C10 「但在散开的路上——」 (S05 C8's exact layout) — ink streams along a contour
//               and paints the human figure (水墨: pressure, 飞白, 墨晕), it holds while the ink keeps flowing, then
//               lets go. C11 「它画出了你。」 — 你 is painted with a real brush texture (the only one in the film).
//               The S-gauge (ink) rises the whole time.
//   B6  720–780 ◀◀ flickers in under the water line, tries to rewind (digits run back, chromatic split); the ink
//               ignores it; the ◀◀ itself bleeds into ink and sinks.
//   B7  756–818 title 「熵 · 时间 · 生命」 (shāng over 熵) condenses, then dissolves into ink particles; a last drop
//               falls through the surface (f786); the light table switches off; the hairline contracts to a point.
//   B8  819–847 pure black, silence (loops to S01's cold open).
import { clamp, ease, seg } from '../../lib/math';

export const DUR = 848;
export const FPS = 30;

/** S08's last frame is its local 569: S09 continues the same closed-form clock (pulses, echo rings, motes). */
export const S08_T0 = 570;

// ───────────────────────────── B1 pull-back ─────────────────────────────
/** Z at f0: FIGURE_S08 is 1300 px tall for a 1.75 m person → frame width 1.4538 m. */
export const PERSON_M = 1.75;
export const Z0 = Math.log10((1080 * PERSON_M) / 1300);
/** screen anchor of the pull-back = the figure's centre (it shrinks in place: the camera simply moves back) */
export const ANCHOR: readonly [number, number] = [540, 940];

/** [frame, Z] knots — monotone cubic. Breathes on the Earth (f52–68) and the Milky Way (f124–150). */
export const Z_KNOTS: ReadonlyArray<readonly [number, number]> = [
  [0, Z0],
  [7, Z0 + 0.12],
  [15, 0.95],
  [23, 2.2],
  [31, 3.7],
  [39, 5.15],
  [47, 6.45],
  [56, 7.3],
  [68, 7.85],
  [80, 10.0],
  [91, 13.2],
  [101, 16.6],
  [111, 19.25],
  [119, 20.15],
  [131, 20.86],
  [145, 21.3],
  [156, 21.95],
  [172, 22.95],
  [188, 23.95],
  [202, 24.55],
  [210, 24.68],
];
export const PB_END = 210;

/** Monotone cubic (Fritsch–Carlson) through knots [x, y]; clamped outside. */
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
const zCurve = knots(Z_KNOTS);
/** log10 of the frame width in metres at (fractional) frame f */
export const zoomZ = (f: number) => zCurve(f);
/** decades per frame (for motion blur / sound) */
export const zoomSpeed = (f: number) => zCurve(f + 0.5) - zCurve(f - 0.5);

// ───────────────────────────── narration (canvas voice) ─────────────────────────────
export const CAP = {
  c2: { at: 24, dur: 80 },
  c3: { at: 104, dur: 106 }, // killed by the hard cut at 210
  c7: { at: 312, dur: 116 },
  c9: { at: 488, dur: 60 },
  c10: { at: 548, dur: 66 }, // = S05 C8 (stagger 1.4, enterLen 16, exitLen 24)
  c11: { at: 614, dur: 106 },
} as const;

// ───────────────────────────── B2 triplet ─────────────────────────────
export const HIT = { galaxy: 210, cell: 240, eye: 270 } as const;
/** the three punch-in circles share this centre & radius */
export const DISC = { x: 540, y: 850, r: 400 } as const;

// ───────────────────────────── B3 eye → web ─────────────────────────────
export const EYE = {
  gaze: [292, 322] as const, // the eye looks up
  dive: [334, 416] as const, // push into the pupil
  webIn: [356, 412] as const, // the web shows through the pupil and takes the frame
  end: 428,
};

// ───────────────────────────── B4 inversion ─────────────────────────────
export const INV = {
  invert: [428, 474] as const, // CosmicWeb invert 0 → 1 (front from the water line)
  tank: [452, 500] as const, // the tank (air, bokeh, hairline) replaces the inverted web image
  hairline: [456, 492] as const, // the silver line draws itself from the centre outward
  handover: 466, // ink particles are seeded on the web's filaments from this frame's geometry
};
export const SURFACE_Y = 300;

// ───────────────────────────── B5 ink ─────────────────────────────
export const INK_T = {
  /** figure: painted along the contour, held while the ink keeps flowing, then released */
  paint: [538, 604] as const,
  hold: 688,
  release: [688, 784] as const,
  /** 你 is painted stroke by stroke */
  brush: [640, 668] as const,
  gauge: [488, 510] as const,
  gaugeOut: [790, 806] as const,
};

// ───────────────────────────── B6 ◀◀ ─────────────────────────────
export const RW = { on: 720, attempt: [726, 746] as const, melt: [744, 790] as const };

// ───────────────────────────── B7 title & ending ─────────────────────────────
export const END = {
  title: [756, 770] as const, // condense
  titleMelt: [791, 818] as const, // the drop's impact sets the title dissolving into ink
  dropFrom: 776, // the last drop starts falling
  impact: 790, // contact with the surface
  light: [797, 813] as const, // light table off
  span: [804, 817] as const, // hairline contracts to a point
  point: [816, 819] as const, // the point of light goes out
  black: 819,
};

// ───────────────────────────── shared curves ─────────────────────────────
/** S-gauge value: rises the whole time the ink is on screen (never falls) */
export const sValue = (f: number) => 0.56 + 0.4 * ease.inOutSine(seg(f, 470, 820));
export const gaugeAlpha = (f: number) => ease.inOutSine(seg(f, INK_T.gauge[0], INK_T.gauge[1])) * (1 - ease.inOutSine(seg(f, INK_T.gaugeOut[0], INK_T.gaugeOut[1])));
/** light-table power at the end */
export const lightAt = (f: number) => 1 - ease.inOutSine(seg(f, END.light[0], END.light[1]));
export const clamp01 = (x: number) => clamp(x);
