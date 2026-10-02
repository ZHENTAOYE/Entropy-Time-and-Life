// Beat A/B — the zero row of S03 becomes the ARROW OF TIME (vertical, future up). A plume of gold dust leaves the
// tail and rises along it, spreading sideways as it ages (σ ∝ age^0.75): the higher (later) you look along the
// arrow, the wider the dust — the arrow simply points the way the spreading goes. Width brackets measure it.
// Then the flow clock stalls and runs backward: the plume narrows and falls back into the tail (越早，熵越低), the
// S-gauge falls red, and the camera dives into the tail point, which opens (iris) onto the cosmos.
import { ZERO_LINE, COLOR } from '../../lib/handoff';
import { clamp, ease, lerp, memo, mixHex, prog, seg, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { T } from './timing';

export const TAIL_Y = 1290;
export const TIP_Y = 340;
const AX = 540;

// ───────────────────────── flow clock (seconds of plume time; closed form) ─────────────────────────
const R_BACK = 2.6; // backward speed
export function flowClock(f: number): number {
  const f0 = T.plume0 + 16; // dust starts once the line is nearly vertical
  if (f <= f0) return 0;
  const a = T.stall,
    b = T.stallEnd;
  const tauA = (a - f0) / 30;
  if (f <= a) return (f - f0) / 30;
  const span = (b - a) / 30;
  if (f <= b) {
    const u = (f - a) / (b - a);
    // rate goes linearly 1 → −R_BACK
    return tauA + span * (u - ((1 + R_BACK) / 2) * u * u);
  }
  const tauB = tauA + span * (1 - (1 + R_BACK) / 2);
  return Math.max(0, tauB - (R_BACK * (f - b)) / 30);
}
/** d(flowClock)/df sign: true while the clock runs backward */
export const flowFalling = (f: number) => f > T.stall + (T.stallEnd - T.stall) / (1 + R_BACK) && flowClock(f) > 0.001;

// ───────────────────────── geometry ─────────────────────────
export interface ArrowGeom {
  tx: number; // tail
  ty: number;
  hx: number; // tip
  hy: number;
  dx: number; // unit direction tail → tip
  dy: number;
  len: number;
  barb: number;
  col: string;
  core: string;
}
export function arrowGeom(f: number): ArrowGeom {
  const th = -Math.PI / 2 * prog(f, T.rotate[0], T.rotate[1], ease.inOutCubic);
  const kc = prog(f, T.rotate[0] + 6, T.extend[1], ease.inOutCubic);
  const cx = AX;
  const cy = lerp(ZERO_LINE.y, (TAIL_Y + TIP_Y) / 2, kc);
  const L = lerp((ZERO_LINE.x1 - ZERO_LINE.x0) / 2, (TAIL_Y - TIP_Y) / 2, prog(f, T.extend[0], T.extend[1], ease.inOutCubic));
  const dx = Math.cos(th),
    dy = Math.sin(th);
  const kcol = prog(f, 8, 48, ease.inOutSine);
  return {
    tx: cx - L * dx,
    ty: cy - L * dy,
    hx: cx + L * dx,
    hy: cy + L * dy,
    dx,
    dy,
    len: 2 * L,
    barb: 52 * prog(f, T.headGrow[0], T.headGrow[1], ease.outCubic) + 16 * prog(f, 40, 70),
    col: mixHex(COLOR.amber, COLOR.orderGold, kcol),
    core: mixHex('#FFD9A8', '#FFF4D6', kcol),
  };
}

// ───────────────────────── plume particles ─────────────────────────
interface Plume {
  n: number;
  b: Float32Array; // birth (plume s)
  v: Float32Array; // speed px/s
  g: Float32Array; // lateral gaussian
  s: Float32Array; // size
  ph: Float32Array;
}
const N = 3400;
function plume(): Plume {
  return memo('s04:plume', () => {
    const r = mulberry32(4404);
    const P: Plume = { n: N, b: new Float32Array(N), v: new Float32Array(N), g: new Float32Array(N), s: new Float32Array(N), ph: new Float32Array(N) };
    for (let i = 0; i < N; i++) {
      P.b[i] = r() * 2.4;
      P.v[i] = 470 + r() * 120;
      const gg = (r() + r() + r() + r() - 2) * 1.22;
      P.g[i] = Math.max(-2.6, Math.min(2.6, gg));
      P.s[i] = 0.7 + Math.pow(r(), 3) * 2.2;
      P.ph[i] = r() * 6.283;
    }
    return P;
  });
}
const sigma = (a: number) => 2.5 + 78 * Math.pow(Math.max(0, a), 0.78);
const V_MEAN = 525;

// ───────────────────────── sprites ─────────────────────────
function sprite(key: string, rgb: [number, number, number], core = 0.55): HTMLCanvasElement {
  return memo('s04:sprite:' + key, () => {
    const S = 32;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    const [r, gg, b] = rgb;
    g.addColorStop(0, `rgba(255,255,255,1)`);
    g.addColorStop(0.12, `rgba(${r},${gg},${b},${core + 0.4})`);
    g.addColorStop(0.35, `rgba(${r},${gg},${b},${core * 0.5})`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  });
}
/** a static half-res star canvas (cool palette, power-law brightness), drawn once per tab */
function starCanvas(): HTMLCanvasElement {
  return memo('s04:stars', () => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1920;
    const x = c.getContext('2d')!;
    const r = mulberry32(4141);
    const cols = ['#A9B8FF', '#D6E6FF', '#E8F0FF', '#FFF4EA', '#C0CCFF', '#9E8CFF'];
    for (let i = 0; i < 1500; i++) {
      const px = r() * 1080,
        py = r() * 1920;
      const m = Math.pow(r(), 3.4);
      x.globalAlpha = 0.18 + 0.82 * m;
      x.fillStyle = cols[Math.floor(r() * cols.length)];
      const s = 0.7 + 1.5 * m;
      x.fillRect(px - s / 2, py - s / 2, s, s);
      if (m > 0.55) {
        const R = 4 + 7 * m;
        const g = x.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, 'rgba(220,230,255,0.45)');
        g.addColorStop(1, 'rgba(220,230,255,0)');
        x.globalAlpha = 1;
        x.fillStyle = g;
        x.fillRect(px - R, py - R, 2 * R, 2 * R);
      }
    }
    return c;
  });
}
function scratch(key: string, w: number, h: number): HTMLCanvasElement {
  const c = memo('s04:scratch:' + key, () => document.createElement('canvas'));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

// ───────────────────────── camera of beat B (dive into the tail) ─────────────────────────
export function diveZoom(f: number): number {
  return Math.exp(Math.log(30) * ease.inQuad(seg(f, T.dive[0], T.dive[1])));
}
export function irisRadius(f: number): number {
  return 1550 * ease.inCubic(seg(f, T.iris[0], T.iris[1]));
}

/** S-gauge value during A/B (0..1): follows the width of the plume */
export function gaugeAB(f: number): number {
  return 0.3 + 0.13 * flowClock(f);
}

/** Draw the whole arrow beat (opaque background, with a hole for the iris once it opens). */
export function drawArrow(ctx: CanvasRenderingContext2D, f: number) {
  const G = arrowGeom(f);
  const tau = flowClock(f);
  const Z = diveZoom(f);
  const split = 5 * smoothstep(T.rewindHud, T.rewindHud + 10, f) * (1 - smoothstep(T.dive[0] + 10, T.dive[1], f));
  const W = 1080,
    H = 1920;

  // ── emissive content (transparent canvas; background added behind afterwards)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // camera: zoom about the tail (the dive)
  const px = G.tx,
    py = G.ty;
  ctx.translate(px, py);
  ctx.scale(Z, Z);
  ctx.translate(-px, -py);

  const nx = -G.dy,
    ny = G.dx; // perpendicular (right of the arrow when vertical)
  // ruler ticks along the shaft (the time axis)
  const kr = prog(f, T.ruler[0], T.ruler[1], ease.outCubic);
  if (kr > 0) {
    ctx.strokeStyle = G.col;
    ctx.lineWidth = 1.2 / Math.sqrt(Z);
    for (let k = 1; k * 38 < G.len - 30; k++) {
      const u = k * 38;
      const vis = clamp((kr * G.len - u) / 60);
      if (vis <= 0) continue;
      const major = k % 5 === 0;
      const hl = major ? 13 : 6;
      ctx.globalAlpha = (major ? 0.42 : 0.22) * vis;
      const x = G.tx + G.dx * u,
        y = G.ty + G.dy * u;
      ctx.beginPath();
      ctx.moveTo(x - nx * hl, y - ny * hl);
      ctx.lineTo(x + nx * hl, y + ny * hl);
      ctx.stroke();
    }
  }

  // the light volume of the plume: a soft fan that widens with age (drawn as three nested cones)
  const front0 = Math.min(G.len + 60, tau * 560);
  if (front0 > 20) {
    for (const [wk, al] of [
      [2.3, 0.035],
      [1.4, 0.05],
      [0.7, 0.07],
    ] as Array<[number, number]>) {
      ctx.beginPath();
      const steps = 24;
      for (let k = 0; k <= steps; k++) {
        const u = (front0 * k) / steps;
        const hw = wk * sigma(u / V_MEAN) + 3;
        ctx.lineTo(G.tx + G.dx * u + nx * hw, G.ty + G.dy * u + ny * hw);
      }
      for (let k = steps; k >= 0; k--) {
        const u = (front0 * k) / steps;
        const hw = wk * sigma(u / V_MEAN) + 3;
        ctx.lineTo(G.tx + G.dx * u - nx * hw, G.ty + G.dy * u - ny * hw);
      }
      ctx.closePath();
      const lg = ctx.createLinearGradient(G.tx, G.ty, G.tx + G.dx * front0, G.ty + G.dy * front0);
      lg.addColorStop(0, `rgba(255,214,140,${al * 2.2})`);
      lg.addColorStop(0.5, `rgba(255,190,90,${al})`);
      lg.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = lg;
      ctx.fill();
    }
  }

  // plume of dust
  const P = plume();
  const spG = sprite('gold', [255, 201, 74]);
  const spW = sprite('white', [255, 236, 190], 0.7);
  const spR = sprite('red', [255, 50, 70], 0.5);
  const spC = sprite('cyan', [40, 210, 255], 0.5);
  const front = tau * 590;
  for (let i = 0; i < P.n; i++) {
    const a = tau - P.b[i];
    if (a <= 0) continue;
    const u = P.v[i] * a * (1 - 0.04 * a);
    if (u > G.len + 140) continue;
    const sg = sigma(a);
    const wob = Math.sin(P.ph[i] + a * 3.1) * (2 + sg * 0.12);
    const w = P.g[i] * sg + wob;
    const x = G.tx + G.dx * u + nx * w;
    const y = G.ty + G.dy * u + ny * w;
    const dens = Math.pow(1 / (1 + sg / 18), 0.55);
    let al = 0.95 * dens * smoothstep(0, 0.06, a) * (1 - smoothstep(G.len - 70, G.len + 130, u));
    if (al < 0.01) continue;
    const r = (P.s[i] * (1.6 + 0.9 * dens)) / Math.sqrt(Z);
    const s = r * 4.2;
    ctx.globalAlpha = al;
    ctx.drawImage(a < 0.35 ? spW : spG, x - s / 2, y - s / 2, s, s);
    if (split > 0.2) {
      ctx.globalAlpha = al * 0.55;
      ctx.drawImage(spR, x - s / 2 + split, y - s / 2, s, s);
      ctx.drawImage(spC, x - s / 2 - split, y - s / 2, s, s);
    }
  }

  // width brackets: the spread measured at five moments along the arrow
  const kb = prog(f, T.brackets, T.brackets + 20);
  if (kb > 0) {
    ctx.strokeStyle = G.col;
    ctx.lineWidth = 1.1 / Math.sqrt(Z);
    for (let k = 1; k <= 4; k++) {
      const u = 175 * k + 40;
      const vis = clamp((front - u) / 120) * kb * (1 - smoothstep(T.dive[0], T.dive[0] + 18, f));
      if (vis <= 0.01) continue;
      const hw = 1.9 * sigma(u / V_MEAN) * ease.outCubic(vis);
      const x = G.tx + G.dx * u,
        y = G.ty + G.dy * u;
      ctx.globalAlpha = 0.55 * vis;
      ctx.beginPath();
      ctx.moveTo(x - nx * hw, y - ny * hw);
      ctx.lineTo(x + nx * hw, y + ny * hw);
      for (const sgn of [-1, 1]) {
        const ex = x + nx * hw * sgn,
          ey = y + ny * hw * sgn;
        ctx.moveTo(ex - G.dx * 7, ey - G.dy * 7);
        ctx.lineTo(ex + G.dx * 7, ey + G.dy * 7);
      }
      ctx.stroke();
    }
  }

  // the shaft (glow passes + core)
  const passes: Array<[number, number]> = [
    [44, 0.045],
    [20, 0.09],
    [8, 0.24],
    [3.4, 0.95],
  ];
  const drawShaft = (lw: number, al: number, col: string) => {
    ctx.globalAlpha = al;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw / Math.sqrt(Z);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(G.tx, G.ty);
    ctx.lineTo(G.hx, G.hy);
    if (G.barb > 0.5) {
      const ca = Math.cos(0.5),
        sa = Math.sin(0.5);
      // two barbs, swept back from the tip
      const bx = -G.dx,
        by = -G.dy;
      ctx.moveTo(G.hx, G.hy);
      ctx.lineTo(G.hx + (bx * ca - by * sa) * G.barb, G.hy + (bx * sa + by * ca) * G.barb);
      ctx.moveTo(G.hx, G.hy);
      ctx.lineTo(G.hx + (bx * ca + by * sa) * G.barb, G.hy + (-bx * sa + by * ca) * G.barb);
    }
    ctx.stroke();
  };
  const shaftK = 1 - 0.55 * smoothstep(T.dive[0] + 8, T.dive[1] - 8, f);
  // the turn leaves a faint sweep (a long exposure of the rotating line)
  if (f > T.rotate[0] && f < T.rotate[1] + 6) {
    for (let k = 1; k <= 7; k++) {
      const g0 = arrowGeom(f - k * 1.2);
      ctx.globalAlpha = 0.11 * (1 - k / 8) * Math.sin(Math.PI * seg(f, T.rotate[0], T.rotate[1] + 6));
      ctx.strokeStyle = G.col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g0.tx, g0.ty);
      ctx.lineTo(g0.hx, g0.hy);
      ctx.stroke();
    }
  }
  for (const [lw, al] of passes) drawShaft(lw, al * shaftK, lw < 4 ? G.core : G.col);

  // tail point: the low-entropy seed (brighter as the dust falls back into it)
  const gather = smoothstep(T.stall + 8, T.stallEnd + 26, f);
  const emit = smoothstep(T.plume0 + 16, T.plume0 + 30, f);
  const tk = (0.35 + 0.65 * emit + 1.1 * gather) * smoothstep(30, 52, f) * (1 - smoothstep(T.iris[0] + 6, T.iris[0] + 26, f));
  if (tk > 0.01) {
    const R = 46 + 40 * gather;
    const g = ctx.createRadialGradient(G.tx, G.ty, 0, G.tx, G.ty, R);
    g.addColorStop(0, `rgba(255,248,226,${Math.min(1, 0.95 * tk)})`);
    g.addColorStop(0.18, `rgba(255,214,120,${0.55 * tk})`);
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(G.tx - R, G.ty - R, 2 * R, 2 * R);
  }
  ctx.restore();

  // dive: radial speed lines rushing out of the tail point
  const kd = seg(f, T.dive[0], T.dive[1]);
  if (kd > 0 && kd < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = COLOR.orderGold;
    const r = mulberry32(77);
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const sp = 0.6 + r();
      const ph = r();
      const q = (kd * (1.5 + sp) + ph) % 1;
      const r0 = 40 + Math.pow(q, 2.2) * 1700;
      const r1 = r0 + (30 + 260 * q) * kd;
      ctx.globalAlpha = 0.35 * Math.sin(Math.PI * q) * Math.sin(Math.PI * kd);
      ctx.lineWidth = 1 + 2 * q;
      ctx.beginPath();
      ctx.moveTo(G.tx + Math.cos(a) * r0, G.ty + Math.sin(a) * r0);
      ctx.lineTo(G.tx + Math.cos(a) * r1, G.ty + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── bloom: a blurred quarter-res copy of the emissive layer, added back
  const c = ctx.canvas;
  const bw = Math.round(c.width / 4),
    bh = Math.round(c.height / 4);
  const bc = scratch('bloom', bw, bh);
  const bx = bc.getContext('2d')!;
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.globalCompositeOperation = 'source-over';
  bx.filter = 'none';
  bx.clearRect(0, 0, bw, bh);
  bx.filter = `blur(${Math.max(2, 6 * (bw / 270))}px)`;
  bx.drawImage(c, 0, 0, bw, bh);
  bx.filter = 'none';

  // ── background behind
  ctx.save();
  ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  const kbg = prog(f, T.bg[0], T.bg[1], ease.inOutSine);
  // starfield (behind the arrow): cached, pushed with the dive camera
  if (kbg > 0.01) {
    const zs = Math.pow(Z, 0.35);
    ctx.globalAlpha = 0.5 * kbg;
    const sw = W * zs,
      sh = H * zs;
    ctx.drawImage(starCanvas(), G.tx - (G.tx / W) * sw, G.ty - (G.ty / H) * sh - f * 0.12, sw, sh);
    ctx.globalAlpha = 1;
  }
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, mixHex('#070604', '#02030A', kbg));
  bg.addColorStop(0.55, mixHex('#070604', '#050719', kbg));
  bg.addColorStop(1, mixHex('#070604', '#0B0F2E', kbg));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.75;
  ctx.drawImage(bc, 0, 0, W, H);
  ctx.restore();

  // ── iris: the tail point opens onto the cosmos (the CosmicWeb layer is underneath)
  const R = irisRadius(f);
  if (R > 0.5) {
    ctx.save();
    ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    const soft = 18 + R * 0.08;
    const g = ctx.createRadialGradient(G.tx, G.ty, Math.max(0, R - soft), G.tx, G.ty, R + soft);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(G.tx, G.ty, R + soft, 0, Math.PI * 2);
    ctx.fill();
    // the rim of light
    ctx.globalCompositeOperation = 'lighter';
    const ka = 1 - smoothstep(700, 1500, R);
    for (const [lw, al] of [
      [26, 0.07],
      [9, 0.16],
      [2.5, 0.8],
    ] as Array<[number, number]>) {
      ctx.globalAlpha = al * ka;
      ctx.strokeStyle = lw < 3 ? '#FFF1CC' : COLOR.orderGold;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(G.tx, G.ty, R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
