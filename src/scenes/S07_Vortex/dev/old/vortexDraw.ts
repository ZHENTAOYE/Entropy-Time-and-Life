// Drawing of the whirlpool (top view → tilt): water particles, gold feeder arms, census tagging, the tracer,
// S06's leftovers (sink glow, red sparks) at the very start.
import { clamp, ease, seg, smoothstep } from '../../../../lib/math';
import { hash01 } from '../../../../lib/random';
import { Cam, project } from './camera';
import { hex, mixArr, rgbaArr, Strokes } from './gfx';
import { T } from './timing';
import { N_IN, NV, TRACER, tracerPos, V, vCycle, vFade, vOriginal, vparts, vPos, vBirth } from './vortex';

const LV = 5; // intensity levels per class
/** feeding pulses along the arms during 「生命以“负熵”为食」 */
const FEED_PULSES = [104, 118, 132, 146];
const C_WATER = 0;
const C_ARM = 1; // 1..6 radial bins
const C_TAG = 7;
const C_OUTER = 8;
const C_NEW = 9;
const C_PULSE = 10;
const NCLS = 11;

const S06_LIFE = ['#FFC94A', '#FFD86A', '#D9E46A', '#9EE06A', '#45CF9C', '#2CC5A6'].map(hex);
const ARM_GOLD = ['#FFB12E', '#FFC94A', '#FFD772', '#FFE29A', '#FFEBC0', '#FFF6E2'].map(hex);
const WATER_LO = hex('#1FB5C9');
const WATER_HI = hex('#BDF4FF');
const TAG_COL = hex('#F6FEFF');
const NEW_COL = hex('#138A9C');
const OUT_COL = hex('#4FB7C4');
const PULSE_COL = hex('#FFF3CF');

const tmp = new Float32Array(4);
const pr = new Float32Array(3);
const poly = new Float32Array(32);

/** arm colour bin by radius: far = deep gold … core = white-gold */
const armBin = (r: number) => C_ARM + clamp(Math.floor((1 - (r - 60) / 760) * 6), 0, 5);

export interface VortexOpts {
  alpha: number;
  /** particles handed over to the body module (morph started) */
  skip?: (i: number) => boolean;
  /** particles with index ≥ poolFrom are the leftover pool */
  poolFrom: number;
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
  return [rgbaArr(OUT_COL, 0.08 + 0.3 * a), 1.2];
}

export function drawVortex(ctx: CanvasRenderingContext2D, f: number, cam: Cam, o: VortexOpts) {
  if (o.alpha <= 0.003) return;
  const P = vparts();
  const S = new Strokes(NCLS * LV);
  const water = ease.inOutSine(seg(f, T.waterIn0, T.waterIn1)); // water floods in from the rim
  const censusOn = f >= T.tag;
  const dt = o.trail;
  // a tilted disc packs the same light into fewer pixels: compensate, and let the far arms go
  const fore = Math.pow(Math.max(0.15, cam.sp), 0.9);
  const tiltK = 1 - cam.sp; // 0 top view … ~0.8 side view
  for (let i = 0; i < NV; i++) {
    if (o.skip && o.skip(i)) continue;
    const outer = P.outer[i] === 1;
    const isArm = P.arm[i] >= 0;
    let pulse = 0;
    const [c, tau] = vCycle(P, i, f);
    vPos(P, i, c, tau, tmp);
    const r = tmp[3];
    let inten = vFade(P, i, tau, r);
    if (inten <= 0.01) continue;
    // S06 → water: arms exist from frame 0, the water floods in from the rim
    if (!isArm) {
      const reach = water * 1.35 - (1 - r / V.R0);
      inten *= clamp(reach / 0.35);
      if (inten <= 0.01) continue;
    }
    if (!outer && !isArm) inten *= 0.32 + 0.68 * Math.pow(smoothstep(V.R0 * 1.02, 50, r), 1.1);
    if (isArm) {
      inten *= (0.55 + 0.45 * smoothstep(900, 200, r)) * (1 - tiltK * smoothstep(300, 700, r));
      // 「以“负熵”为食」: pulses of free energy race inward along the feeder arms
      for (const tp of FEED_PULSES) {
        const a = (f - tp) / 34;
        if (a < 0 || a > 1) continue;
        const rp = 920 - 860 * a * a;
        pulse = Math.max(pulse, Math.exp(-(((r - rp) / 55) ** 2)) * Math.sin(Math.PI * Math.min(1, a * 1.25)));
      }
    }
    inten *= fore;
    inten *= (0.7 + 0.6 * P.br[i]) * o.alpha * (i >= o.poolFrom ? o.poolAlpha : 1);
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
    if (!project(cam, tmp[0], tmp[1], tmp[2], pr, 0)) continue;
    // adaptive trail: slow arm streams get long filaments, the fast core gets finely sampled arcs
    const trail = isArm ? dt * 2.2 : dt;
    const t0 = Math.max(0, tau - trail);
    const rr = Math.max(r, V.rc);
    const dTheta = (Math.abs(V.k) * P.q[i] * (tau - t0)) / (2 * rr * rr);
    const n = Math.min(9, Math.max(2, Math.ceil(dTheta / 0.3) + 1));
    poly[0] = pr[0];
    poly[1] = pr[1];
    for (let j = 1; j < n; j++) {
      vPos(P, i, c, tau - ((tau - t0) * j) / (n - 1), tmp);
      project(cam, tmp[0], tmp[1], tmp[2], poly, j * 2);
    }
    // energy-conserving motion blur: a long fast streak spreads the same light over more pixels
    const len = Math.abs(poly[0] - poly[(n - 1) * 2]) + Math.abs(poly[1] - poly[(n - 1) * 2 + 1]);
    inten *= Math.min(1, Math.max(0.16, (isArm ? 22 : 11) / (len + 1)));
    const lvl = Math.min(LV - 1, Math.floor(clamp(inten) * LV));
    if (inten < 0.03) continue;
    S.poly(cls * LV + lvl, poly, n);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  for (let b = 0; b < NCLS * LV; b++) {
    if (!S.used[b]) continue;
    const [st, w] = bucketStyle(b, f);
    S.stroke(ctx, b, st, w * Math.max(0.6, cam.zoom));
  }
  ctx.restore();
}

/** The drain: dark eye + glowing rim of the Rankine core (and S06's bright sink fading out at the start). */
export function drawEye(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.003) return;
  if (!project(cam, 0, -V.Hf * 0.55, 0, pr, 0)) return;
  const cx = pr[0];
  const cy = pr[1];
  const k = pr[2];
  const sy = Math.max(0.05, cam.sp);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cam.roll);
  ctx.scale(1, sy);
  // dark throat
  const R = V.rc * 1.25 * k;
  let g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(0,4,6,${0.92 * alpha})`);
  g.addColorStop(0.55, `rgba(0,8,10,${0.7 * alpha})`);
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
  g.addColorStop(0.45, `rgba(150,240,250,${0.22 * alpha})`);
  g.addColorStop(1, 'rgba(120,230,240,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rr * 1.4, 0, Math.PI * 2);
  ctx.fill();
  // S06's sink — a white-gold core with green/teal glow, fading as it becomes the drain
  const s06 = 1 - ease.inOutSine(seg(f, 0, 40));
  if (s06 > 0.01) {
    const pulse = 0.85 + 0.15 * Math.sin(f * 0.3);
    for (const [Rg, a] of [
      [75, 1],
      [150, 0.55],
    ] as const) {
      const RR = Rg * k;
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, RR);
      g.addColorStop(0, `rgba(255,250,220,${0.9 * s06 * pulse * a})`);
      g.addColorStop(0.25, `rgba(158,224,106,${0.5 * s06 * a})`);
      g.addColorStop(0.6, `rgba(44,197,166,${0.2 * s06 * a})`);
      g.addColorStop(1, 'rgba(44,197,166,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, RR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** S06's red infrared sparks, still flying outward at the cut; none are born after ~f30. */
export function drawS06Sparks(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  if (f > 70) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const hot = new Path2D();
  const dim = new Path2D();
  const life = 34;
  for (let j = 0; j < 90; j++) {
    const per = 14 + Math.floor(hash01(j, 3) * 18);
    const ph = Math.floor(hash01(j, 4) * per);
    for (let gen = 0; gen < 2; gen++) {
      const born = Math.floor((f + ph) / per) * per - ph - gen * per;
      if (born > 30) continue;
      const age = f - born;
      if (age < 0 || age > life) continue;
      const sd = j * 131 + born;
      const r0 = 70 + hash01(sd, 5) * 330;
      const a0 = hash01(sd, 6) * Math.PI * 2;
      const ra = a0 + (hash01(sd, 7) - 0.5) * 1.4;
      const sp = 1.8 + hash01(sd, 8) * 2.4;
      const d = sp * age * (1 - age / (life * 2.6));
      const X0 = Math.cos(a0) * r0;
      const Z0 = Math.sin(a0) * r0;
      const X = X0 + Math.cos(ra) * d;
      const Z = Z0 + Math.sin(ra) * d;
      const tail = Math.max(0, d - 8);
      if (!project(cam, X, 0, Z, pr, 0)) continue;
      const x1 = pr[0];
      const y1 = pr[1];
      project(cam, X0 + Math.cos(ra) * tail, 0, Z0 + Math.sin(ra) * tail, pr, 0);
      const k = 1 - age / life;
      (k > 0.5 ? hot : dim).moveTo(pr[0], pr[1]);
      (k > 0.5 ? hot : dim).lineTo(x1, y1);
    }
  }
  const fade = 1 - smoothstep(30, 70, f);
  ctx.strokeStyle = `rgba(255,80,60,${0.9 * fade})`;
  ctx.lineWidth = 1.8;
  ctx.stroke(hot);
  ctx.strokeStyle = `rgba(200,40,40,${0.55 * fade})`;
  ctx.lineWidth = 1.4;
  ctx.stroke(dim);
  ctx.restore();
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
    for (let s = 0; s <= tEnd + 1e-6; s += 0.35) {
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

/** Census: the sonar tag pulse (f216) and the fixed dashed outline of the shape. */
export function drawCensus(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  const on = seg(f, T.tag - 4, T.tag + 6) * (1 - seg(f, T.tilt1a - 6, T.tilt1a + 10));
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
  // the shape: a dashed outline that does not change
  const sh = ease.inOutSine(seg(f, T.tag + 12, T.tag + 30));
  if (sh > 0.01) {
    ctx.setLineDash([10, 9]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = `rgba(243,239,230,${0.42 * sh * on})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, (V.R0 + 18) * k, (V.R0 + 18) * k * sy, cam.roll, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // tick marks at 4 compass points
    ctx.strokeStyle = `rgba(243,239,230,${0.55 * sh * on})`;
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2;
      const r0 = (V.R0 + 8) * k;
      const r1 = (V.R0 + 30) * k;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * sy);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * sy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export { N_IN };
