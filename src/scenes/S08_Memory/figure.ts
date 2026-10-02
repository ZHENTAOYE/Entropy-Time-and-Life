// S08 → S09 handoff renderer.
//
//   import { drawFigureS08 } from '../S08_Memory/figure';
//   drawFigureS08(ctx, t, { scale, tx, ty, background: true });
//
// Draws FIGURE_S08 (lib/handoff.ts): the gold-line human (cx 540, feet at y 1610, height 1300) with the memory
// network glowing in the head, echo rings and nerve pulses running down the body, on #0A0705 (if `background`).
// * `t` = S08-local frame. t = 569 reproduces S08's last frame exactly. S09 should pass t = 570 + its local frame:
//   the pulses / echo rings keep going seamlessly (everything is closed-form in t).
// * `scale, tx, ty`: screen = scale * p + (tx, ty) for a point p of the canonical FIGURE_S08 frame (default identity).
//   For a pull-back about an anchor (ax, ay) by factor k use scale = k, tx = ax * (1 - k), ty = ay * (1 - k).
// * Draws in logical 1080×1920 px (works with CanvasLayer at any `scale`). Includes its own bloom pass (0.25-scale
//   offscreen canvas) composited with 'lighter'; pass bloom: false to skip it.
// * PERFORMANCE: draw it on a CPU-backed canvas (`CpuCanvas` from ./CpuCanvas, i.e. getContext('2d',
//   { willReadFrequently: true })). On the SwiftShader render boxes the default (emulated-GPU) canvas is ~5× slower
//   for these thousands of additive strokes. Avoid CSS mix-blend-mode on it (plain alpha compositing looks the same
//   on the dark ground and is much cheaper).
// * The rest of S08's last frame: gold dust = drawMotesS08(ctx, t, zoom) from ./motes (S08 draws it on a 0.5-scale
//   canvas), then <Vignette strength={0.5} color="14,8,4" /> on top. Background FIGURE_S08.bg = #0A0705.
import { FIGURE_S08 } from '../../lib/handoff';
import { HUMAN_PATH } from '../../lib/human';
import { clamp, ease, memo, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { ECHOES, NET_SPEED, PULSE_PERIOD, PULSE_T0, axonGeom, boxToFinal, getNet, pulseAt } from './network';
import { K_N, MACRO_K } from './trail';
import { cpuCanvas } from './CpuCanvas';

export interface FigureOpts {
  scale?: number;
  tx?: number;
  ty?: number;
  /** overall opacity 0..1 */
  alpha?: number;
  /** fill FIGURE_S08.bg first */
  background?: boolean;
  bloom?: boolean;
  /** override outline draw-on progress 0..1 (default: by t, complete from t ≥ 536) */
  outline?: number;
  /** multiply network brightness */
  network?: number;
  /** dev profiling hook */
  mark?: (label: string) => void;
}

const GOLD = '#FFC94A';
const BUCKET_COL = ['#4A2E10', '#7A5019', '#B07C27', '#E7AE3C', '#FFC94A', '#FFDF8C', '#FFF4D6'];
const BUCKET_A = [0.55, 0.65, 0.75, 0.85, 0.95, 1, 1];

// ------------------------------------------------------------------------------------------------ geometry
interface Poly {
  pts: Float32Array;
  cum: Float32Array;
  len: number;
}
function mkPoly(p: number[]): Poly {
  const cum = new Float32Array(p.length / 2);
  for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]);
  return { pts: new Float32Array(p), cum, len: cum[cum.length - 1] };
}

/** outline halves in final space, both starting at the top of the head (right side, left side) */
function outlineHalves(): [Poly, Poly] {
  return memo('S08:outlineHalves', () => {
    const nums = (HUMAN_PATH.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const pts: number[] = [nums[0], nums[1]];
    let cx = nums[0];
    let cy = nums[1];
    const segs: number[][] = [];
    for (let i = 2; i + 5 < nums.length; i += 6) {
      const [c1x, c1y, c2x, c2y, x, y] = nums.slice(i, i + 6);
      const seg: number[] = [];
      for (let s = 1; s <= 10; s++) {
        const t = s / 10;
        const u = 1 - t;
        seg.push(u * u * u * cx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * cy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
      }
      segs.push(seg);
      cx = x;
      cy = y;
    }
    const half = Math.floor(segs.length / 2); // 53 → head top … crotch
    const right: number[] = [...pts];
    for (let i = 0; i < half; i++) right.push(...segs[i]);
    const leftRev: number[] = [...pts];
    for (let i = segs.length - 1; i >= half; i--) {
      // walk backwards: previous segment's end points
      const sg = segs[i];
      for (let s = sg.length / 2 - 2; s >= 0; s--) leftRev.push(sg[s * 2], sg[s * 2 + 1]);
      const prev = i > 0 ? segs[i - 1] : pts;
      leftRev.push(prev[prev.length - 2], prev[prev.length - 1]);
    }
    const toF = (a: number[]) => {
      const o: number[] = [];
      for (let i = 0; i < a.length; i += 2) o.push(...boxToFinal(a[i], a[i + 1]));
      return mkPoly(o);
    };
    return [toF(right), toF(leftRev)];
  });
}

/** outline split at the neck: [headR, headL] run neck → crown, [bodyR, bodyL] run neck → crotch */
function outlineParts(): { head: [Poly, Poly]; body: [Poly, Poly] } {
  return memo('S08:outlineParts', () => {
    const NECK = 1 + 6 * 10; // RIGHT[6] = (326,232): 6 cubic segments of 10 samples each after the start point
    const sub = (p: Poly, a: number, b: number, rev: boolean) => {
      const o: number[] = [];
      for (let i = a; i <= b; i++) o.push(p.pts[i * 2], p.pts[i * 2 + 1]);
      if (rev) {
        const r: number[] = [];
        for (let i = o.length / 2 - 1; i >= 0; i--) r.push(o[i * 2], o[i * 2 + 1]);
        return mkPoly(r);
      }
      return mkPoly(o);
    };
    const [hr, hl] = outlineHalves();
    const n = hr.pts.length / 2 - 1;
    const m = hl.pts.length / 2 - 1;
    return {
      head: [sub(hr, 0, NECK, true), sub(hl, 0, NECK, true)] as [Poly, Poly],
      body: [sub(hr, NECK, n, false), sub(hl, NECK, m, false)] as [Poly, Poly],
    };
  });
}

interface Nerve {
  poly: Poly;
  /** delay (frames) after the pulse leaves the axon */
  delay: number;
  speed: number;
}
const B = (pts: number[][]) => {
  const o: number[] = [];
  for (const [x, y] of pts) o.push(...boxToFinal(x, y));
  return mkPoly(o);
};
function nerves(): Nerve[] {
  return memo('S08:nerves', () => {
    const spine = B([[300, 236], [300, 300], [300, 480], [300, 700], [300, 862]]);
    // limb centre lines (midway between HUMAN_PATH's outer and inner contour)
    const armR = [[300, 268], [336, 282], [384, 298], [422, 330], [438, 392], [445, 462], [452, 530], [461, 590], [471, 650], [482, 716], [492, 772], [497, 822], [500, 846]];
    const legR = [[300, 862], [334, 896], [364, 960], [363, 1050], [361, 1130], [356, 1230], [350, 1320], [358, 1388]];
    const mir = (a: number[][]) => a.map(([x, y]) => [600 - x, y]);
    const sp = 34; // final px / frame
    const tShoulder = (32 * 0.9673) / sp;
    const tPelvis = spine.len / sp;
    return [
      { poly: spine, delay: 0, speed: sp },
      { poly: B(armR), delay: tShoulder, speed: sp * 0.92 },
      { poly: B(mir(armR)), delay: tShoulder, speed: sp * 0.92 },
      { poly: B(legR), delay: tPelvis, speed: sp },
      { poly: B(mir(legR)), delay: tPelvis, speed: sp },
    ];
  });
}

function headPath(): Path2D {
  return memo('S08:humanPath2D', () => new Path2D(HUMAN_PATH));
}

function strokePoly(ctx: CanvasRenderingContext2D, p: Poly, a: number, b: number) {
  // stroke arc-length range [a, b]
  if (b <= a) return;
  const P = p.pts;
  const C = p.cum;
  const n = C.length;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < n - 1; i++) {
    const c0 = C[i];
    const c1 = C[i + 1];
    if (c1 < a) continue;
    if (c0 > b) break;
    const t0 = c1 > c0 ? Math.max(0, (a - c0) / (c1 - c0)) : 0;
    const t1 = c1 > c0 ? Math.min(1, (b - c0) / (c1 - c0)) : 1;
    const x0 = P[i * 2] + (P[i * 2 + 2] - P[i * 2]) * t0;
    const y0 = P[i * 2 + 1] + (P[i * 2 + 3] - P[i * 2 + 1]) * t0;
    const x1 = P[i * 2] + (P[i * 2 + 2] - P[i * 2]) * t1;
    const y1 = P[i * 2 + 1] + (P[i * 2 + 3] - P[i * 2 + 1]) * t1;
    if (!started) {
      ctx.moveTo(x0, y0);
      started = true;
    }
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
}
function pointAt(p: Poly, d: number): [number, number] {
  const C = p.cum;
  const P = p.pts;
  if (d <= 0) return [P[0], P[1]];
  if (d >= p.len) return [P[P.length - 2], P[P.length - 1]];
  let lo = 0;
  let hi = C.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (C[m] < d) lo = m;
    else hi = m;
  }
  const t = (d - C[lo]) / (C[hi] - C[lo] || 1);
  return [P[lo * 2] + (P[hi * 2] - P[lo * 2]) * t, P[lo * 2 + 1] + (P[hi * 2 + 1] - P[lo * 2 + 1]) * t];
}

function axonPoly(): Poly {
  return memo('S08:axonPoly', () => {
    const g = axonGeom();
    return { pts: g.axon, cum: new Float32Array(Array.from(g.axonD, (v) => v * K_N)), len: g.axonD[g.axonD.length - 1] * K_N };
  });
}

/** white-hot → gold radial glow (growth tips) */
function tipSprite(): HTMLCanvasElement {
  return memo('S08:tipSprite', () => {
    const c = cpuCanvas(32, 32);
    const x = c.getContext('2d', { willReadFrequently: true })!;
    const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,250,236,1)');
    gr.addColorStop(0.22, 'rgba(255,240,200,0.9)');
    gr.addColorStop(0.5, 'rgba(255,201,74,0.35)');
    gr.addColorStop(1, 'rgba(255,170,60,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 32, 32);
    return c;
  });
}

// ------------------------------------------------------------------------------------------------ bloom buffers
function bloomBuffers(): [HTMLCanvasElement, HTMLCanvasElement] {
  return memo('S08:bloomBuffers', () => {
    return [cpuCanvas(270, 480), cpuCanvas(270, 480)];
  });
}

/** time (frames after the soma fires) when a pulse leaves the head into the spinal cord */
export function axonExitDelay(): number {
  const g = axonGeom();
  return g.axonD[g.axonD.length - 1] / NET_SPEED;
}

/** frame (S08-local, may exceed 569) at which pulse fired at f0 reaches the soles (ground ripple) */
export function pulseFootArrival(f0: number): number {
  const leg = nerves()[3];
  return f0 + axonExitDelay() + leg.delay + leg.poly.len / leg.speed;
}

// ------------------------------------------------------------------------------------------------ main
export function drawFigureS08(ctx: CanvasRenderingContext2D, t: number, o: FigureOpts = {}) {
  const S = o.scale ?? 1;
  const TX = o.tx ?? 0;
  const TY = o.ty ?? 0;
  const alpha = o.alpha ?? 1;
  const netK = o.network ?? 1;
  const mark = o.mark;
  const net = getNet();
  mark?.('f.getNet');

  ctx.save();
  if (o.background) {
    ctx.fillStyle = FIGURE_S08.bg;
    ctx.fillRect(0, 0, 1080, 1920);
  }
  const [gA, gB] = bloomBuffers();
  const doBloom = o.bloom !== false;
  const g = gA.getContext('2d')!;
  if (doBloom) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, 270, 480);
    g.setTransform(0.25 * S, 0, 0, 0.25 * S, 0.25 * TX, 0.25 * TY);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // world (final-space) transform; line widths are given in screen px, so divide by S
  const base = ctx.getTransform();
  ctx.transform(S, 0, 0, S, TX, TY);
  const px = 1 / S; // one screen px in final units
  /** visual width scale: thicker lines while magnified (network stage), hairlines at the end */
  const ws = 0.55 + 0.45 * Math.pow(clamp(S / 9.0, 0, 1.2), 0.8);

  // ---- soft aura behind the head (appears with the outline)
  const pres = net.somas.find((s) => s.kind === 'present')!;
  const outlineP = o.outline ?? ease.inOutSine(seg(t, 414, 534));
  if (outlineP > 0) {
    const r = 210;
    const grd = ctx.createRadialGradient(540, 380, 0, 540, 380, r);
    grd.addColorStop(0, `rgba(255,190,90,${0.16 * outlineP})`);
    grd.addColorStop(0.4, `rgba(255,170,70,${0.06 * outlineP})`);
    grd.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(540 - r, 380 - r, r * 2, r * 2);
  }

  // ---- axon (the trail) revealed top → bottom by the ignition front
  const axFront = (t - pres.T) * (net.axonBeadEnd / 36);
  // at the figure scale the axon thins and dims so the dendrite glow dominates (no "crack" through the skull)
  const axK = smoothstep(1.2, 3, S);
  if (axFront > 0) {
    const d = Math.min(axFront, net.axonD[net.axonD.length - 1]);
    const axPoly: Poly = axonPoly();
    ctx.strokeStyle = `rgba(255,201,74,${(0.85 * (0.62 + 0.38 * axK)).toFixed(3)})`;
    ctx.lineWidth = 2.6 * ws * (0.55 + 0.45 * axK) * px;
    strokePoly(ctx, axPoly, 0, d * K_N);
    // travelling ignition head
    if (axFront < net.axonD[net.axonD.length - 1] + 200) {
      const [hx, hy] = pointAt(axPoly, d * K_N);
      ctx.fillStyle = '#FFF4D6';
      ctx.beginPath();
      ctx.arc(hx, hy, 5 * ws * px, 0, Math.PI * 2);
      ctx.fill();
      if (doBloom) {
        g.fillStyle = 'rgba(255,230,170,1)';
        g.beginPath();
        g.arc(hx, hy, 18 * ws * px, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (doBloom) {
      g.strokeStyle = `rgba(255,190,80,${(0.8 * (0.5 + 0.5 * axK)).toFixed(3)})`;
      g.lineWidth = 7 * ws * (0.6 + 0.4 * axK) * px;
      strokePoly(g, axPoly, 0, d * K_N);
    }
    // pulses along the axon
    if (t >= PULSE_T0) {
      for (let i = 0; i < net.axonD.length; i += 2) {
        const pu = pulseAt(net.axonD[i], t, 90);
        if (pu < 0.08) continue;
        ctx.fillStyle = `rgba(255,244,214,${Math.min(1, pu)})`;
        ctx.beginPath();
        ctx.arc(net.axon[i * 2], net.axon[i * 2 + 1], 3.2 * ws * px * (0.6 + pu), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  mark?.('f.axon');
  // ---- dendrites, bucketed by brightness × width
  const NB = BUCKET_COL.length;
  const paths: Path2D[] = [];
  const gpaths: Path2D[] = [];
  for (let i = 0; i < NB * 3; i++) paths.push(new Path2D());
  for (let i = 0; i < 3; i++) gpaths.push(new Path2D());
  const X = net.x;
  const Y = net.y;
  const P = net.parent;
  const tips: number[] = [];
  for (let i = 0; i < net.n; i++) {
    const p = P[i];
    if (p < 0) continue;
    const age = t - net.tA[i];
    if (age < 0) continue;
    let tipNow = 0;
    const fr = age >= 1 ? 1 : age;
    const r = net.r[i];
    let b = 0.3 + 0.45 * Math.min(1, Math.sqrt(r) / 3.2);
    // young segments glow and flicker like lightning; the white-hot growth tip itself is drawn as a glow dot below
    if (age < 14) {
      b += 0.4 * Math.exp(-age / 4) + (hash01(i * 7 + Math.floor(t), 3) - 0.5) * 0.3 * (1 - age / 14);
      // a tip = the current end of its branch (no child born yet, or just born); leaves cool down
      const kid = net.firstKid[i];
      if (t < kid + 0.8) tipNow = Math.exp(-age / 4);
    }
    if (t >= PULSE_T0) b += 0.85 * pulseAt(net.dist[i], t);
    b *= netK;
    const bi = Math.max(0, Math.min(NB - 1, Math.floor(b * 3.2)));
    const wi = r < 1.6 ? 0 : r < 4 ? 1 : 2;
    const x0 = X[p];
    const y0 = Y[p];
    const x1 = x0 + (X[i] - x0) * fr;
    const y1 = y0 + (Y[i] - y0) * fr;
    const pa = paths[bi * 3 + wi];
    pa.moveTo(x0, y0);
    pa.lineTo(x1, y1);
    if (tipNow > 0) tips.push(x1, y1, tipNow);
    if (doBloom && b > 0.42) {
      const gp = gpaths[Math.min(2, Math.floor((b - 0.42) * 2.0))];
      gp.moveTo(x0, y0);
      gp.lineTo(x1, y1);
    }
  }
  mark?.('f.dendBuild');
  const widths = [0.55, 1.0, 1.8];
  for (let bi = 0; bi < NB; bi++)
    for (let wi = 0; wi < 3; wi++) {
      ctx.strokeStyle = BUCKET_COL[bi];
      ctx.globalAlpha = alpha * BUCKET_A[bi];
      ctx.lineWidth = widths[wi] * ws * px * (bi >= 5 ? 1.25 : 1);
      ctx.stroke(paths[bi * 3 + wi]);
    }
  ctx.globalAlpha = alpha;
  mark?.('f.dendStroke');
  // white-hot growth tips: small radial glow dots (never relies on stroke saturation)
  if (tips.length) {
    const spr = tipSprite();
    for (let k = 0; k < tips.length; k += 3) {
      const q = tips[k + 2] * netK;
      const rr = (1.4 + 2.0 * q) * Math.max(0.8, ws) * px;
      ctx.globalAlpha = alpha * Math.min(1, 0.15 + 0.6 * q);
      ctx.drawImage(spr, tips[k] - rr, tips[k + 1] - rr, rr * 2, rr * 2);
    }
    ctx.globalAlpha = alpha;
    if (doBloom) {
      for (let k = 0; k < tips.length; k += 3) {
        g.fillStyle = `rgba(255,236,190,${(0.12 + 0.2 * tips[k + 2]).toFixed(3)})`;
        g.beginPath();
        g.arc(tips[k], tips[k + 1], (3 + 3 * tips[k + 2]) * px, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  if (doBloom) {
    const ga = [0.22, 0.5, 0.9];
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = `rgba(255,196,86,${ga[k]})`;
      g.lineWidth = (4 + 3 * (1 - ws)) * px;
      g.stroke(gpaths[k]);
    }
  }

  mark?.('f.tips+gbloom');
  // ---- somas (beads, the present, other cells)
  for (const s of net.somas) {
    const age = t - s.T;
    if (age < 0) continue;
    const flash = Math.exp(-age / 6);
    const pu = t >= PULSE_T0 ? pulseAt(s.d, t, 110) : 0;
    const big = s.kind === 'present' ? 1.9 : s.kind === 'bead' ? 1.15 : 0.9;
    // older footprints = fainter memories (they were eroded longest)
    const memK = s.kind === 'bead' ? 0.45 + 0.55 * Math.exp(-(MACRO_K - s.k) / 5) : 1;
    const rad = Math.min(9 * Math.max(1, S * 0.6), (3.2 + 2.2 * flash + 1.6 * pu) * big * ws) * px * Math.min(1, age / 3 + 0.2);
    ctx.globalAlpha = alpha * memK;
    ctx.fillStyle = s.kind === 'cell' ? 'rgba(255,214,140,0.9)' : '#FFE7A8';
    ctx.beginPath();
    ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = alpha * memK * Math.min(1, 0.45 + flash + pu);
    ctx.beginPath();
    ctx.arc(s.x, s.y, rad * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    if (doBloom) {
      g.fillStyle = `rgba(255,205,110,${Math.min(1, (0.5 + flash * 1.5 + pu) * memK)})`;
      g.beginPath();
      g.arc(s.x, s.y, rad * (3 + 3 * flash), 0, Math.PI * 2);
      g.fill();
    }
  }

  mark?.('f.somas');
  // ---- echo rings from the present (main pulse + two decaying echoes)
  if (t >= PULSE_T0) {
    const jMax = Math.floor((t - PULSE_T0) / PULSE_PERIOD);
    for (let j = Math.max(0, jMax - 2); j <= jMax; j++) {
      const f0 = PULSE_T0 + j * PULSE_PERIOD;
      for (const [dl, amp] of ECHOES) {
        const age = t - f0 - dl;
        if (age < 0) continue;
        const a = amp * 0.42 * Math.exp(-age / 17);
        if (a < 0.01) continue;
        const rr = (5 + 24 * age) * px;
        ctx.strokeStyle = `rgba(255,214,140,${a})`;
        ctx.lineWidth = (1.1 + 0.8 * amp) * px;
        ctx.beginPath();
        ctx.arc(pres.x, pres.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ---- infrared leaving the head after each firing (thinking costs heat)
  if (t >= PULSE_T0) {
    const irA = ease.inOutSine(seg(t, 440, 500));
    const jMax = Math.floor((t - PULSE_T0) / PULSE_PERIOD);
    if (irA > 0)
      for (let j = Math.max(0, jMax - 1); j <= jMax; j++) {
        const f0 = PULSE_T0 + j * PULSE_PERIOD;
        for (let k = 0; k < 12; k++) {
          const age = t - f0 - 4 - hash01(j * 31 + k, 511) * 10;
          if (age < 0 || age > 34) continue;
          const ang = Math.PI * (0.88 + 1.24 * hash01(j * 31 + k, 512)); // up and sideways, never down the body
          const r0 = 40 + 20 * hash01(j * 31 + k, 513);
          const rr = r0 + age * (1.6 + 1.2 * hash01(j * 31 + k, 514));
          const al = 0.85 * irA * (1 - age / 34) * Math.min(1, age / 3);
          const ex = 540 + Math.cos(ang) * rr * 0.9;
          const ey = 384 + Math.sin(ang) * rr;
          ctx.fillStyle = `rgba(255,${Math.round(55 + 50 * (1 - age / 34))},38,${al})`;
          ctx.beginPath();
          ctx.arc(ex, ey, 2.2 * px, 0, Math.PI * 2);
          ctx.fill();
          if (doBloom) {
            g.fillStyle = `rgba(255,60,30,${al * 0.8})`;
            g.beginPath();
            g.arc(ex, ey, 9 * px, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
  }

  mark?.('f.rings+IR');
  // ---- the gold-line figure
  if (outlineP > 0) {
    // faint inner body light (volume), strongest at the head
    const fillA = ease.inOutSine(seg(t, 470, 540));
    if (fillA > 0) {
      ctx.save();
      const sF = FIGURE_S08.height / 1344;
      const [ox, oy] = boxToFinal(0, 0);
      ctx.translate(ox, oy);
      ctx.scale(sF, sF);
      const grd = ctx.createLinearGradient(0, 60, 0, 1400);
      grd.addColorStop(0, `rgba(255,190,90,${0.1 * fillA})`);
      grd.addColorStop(0.35, `rgba(255,170,70,${0.045 * fillA})`);
      grd.addColorStop(1, `rgba(255,160,60,${0.015 * fillA})`);
      ctx.fillStyle = grd;
      ctx.fill(headPath());
      ctx.restore();
    }
    const parts = outlineParts();
    const pH = o.outline ?? ease.inOutSine(seg(t, 414, 466));
    const pB = o.outline ?? ease.inOutSine(seg(t, 446, 534));
    const draws: Array<[Poly, number]> = [
      [parts.head[0], pH],
      [parts.head[1], pH],
      [parts.body[0], pB],
      [parts.body[1], pB],
    ];
    ctx.strokeStyle = GOLD;
    ctx.globalAlpha = alpha * 0.95;
    ctx.lineWidth = 2.0 * px * Math.max(1, Math.pow(S, 0.35));
    for (const [pl, pr] of draws) if (pr > 0) strokePoly(ctx, pl, 0, pl.len * pr);
    ctx.globalAlpha = alpha;
    if (doBloom) {
      g.strokeStyle = 'rgba(255,190,80,0.55)';
      g.lineWidth = 9 * px;
      for (const [pl, pr] of draws) if (pr > 0) strokePoly(g, pl, 0, pl.len * pr);
      // draw-on heads: soft sparks travelling along the contour
      g.fillStyle = 'rgba(255,225,160,0.9)';
      for (const [pl, pr] of draws) {
        if (pr <= 0 || pr >= 1) continue;
        const [x, y] = pointAt(pl, pl.len * pr);
        g.beginPath();
        g.arc(x, y, 12 * px, 0, Math.PI * 2);
        g.fill();
      }
    }
    // ground: a faint contact line under the feet
    const ga = 0.22 * ease.inOutSine(seg(t, 500, 546));
    if (ga > 0) {
      const gy = FIGURE_S08.groundY + 4;
      const grd = ctx.createLinearGradient(330, 0, 750, 0);
      grd.addColorStop(0, 'rgba(255,201,74,0)');
      grd.addColorStop(0.5, `rgba(255,201,74,${ga})`);
      grd.addColorStop(1, 'rgba(255,201,74,0)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.2 * px;
      ctx.beginPath();
      ctx.moveTo(330, gy);
      ctx.lineTo(750, gy);
      ctx.stroke();
    }
  }

  mark?.('f.outline');
  // ---- nervous system + pulses running down the body (the echo inside you)
  const nerveA = ease.inOutSine(seg(t, 466, 530));
  if (nerveA > 0) {
    const nv = nerves();
    // the static nerves stay a whisper (the travelling pulses reveal them): spine 0.1, limbs 0.06
    ctx.lineWidth = 1.0 * px;
    nv.forEach((n, i) => {
      ctx.strokeStyle = `rgba(255,201,74,${((i === 0 ? 0.1 : 0.06) * nerveA).toFixed(3)})`;
      strokePoly(ctx, n.poly, 0, n.poly.len);
    });
    // pulses: soma fires at f0, wave reaches the neck after axonExitDelay()
    const exitD = axonExitDelay();
    const jMax = Math.floor((t - PULSE_T0) / PULSE_PERIOD);
    for (let j = Math.max(0, jMax - 3); j <= jMax; j++) {
      const f0 = PULSE_T0 + j * PULSE_PERIOD;
      for (const n of nv) {
        const age = t - f0 - exitD - n.delay;
        if (age < 0) continue;
        const d = age * n.speed;
        if (d > n.poly.len + 90) continue;
        const fade = nerveA * (1 - clamp((d - n.poly.len * 0.8) / (n.poly.len * 0.2 + 90)));
        const tail = 90;
        // gradient tail
        for (let k = 0; k < 6; k++) {
          const a0 = d - tail * (k + 1) / 6;
          const a1 = d - tail * k / 6;
          ctx.strokeStyle = `rgba(255,222,150,${0.85 * fade * (1 - k / 6)})`;
          ctx.lineWidth = (2.4 - k * 0.3) * px;
          strokePoly(ctx, n.poly, Math.max(0, a0), Math.min(n.poly.len, a1));
        }
        if (d <= n.poly.len) {
          const [x, y] = pointAt(n.poly, d);
          ctx.fillStyle = `rgba(255,248,230,${fade})`;
          ctx.beginPath();
          ctx.arc(x, y, 3 * px, 0, Math.PI * 2);
          ctx.fill();
          if (doBloom) {
            g.fillStyle = `rgba(255,220,150,${fade})`;
            g.beginPath();
            g.arc(x, y, 14 * px, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      // every signal is dissipative: each pulse sheds two infrared (waste-red) embers from a limb nerve as it
      // passes; they drift out of the body and are gone within ~22 f (no speckle left on the figure)
      for (let k = 0; k < 2; k++) {
        const h0 = hash01(j * 131 + k, 500);
        const ni = 1 + Math.floor(hash01(j * 131 + k, 503) * 4); // an arm or a leg
        const n = nv[ni];
        const dk = (0.25 + 0.6 * h0) * n.poly.len;
        const tb = f0 + exitD + n.delay + dk / n.speed;
        const age = t - tb;
        if (age < 0 || age > 22) continue;
        const [px0, py0] = pointAt(n.poly, dk);
        const out = px0 >= 540 ? 1 : -1;
        const sp = 1.4 + 1.2 * hash01(j * 131 + k, 502);
        const al = 0.75 * nerveA * (1 - age / 22) * Math.min(1, age / 2);
        const ex = px0 + out * (6 + age * sp);
        const ey = py0 - age * 0.5;
        ctx.fillStyle = `rgba(255,${Math.round(60 + 50 * (1 - age / 22))},40,${al.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.0 * px, 0, Math.PI * 2);
        ctx.fill();
        if (doBloom) {
          g.fillStyle = `rgba(255,60,30,${(al * 0.7).toFixed(3)})`;
          g.beginPath();
          g.arc(ex, ey, 8 * px, 0, Math.PI * 2);
          g.fill();
        }
      }
      // ground ripple when a pulse reaches the feet (rhymes with the footprints)
      const leg = nv[3];
      const arrive = f0 + exitD + leg.delay + leg.poly.len / leg.speed;
      const ra = t - arrive;
      if (ra >= 0 && ra < 40) {
        const a = 0.35 * nerveA * Math.exp(-ra / 12);
        ctx.strokeStyle = `rgba(255,214,140,${a})`;
        ctx.lineWidth = 1 * px;
        for (const fx of [boxToFinal(238, 1398)[0], boxToFinal(362, 1398)[0]]) {
          ctx.beginPath();
          ctx.ellipse(fx, FIGURE_S08.groundY + 2, 6 + ra * 2.2, (6 + ra * 2.2) * 0.22, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  mark?.('f.nerves');
  ctx.setTransform(base);
  // ---- bloom composite
  if (doBloom) {
    const g2 = gB.getContext('2d')!;
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.globalCompositeOperation = 'source-over';
    g2.clearRect(0, 0, 270, 480);
    g2.filter = 'blur(5px)';
    g2.drawImage(gA, 0, 0);
    g2.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    // composite only the figure's screen bbox (final-space bbox x 280–800, y 150–1680, plus the blur reach)
    const bx0 = Math.max(0, Math.floor((S * 280 + TX) / 4) - 4);
    const by0 = Math.max(0, Math.floor((S * 150 + TY) / 4) - 4);
    const bx1 = Math.min(270, Math.ceil((S * 800 + TX) / 4) + 4);
    const by1 = Math.min(480, Math.ceil((S * 1680 + TY) / 4) + 4);
    if (bx1 > bx0 && by1 > by0) {
      const w = bx1 - bx0;
      const h = by1 - by0;
      ctx.globalAlpha = alpha * 0.9;
      ctx.drawImage(gB, bx0, by0, w, h, bx0 * 4, by0 * 4, w * 4, h * 4);
      ctx.globalAlpha = alpha * 0.5;
      ctx.drawImage(gA, bx0, by0, w, h, bx0 * 4, by0 * 4, w * 4, h * 4);
    }
  }
  ctx.restore();
  mark?.('f.bloomComp');
}

/** pulse frames (for the score): every soma firing at or after `from` up to `to` */
export function pulseFrames(from: number, to: number): number[] {
  const out: number[] = [];
  for (let f = PULSE_T0; f <= to; f += PULSE_PERIOD) if (f >= from) out.push(f);
  return out;
}
