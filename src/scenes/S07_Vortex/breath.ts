// The breath: every 4 s of flow time an exhale carries CO₂ and H₂O out of the mouth — a warm jet that slows, spreads
// and rises. Keyed on the body's flow time s (flow.ts): it runs fast in the time-lapse, and it freezes with the freeze.
// Closed form: particle j is emitted at s_j = j·DS (if the exhale is on), its state is a function of its age s − s_j.
import { memo } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { MOUTH } from './body';
import { Cam, project } from './camera';
import { flowTime } from './flow';

/** flow frames per breath (4 s in real time) */
export const BREATH_P = 120;
/** the first exhale of the thermal phase starts at scene frame 488 (peaks ≈ f500, f620, f740) */
const phase0 = () => memo('s07:breath0', () => flowTime(488));
export const EX_LIFE = 58;
const DS = 0.11;

/** exhale strength 0..1 at flow time s (the exhale is ~40 % of the cycle) */
export function exhaleRate(s: number): number {
  const p = ((((s - phase0()) % BREATH_P) + BREATH_P) % BREATH_P) / BREATH_P;
  return p < 0.42 ? Math.pow(Math.sin((Math.PI * p) / 0.42), 2) : 0;
}

/** scene frames (≥ f0) at which an exhale starts, for the cue sheet */
export function exhaleOnsets(f0: number, f1: number): number[] {
  const out: number[] = [];
  let prev = exhaleRate(flowTime(f0 - 1));
  for (let f = f0; f <= f1; f++) {
    const r = exhaleRate(flowTime(f));
    if (prev === 0 && r > 0) out.push(f);
    prev = r;
  }
  return out;
}

/** position of exhale particle j at age a (flow frames) → out [X, H, Z] */
function exPos(j: number, a: number, out: Float32Array) {
  const ang = 0.18 + (hash01(j, 902) - 0.5) * 0.6;
  const dist = 165 * (1 - Math.exp(-a / 15)) + 0.7 * a;
  const spread = 6.5 * Math.sqrt(a);
  out[0] = MOUTH[0] + 16 + Math.cos(ang) * dist + (hash01(j, 903) - 0.5) * 2 * spread;
  out[1] = MOUTH[1] - 8 + Math.sin(ang) * dist + (hash01(j, 904) - 0.5) * 2 * spread + 0.03 * a * a;
  out[2] = (hash01(j, 905) - 0.5) * 2 * spread;
}

/** Visit the live exhale particles at frame f: cb(X, H, Z, age 0..1, weight, j). trailF = earlier frame for a trail. */
export function forExhale(f: number, cb: (p: Float32Array, q: number, w: number, j: number, prev: Float32Array | null) => void, trailF?: number) {
  const s = flowTime(f);
  if (s <= 0) return;
  const sT = trailF !== undefined ? flowTime(trailF) : s;
  const p = new Float32Array(3);
  const pp = new Float32Array(3);
  const j1 = Math.floor(s / DS);
  const j0 = Math.max(0, Math.ceil((s - EX_LIFE) / DS));
  for (let j = j0; j <= j1; j++) {
    const sb = j * DS;
    const w = exhaleRate(sb);
    if (w < 0.04 || hash01(j, 901) > w) continue;
    const a = s - sb;
    exPos(j, a, p);
    let prev: Float32Array | null = null;
    if (sT < s) {
      exPos(j, Math.max(0, sT - sb), pp);
      prev = pp;
    }
    cb(p, a / EX_LIFE, w, j, prev);
  }
}

/** The exhale in the flow view: CO₂ · H₂O leaving the mouth as a spreading puff of red-orange streaks. */
export function drawExhale(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.01) return;
  const LV = 4;
  const P = Array.from({ length: LV }, () => new Path2D());
  const a0 = new Float32Array(3);
  const a1 = new Float32Array(3);
  forExhale(
    f,
    (p, q, w, j, prev) => {
      if (!project(cam, p[0], p[1], p[2], a0, 0)) return;
      const inten = w * (1 - q) * (1 - q) * (0.6 + 0.4 * hash01(j, 906));
      const lv = Math.min(LV - 1, Math.floor(inten * LV));
      if (inten < 0.05) return;
      if (prev && project(cam, prev[0], prev[1], prev[2], a1, 0)) {
        P[lv].moveTo(a1[0], a1[1]);
        P[lv].lineTo(a0[0], a0[1]);
      } else P[lv].rect(a0[0] - 1, a0[1] - 1, 2, 2);
    },
    f - 3,
  );
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let l = 0; l < LV; l++) {
    const k = (l + 0.5) / LV;
    ctx.strokeStyle = `rgba(255,106,77,${(0.75 * k * alpha).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.stroke(P[l]);
  }
  ctx.restore();
}
