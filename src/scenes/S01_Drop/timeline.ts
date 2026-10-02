// S01 墨滴 — the scene's single source of time. Every visual is a pure function of the scene-local frame through
// `state(f)`: the "tape" (physical seconds since impact = the ink renderer's `age`), the playback speed, the camera,
// the tamper (rewind artefacts) intensity and the entropy gauge.
//
// Beats (scene-local frames, 30 fps; screenplay S01 card table). The score's S01 bed is hard-timed to 2.4 s (reversed
// plop), 3.0 s (clunk) and 4.2 s (impact), so those three stay on f72/f90/f126:
//   f0      cold open: a spread cloud (age ≈ 8.3 s, spread .3) is already rolling BACKWARD (◀◀ ×5, RGB split, tears)
//   f3      card 2 「这是倒放。」 — line 2 「你一眼就知道。」 at f18
//   f0–44   the chandelier un-blooms at ×5–6 (grand-lobes fold back f~25, the 4 lobes merge into one ring f~41)
//   f34–56  the camera pushes in to a stable 1.6× frame on the surface (it holds until the drop has cleared it)
//   f44–72  the tape brakes into SLOW MOTION (×2.3 → ×0.4): the glossy torus climbs its stem to the crater, the
//           Worthington jet rises and retracts (f53–65), the crown closes (f61–72), the ink re-gathers in the crater
//   f72.5   the drop LEAPS OUT of the water (contact is crossed between frames: f72 = drop in the closing crater,
//           f73 = drop just above it); reversed plop. The tape then kicks to ×1.5 (the leap) and decelerates
//   f76–90  macro push-in (1.6× → 4.5×) while the drop decelerates; it comes to rest at its apex exactly at f90
//   f90     tape-stop CLUNK: ◀◀ → ▶, artefacts snap off. Macro still life: the drop hangs over a perfectly still
//   f90–108 surface (speed 0 → ∝ u², it barely moves until ~f108)
//   f108–122 the drop falls; the camera pulls back to the impact framing (2.3×), stable for the last fast frames
//   f125.5  CONTACT (f125 = drop just above the surface, f126 = drop sinking into the crater + flash, 4.2 s); instant
//           speed-ramp into slow motion (×0.25): photographic crown, jets, spray
//   f140–196 pull-out reveal: the vortex ring descends on its stem; Worthington jet f146–175
//   f147    card 4 「现实里，/ 没人见过它自己聚回来。」 (聚回来 drifts apart while displayed) until f279
//   f186–189 first Widnall split (4 lobes) · f222–227 second split (×3) → the chandelier
//   f262–330 the bloom breathes alone; it starts to spread (spread 0 → .3), the camera leans in, the light swells
//   f330    HARD CUT to black. 「为什么？」 fades in f331–336, diffuses f360–384; only the dot remains at Q_DOT
import { clamp, ease, lerp, memo, seg } from '../../lib/math';
import { WATER_LINE_Y } from '../../lib/handoff';

export const F = {
  card2: 3,
  card2End: 105,
  /** last frame on which the re-gathered ink is still in the water (contact is crossed at LEAP_AT) */
  leap: 72,
  stop: 90,
  /** first frame after the contact (flash) — the score's 4.2 s */
  impact: 126,
  card4: 147,
  card4End: 279,
  breath: 279,
  cut: 330,
  qIn: 331,
  qDiffuse: 360,
  end: 390,
} as const;

/** Exact (fractional) frames at which the drop crosses contact. Never an integer frame: on an integer frame the drop
 *  would sit exactly at age 0, where the ink renderer shows neither the drop nor the bloom. */
export const LEAP_AT = 72.5;
export const IMPACT_AT = 125.5;

/** Drop apex (where the rewound drop comes to rest and later falls from). */
export const FROM_Y = 200;
export const DROP_R = 13;
const G = 900;
/** Fall time from the apex to contact, seconds. */
export const T_FALL = Math.sqrt((2 * (WATER_LINE_Y - DROP_R - FROM_Y)) / G);
/** Tape clock at impact (the screenplay's 4.2 s). */
export const TAPE_IMPACT = 4.2;

// ───────────────────────────── playback speed (physical s per real s) ─────────────────────────────
const FALL_LEN = IMPACT_AT - F.stop; // spin-up f90 → contact with speed ∝ u²: ∫ = FALL_LEN/30·SPIN/3 = T_FALL
const SPIN_MAX = (3 * T_FALL * 30) / FALL_LEN;
const LEAP_LEN = F.stop - LEAP_AT;
/** tape speed through the contact (slow motion: the crater closes and the drop emerges over several frames) */
const V_CONTACT = 0.4;
/** leap → tape-stop: cubic Bernstein speed profile v0..v3 (kick right after the drop clears the water, then a smooth
 *  deceleration to 0 at the clunk), its integral constrained to T_FALL so the drop is exactly at its apex at f90 */
const LEAP_V2 = 0.6;
const LEAP_V1 = (4 * T_FALL * 30) / LEAP_LEN - V_CONTACT - LEAP_V2;
function leapSpeed(x: number): number {
  const y = 1 - x;
  return V_CONTACT * y * y * y + 3 * LEAP_V1 * x * y * y + 3 * LEAP_V2 * x * x * y;
}

/** forward speed after contact */
function postSpeed(f: number): number {
  // speed ramp into slow motion right at contact, then up to ×1.7 through the cascade, then ×1.1 while it breathes
  if (f < IMPACT_AT + 3) return lerp(SPIN_MAX, 0.25, ease.outCubic(seg(f, IMPACT_AT, IMPACT_AT + 3)));
  if (f < 146) return 0.25;
  if (f < 188) return lerp(0.25, 1.7, ease.inOutSine(seg(f, 146, 188)));
  if (f < 250) return 1.7;
  if (f < 286) return lerp(1.7, 1.1, ease.inOutSine(seg(f, 250, 286)));
  return 1.1;
}

/** Rewind anchors [frame, age, |speed|]: fast un-bloom, braking into slow motion through the contact. Ages between
 *  anchors are cubic Hermite (C¹: the speed is continuous). The first anchor's age is the last pre-cut image. */
function rewindAnchors(ageEnd: number): Array<[number, number, number]> {
  const a18 = 1.3 + (26.5 * (6.0 + 2.3)) / 60;
  const v0 = (60 * (ageEnd - a18)) / 18 - 6.0;
  return [
    [0, ageEnd, v0],
    [18, a18, 6.0],
    [44.5, 1.3, 2.3],
    [60.5, 0.35, 1.25],
    [LEAP_AT, 0, V_CONTACT],
  ];
}

interface Tape {
  /** age at f (index = frame·SUB) */
  age: Float32Array;
  ageEnd: number;
  anchors: Array<[number, number, number]>;
}
const SUB = 8;

function buildTape(): Tape {
  return memo('s01-tape-v2', () => {
    const N = F.end * SUB + 1;
    const age = new Float32Array(N);
    const iImp = IMPACT_AT * SUB;
    // forward from contact (age 0 at IMPACT_AT)
    let a = 0;
    age[iImp] = 0;
    for (let i = iImp + 1; i < N; i++) {
      a += postSpeed((i - 0.5) / SUB) / 30 / SUB;
      age[i] = a;
    }
    const ageEnd = age[(F.cut - 1) * SUB]; // the last image before the cut is the state the film opens on
    // spin-up f90 → contact: age = −T + SPIN·L/30·u³/3
    for (let i = F.stop * SUB; i < iImp; i++) {
      const u = (i / SUB - F.stop) / FALL_LEN;
      age[i] = -T_FALL + ((SPIN_MAX * FALL_LEN) / 30) * (u * u * u) / 3;
    }
    // leap + tape-stop LEAP_AT → f90 (backward): integrate the Bernstein speed profile
    let acc = 0;
    age[LEAP_AT * SUB] = 0;
    for (let i = LEAP_AT * SUB + 1; i <= F.stop * SUB; i++) {
      const x = ((i - 0.5) / SUB - LEAP_AT) / LEAP_LEN;
      acc += leapSpeed(x) / 30 / SUB;
      age[i] = -acc;
    }
    // exact apex at the clunk (removes the midpoint-rule residue)
    const k = T_FALL / acc;
    for (let i = LEAP_AT * SUB + 1; i <= F.stop * SUB; i++) age[i] *= k;
    // rewind f0 → LEAP_AT: Hermite through the anchors
    const anchors = rewindAnchors(ageEnd);
    for (let s = 0; s < anchors.length - 1; s++) {
      const [fa, pa, va] = anchors[s];
      const [fb, pb, vb] = anchors[s + 1];
      const h = fb - fa;
      const m0 = (-va / 30) * h,
        m1 = (-vb / 30) * h;
      for (let i = Math.round(fa * SUB); i <= Math.round(fb * SUB); i++) {
        const t = (i / SUB - fa) / h;
        const t2 = t * t,
          t3 = t2 * t;
        age[i] = (2 * t3 - 3 * t2 + 1) * pa + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * pb + (t3 - t2) * m1;
      }
    }
    return { age, ageEnd, anchors };
  });
}

/** physical age (s since impact) at a (fractional) scene frame */
export function ageAt(f: number): number {
  const t = buildTape();
  const x = clamp(f, 0, F.end) * SUB;
  const i = Math.floor(x);
  const j = Math.min(t.age.length - 1, i + 1);
  return lerp(t.age[i], t.age[j], x - i);
}
export const AGE_END = () => buildTape().ageEnd;

/** signed playback speed (negative = rewind), physical s per real s */
export function speedAt(f: number): number {
  if (f < LEAP_AT) {
    const an = buildTape().anchors;
    for (let s = 0; s < an.length - 1; s++) {
      const [fa, pa, va] = an[s];
      const [fb, pb, vb] = an[s + 1];
      if (f > fb && s < an.length - 2) continue;
      const h = fb - fa;
      const t = clamp((f - fa) / h);
      const m0 = (-va / 30) * h,
        m1 = (-vb / 30) * h;
      const d = (6 * t * t - 6 * t) * pa + (3 * t * t - 4 * t + 1) * m0 + (-6 * t * t + 6 * t) * pb + (3 * t * t - 2 * t) * m1;
      return (d / h) * 30;
    }
  }
  if (f < F.stop) return -leapSpeed((f - LEAP_AT) / LEAP_LEN) * (T_FALL / ((LEAP_LEN / 30) * (V_CONTACT + LEAP_V1 + LEAP_V2) / 4));
  if (f < IMPACT_AT) {
    const u = (f - F.stop) / FALL_LEN;
    return SPIN_MAX * u * u;
  }
  return postSpeed(f);
}

// ───────────────────────────── camera ─────────────────────────────
// screen_y = z·world_y + ty  (x always about 540). Keyframes interpolate (z, ty) with one eased parameter per
// segment, so every world point moves on a straight line between its two keyframe screen positions (no swing).
interface Cam {
  f: number;
  z: number;
  ty: number;
  e?: (t: number) => number;
}
const about = (z: number, oy: number) => ({ z, ty: oy * (1 - z) });
/** world y `y` at screen `sy` with zoom z */
const pin = (z: number, y: number, sy: number) => ({ z, ty: sy - z * y });
const S = WATER_LINE_Y;
const CAM: Cam[] = [
  // f0 = the camera of the last image before the cut (the cold open IS that cloud, rewound)
  { f: 0, ...about(1.13, 900) },
  { f: 34, z: 1, ty: 0, e: ease.inOutSine },
  // a stable frame on the surface for the slow-motion contact and the leap (surface at screen 720 → 724)
  { f: 56, ...pin(1.55, S, 720), e: ease.inOutSine },
  { f: 76, ...pin(1.6, S, 724), e: ease.inOutSine },
  // macro push-in once the drop has cleared the surface: the drop comes to rest at its apex at screen y 532,
  // the still surface at 1252 (above the caption lane), drop ⌀ ≈ 117 px
  { f: 90, ...pin(4.5, FROM_Y, 532), e: ease.inOutCubic },
  { f: 106, ...pin(4.62, FROM_Y, 534), e: ease.inOutSine },
  // pull back with the falling drop to the impact framing (surface at 880, 2.3×), stable for the last fast frames
  { f: 121, ...pin(2.3, S, 880), e: ease.inOutCubic },
  { f: 140, ...pin(2.4, S, 878), e: ease.outSine },
  // pull-out reveal of the ring on its stem
  { f: 196, z: 1, ty: 0, e: ease.inOutCubic },
  // slow push-in while the bloom grows, then the camera leans in (accelerating) as it breathes and the light swells
  { f: 262, ...about(1.03, 900), e: ease.inOutSine },
  { f: 330, ...about(1.13, 900), e: ease.inQuad },
];

export function camAt(f: number): { zoom: number; origin: [number, number]; ty: number } {
  let a = CAM[0],
    b = CAM[CAM.length - 1];
  if (f <= CAM[0].f) b = a;
  else if (f >= b.f) a = b;
  else
    for (let i = 0; i < CAM.length - 1; i++)
      if (f >= CAM[i].f && f < CAM[i + 1].f) {
        a = CAM[i];
        b = CAM[i + 1];
        break;
      }
  const t = a === b ? 0 : (b.e ?? ease.inOutSine)(seg(f, a.f, b.f));
  const z = lerp(a.z, b.z, t);
  const ty = lerp(a.ty, b.ty, t);
  const oy = Math.abs(1 - z) < 1e-5 ? 860 : ty / (1 - z);
  return { zoom: z, origin: [540, oy], ty };
}
/** world → screen with the camera at frame f */
export function toScreen(f: number, x: number, y: number): [number, number] {
  const { zoom, ty } = camAt(f);
  return [540 + (x - 540) * zoom, zoom * y + ty];
}

// ───────────────────────────── derived state ─────────────────────────────
export type Mode = 'rewind' | 'play' | 'black';

export interface S01State {
  f: number;
  mode: Mode;
  age: number;
  speed: number;
  /** tape clock seconds (HUD) */
  clock: number;
  spread: number;
  /** 0..1 strength of the time-tamper artefacts */
  tamper: number;
  rgbSplit: number;
  zoom: number;
  origin: [number, number];
  /** entropy gauge 0..1 */
  sVal: number;
  /** 0..1 how "macro" the shot is (drives the macro still-life layers) */
  macro: number;
}

const SPREAD_MAX = 0.3;
/** spread is a function of the ink's age (state), so the rewind un-spreads exactly what the forward run spread */
function spreadOfAge(age: number): number {
  const a0 = ageAt(262);
  return SPREAD_MAX * ease.inOutSine(clamp((age - a0) / (AGE_END() - a0)));
}

export function state(f: number): S01State {
  const age = ageAt(f);
  const speed = speedAt(f);
  const mode: Mode = f >= F.cut ? 'black' : f < F.stop ? 'rewind' : 'play';
  const spread = spreadOfAge(age);
  // artefacts follow the rewind speed (a slow tape tracks cleanly: the slow-motion contact stays readable), then die
  // with the tape at the clunk
  const tamper = f < F.stop ? clamp(0.1 + 0.16 * Math.abs(speed)) * (1 - 0.6 * seg(f, LEAP_AT, F.stop)) : 0;
  const rgbSplit = f < F.stop ? 0.9 + 1.3 * Math.abs(speed) : 0;
  const { zoom, origin } = camAt(f);
  const sVal = clamp(0.06 + 0.62 * Math.sqrt(Math.max(0, age) / 8.5) + 0.3 * spread);
  const macro = clamp((zoom - 2.45) / 1.5);
  return { f, mode, age, speed, clock: TAPE_IMPACT + Math.max(age, -T_FALL), spread, tamper, rgbSplit, zoom, origin, sVal, macro: macro * macro * (3 - 2 * macro) };
}
