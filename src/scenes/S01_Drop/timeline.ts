// S01 墨滴 — the scene's single source of time. Every visual is a pure function of the scene-local frame through
// `state(f)`: the "tape" (physical seconds since impact = the ink renderer's `age`), the playback speed, the camera,
// the tamper (rewind artefacts) intensity and the entropy gauge.
//
// Beats (scene-local frames, 30 fps; screenplay S01 card table):
//   f0      cold open: a spread cloud (age ≈ 8.3 s, spread .3) is already rolling BACKWARD (◀◀, RGB split, tears)
//   f9      card 2 「这是倒放。」 — line 2 「你一眼就知道。」 at f27
//   f0–72   the cloud un-blooms; the camera pushes in toward the surface; the ink re-gathers into the drop
//   f72     the drop LEAPS OUT of the water (age crosses 0 backward); reversed plop
//   f72–90  it rises and decelerates while the tape itself slows (tape-stop)
//   f90     tape-stop CLUNK at the apex: ◀◀ → ▶, artefacts snap off. The drop hangs over a perfectly still surface
//   f90–126 the tape spins up (speed 0 → 1.43, ∝ u²): the drop hangs, then falls; the camera tracks it down
//   f126    IMPACT (4.2 s) at macro zoom; instant speed-ramp into slow motion (×0.25): crown, jets, Worthington jet
//   f136–194 pull-out reveal: the vortex ring descends on its stem
//   f162    card 4 「现实里，/ 没人见过它自己聚回来。」 (聚回来 drifts apart while displayed)
//   f188–200 first Widnall split (4 lobes) · f228–240 second split (×3) → the chandelier
//   f264–330 the bloom breathes alone; it starts to spread (spread 0 → .3), light swells
//   f330    HARD CUT to black. 「为什么？」 fades in f331–336, diffuses f362–384; only the dot remains at Q_DOT
import { clamp, ease, lerp, memo, seg, smoothstep } from '../../lib/math';
import { WATER_LINE_Y } from '../../lib/handoff';

export const F = {
  card2: 9,
  card2b: 27,
  leap: 72,
  stop: 90,
  impact: 126,
  card4: 162,
  card4End: 264,
  breath: 264,
  cut: 330,
  qIn: 331,
  qDiffuse: 360,
  end: 390,
} as const;

/** Drop apex (where the rewound drop stops and later falls from). */
export const FROM_Y = 200;
export const DROP_R = 13;
const G = 900;
/** Fall time from the apex to contact, seconds. */
export const T_FALL = Math.sqrt((2 * (WATER_LINE_Y - DROP_R - FROM_Y)) / G);
/** Tape clock at impact (the screenplay's 4.2 s). */
export const TAPE_IMPACT = 4.2;

// ───────────────────────────── playback speed (physical s per real s), forward part ─────────────────────────────
const SPIN_MAX = T_FALL / 0.4; // spin-up f90→126 with speed ∝ u²: ∫ = 36/3/30·max = T_FALL
const LEAP_V = (2 * T_FALL * 30) / (F.stop - F.leap); // linear tape-stop f72→90, ∫ = T_FALL

/** forward speed after impact (>= f126) */
function postSpeed(f: number): number {
  // speed ramp into slow motion right at contact, then up to ×1.7 through the cascade, then ×1.1 while it breathes
  if (f < F.impact + 3) return lerp(SPIN_MAX, 0.25, ease.outCubic(seg(f, F.impact, F.impact + 3)));
  if (f < 146) return 0.25;
  if (f < 188) return lerp(0.25, 1.7, ease.inOutSine(seg(f, 146, 188)));
  if (f < 250) return 1.7;
  if (f < 286) return lerp(1.7, 1.1, ease.inOutSine(seg(f, 250, 286)));
  return 1.1;
}

/** rewind shape f0→72 (before normalisation): already moving at f0, fastest around f20, braking into the leap */
const rewindShape = (u: number) => Math.pow(1 - u, 1.5) * (0.55 + 0.45 * smoothstep(0, 0.3, u));

interface Tape {
  /** age at f (index = frame·SUB) */
  age: Float32Array;
  ageEnd: number;
  K: number;
}
const SUB = 8;

function buildTape(): Tape {
  return memo('s01-tape', () => {
    const N = F.end * SUB + 1;
    const age = new Float32Array(N);
    // forward from impact (age 0 at f126)
    let a = 0;
    age[F.impact * SUB] = 0;
    for (let i = F.impact * SUB + 1; i < N; i++) {
      const fm = (i - 0.5) / SUB;
      a += postSpeed(fm) / 30 / SUB;
      age[i] = a;
    }
    const ageEnd = age[(F.cut - 1) * SUB]; // the last image before the cut is the state the film opens on
    // spin-up f90 → 126: age(f) = −T + SPIN_MAX·36/30·u³/3
    for (let i = F.stop * SUB; i <= F.impact * SUB; i++) {
      const u = (i / SUB - F.stop) / (F.impact - F.stop);
      age[i] = -T_FALL + (SPIN_MAX * (F.impact - F.stop)) / 30 * (u * u * u) / 3;
    }
    // leap + tape-stop f72 → 90: speed LEAP_V·(1−u) backward
    for (let i = F.leap * SUB; i <= F.stop * SUB; i++) {
      const u = (i / SUB - F.leap) / (F.stop - F.leap);
      age[i] = -(LEAP_V * (F.stop - F.leap)) / 30 * (u - (u * u) / 2);
    }
    // rewind f0 → 72: speed = LEAP_V + K·shape(u); normalise K so the cloud is exactly re-gathered (age 0) at f72
    let I = 0;
    const M = 2000;
    for (let j = 0; j < M; j++) I += rewindShape((j + 0.5) / M) / M;
    const need = ageEnd * 30 - LEAP_V * F.leap; // physical frames to cover beyond the base speed
    const K = need / (F.leap * I);
    let acc = 0;
    age[F.leap * SUB] = 0;
    for (let i = F.leap * SUB - 1; i >= 0; i--) {
      const u = (i + 0.5) / SUB / F.leap;
      acc += (LEAP_V + K * rewindShape(u)) / 30 / SUB;
      age[i] = acc;
    }
    return { age, ageEnd, K };
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

/** signed playback speed (negative = rewind) */
export function speedAt(f: number): number {
  if (f < F.leap) return -(LEAP_V + buildTape().K * rewindShape(f / F.leap));
  if (f < F.stop) return -LEAP_V * (1 - (f - F.leap) / (F.stop - F.leap));
  if (f < F.impact) {
    const u = (f - F.stop) / (F.impact - F.stop);
    return SPIN_MAX * u * u;
  }
  return postSpeed(f);
}

// ───────────────────────────── camera ─────────────────────────────
// screen_y = z·world_y + ty  (x always about 540). Keyframes interpolate (z, ty) with one eased parameter per
// segment, so the equivalent zoom origin (ty / (1 − z)) stays put within a segment and never jumps.
interface Cam {
  f: number;
  z: number;
  ty: number;
  e?: (t: number) => number;
}
const about = (z: number, oy: number) => ({ z, ty: oy * (1 - z) });
const CAM: Cam[] = [
  // f0 = the camera of the last image before the cut (the cold open IS that cloud, rewound)
  { f: 0, ...about(1.13, 900) },
  { f: 34, z: 1, ty: 0, e: ease.inOutSine },
  { f: 42, z: 1, ty: 0 },
  // macro close-up on the drop at its apex (y 200 → screen 720, surface 360 → 1200), creeping in during the hang
  { f: 90, z: 3.0, ty: 720 - 3.0 * 200, e: ease.inOutCubic },
  { f: 106, z: 3.06, ty: 722 - 3.06 * 200, e: ease.inOutSine },
  // track the falling drop down into a macro framing of the contact: surface → screen 820
  { f: 126, z: 2.7, ty: 820 - 2.7 * WATER_LINE_Y, e: ease.inOutSine },
  { f: 138, z: 2.78, ty: 826 - 2.78 * WATER_LINE_Y, e: ease.outSine },
  // pull-out reveal of the ring on its stem
  { f: 196, z: 1, ty: 0, e: ease.inOutCubic },
  // slow push-in while the bloom grows, then the camera leans in (accelerating) as it breathes and the light swells
  { f: 262, ...about(1.03, 900), e: ease.inOutSine },
  { f: 330, ...about(1.13, 900), e: ease.inQuad },
];

export function camAt(f: number): { zoom: number; origin: [number, number] } {
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
  return { zoom: z, origin: [540, oy] };
}
/** world → screen with the camera at frame f */
export function toScreen(f: number, x: number, y: number): [number, number] {
  const { zoom, origin } = camAt(f);
  return [origin[0] + (x - origin[0]) * zoom, origin[1] + (y - origin[1]) * zoom];
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
  // artefacts follow the rewind speed, then die with the tape at the clunk
  const tamper = f < F.stop ? clamp(0.35 + 0.17 * Math.abs(speed)) * (1 - 0.6 * seg(f, F.leap, F.stop)) : 0;
  const rgbSplit = f < F.stop ? 1.2 + 1.3 * Math.abs(speed) : 0;
  const { zoom, origin } = camAt(f);
  const sVal = clamp(0.06 + 0.62 * Math.sqrt(Math.max(0, age) / 8.5) + 0.3 * spread);
  return { f, mode, age, speed, clock: TAPE_IMPACT + Math.max(age, -T_FALL), spread, tamper, rgbSplit, zoom, origin, sVal };
}
