// Drawing of the whirlpool (top view → tilt): water particles, gold feeder arms, census tagging, the tracer, the eye.
// S06's last image (s06.ts) is drawn over it at the cut and handed over to it during f0–40.
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { Cam, project } from './camera';
import { hex, mixArr, rgbaArr, Strokes } from './gfx';
import { drawS06Sink } from './s06';
import { T } from './timing';
import {
  censusZero,
  N_IN,
  NV,
  TRACER,
  tracerPos,
  V,
  vBirth,
  vCycle,
  vFade,
  vOriginal,
  vparts,
  vPos,
  vRate,
  vTime,
} from './vortex';

const LV = 5; // intensity levels per class
/** feeding pulses along the arms during 「生命以“负熵”为食」 */
export const FEED_PULSES = [104, 118, 132, 146];
const C_WATER = 0;
const C_ARM = 1; // 1..6 radial bins
const C_TAG = 7;
const C_OUTER = 8;
const C_NEW = 9;
const C_PULSE = 10;
const NCLS = 11;

// S06's LIFE ramp at the radii of the 6 arm bins (S06: b = ⌊(1 − (r − 40)/560)·8⌋)
const S06_LIFE = ['#FFC94A', '#FFC94A', '#FFD86A', '#9EE06A', '#45CF9C', '#2CC5A6'].map(hex);
const ARM_GOLD = ['#FFB12E', '#FFC94A', '#FFD772', '#FFE29A', '#FFEBC0', '#FFF6E2'].map(hex);
const WATER_LO = hex('#1FB5C9');
const WATER_HI = hex('#BDF4FF');
const TAG_COL = hex('#F6FEFF');
const NEW_COL = hex('#138A9C');
const OUT_COL = hex('#4FB7C4');
const OUT_S06 = hex('#FFD86A');
const PULSE_COL = hex('#FFF3CF');

const tmp = new Float32Array(5);
const pr = new Float32Array(3);
const poly = new Float32Array(32);

/** arm colour bin by radius: far = deep gold … core = white-gold */
const armBin = (r: number) => C_ARM + clamp(Math.floor((1 - (r - 60) / 760) * 6), 0, 5);

export interface VortexOpts {
  alpha: number;
  /** particles handed over to the body module (morph started) */
  skip?: (i: number) => boolean;
  /** particles that stay in the leftover pool (not taken by the body) */
  isPool?: (i: number) => boolean;
  /** extra fade of the leftover pool */
  poolAlpha: number;
  /** trail length in frames */
  trail: number;
}

/** colour for the vortex particle classes at frame f (bucket b) */
function bucketStyle(b: number, f: number): [string, number] {
  const cls = Math.floor(b / LV);
  const lvl = (b % LV) + 0.5;
  const a = lvl / LV;
  const m06 = 1 - smoothstep(0, 46, f);
  if (cls === C_WATER) return [rgbaArr(mixArr(WATER_LO, WATER_HI, a * a), 0.07 + 0.5 * a), 1.4];
  if (cls >= C_ARM && cls < C_ARM + 6) {
    const k = cls - C_ARM;
    const c = mixArr(ARM_GOLD[k], S06_LIFE[k], m06);
    return [rgbaArr(c, 0.12 + 0.7 * a), 1.7];
  }
  if (cls === C_TAG) return [rgbaArr(TAG_COL, 0.12 + 0.6 * a), 1.6];
  if (cls === C_NEW) return [rgbaArr(NEW_COL, 0.08 + 0.45 * a), 1.4];
  if (cls === C_PULSE) return [rgbaArr(PULSE_COL, 0.3 + 0.7 * a), 2.2];
  return [rgbaArr(mixArr(OUT_COL, OUT_S06, m06), 0.08 + 0.3 * a), 1.2];
}

/** max angle (rad) a trail may sweep: in the fast Rankine core a fixed-time trail would wrap into a polygon */
const MAX_SWEEP = 0.8;
/** max angle per polyline chord */
const CHORD = 0.16;

export function drawVortex(ctx: CanvasRenderingContext2D, f: number, cam: Cam, o: VortexOpts) {
  if (o.alpha <= 0.003) return;
  const P = vparts();
  const S = new Strokes(NCLS * LV);
  const water = ease.inOutSine(seg(f, T.waterIn0, T.waterIn1)); // water floods in from the rim
  const censusOn = f >= T.tag;
  const dt = o.trail;
  // at the cut S06's own last image (s06.ts) carries the picture; the whirlpool's particles fade in under it
  const armIn = smoothstep(2, 26, f);
  const outIn = smoothstep(6, 34, f);
  // a tilted disc packs the same light into fewer pixels: compensate, and let the far arms go
  const fore = Math.pow(Math.max(0.15, cam.sp), 0.9);
  // flow time (S06's inflow speed at the cut) — the arm pattern keeps turning in real time
  const vt = vTime(f);
  const rate = vRate(f);
  const rot = V.Om * (f - vt);
  const maxSweep = MAX_SWEEP;
  const tiltK = 1 - cam.sp; // 0 top view … ~0.8 side view
  for (let i = 0; i < NV; i++) {
    if (o.skip && o.skip(i)) continue;
    const outer = P.outer[i] === 1;
    const isArm = P.arm[i] >= 0;
    let pulse = 0;
    const [c, tau] = vCycle(P, i, vt);
    const r = Math.sqrt(Math.max(0, P.R[i] * P.R[i] - P.q[i] * tau));
    let inten = vFade(P, i, tau, Math.max(r, outer ? V.rOutEnd : V.rEye));
    if (inten <= 0.01) continue;
    // S06 → water: arms exist from frame 0, the water floods in from the rim
    if (!isArm) {
      if (outer) inten *= outIn;
      else {
        const reach = water * 1.35 - (1 - r / V.R0);
        inten *= clamp(reach / 0.35);
      }
      if (inten <= 0.01) continue;
    }
    if (!outer && !isArm) inten *= 0.32 + 0.68 * Math.pow(smoothstep(V.R0 * 1.02, 50, r), 1.1);
    if (isArm) {
      inten *= (0.55 + 0.45 * smoothstep(900, 200, r)) * (1 - tiltK * smoothstep(300, 700, r)) * armIn;
      // 「以“负熵”为食」: pulses of free energy race inward along the feeder arms
      for (const tp of FEED_PULSES) {
        const a = (f - tp) / 34;
        if (a < 0 || a > 1) continue;
        const rp = 920 - 860 * a * a;
        pulse = Math.max(pulse, Math.exp(-(((r - rp) / 55) ** 2)) * Math.sin(Math.PI * Math.min(1, a * 1.25)));
      }
    }
    inten *= fore;
    inten *= (0.7 + 0.6 * P.br[i]) * o.alpha * (o.isPool && o.isPool(i) ? o.poolAlpha : 1);
    let cls: number;
    if (outer) cls = C_OUTER;
    else if (censusOn && vOriginal(P, i, c)) {
      // tag pulse expands from the eye to the rim in 10 frames
      const bth = vBirth(P, i, c);
      const rTag = Math.sqrt(Math.max(0, P.R[i] * P.R[i] - P.q[i] * (T.tag - bth)));
      cls = f >= T.tag + 10 * (rTag / V.R0) ? C_TAG : isArm ? armBin(r) : C_WATER;
    } else if (isArm) cls = armBin(r);
    else cls = censusOn ? C_NEW : C_WATER;
    if (cls === C_TAG) inten = Math.min(1, inten * 1.2 + 0.08);
    if (pulse > 0.3 && cls !== C_TAG) {
      cls = C_PULSE;
      inten = Math.min(1, inten + pulse * 0.8);
    }
    if (inten < 0.04) continue;
    vPos(P, i, c, tau, tmp, rot);
    if (!project(cam, tmp[0], tmp[1], tmp[2], pr, 0)) continue;
    // trail: by time (slow arm streams get long filaments) but capped by the angle it sweeps, and sampled finely
    // enough that every chord stays ≤ 0.12 rad — the fast core draws true arcs, never polygons
    let trail = Math.min(tau, (isArm ? dt * 2.2 : dt) * rate);
    // closed form: angular speed of the spiral sink ω = |k|·q / 2r² (solid body inside the core)
    const rr = Math.max(r, V.rc);
    let sweep = (Math.abs(V.k) * P.q[i] * trail) / (2 * rr * rr);
    if (sweep > maxSweep) {
      trail *= maxSweep / sweep;
      sweep = maxSweep;
    }
    const n = Math.min(10, Math.max(2, Math.ceil(sweep / CHORD) + 1));
    poly[0] = pr[0];
    poly[1] = pr[1];
    let len = 0;
    let ok = true;
    for (let j = 1; j < n; j++) {
      vPos(P, i, c, tau - (trail * j) / (n - 1), tmp, rot);
      if (!project(cam, tmp[0], tmp[1], tmp[2], poly, j * 2)) {
        ok = false;
        break;
      }
      len += Math.hypot(poly[j * 2] - poly[j * 2 - 2], poly[j * 2 + 1] - poly[j * 2 - 1]);
    }
    if (!ok) continue;
    // energy-conserving motion blur: a long fast streak spreads the same light over more pixels
    inten *= Math.min(1, Math.max(0.16, (isArm ? 22 : 11) / (len + 1)));
    if (inten < 0.03) continue;
    const lvl = Math.min(LV - 1, Math.floor(clamp(inten) * LV));
    S.poly(cls * LV + lvl, poly, n);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter'; // chords turn by ≤ 0.16 rad: miter joins are invisible and far cheaper than round ones
  for (let b = 0; b < NCLS * LV; b++) {
    if (!S.used[b]) continue;
    const [st, w] = bucketStyle(b, f);
    S.stroke(ctx, b, st, w * Math.max(0.6, cam.zoom));
  }
  ctx.restore();
}

/** The drain: dark eye + glowing rim of the Rankine core (S06's bright sink hands over to it during f4–40). */
export function drawEye(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.003) return;
  if (!project(cam, 0, -V.Hf * 0.55, 0, pr, 0)) return;
  const cx = pr[0];
  const cy = pr[1];
  const k = pr[2];
  const sy = Math.max(0.05, cam.sp);
  // S06 had no drain: the throat opens under S06's fading sink
  const throat = alpha * smoothstep(4, 40, f);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cam.roll);
  ctx.scale(1, sy);
  let g: CanvasGradient;
  if (throat > 0.003) {
    const R = V.rc * 1.25 * k;
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(0,4,6,${0.92 * throat})`);
    g.addColorStop(0.55, `rgba(0,8,10,${0.7 * throat})`);
    g.addColorStop(1, 'rgba(0,8,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    // rim light of the core (thin, additive)
    ctx.globalCompositeOperation = 'lighter';
    const rr = V.rc * 1.02 * k;
    g = ctx.createRadialGradient(0, 0, rr * 0.75, 0, 0, rr * 1.35);
    g.addColorStop(0, 'rgba(120,230,240,0)');
    g.addColorStop(0.45, `rgba(150,240,250,${0.22 * throat})`);
    g.addColorStop(1, 'rgba(120,230,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // S06's sink (exactly S06's last frame), fading as it becomes the drain
  drawS06Sink(ctx, f, cam, 1 - ease.inOutSine(seg(f, 4, 40)));
}

/** Screen position of the tracer (for the HUD label); null when not alive. */
export function tracerScreen(f: number, cam: Cam): [number, number, number] | null {
  const tau = f - T.tracerBirth;
  if (tau < 0 || tau > TRACER.L) return null;
  tracerPos(tau, tmp);
  if (!project(cam, tmp[0], tmp[1], tmp[2], pr, 0)) return null;
  return [pr[0], pr[1], tau];
}

/** The gold tracer: comet head, its complete path (persisting after it leaves), the exit flash. */
export function drawTracer(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  const tau = f - T.tracerBirth;
  if (tau < -2) return;
  const after = tau - TRACER.L; // > 0 once drained
  const pathA = after > 0 ? 1 - smoothstep(4, 40, after) : 1;
  if (pathA <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tEnd = Math.min(tau, TRACER.L);
  // full path so far
  if (tEnd > 0) {
    ctx.beginPath();
    let first = true;
    for (let s = 0; s <= tEnd + 1e-6; s += 0.25) {
      tracerPos(Math.min(s, tEnd), tmp);
      if (!project(cam, tmp[0], tmp[1], tmp[2], pr, 0)) continue;
      if (first) ctx.moveTo(pr[0], pr[1]);
      else ctx.lineTo(pr[0], pr[1]);
      first = false;
    }
    ctx.strokeStyle = `rgba(255,201,74,${0.42 * pathA})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,201,74,${0.12 * pathA})`;
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  if (tau >= 0 && tau <= TRACER.L) {
    // comet tail (last ~7 frames), thick → thin
    const N = 14;
    for (let j = N; j >= 1; j--) {
      const s0 = Math.max(0, tau - (j / N) * 7);
      const s1 = Math.max(0, tau - ((j - 1) / N) * 7);
      tracerPos(s0, tmp);
      project(cam, tmp[0], tmp[1], tmp[2], pr, 0);
      const ax = pr[0];
      const ay = pr[1];
      tracerPos(s1, tmp);
      project(cam, tmp[0], tmp[1], tmp[2], pr, 0);
      ctx.strokeStyle = `rgba(255,${200 + 40 * (1 - j / N)},${120 + 100 * (1 - j / N)},${0.9 * (1 - j / N) + 0.1})`;
      ctx.lineWidth = 1 + 6 * (1 - j / N);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(pr[0], pr[1]);
      ctx.stroke();
    }
    tracerPos(tau, tmp);
    project(cam, tmp[0], tmp[1], tmp[2], pr, 0);
    const drain = smoothstep(TRACER.L - 6, TRACER.L, tau);
    const R = 26 * (1 - 0.6 * drain);
    const g = ctx.createRadialGradient(pr[0], pr[1], 0, pr[0], pr[1], R);
    g.addColorStop(0, `rgba(255,252,235,${1 - 0.5 * drain})`);
    g.addColorStop(0.2, `rgba(255,214,110,${0.8 * (1 - drain)})`);
    g.addColorStop(1, 'rgba(255,170,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pr[0], pr[1], R, 0, Math.PI * 2);
    ctx.fill();
  }
  // exit flash: a gold ring expanding from the eye as it leaves
  if (after > -1 && after < 22) {
    const q = clamp(after / 22);
    project(cam, 0, -V.Hf * 0.6, 0, pr, 0);
    ctx.strokeStyle = `rgba(255,214,120,${0.7 * (1 - q)})`;
    ctx.lineWidth = 2.5 * (1 - q) + 0.5;
    ctx.beginPath();
    ctx.ellipse(pr[0], pr[1], (20 + 120 * ease.outCubic(q)) * pr[2], (20 + 120 * ease.outCubic(q)) * pr[2] * Math.max(0.05, cam.sp), cam.roll, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** 0..1 flash when the census reaches 0 % (the shape outline and its label light up, then settle brighter) */
export function zeroFlash(f: number): [number, number] {
  const z = censusZero();
  if (f < z) return [0, 0];
  return [Math.exp(-(f - z) / 9), smoothstep(z, z + 6, f)];
}

/** Census: the sonar tag pulse (f210) and the fixed dashed outline of the shape. */
export function drawCensus(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  const on = seg(f, T.tag - 4, T.tag + 6) * (1 - seg(f, T.censusOut - 12, T.censusOut));
  if (on <= 0.01) return;
  project(cam, 0, 0, 0, pr, 0);
  const cx = pr[0];
  const cy = pr[1];
  const k = pr[2];
  const sy = Math.max(0.05, cam.sp);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // pulse ring
  const pa = f - T.tag;
  if (pa >= 0 && pa < 18) {
    const q = pa / 18;
    const R = (40 + (V.R0 + 30) * ease.outCubic(Math.min(1, pa / 10))) * k;
    ctx.strokeStyle = `rgba(240,255,255,${0.75 * (1 - q)})`;
    ctx.lineWidth = 3 + 10 * (1 - q);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * sy, cam.roll, 0, Math.PI * 2);
    ctx.stroke();
  }
  // the shape: a dashed outline that does not change (it flashes when the last original drop has left)
  const sh = ease.inOutSine(seg(f, T.tag + 12, T.tag + 30));
  const [zf, zh] = zeroFlash(f);
  if (sh > 0.01) {
    const RR = (V.R0 + 18) * k;
    if (zf > 0.01) {
      ctx.strokeStyle = `rgba(243,239,230,${0.35 * zf * on})`;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.ellipse(cx, cy, RR, RR * sy, cam.roll, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([10, 9]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = `rgba(243,239,230,${Math.min(1, (0.42 + 0.22 * zh + 0.5 * zf) * sh * on)})`;
    ctx.lineWidth = 1.5 + 1.2 * zf;
    ctx.beginPath();
    ctx.ellipse(cx, cy, RR, RR * sy, cam.roll, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // tick marks at 4 compass points
    ctx.strokeStyle = `rgba(243,239,230,${Math.min(1, (0.55 + 0.3 * zh) * sh * on)})`;
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2;
      const r0 = (V.R0 + 8) * k;
      const r1 = (V.R0 + 30) * k;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      // rotate the tick with the camera roll and squash with the tilt (same frame as the ellipse)
      const ex = (rx: number, ry: number): [number, number] => [cx + rx * Math.cos(cam.roll) - ry * sy * Math.sin(cam.roll), cy + rx * Math.sin(cam.roll) + ry * sy * Math.cos(cam.roll)];
      const [ax, ay] = ex(ca * r0, sa * r0);
      const [bx, by] = ex(ca * r1, sa * r1);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export { N_IN };
