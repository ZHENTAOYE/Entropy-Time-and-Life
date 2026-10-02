// The leaf-vein network, drawn on the CPU as vector strokes (it replaces the r1 WebGL shader: a GL context, a shader
// compile and a 1080² readback cost ~300 ms per still). Same look, segment by segment, as that shader:
//   base   = mix(gold, lime, green·(0.55 + 0.45·(1 − d)))·0.6           (d = distance from the sink, 0 root … 1 tips)
//   pulses = life(d)·1.9·flow  where pulse((s + φ)/46) / 0.55·pulse((s + 1.35φ)/71 + .37) — light flowing to the sink
//   front  = white-hot growth front at the reveal distance
//   blades = dark translucent green (older = deeper), lime margin; younger leaves OCCLUDE the veins beneath them
//            (pre-computed once, in ground space — the twist is a continuous warp, so occlusion is invariant).
// The halo of the veins comes from the scene's bloom pass (drawVeins(…, glow = true)).
import { clamp, ease, memo, seg } from '../../lib/math';
import { Cam, applyGround, groundScale } from './camera';
import { K_END, Leaf, leaves, netReveal, spinAt, twistAmount, youPulse } from './network';
import { T } from './timing';
import { OCC_B64 } from './netOcc.blob';

const STEP = 6; // growth step of the leaves (network.ts)

type RGB = [number, number, number];
const GOLD: RGB = [255, 201, 74];
const LIME: RGB = [158, 224, 107];
const TEAL: RGB = [44, 197, 166];
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const life = (d: number): RGB => (d > 0.5 ? mixc(LIME, GOLD, (d - 0.5) * 2) : mixc(TEAL, LIME, d * 2));
const css = (c: RGB, a: number) => `rgba(${Math.round(Math.min(255, c[0]))},${Math.round(Math.min(255, c[1]))},${Math.round(Math.min(255, c[2]))},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const pulse = (x: number) => {
  const p = x - Math.floor(x);
  return p < 0.62 ? 0 : Math.pow(1 - (p - 0.62) / 0.38, 1.6);
};

const WB = 6; // width buckets (Murray radius)
const DB = 6; // colour bands along the flow
const PL = 3; // pulse intensity levels

interface Geo {
  /** per leaf: node ground coords, parent, distance from the sink (px), width bucket, occluded by a younger leaf */
  leaves: Array<{ x: Float32Array; y: Float32Array; parent: Int32Array; dpx: Float32Array; wb: Uint8Array; hid: Uint8Array; youth: number; outline: Array<[number, number]> }>;
  dmax: number;
}

const inPoly = (x: number, y: number, P: Array<[number, number]>) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** which vein nodes lie under a younger leaf's blade (raw computation — used by dev/gen-occ-data.ts) */
export function occlusionMasks(): Uint8Array[] {
  const L: Leaf[] = leaves();
  const bb = L.map((lf) => {
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    for (const [x, y] of lf.outline) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return [x0, y0, x1, y1];
  });
  return L.map((lf, li) => {
    const hid = new Uint8Array(lf.nodes.length);
    lf.nodes.forEach((nd, i) => {
      if (nd.parent < 0) return;
      const p = lf.nodes[nd.parent];
      const mx = (p.x + nd.x) / 2;
      const my = (p.y + nd.y) / 2;
      for (let k = li + 1; k < L.length; k++) {
        const b = bb[k];
        if (mx < b[0] || mx > b[2] || my < b[1] || my > b[3]) continue;
        if (inPoly(mx, my, L[k].outline)) {
          hid[i] = 1;
          break;
        }
      }
    });
    return hid;
  });
}

const occlusion = (li: number, n: number): Uint8Array => {
  const bin = atob(OCC_B64[li]);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
};

export const veinGeo = () =>
  memo('s06:veinGeo', (): Geo => {
    const L: Leaf[] = leaves();
    let dmax = 0;
    for (const lf of L) for (const n of lf.nodes) dmax = Math.max(dmax, n.depth * STEP);
    const out: Geo['leaves'] = L.map((lf, li) => {
      const n = lf.nodes.length;
      const x = new Float32Array(n);
      const y = new Float32Array(n);
      const parent = new Int32Array(n);
      const dpx = new Float32Array(n);
      const wb = new Uint8Array(n);
      lf.nodes.forEach((nd, i) => {
        x[i] = nd.x;
        y[i] = nd.y;
        parent[i] = nd.parent;
        dpx[i] = nd.depth * STEP;
        wb[i] = Math.max(0, Math.min(WB - 1, Math.floor(Math.log2(nd.radius) * 1.35)));
      });
      return { x, y, parent, dpx, wb, hid: occlusion(li, n), youth: lf.youth, outline: lf.outline };
    });
    return { leaves: out, dmax };
  });

export const netDmax = () => veinGeo().dmax;

/** pulse speed factor (×3.4 px/frame), 2.3 at the cut */
const accAt = (f: number) => 1 + 1.3 * ease.inQuad(seg(f, T.swirlStart, T.end));
/** ∫_f^end acc dt (closed form) */
const accInt = (f: number) => {
  const a = T.swirlStart;
  const b = T.end;
  const L = b - a;
  if (f >= b) return 0;
  const q = clamp((f - a) / L);
  const tail = b - Math.max(f, a) + ((1.3 * L) / 3) * (1 - q * q * q);
  return tail + Math.max(0, a - f);
};
/** pulse travel (px along the veins). Integrated speed 3.4·acc(t), pinned to r1's phase 3.4·t·acc(t) at the cut
 *  (the r1 product form raced at ~50 px/frame through B7 and strobed). */
const pulsePhase = (f: number) => 3.4 * (T.end * accAt(T.end) - accInt(f));

export interface VeinParams {
  K: number;
  spin: number;
  q: number;
  reveal: number;
  green: number;
  flow: number;
  blade: number;
  phase: number;
}

export function veinParams(frame: number): VeinParams {
  const K = twistAmount(frame);
  return {
    K,
    spin: spinAt(frame),
    q: ease.inQuad(clamp(K / K_END)),
    reveal: netReveal(frame),
    green: ease.inOutSine(seg(frame, T.netGrowStart + 30, T.netGrowEnd + 30)),
    flow: ease.inOutSine(seg(frame, T.netGrowStart + 20, T.netGrowEnd + 10)) * (1 + 0.8 * youPulse(frame)),
    // blades fade out while the rosette winds up: only the flowing veins remain at the cut
    blade: ease.inOutSine(seg(frame, T.netGrowStart + 20, T.netGrowEnd + 10)) * (1 - ease.inOutSine(seg(frame, T.swirlStart + 20, T.bladeOut))),
    phase: pulsePhase(frame),
  };
}

// twisted coordinates, reused
let TX = new Float32Array(2048);
let TY = new Float32Array(2048);
const R_OUT = 700;
const CORE = 20;
function twistInto(lx: Float32Array, ly: Float32Array, n: number, P: VeinParams) {
  if (TX.length < n) {
    TX = new Float32Array(n * 2);
    TY = new Float32Array(n * 2);
  }
  const C = { x: 540, y: 860 };
  for (let i = 0; i < n; i++) {
    const dx = lx[i] - C.x;
    const dy = ly[i] - C.y;
    const r = Math.hypot(dx, dy);
    if (r < 1e-3 || (P.K === 0 && P.spin === 0)) {
      TX[i] = lx[i];
      TY[i] = ly[i];
      continue;
    }
    const th = P.K * Math.log((R_OUT + CORE) / (r + CORE)) + P.spin;
    const pull = 1 - 0.12 * P.q * (1 - clamp(r / 520));
    const c = Math.cos(th);
    const s = Math.sin(th);
    TX[i] = C.x + (dx * c - dy * s) * pull;
    TY[i] = C.y + (dx * s + dy * c) * pull;
  }
}

/** Draw the vein network (ground space, centred on SPIRAL). `glow` = the bloom source (¼ res). */
export function drawVeins(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, alpha: number, glow = false) {
  if (alpha <= 0.005) return;
  const G = veinGeo();
  const P = veinParams(frame);
  const rev = P.reveal * G.dmax;
  if (rev <= 0.5) return;
  const growing = P.reveal > 0.001 && P.reveal < 0.999;
  const s = groundScale(cam);
  // keep hairlines ≥ ~0.7 screen px while the rosette is still small in the frame
  const wk = 1 / Math.max(0.35, Math.min(1, s));
  ctx.save();
  applyGround(ctx, cam);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const base: Path2D[] = Array.from({ length: WB * DB }, () => new Path2D());
  const pul: Path2D[] = Array.from({ length: 2 * DB * PL }, () => new Path2D());
  const front = new Path2D();
  const blades: Path2D[] = [];
  const nodesOut = new Path2D();
  for (let li = 0; li < G.leaves.length; li++) {
    const lf = G.leaves[li];
    const n = lf.x.length;
    twistInto(lf.x, lf.y, n, P);
    for (let i = 0; i < n; i++) {
      const p = lf.parent[i];
      if (p < 0) continue;
      const dpx = lf.dpx[i];
      if (dpx > rev + 1) continue;
      const x0 = TX[p];
      const y0 = TY[p];
      const x1 = TX[i];
      const y1 = TY[i];
      if (glow) {
        // halo: every revealed vein (the r1 glow texture did not occlude)
        const b = Math.min(DB - 1, Math.floor((dpx / G.dmax) * DB));
        const wbi = lf.wb[i] >= 3 ? 1 : 0;
        base[wbi * DB + b].moveTo(x0, y0);
        base[wbi * DB + b].lineTo(x1, y1);
        continue;
      }
      if (lf.hid[i]) continue;
      const d = dpx / G.dmax;
      const b = Math.min(DB - 1, Math.floor(d * DB));
      const path = base[lf.wb[i] * DB + b];
      path.moveTo(x0, y0);
      path.lineTo(x1, y1);
      const fl = Math.max(pulse((dpx + P.phase) / 46), 0.55 * pulse((dpx + P.phase * (4.6 / 3.4)) / 71 + 0.37)) * P.flow;
      if (fl > 0.06) {
        const lv = Math.min(PL - 1, Math.floor(fl * PL));
        const pp = pul[((lf.wb[i] >= 3 ? 1 : 0) * DB + b) * PL + lv];
        pp.moveTo(x0, y0);
        pp.lineTo(x1, y1);
      }
      if (growing && Math.abs(dpx - rev) < 10) {
        front.moveTo(x0, y0);
        front.lineTo(x1, y1);
        if (lf.wb[i] === 0 && dpx > rev - 4) nodesOut.rect(x1 - 1.6, y1 - 1.6, 3.2, 3.2);
      }
    }
    if (!glow && P.blade > 0.005) {
      const bp = new Path2D();
      lf.outline.forEach(([ox, oy], k) => {
        const dx = ox - 540;
        const dy = oy - 860;
        const r = Math.hypot(dx, dy);
        const th = P.K * Math.log((R_OUT + CORE) / (r + CORE)) + P.spin;
        const pull = 1 - 0.12 * P.q * (1 - clamp(r / 520));
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const X = 540 + (dx * c - dy * sn) * pull;
        const Y = 860 + (dx * sn + dy * c) * pull;
        if (k === 0) bp.moveTo(X, Y);
        else bp.lineTo(X, Y);
      });
      bp.closePath();
      blades.push(bp);
    }
  }

  if (glow) {
    ctx.globalCompositeOperation = 'lighter';
    const hal = mixc(GOLD, [115, 217, 140], P.green);
    for (let w = 0; w < 2; w++)
      for (let b = 0; b < DB; b++) {
        const d = (b + 0.5) / DB;
        ctx.strokeStyle = css(mixc(hal, life(d), 0.35 * P.flow), alpha * (0.42 + 0.25 * w));
        ctx.lineWidth = (3 + w * 2.5) * wk;
        ctx.stroke(base[w * DB + b]);
      }
    ctx.restore();
    return;
  }

  // ---- blades (older first; translucent dark green, younger leaves lighter; lime margin)
  if (P.blade > 0.005) {
    const ba = P.blade * alpha;
    ctx.globalCompositeOperation = 'source-over';
    for (let li = 0; li < blades.length; li++) {
      const y = G.leaves[li].youth;
      const bc = mixc([11, 43, 22], [38, 77, 23], y);
      // premultiplied: add bcol·1.1 (the r1 shader lit the blade along the veins' halo: ×(0.6 + 1.6·G)), cover 42 %
      // of what lies beneath (as that shader's output alpha)
      ctx.fillStyle = css([(bc[0] * 1.1) / 0.42, (bc[1] * 1.1) / 0.42, (bc[2] * 1.1) / 0.42], 0.42 * ba);
      ctx.fill(blades[li]);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = css(LIME, 0.22 * ba);
    ctx.lineWidth = 1.4 * wk;
    for (const bp of blades) ctx.stroke(bp);
  }

  // ---- veins
  ctx.globalCompositeOperation = 'lighter';
  for (let w = 0; w < WB; w++)
    for (let b = 0; b < DB; b++) {
      const d = (b + 0.5) / DB;
      const c = mixc(GOLD, LIME, P.green * (0.55 + 0.45 * (1 - d)));
      ctx.strokeStyle = css(c, 0.6 * alpha);
      ctx.lineWidth = (0.76 + w * 0.63) * wk;
      ctx.stroke(base[w * DB + b]);
    }
  // pulses of light flowing to the sink
  for (let w = 0; w < 2; w++)
    for (let b = 0; b < DB; b++)
      for (let lv = 0; lv < PL; lv++) {
        const k = Math.min(1, ((lv + 0.5) / PL) * 1.9);
        ctx.strokeStyle = css(life((b + 0.5) / DB), k * alpha);
        ctx.lineWidth = (w ? 2.6 : 1.3) * wk;
        ctx.stroke(pul[(w * DB + b) * PL + lv]);
      }
  // white-hot growth front
  if (growing) {
    ctx.strokeStyle = css([255, 245, 214], 0.9 * alpha);
    ctx.lineWidth = 1.8 * wk;
    ctx.stroke(front);
    ctx.fillStyle = css([255, 250, 230], alpha);
    ctx.fill(nodesOut);
  }
  ctx.restore();
}
