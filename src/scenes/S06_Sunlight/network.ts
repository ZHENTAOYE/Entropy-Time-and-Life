// Beats 6–7: the light flow branches. Top-down "ground" space, centred on SPIRAL.
//  · a river-basin network (seen during the dive) and a rosette of leaves (vein networks) share one law:
//    space colonization + Murray's law (lib/growth.ts).
//  · gold light lands on the vein tips → flows inward, turning gold → green → teal (life);
//  · every junction sheds red IR sparks outward (the entropy tax paid at each step);
//  · finally everything is twisted into a whirlpool converging on SPIRAL (→ S07).
import { GrowthNode, grow } from '../../lib/growth';
import { SPIRAL } from '../../lib/handoff';
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { Cam, applyGround, groundScale } from './camera';
import { T, YOU_AT } from './timing';
import { netNodes } from './netData';

const C = { x: SPIRAL.x, y: SPIRAL.y };
/** 13 leaves (a Fibonacci number: the rosette shows 5 and 8 parastichies) on golden-angle phyllotaxis */
export const NLEAF = 13;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 137.5°

export interface Leaf {
  ang: number;
  len: number;
  wid: number;
  base: number;
  /** 0 = oldest / outermost … 1 = youngest / innermost */
  youth: number;
  nodes: GrowthNode[];
  maxStep: number;
  outline: Array<[number, number]>;
}

/** broad ovate blade: widest below the middle, rounded base, gently pointed tip */
const leafHalfWidth = (u: number, W: number) => W * Math.pow(Math.sin(Math.PI * Math.pow(clamp(u), 0.78)), 0.72) * (1 - 0.12 * u);

export const leaves = () => memo('s06:leaves', () => buildLeaves(false));

/** The rosette seen from above. Leaf k (k = 0 oldest) sits at k·137.5°; older leaves are longer, broader and darker,
 *  younger ones smaller and lighter and drawn on top (they overlap). `raw` = run the space-colonization growth
 *  (dev/gen-net-data.ts); otherwise decode the identical, pre-grown trees from netData.ts. */
export function buildLeaves(raw: boolean): Leaf[] {
  const r = mulberry32(1307);
  const out: Leaf[] = [];
  for (let k = 0; k < NLEAF; k++) {
    const youth = k / (NLEAF - 1);
    const ang = -Math.PI / 2 + 0.35 + k * GOLDEN_ANGLE + (r() - 0.5) * 0.08;
    const len = 400 * (0.36 + 0.64 * Math.pow(1 - youth, 0.85)) * (0.94 + 0.12 * r());
    const wid = len * (0.4 + 0.06 * r());
    const base = 16 + 26 * (1 - youth) * (0.8 + 0.4 * r()); // short petiole
    const bendS = (r() - 0.5) * 0.12;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const toG = (u: number, v: number): [number, number] => {
      const a = base + u * len;
      const bend = Math.sin(u * Math.PI) * len * bendS;
      return [C.x + ca * a - sa * (v + bend), C.y + sa * a + ca * (v + bend)];
    };
    const att: number[] = [];
    const nAtt = Math.round(360 * Math.pow(len / 400, 1.6));
    let tries = 0;
    while (att.length < 2 * nAtt && tries < 30000) {
      tries++;
      const u = r();
      const v = (r() * 2 - 1) * wid;
      if (Math.abs(v) > leafHalfWidth(u, wid) * 0.93) continue;
      const [x, y] = toG(u, v);
      att.push(x, y);
    }
    // midrib guide + petiole: a chain of attractors from the centre through the blade
    for (let a = 8; a < base + len * 0.9; a += 7) {
      const u = (a - base) / len;
      const [x, y] = u > 0 ? toG(u, 0) : [C.x + ca * a, C.y + sa * a];
      att.push(x, y);
    }
    const nodes = raw ? growNow(att, [[C.x + ca * 3, C.y + sa * 3]], 6, 52, 8, 240) : netNodes('leaf', k);
    const outline: Array<[number, number]> = [];
    for (let i = 0; i <= 48; i++) outline.push(toG(i / 48, leafHalfWidth(i / 48, wid)));
    for (let i = 48; i >= 0; i--) outline.push(toG(i / 48, -leafHalfWidth(i / 48, wid)));
    out.push({ ang, len, wid, base, youth, nodes, maxStep: nodes.reduce((m, n) => Math.max(m, n.step), 0), outline });
  }
  return out;
}

/** The river basin: one dendritic tree filling a disc (seen from orbit during the dive). */
export const river = () => memo('s06:river', () => buildRiver(false));
export function buildRiver(raw: boolean) {
  let nodes: GrowthNode[];
  if (raw) {
    const r = mulberry32(919);
    const att: number[] = [];
    while (att.length < 2 * 1100) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * 470;
      att.push(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr * 0.92);
    }
    nodes = growNow(att, [[C.x, C.y]], 7, 64, 10, 260);
  } else nodes = netNodes('river', 0);
  return { nodes, maxStep: nodes.reduce((m, n) => Math.max(m, n.step), 0) };
}

// space colonization via lib/growth.ts (uncached key per call: only used by the dev generator)
let growId = 0;
function growNow(att: number[], roots: Array<[number, number]>, step: number, influence: number, kill: number, maxSteps: number) {
  return grow(`s06-dev-${growId++}`, { attractors: att, roots, step, influence, kill, maxSteps });
}

// ---------------------------------------------------------------- flow paths (tip → root)
interface Paths {
  /** flattened node coordinates per path: [x0,y0,x1,y1,...] from tip to root */
  pts: Float32Array[];
  leaf: Uint8Array;
  junctions: Array<{ x: number; y: number; load: number; leaf: number }>;
  tips: Array<{ x: number; y: number; leaf: number }>;
}
export const paths = () =>
  memo('s06:paths', (): Paths => {
    const L = leaves();
    const pts: Float32Array[] = [];
    const leafIdx: number[] = [];
    const junctions: Paths['junctions'] = [];
    const tips: Paths['tips'] = [];
    L.forEach((lf, li) => {
      const nodes = lf.nodes;
      const kids = new Uint16Array(nodes.length);
      for (const n of nodes) if (n.parent >= 0) kids[n.parent]++;
      nodes.forEach((n, i) => {
        if (kids[i] >= 2 && n.load >= 3) junctions.push({ x: n.x, y: n.y, load: n.load, leaf: li });
        if (kids[i] === 0) {
          tips.push({ x: n.x, y: n.y, leaf: li });
          const arr: number[] = [];
          let j = i;
          while (j >= 0) {
            arr.push(nodes[j].x, nodes[j].y);
            j = nodes[j].parent;
          }
          if (arr.length >= 8) {
            pts.push(new Float32Array(arr));
            leafIdx.push(li);
          }
        }
      });
    });
    return { pts, leaf: new Uint8Array(leafIdx), junctions, tips };
  });

// ---------------------------------------------------------------- swirl (the vortex)
// The rosette is wound into a LOG SPIRAL: θ(r) = K·ln((R_OUT + CORE)/(r + CORE)) + rigid spin, with K → K_END = 5,
// the winding |k| of S07's whirlpool (S07 vortex.ts V.k = −5 in its Z-up world = clockwise on screen, as here).
// Leaf tips (r ≈ 440) to the sink (r ≈ 40) wind ≈ 1.6 turns at the cut.
export const K_END = 5;
const R_OUT = 700;
const CORE = 20;
const kShape = (f: number) => ease.inOutSine(seg(f, T.swirlStart - 6, T.end + 15));
/** winding coefficient (steady-ish at the cut: S07 carries the motion on) */
export const twistAmount = (frame: number) => (K_END * kShape(frame)) / kShape(T.end);
export const gfun = (r: number) => Math.log((R_OUT + CORE) / (r + CORE));
/** rigid spin (rad/frame), clockwise like S07's arm pattern speed */
export const SPIN0 = 0.0035;
export const spinAt = (frame: number) => SPIN0 * (frame - T.netGrowStart);
export const pullAt = (r: number, K: number) => 1 - 0.12 * ease.inQuad(clamp(K / K_END)) * (1 - clamp(r / 520));
/** ground point → twisted ground point */
export function twist(x: number, y: number, K: number, frame: number): [number, number] {
  const dx = x - C.x;
  const dy = y - C.y;
  const r = Math.hypot(dx, dy);
  if (r < 1e-3) return [x, y];
  const th = K * gfun(r) + spinAt(frame);
  const pull = pullAt(r, K);
  const c = Math.cos(th);
  const s = Math.sin(th);
  return [C.x + (dx * c - dy * s) * pull, C.y + (dx * s + dy * c) * pull];
}

export const LIFE = ['#FFC94A', '#FFD86A', '#D9E46A', '#9EE06A', '#6FD88A', '#45CF9C', '#2CC5A6', '#2AB8B0'];

/** Reveal 0..1 of the vein growth. */
export const netReveal = (frame: number) => ease.inOutSine(seg(frame, T.netGrowStart, T.netGrowEnd));

// the soft out-of-focus river web behind the rosette (320² raster, blurred once)
const RSPAN = 1000;
const riverSoft = () =>
  memo('s06:riverSoft', () => {
    const R = river();
    const S = 320;
    const k = S / RSPAN;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const NB = 5;
    const PP: Path2D[] = Array.from({ length: NB }, () => new Path2D());
    for (const n of R.nodes) {
      if (n.parent < 0) continue;
      const p = R.nodes[n.parent];
      const b = Math.max(0, Math.min(NB - 1, Math.floor(Math.log2(n.radius) * 0.9)));
      PP[b].moveTo((p.x - C.x) * k + S / 2, (p.y - C.y) * k + S / 2);
      PP[b].lineTo((n.x - C.x) * k + S / 2, (n.y - C.y) * k + S / 2);
    }
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < NB; b++) {
      ctx.strokeStyle = `rgba(110,210,150,${0.25 + b * 0.12})`;
      ctx.lineWidth = (2 + b * 1.5) * (S / 512);
      ctx.stroke(PP[b]);
    }
    const o = document.createElement('canvas');
    o.width = S;
    o.height = S;
    const oc = o.getContext('2d', { willReadFrequently: true })!;
    oc.filter = `blur(${(3 * S) / 512}px)`;
    oc.drawImage(c, 0, 0);
    return o;
  });

// river: static vector paths in ground space (crisp at every zoom), bucketed by Murray radius
const riverPaths = () =>
  memo('s06:riverPaths', () => {
    const R = river();
    const NB = 5;
    const PP: Path2D[] = Array.from({ length: NB }, () => new Path2D());
    for (const n of R.nodes) {
      if (n.parent < 0) continue;
      const p = R.nodes[n.parent];
      const b = Math.max(0, Math.min(NB - 1, Math.floor(Math.log2(n.radius) * 0.9)));
      PP[b].moveTo(p.x - C.x, p.y - C.y);
      PP[b].lineTo(n.x - C.x, n.y - C.y);
    }
    return PP;
  });

/** Draw the river copy — `k` = magnification relative to the leaf rosette. tint: 'water' (glinting rivers of
 *  light on dusk land during the dive: crisp 1–2.6 px lines + flowing dashes; the bloom pass adds the glow) or
 *  'far' (soft out-of-focus web behind the rosette). */
export function drawRiver(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, alpha: number, k: number, tint: 'water' | 'far' | 'glow' = 'water') {
  if (alpha <= 0.01) return;
  if (tint === 'far') {
    const img = riverSoft();
    ctx.save();
    ctx.translate(cam.sx, cam.sy);
    ctx.scale(groundScale(cam, k), groundScale(cam, k));
    ctx.rotate(0.6 + frame * 0.0015);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(img, -RSPAN / 2, -RSPAN / 2, RSPAN, RSPAN);
    ctx.restore();
    return;
  }
  const PP = riverPaths();
  const s = groundScale(cam, k);
  ctx.save();
  ctx.translate(cam.sx, cam.sy);
  ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const a = Math.min(1, alpha);
  for (let b = 0; b < PP.length; b++) {
    if (tint === 'glow') {
      ctx.strokeStyle = `rgba(255,190,90,${((0.25 + b * 0.15) * a).toFixed(3)})`;
      ctx.lineWidth = (4 + b * 2) / s;
    } else {
      // sunlight glinting on water at dusk: fine tributaries dim, the trunk bright
      ctx.strokeStyle = `rgba(255,${200 + b * 10},${120 + b * 25},${((0.38 + b * 0.15) * a).toFixed(3)})`;
      ctx.lineWidth = (0.8 + b * 0.45) / s;
    }
    ctx.stroke(PP[b]);
  }
  if (tint === 'water') {
    // light flowing down the main channels towards the mouth (screen-constant dash length & speed)
    ctx.setLineDash([16 / s, 52 / s]);
    ctx.lineDashOffset = (frame * 6) / s;
    ctx.strokeStyle = `rgba(255,246,220,${(0.85 * a).toFixed(3)})`;
    ctx.lineWidth = 2 / s;
    ctx.stroke(PP[PP.length - 1]);
    ctx.lineWidth = 1.4 / s;
    ctx.stroke(PP[PP.length - 2]);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** the moment 你 lights up in the caption: the sink takes one deep, bright beat */
export const youPulse = (frame: number) => {
  const t = frame - YOU_AT;
  return t < 0 ? 0 : (1 - Math.exp(-t / 3)) * Math.exp(-t / 22);
};

/** CPU part of the network: arriving sunlight, IR sparks at the junctions, the sink. */
export function drawNetwork(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, alpha: number, glow = false) {
  if (alpha <= 0.01) return;
  const K = twistAmount(frame);
  const reveal = netReveal(frame);
  ctx.save();
  applyGround(ctx, cam);
  const tw = (x: number, y: number) => twist(x, y, K, frame);
  const PA = paths();
  ctx.globalCompositeOperation = 'lighter';

  // ---- sunlight arriving from above (the Sun is behind the camera): photons fall away from us, converging
  //      towards their landing points (perspective), then flash on the vein tips.
  if (!glow) {
    const landOn = alpha * seg(frame, T.netGrowStart + 16, T.netGrowStart + 46);
    if (landOn > 0.01) {
      const streaks = new Path2D();
      const flashes = new Path2D();
      for (let i = 0; i < PA.tips.length; i++) {
        const per = 40 + Math.floor(hash01(i, 61) * 36);
        const ph = Math.floor(hash01(i, 62) * per);
        const tt = (frame + ph) % per;
        if (tt >= 18) continue;
        const tip = PA.tips[i];
        if (Math.hypot(tip.x - C.x, tip.y - C.y) > 40 + reveal * 480) continue;
        const [x, y] = tw(tip.x, tip.y);
        if (tt < 9) {
          const k0 = 0.42 * (1 - tt / 9);
          const k1 = 0.42 * (1 - (tt - 2.5) / 9);
          const ox = x - C.x + 40;
          const oy = y - C.y + 40;
          streaks.moveTo(x + ox * k1, y + oy * k1);
          streaks.lineTo(x + ox * k0, y + oy * k0);
        } else {
          const k = 1 - (tt - 9) / 9;
          const rr = 1.2 + 2.2 * k;
          flashes.rect(x - rr, y - rr, 2 * rr, 2 * rr);
        }
      }
      ctx.strokeStyle = `rgba(255,214,120,${0.6 * landOn})`;
      ctx.lineWidth = 1.3;
      ctx.stroke(streaks);
      ctx.fillStyle = `rgba(255,236,170,${0.7 * landOn})`;
      ctx.fill(flashes);
    }
  }

  // ---- red IR sparks shed at the junctions, flying outward (the entropy tax)
  const sparkOn = alpha * seg(frame, T.netGrowStart + 24, T.netGrowEnd);
  if (sparkOn > 0.01) {
    const SP = new Path2D();
    const SH = new Path2D();
    const boost = 1 + 1.2 * seg(frame, T.swirlStart, T.end);
    for (let j = 0; j < PA.junctions.length; j++) {
      const J = PA.junctions[j];
      if (Math.hypot(J.x - C.x, J.y - C.y) > 30 + reveal * 470) continue;
      const per = Math.max(8, Math.round((44 - Math.min(30, J.load * 0.8)) / boost));
      const ph = Math.floor(hash01(j, 71) * per);
      const life = 30;
      for (let gen = 0; gen < 2; gen++) {
        const born = Math.floor((frame + ph) / per) * per - ph - gen * per;
        const age = frame - born;
        if (age < 0 || age > life) continue;
        const sd = j * 131 + born;
        const [jx, jy] = tw(J.x, J.y);
        const ra = Math.atan2(jy - C.y, jx - C.x) + (hash01(sd, 72) - 0.5) * 1.6;
        const sp = 1.8 + hash01(sd, 73) * 2.6;
        const d = sp * age * (1 - age / (life * 2.6));
        const x = jx + Math.cos(ra) * d;
        const y = jy + Math.sin(ra) * d;
        const tail = Math.max(0, d - 12);
        const k = 1 - age / life;
        const target = k > 0.5 ? SH : SP;
        target.moveTo(jx + Math.cos(ra) * tail, jy + Math.sin(ra) * tail);
        target.lineTo(x, y);
      }
    }
    ctx.strokeStyle = glow ? `rgba(255,59,47,${0.7 * sparkOn})` : `rgba(255,90,66,${0.95 * sparkOn})`;
    ctx.lineWidth = glow ? 7 : 2.2;
    ctx.stroke(SH);
    ctx.strokeStyle = glow ? `rgba(160,20,30,${0.5 * sparkOn})` : `rgba(210,40,40,${0.6 * sparkOn})`;
    ctx.lineWidth = glow ? 5 : 1.5;
    ctx.stroke(SP);
  }

  // ---- the sink (where all the flows converge): grows into S07's white-green core at the cut
  const sinkOn = alpha * seg(frame, T.netGrowStart + 8, T.netGrowStart + 42);
  if (sinkOn > 0.01) {
    const pulse = 0.85 + 0.15 * Math.sin(frame * 0.3) + 0.5 * youPulse(frame);
    const grow = ease.inOutSine(seg(frame, T.swirlStart, T.end));
    const R = (glow ? 70 : 42) * (1 + 0.8 * grow + 0.7 * youPulse(frame));
    const g = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R);
    // (the bloom copy of the eye eases off as it grows, so the cut shows S07's small white-green core, not a blow-out)
    const gk = glow ? 1 - 0.45 * grow : 1;
    g.addColorStop(0, `rgba(255,252,232,${(glow ? 0.55 * gk : 0.92) * sinkOn * pulse})`);
    g.addColorStop(0.2, `rgba(240,255,210,${(glow ? 0.35 * gk : 0.62) * sinkOn})`);
    g.addColorStop(0.42, `rgba(158,224,106,${(glow ? 0.22 * gk : 0.4) * sinkOn})`);
    g.addColorStop(0.65, `rgba(44,197,166,${0.22 * sinkOn})`);
    g.addColorStop(1, 'rgba(44,197,166,0)');
    ctx.fillStyle = g;
    ctx.fillRect(C.x - R, C.y - R, 2 * R, 2 * R);
    if (!glow && grow > 0.01) {
      // the wide green-teal glow of the whirlpool's eye
      const R2 = 160 * grow;
      const g2 = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R2);
      g2.addColorStop(0, `rgba(190,250,200,${0.3 * grow * sinkOn})`);
      g2.addColorStop(0.45, `rgba(60,200,160,${0.14 * grow * sinkOn})`);
      g2.addColorStop(1, 'rgba(44,197,166,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(C.x - R2, C.y - R2, 2 * R2, 2 * R2);
    }
  }
  ctx.restore();
}

/** Beat 7: faint whirlpool streamlines (the flow field becoming visible) on the same log spiral. */
export function drawStreamlines(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  const on = ease.inOutSine(seg(frame, T.swirlStart + 10, T.end));
  if (on <= 0.01) return;
  ctx.save();
  applyGround(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const K = flowK(twistAmount(frame));
  const spin = spinAt(frame);
  const P = new Path2D();
  const NS = 48;
  for (let i = 0; i < NS; i++) {
    const a0 = (i / NS) * Math.PI * 2 + hash01(i, 5) * 0.2;
    const r0 = 520 + hash01(i, 6) * 300;
    const ph = ((frame * (0.9 + hash01(i, 7) * 0.6)) / 60 + hash01(i, 8)) % 1;
    for (let k = 0; k <= 14; k++) {
      const u = ph * 0.8 + (k / 14) * 0.2;
      const r = r0 * Math.pow(1 - u, 1.3) + 20;
      const th = a0 + K * gfun(r) + spin;
      const x = C.x + Math.cos(th) * r;
      const y = C.y + Math.sin(th) * r;
      if (k === 0) P.moveTo(x, y);
      else P.lineTo(x, y);
    }
  }
  ctx.strokeStyle = `rgba(150,230,200,${0.1 * on})`;
  ctx.lineWidth = 1.2;
  ctx.stroke(P);
  ctx.restore();
}

/** the inflow follows the leaves' log spiral, a little tighter while the rosette is still flat */
const flowK = (K: number) => K + 1.4 * (1 - K / K_END);

/** Beat 7: the gathering — dense streams from beyond the frame spiral in along the wound leaves towards the sink
 *  (→ S07's whirlpool): one stream per leaf (its arm) plus a diffuse inflow; coloured by radius gold → olive → teal. */
export function drawInflow(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glow = false) {
  const on = ease.inOutSine(seg(frame, T.swirlStart - 26, T.end - 24));
  if (on <= 0.01) return;
  ctx.save();
  applyGround(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const K = flowK(twistAmount(frame));
  const spin = spinAt(frame);
  const L = leaves();
  const NB = LIFE.length;
  const FP: Path2D[] = Array.from({ length: NB }, () => new Path2D());
  const NP = glow ? 700 : 1500;
  const acc = 0.6 + 1.6 * ease.inQuad(seg(frame, T.swirlStart, T.end));
  // phase integrates the accelerating speed (closed form of ∫acc dt)
  const t0 = T.swirlStart - 26;
  const tt = Math.max(0, frame - t0);
  const span = T.end - t0;
  const q = clamp(tt / span);
  const travelled = 0.6 * tt + 1.6 * span * (q * q * q) / 3;
  const pos = (a0: number, r0: number, uu: number): [number, number, number] => {
    const r = r0 * Math.pow(1 - uu, 1.25) + 16;
    const th = a0 + K * gfun(r) + spin;
    const pull = pullAt(r, K);
    return [C.x + Math.cos(th) * r * pull, C.y + Math.sin(th) * r * pull, r];
  };
  for (let i = 0; i < NP; i++) {
    const arm = hash01(i, 800) < 0.72;
    const lf = L[i % NLEAF];
    const a0 = arm ? lf.ang + (hash01(i, 801) - 0.5) * 0.3 * (0.5 + lf.wid / 300) : hash01(i, 801) * Math.PI * 2;
    const r0 = 720 + hash01(i, 802) * 260;
    const sp = 0.0024 + hash01(i, 803) * 0.0018;
    const u = (hash01(i, 804) + travelled * sp) % 1;
    const du = 0.04 + 0.035 * acc;
    const [x1, y1, r1] = pos(a0, r0, u);
    const fadeIn = clamp(u / 0.12);
    if (fadeIn <= 0.05) continue;
    const b = Math.max(0, Math.min(NB - 1, Math.floor((1 - (r1 - 40) / 560) * NB)));
    const path = FP[b];
    path.moveTo(x1, y1);
    for (let k = 1; k <= 3; k++) {
      const [x, y] = pos(a0, r0, Math.max(0, u - (du * k) / 3));
      path.lineTo(x, y);
    }
  }
  for (let b = 0; b < NB; b++) {
    ctx.strokeStyle = LIFE[b];
    ctx.globalAlpha = on * (glow ? 0.3 : 0.6) * (0.55 + 0.45 * (b / NB));
    ctx.lineWidth = glow ? 6 : 1.4;
    ctx.stroke(FP[b]);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
