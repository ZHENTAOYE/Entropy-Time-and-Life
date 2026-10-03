// S01 墨滴 — the scene's single source of time. Every visual is a pure function of the scene-local frame through
// `state(f)`: the "tape" (physical seconds since impact = the ink renderer's `age`), the playback speed, the camera,
// the tamper (rewind artefacts) intensity and the entropy gauge.
//
// Beats (scene-local frames, 30 fps; screenplay S01 card table). The score's S01 bed is hard-timed to f52 (the leap /
// reversed plop), f72 (tape-stop clunk) and f126 (impact, 4.2 s):
//   f0       COVER FRAME. Hard open mid-rewind: a dense black ink chandelier (age 5.6 s, no haze, density ×2.7) fills
//            the frame at 1.7×, ◀◀ ×16 in alarm red, two scan tears, slight chroma split; headline A
//            「你永远不会 / 看到这一幕。」 is already fully on screen (no fade-in)
//   f1–46    the VIOLENT rewind (HUD ×16 → ×24, radial motion smear toward the impact point, tears, shake): the 12
//            grand-lobes fold back (f~10), the 4 lobes merge into one ring (f~22), the camera whips up the stem to the
//            surface, the torus climbs to the crater (f22–44), the Worthington jet rises and retracts (f33–43), the
//            ripples run INWARD, the crown closes (f44–52) while the impact flash implodes into the crater
//   f38–48   headline A diffuses (fast)
//   f52.5    the drop LEAPS OUT of the water (contact is crossed between frames: f52 = drop in the closing crater,
//            f53 = drop just above it); reversed plop. Crash zoom with the drop (2.6× → 5×), motion-blurred
//   f50–58   headline B 「可物理定律，/ 并不禁止它。」 condenses (crisp from f58, holds to f112, diffuses f112–124)
//   f72      tape-stop CLUNK at the apex: vertical roll, ◀◀ → ▶ ×0.00, artefacts snap off
//   f72–100  macro still life: the drop hangs over a perfectly still surface (tape spins up from f90 ∝ u²: it barely
//            moves until ~f108)
//   f100–121 the drop falls; the camera pulls back to the impact framing (2.3×), stable for the last fast frames
//   f125.5   CONTACT (f125 = drop just above the surface, f126 = drop sinking into the crater + flash, 4.2 s); instant
//            speed-ramp into slow motion (×0.25): photographic crown, jets, spray
//   f140–196 pull-out reveal: the vortex ring descends on its stem; Worthington jet f146–175
//   f147     card 4 「现实里，/ 它只会散开。」 (散开 drifts apart while displayed) until f279
//   f186–189 first Widnall split (4 lobes) · f222–227 second split (×3) → the chandelier
//   f262–330 the bloom breathes alone; it starts to spread (spread 0 → .3), the camera leans in, the light swells
//   f330     HARD CUT to black. 「为什么？」 fades in f331–336, diffuses f360–384; only the dot remains at Q_DOT
// Everything from f126 on is unchanged from the previous cut (same tape from the spin-up at f90, same camera from f121).
import { clamp, ease, lerp, memo, seg, smoothstep } from '../../lib/math';
import { WATER_LINE_Y } from '../../lib/handoff';
import { hash01 } from '../../lib/random';

export const F = {
  /** headline A is on screen from frame 0 (the cover); it diffuses headAOut → headAEnd */
  headAOut: 38,
  headAEnd: 48,
  /** headline B condenses headB → headB + 8, diffuses (headBEnd − 12) → headBEnd */
  headB: 50,
  headBEnd: 124,
  /** last frame on which the re-gathered ink is still in the water (contact is crossed at LEAP_AT) */
  leap: 52,
  /** tape-stop clunk at the apex */
  stop: 72,
  /** the stopped tape starts to spin up again (∝ u², the drop barely moves until ~f108) */
  spin: 90,
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
export const LEAP_AT = 52.5;
export const IMPACT_AT = 125.5;

/** Drop apex (where the rewound drop comes to rest and later falls from). */
export const FROM_Y = 200;
export const DROP_R = 13;
const G = 900;
/** Fall time from the apex to contact, seconds. */
export const T_FALL = Math.sqrt((2 * (WATER_LINE_Y - DROP_R - FROM_Y)) / G);
/** Tape clock at impact (the screenplay's 4.2 s). */
export const TAPE_IMPACT = 4.2;
/** Age of the cover frame: the full chandelier (12 grand-lobes), still compact and dense (no haze yet). */
export const AGE_COVER = 4.3;
/** Headline lane (centre y of the 2-line block) shared by headlines A and B. */
export const HEAD_Y = 1392;

// ───────────────────────────── playback speed (physical s per real s) ─────────────────────────────
const FALL_LEN = IMPACT_AT - F.spin; // spin-up f90 → contact with speed ∝ u²: ∫ = FALL_LEN/30·SPIN/3 = T_FALL
const SPIN_MAX = (3 * T_FALL * 30) / FALL_LEN;
const LEAP_LEN = F.stop - LEAP_AT;
/** tape speed through the contact (slow motion: the crater closes and the drop emerges over several frames) */
const V_CONTACT = 0.45;
/** leap → tape-stop: cubic Bernstein speed profile v0..v3 (kick right after the drop clears the water, then a smooth
 *  deceleration to 0 at the clunk), its integral constrained to T_FALL so the drop is exactly at its apex at f72 */
const LEAP_V2 = 0.5;
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

/** Rewind anchors [frame, age, |speed|]: a violent un-bloom (×5–6 physical), braking into slow motion through the
 *  crown and the contact. Ages between anchors are cubic Hermite (C¹: the speed is continuous). */
const REWIND: Array<[number, number, number]> = [
  [0, AGE_COVER, 3.4],
  [8, 3.55, 4.6],
  [20, 1.72, 4.0],
  [32, 0.66, 2.4],
  [43, 0.17, 1.1],
  [LEAP_AT, 0, V_CONTACT],
];

interface Tape {
  /** age at f (index = frame·SUB) */
  age: Float32Array;
  ageEnd: number;
}
const SUB = 8;

function buildTape(): Tape {
  return memo('s01-tape-v3', () => {
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
    const ageEnd = age[(F.cut - 1) * SUB];
    // hang (tape stopped) + spin-up f90 → contact: age = −T + SPIN·L/30·u³/3
    for (let i = F.stop * SUB; i < iImp; i++) {
      const u = Math.max(0, (i / SUB - F.spin) / FALL_LEN);
      age[i] = -T_FALL + ((SPIN_MAX * FALL_LEN) / 30) * (u * u * u) / 3;
    }
    // leap + tape-stop LEAP_AT → f72 (backward): integrate the Bernstein speed profile
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
    for (let s = 0; s < REWIND.length - 1; s++) {
      const [fa, pa, va] = REWIND[s];
      const [fb, pb, vb] = REWIND[s + 1];
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
    return { age, ageEnd };
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
    for (let s = 0; s < REWIND.length - 1; s++) {
      const [fa, pa, va] = REWIND[s];
      const [fb, pb, vb] = REWIND[s + 1];
      if (f > fb && s < REWIND.length - 2) continue;
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
    const u = Math.max(0, (f - F.spin) / FALL_LEN);
    return SPIN_MAX * u * u;
  }
  return postSpeed(f);
}

/** The speed the HUD shows. During the fast rewind it reads the TAPE transport (×16 → ×24, the deck's shuttle
 *  speed), then hands over to the true playback speed as the tape brakes into the crown (from ~f46 on it is exact). */
export function hudSpeed(f: number): number {
  const v = Math.abs(speedAt(f));
  if (f >= 46) return v;
  const shuttle = 16 + 8 * ease.inOutSine(seg(f, 2, 20));
  return lerp(shuttle, v, ease.inOutSine(seg(f, 30, 46)));
}

/** Vertical-hold jump (px, 0 on most frames) of the picture on a few hash-chosen frames of the fast rewind (f2–35).
 *  Shared by the scene (stage transform) and the sound cues (a glitch on each). */
export function vholdJump(f: number): number {
  if (f < 2 || f >= 36 || hash01(f, 407) <= 0.8) return 0;
  return (hash01(f, 408) < 0.5 ? -1 : 1) * (14 + 26 * hash01(f, 409));
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
/** drop centre (world y) at a frame of the leap */
const dropY = (f: number) => {
  const a = ageAt(f);
  const tt = Math.max(0, a + T_FALL);
  return FROM_Y + 0.5 * G * tt * tt;
};

function cams(): Cam[] {
  return memo('s01-cam-v3', () => [
    // COVER: the chandelier fills the frame (1.7×); its lowest lobes just clear the headline lane
    { f: 0, ...pin(1.8, 1045, 1176) },
    // the camera whips up the stem with the gathering ink: ring (f20) → torus under the surface (f36)
    { f: 20, ...pin(2.0, 730, 1060), e: ease.inOutSine },
    { f: 36, ...pin(2.9, S, 700), e: ease.inOutSine },
    // macro on the crater: the jet retracts, the crown closes, the drop pops out at f52.5
    { f: 46, ...pin(3.6, S, 820), e: ease.inOutSine },
    { f: 52, ...pin(3.75, S, 850), e: ease.outSine },
    // punch-in with the drop as it leaps at the lens, then the camera breathes out into the apex framing while the
    // drop decelerates (surface just above headline B)
    { f: 57, ...pin(6.4, dropY(57), 660), e: ease.outCubic },
    { f: 64, ...pin(5.4, S, 1176), e: ease.inOutSine },
    { f: 72, ...pin(5.0, FROM_Y, 352), e: ease.outSine },
    // macro still life: a slow push while it hangs
    { f: 100, ...pin(5.12, FROM_Y, 356), e: ease.inOutSine },
    // pull back with the falling drop to the impact framing (surface at 880, 2.3×), stable for the last fast frames
    { f: 121, ...pin(2.3, S, 880), e: ease.inOutCubic },
    { f: 140, ...pin(2.4, S, 878), e: ease.outSine },
    // pull-out reveal of the ring on its stem
    { f: 196, z: 1, ty: 0, e: ease.inOutCubic },
    // slow push-in while the bloom grows, then the camera leans in (accelerating) as it breathes and the light swells
    { f: 262, ...about(1.03, 900), e: ease.inOutSine },
    { f: 330, ...about(1.13, 900), e: ease.inQuad },
  ]);
}

export function camAt(f: number): { zoom: number; origin: [number, number]; ty: number } {
  const CAM = cams();
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
  /** 0..1 radial motion smear of the violent rewind (0 on the cover frame) */
  smear: number;
  /** optical-density gain of the ink (the rewound chandelier is printed dense: Beer–Lambert deep core) */
  inkGain: number;
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
  const spread = f < F.stop ? 0 : spreadOfAge(age);
  // artefacts: on the cover frame only a couple of tears; from f1 the full violence (following the rewind speed),
  // easing as the tape brakes into the crown, and they die with the tape at the clunk
  const open = f < 1 ? 0.42 : 1;
  const tamper = f < F.stop ? open * clamp(0.16 + 0.15 * Math.abs(speed)) * (1 - 0.55 * seg(f, LEAP_AT, F.stop)) : 0;
  const rgbSplit = f < F.stop ? (f < 1 ? 1.4 : 1.2 + 1.4 * Math.abs(speed)) : 0;
  const smear = f < 1 ? 0 : clamp(0.3 + Math.abs(speed) / 5) * (1 - smoothstep(34, 44, f));
  // the lobes of the cover are printed at ×2.7 optical density; the gain eases off as they merge into the (already
  // near-black) primary, and is exactly 1 from the leap on
  const inkGain = f < F.leap ? 1 + 2.6 * smoothstep(0.9, 3.2, age) : 1;
  const { zoom, origin } = camAt(f);
  const sVal = clamp(0.06 + 0.62 * Math.sqrt(Math.max(0, age) / 8.5) + 0.3 * spread);
  // (0 at every zoom ≤ 2.55: unchanged from f121 on; ramps in with the crash zoom of the leap)
  const macro = clamp((zoom - 2.55) / 2.0);
  return {
    f,
    mode,
    age,
    speed,
    clock: TAPE_IMPACT + Math.max(age, -T_FALL),
    spread,
    tamper,
    rgbSplit,
    smear,
    inkGain,
    zoom,
    origin,
    sVal,
    macro: macro * macro * (3 - 2 * macro),
  };
}
