// Drawing of the whirlpool (top view → tilt): water particles, gold feeder arms, census tagging, the tracer,
// and S06's last image at the cut (the 7-leaf vein rosette, its red IR sparks, its gold inflow, its sink), which the
// flow winds up into the whirlpool over f0–46.
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { Cam, project } from './camera';
import { hex, mixArr, rgbaArr, Strokes } from './gfx';
import { g06, K06, pull06, rosette06, S06_LAST, spin06 } from './s06';
import { T } from './timing';
import {
  armExtent,
  censusZero,
  leafDelta,
  leafPoint,
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
  wOpen,
  kAt,
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

const S06_LIFE = ['#FFC94A', '#FFD86A', '#D9E46A', '#9EE06A', '#45CF9C', '#2CC5A6'].map(hex);
const ARM_GOLD = ['#FFB12E', '#FFC94A', '#FFD772', '#FFE29A', '#FFEBC0', '#FFF6E2'].map(hex);
const WATER_LO = hex('#1FB5C9');
const WATER_HI = hex('#BDF4FF');
const TAG_COL = hex('#F6FEFF');
const NEW_COL = hex('#138A9C');
const OUT_COL = hex('#4FB7C4');
const OUT_S06 = hex('#D9D86A');
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
  // at the cut S06's own rosette carries the image; the whirlpool's particles fade in on top of it
  const armIn = smoothstep(2, 26, f);
  const outIn = smoothstep(6, 34, f);
  const ext = f < 44 ? Array.from({ length: V.NA }, (_, a) => armExtent(a, f)) : null;
  // a tilted disc packs the same light into fewer pixels: compensate, and let the far arms go
  const fore = Math.pow(Math.max(0.15, cam.sp), 0.9);
  // while S06's rosette spins up (f0–46) the trails stay short, or the fast wind-up smears arms into fans
  const wo = wOpen(f);
  const kOut = kAt(f, true);
  const maxSweep = 0.1 + (MAX_SWEEP - 0.1) * wo * wo * wo;
  const tiltK = 1 - cam.sp; // 0 top view … ~0.8 side view
  for (let i = 0; i < NV; i++) {
    if (o.skip && o.skip(i)) continue;
    const outer = P.outer[i] === 1;
    const isArm = P.arm[i] >= 0;
    let pulse = 0;
    const [c, tau] = vCycle(P, i, f);
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
      inten *= (0.55 + 0.45 * smoothstep(900, 200, r)) * (1 - tiltK * smoothstep(300, 700, r));
      if (ext) inten *= armIn * smoothstep(ext[P.arm[i]] + 40, ext[P.arm[i]] - 40, r);
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
    vPos(P, i, c, tau, tmp);
    if (!project(cam, tmp[0], tmp[1], tmp[2], pr, 0)) continue;
    const th1 = tmp[4];
    // trail: by time (slow arm streams get long filaments) but capped by the angle it sweeps, and sampled finely
    // enough that every chord stays ≤ 0.12 rad — the fast core draws true arcs, never polygons
    let trail = Math.min(tau, isArm ? dt * 2.2 : dt);
    let sweep: number;
    if (wo >= 1) {
      // closed form: angular speed of the spiral sink ω = |k|·q / 2r² (solid body inside the core)
      const rr = Math.max(r, V.rc);
      sweep = (Math.abs(outer ? kOut : V.k) * P.q[i] * trail) / (2 * rr * rr);
    } else {
      vPos(P, i, c, tau - trail, tmp);
      sweep = Math.abs(th1 - tmp[4]);
    }
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
      vPos(P, i, c, tau - (trail * j) / (n - 1), tmp);
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

/** The drain: dark eye + glowing rim of the Rankine core (and S06's bright sink fading out at the start). */
export function drawEye(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.003) return;
  if (!project(cam, 0, -V.Hf * 0.55 * wOpen(f), 0, pr, 0)) return;
  const cx = pr[0];
  const cy = pr[1];
  const k = pr[2];
  const sy = Math.max(0.05, cam.sp);
  // S06 had no drain: the throat opens as the whirlpool spins up
  const throat = alpha * smoothstep(10, 42, f);
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
  // S06's sink (same gradient, size and pulse as S06's last frame), fading as it becomes the drain
  const s06 = 1 - ease.inOutSine(seg(f, 2, 40));
  if (s06 > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.85 + 0.15 * Math.sin((S06_LAST + f) * 0.3);
    for (const [Rg, a] of [
      [58, 0.5],
      [120, 0.34],
    ] as const) {
      const RR = Rg * k;
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, RR);
      g.addColorStop(0, `rgba(255,250,220,${0.85 * s06 * pulse * a})`);
      g.addColorStop(0.18, `rgba(255,236,170,${0.55 * s06 * a})`);
      g.addColorStop(0.4, `rgba(158,224,106,${0.35 * s06 * a})`);
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

// ------------------------------------------------------------------ S06's last image, carried into the whirlpool
const LIME = [158, 224, 107];
const GOLD = [255, 201, 74];
const TEAL = [44, 197, 166];
/** S06's colour of life along a vein: d = 0 root … 1 tips */
const life = (d: number) => (d > 0.5 ? mixArr(LIME, GOLD, (d - 0.5) * 2) : mixArr(TEAL, LIME, d * 2));
const pulse06 = (x: number) => {
  const p = x - Math.floor(x);
  return p < 0.62 ? 0 : Math.pow(1 - (p - 0.62) / 0.38, 1.6);
};

/** S06's leaf rosette: translucent blades, the vein trees (Murray widths) and the light pulses flowing to the sink. */
export function drawS06Leaves(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  const veinA = 1 - smoothstep(4, 32, f);
  const bladeA = 1 - smoothstep(0, 24, f);
  if (veinA <= 0.004) return;
  const R = rosette06();
  const p4 = new Float32Array(4);
  const fr = S06_LAST + f;
  const acc = 2.3; // S06's pulse speed factor at its end
  const DMAXPX = 6 * R.dmax; // S06 measures distance along the veins in px (depth × step)
  ctx.save();
  // ---- blades
  if (bladeA > 0.004) {
    const blades = new Path2D();
    for (let a = 0; a < R.leaves.length; a++) {
      const L = R.leaves[a];
      for (let j = 0; j < L.oRho.length; j++) {
        leafPoint(a, L.oRho[j], L.oAlpha[j], f, p4);
        project(cam, p4[0], p4[1], p4[2], pr, 0);
        if (j === 0) blades.moveTo(pr[0], pr[1]);
        else blades.lineTo(pr[0], pr[1]);
      }
      blades.closePath();
    }
    ctx.fillStyle = `rgba(10,38,22,${0.3 * bladeA})`;
    ctx.fill(blades);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(158,224,106,${0.1 * bladeA})`;
    ctx.lineWidth = 1.3;
    ctx.stroke(blades);
  }
  // ---- veins (bucketed by Murray width × colour band) and pulses
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';
  const WB = 5;
  const DB = 4;
  const V0 = new Strokes(WB * DB);
  const PU = new Strokes(DB * 2);
  for (let a = 0; a < R.leaves.length; a++) {
    const L = R.leaves[a];
    const n = L.rho.length;
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      leafPoint(a, L.rho[i], L.alpha[i], f, p4);
      project(cam, p4[0], p4[1], p4[2], pr, 0);
      sx[i] = pr[0];
      sy[i] = pr[1];
    }
    for (let i = 0; i < n; i++) {
      const p = L.parent[i];
      if (p < 0) continue;
      const d = L.dist[i];
      const wb = Math.max(0, Math.min(WB - 1, Math.floor(Math.log2(L.rad[i]) * 1.1)));
      const db = Math.min(DB - 1, Math.floor(d * DB));
      V0.seg(wb * DB + db, sx[p], sy[p], sx[i], sy[i]);
      const dpx = d * DMAXPX;
      const fl = Math.max(pulse06((dpx + fr * 3.4 * acc) / 46), 0.55 * pulse06((dpx + fr * 4.6 * acc) / 71 + 0.37));
      if (fl > 0.25) PU.seg(db * 2 + (fl > 0.6 ? 1 : 0), sx[p], sy[p], sx[i], sy[i]);
    }
  }
  for (let wb = 0; wb < WB; wb++)
    for (let db = 0; db < DB; db++) {
      const d = (db + 0.5) / DB;
      // S06: base = mix(gold, lime, 0.55 + 0.45·(1 − d)) at ~0.5 intensity
      const base = mixArr(GOLD, LIME, 0.55 + 0.45 * (1 - d));
      V0.stroke(ctx, wb * DB + db, rgbaArr(base, (0.28 + wb * 0.07) * veinA), 0.75 + wb * 0.62);
    }
  for (let db = 0; db < DB; db++)
    for (let h = 0; h < 2; h++) PU.stroke(ctx, db * 2 + h, rgbaArr(life((db + 0.5) / DB), (h ? 0.95 : 0.5) * veinA), 1.6 + h * 0.6);
  // sunlight still landing on the vein tips (S06: perspective streaks, then a pale flash), same periods and seeds
  const landA = 1 - smoothstep(2, 22, f);
  if (landA > 0.01) {
    project(cam, 0, 0, 0, pr, 0);
    const cx = pr[0];
    const cy = pr[1];
    const streaks = new Path2D();
    const flashes = new Path2D();
    for (let i = 0; i < R.tips.length; i++) {
      const per = 40 + Math.floor(hash01(i, 61) * 36);
      const ph = Math.floor(hash01(i, 62) * per);
      const tt = (fr + ph) % per;
      if (tt >= 18) continue;
      const tp = R.tips[i];
      leafPoint(tp.leaf, tp.rho, tp.alpha, f, p4);
      project(cam, p4[0], p4[1], p4[2], pr, 0);
      const x = pr[0];
      const y = pr[1];
      if (tt < 9) {
        const k0 = 0.42 * (1 - tt / 9);
        const k1 = 0.42 * (1 - (tt - 2.5) / 9);
        const ox = x - cx + 40;
        const oy = y - cy + 40;
        streaks.moveTo(x + ox * k1, y + oy * k1);
        streaks.lineTo(x + ox * k0, y + oy * k0);
      } else {
        const k = 1 - (tt - 9) / 9;
        const rr = 1.2 + 2.2 * k;
        flashes.rect(x - rr, y - rr, 2 * rr, 2 * rr);
      }
    }
    ctx.strokeStyle = `rgba(255,214,120,${0.6 * landA})`;
    ctx.lineWidth = 1.3;
    ctx.stroke(streaks);
    ctx.fillStyle = `rgba(255,236,170,${0.7 * landA})`;
    ctx.fill(flashes);
  }
  ctx.restore();
}

/** S06's red infrared sparks: the same emitters (vein junctions), periods and seeds, continued from S06's clock;
 *  no new sparks are born after f22, the last ones die out by ~f52. */
export function drawS06Sparks(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  if (f > 56) return;
  const R = rosette06();
  const fr = S06_LAST + f;
  const boost = 2.2;
  const life = 30;
  const p4 = new Float32Array(4);
  project(cam, 0, 0, 0, pr, 0);
  const cx = pr[0];
  const cy = pr[1];
  const hot = new Path2D();
  const dim = new Path2D();
  for (let j = 0; j < R.junctions.length; j++) {
    const J = R.junctions[j];
    const per = Math.max(8, Math.round((44 - Math.min(30, J.load * 0.8)) / boost));
    const ph = Math.floor(hash01(j, 71) * per);
    let mapped = false;
    let jx = 0;
    let jy = 0;
    for (let gen = 0; gen < 2; gen++) {
      const born = Math.floor((fr + ph) / per) * per - ph - gen * per;
      if (born > S06_LAST + 16) continue;
      const age = fr - born;
      if (age < 0 || age > life) continue;
      if (!mapped) {
        leafPoint(J.leaf, J.rho, J.alpha, f, p4);
        project(cam, p4[0], p4[1], p4[2], pr, 0);
        jx = pr[0];
        jy = pr[1];
        mapped = true;
      }
      const sd = j * 131 + born;
      const ra = Math.atan2(jy - cy, jx - cx) + (hash01(sd, 72) - 0.5) * 1.6;
      const sp = 1.8 + hash01(sd, 73) * 2.6;
      const d = sp * age * (1 - age / (life * 2.6));
      const tail = Math.max(0, d - 12);
      const k = 1 - age / life;
      const target = k > 0.5 ? hot : dim;
      target.moveTo(jx + Math.cos(ra) * tail, jy + Math.sin(ra) * tail);
      target.lineTo(jx + Math.cos(ra) * d, jy + Math.sin(ra) * d);
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,59,47,0.16)';
  ctx.lineWidth = 6;
  ctx.stroke(hot);
  ctx.strokeStyle = 'rgba(255,90,66,0.95)';
  ctx.lineWidth = 2.2;
  ctx.stroke(hot);
  ctx.strokeStyle = 'rgba(210,40,40,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke(dim);
  ctx.restore();
}

const S06_INFLOW = ['#FFC94A', '#FFD86A', '#D9E46A', '#9EE06A', '#6FD88A', '#45CF9C', '#2CC5A6', '#2AB8B0'];
/** S06's gathering inflow (520 gold → teal streaks spiralling into the sink), continued and wound up with the flow. */
export function drawS06Inflow(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  const on = 1 - smoothstep(4, 34, f);
  if (on <= 0.004) return;
  const K = K06(f) * 0.6;
  const sp6 = spin06(f);
  const w = wOpen(f);
  const travelled = 124.8 + 2.0 * f;
  const acc = 2.0;
  const NB = S06_INFLOW.length;
  const FP: Path2D[] = Array.from({ length: NB }, () => new Path2D());
  const p = new Float32Array(3);
  const pos = (a0: number, r0: number, uu: number, out: Float32Array) => {
    const r = r0 * Math.pow(1 - uu, 1.35) + 14;
    const th = a0 + 1.1 * Math.log(r0 / r) + K * g06(r) + sp6; // S06 screen angle
    const rr = r * pull06(r, K);
    const phi = -th + w * leafDelta(0, r, f); // world angle, wound with the leaves
    project(cam, rr * Math.cos(phi), 0, rr * Math.sin(phi), out, 0);
  };
  for (let i = 0; i < 520; i++) {
    const a0 = hash01(i, 801) * Math.PI * 2;
    const r0 = 470 + hash01(i, 802) * 230;
    const spd = 0.0028 + hash01(i, 803) * 0.002;
    const u = (hash01(i, 804) + travelled * spd) % 1;
    pos(a0, r0, u, p);
    const x1 = p[0];
    const y1 = p[1];
    pos(a0, r0, Math.max(0, u - 0.035 - 0.03 * acc), p);
    const b = Math.min(NB - 1, Math.floor(u * NB));
    FP[b].moveTo(p[0], p[1]);
    FP[b].lineTo(x1, y1);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < NB; b++) {
    ctx.strokeStyle = S06_INFLOW[b];
    ctx.globalAlpha = on * 0.55 * (0.5 + 0.5 * (b / NB));
    ctx.lineWidth = 1.3;
    ctx.stroke(FP[b]);
  }
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
