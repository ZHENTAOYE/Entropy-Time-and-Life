// Beats 7–10: the probability written out. 「P = 0.000…」, each zero exactly 1 mm (a ruler underneath), the camera
// rides along the row, then pulls back by powers of ten (书桌 → 城市 → 地球 → 太阳系 → 银河系) until the row of
// 2.5×10²⁴ zeros (2.6×10⁵ light-years) spans the frame from x 90 to 990 with the Milky Way sitting on it.
import { drawGalaxy, drawStarfield } from '../../lib/cosmos';
import { clamp, ease, lerp, memo, seg, smoothstep } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { makeNoise } from '../../lib/noise';
import { C, LY, ROW, T } from './constants';
import { Ctx, MONO, SANS, dimLineH, drawRich, glow, rgbaHex, sup } from './paint';

// ------------------------------------------------------------------ camera
const S0 = 43200; // px per metre at the start: 1 mm = 43.2 px
export const Z0 = Math.log10(1080 / S0);
export const ZEND = Math.log10((1080 * ROW.lengthM) / 900);
const PREFIX_W = 2 * ROW.adv; // 「0.」
const CW0 = (540 - (ROW.x0 + PREFIX_W)) / S0; // camera world x at the start (world 0 = first zero's left edge)

/** ride displacement in px at S0 */
function ridePx(f: number): number {
  const tau = f - T.ride;
  if (tau <= 0) return 0;
  const A = 34;
  const V = 64;
  return tau <= A ? (V * tau ** 3) / (3 * A * A) : (V * A) / 3 + V * (tau - A);
}
export function rideV(f: number): number {
  const tau = f - T.ride;
  if (tau <= 0) return 0;
  return 64 * Math.min(1, tau / 34) ** 2;
}

interface Key {
  f: number;
  z: number;
  m: number;
}
const KEYS: Key[] = [
  { f: T.zoom, z: Z0, m: 0 },
  { f: 578, z: 0.35, m: 0.05 },
  { f: 600, z: 4.25, m: 0.06 },
  { f: 620, z: 7.45, m: 0.06 },
  { f: 643, z: 13.1, m: 0.07 },
  { f: T.zoomEnd, z: ZEND, m: 0 },
];
export const STOPS = { desk: 578, city: 600, earth: 620, solar: 643, galaxy: T.zoomEnd } as const;

export function zoomZ(f: number): number {
  if (f <= KEYS[0].f) return Z0;
  if (f >= KEYS[KEYS.length - 1].f) return ZEND;
  let i = 0;
  while (f > KEYS[i + 1].f) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const h = b.f - a.f;
  const t = (f - a.f) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a.z + (t3 - 2 * t2 + t) * h * a.m + (-2 * t3 + 3 * t2) * b.z + (t3 - t2) * h * b.m;
}
export const zoomDz = (f: number) => zoomZ(f + 0.5) - zoomZ(f - 0.5);

export interface Cam {
  s: number; // px per metre
  z: number;
  cw: number; // world x at the pivot
  px: number; // pivot screen x
  X: (w: number) => number;
  Y: (wy: number) => number;
}
export function camAt(f: number): Cam {
  const z = zoomZ(f);
  const s = 1080 / Math.pow(10, z);
  const cw = CW0 + ridePx(f) / S0;
  // the pivot slides from the centre to the row start while only stars are on screen (row ends at 90 → 990)
  const k = smoothstep(15.6, 20.9, z);
  const px = lerp(540, ROW.x0 + cw * s, k);
  return { s, z, cw, px, X: (w) => px + (w - cw) * s, Y: (wy) => ROW.y + wy * s };
}

/** bell visibility of a context layer in log-scale z */
const bell = (z: number, lo: number, hi: number, soft = 0.7) => smoothstep(lo, lo + soft, z) * (1 - smoothstep(hi - soft, hi, z));

// ------------------------------------------------------------------ the row
function zeroSprite(): HTMLCanvasElement {
  return memo('S03:zero', () => {
    const c = document.createElement('canvas');
    c.width = 88;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.font = MONO(144, 400);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = C.pale;
    g.fillText('0', 44, 106);
    return c;
  });
}

/** opacity of the whole row/line sequence */
export function rowAlpha(f: number) {
  return seg(f, T.row, T.row + 3);
}

/** number of zeros typed so far (type-on at the start) */
function typed(f: number) {
  return Math.floor(Math.max(0, f - T.row) * 1.6);
}

export function drawRow(ctx: Ctx, f: number, lineBoost = 0) {
  if (f < T.row) return;
  const cam = camAt(f);
  const A = rowAlpha(f);
  const adv = 1e-3 * cam.s;
  const y = ROW.y;
  const x0 = cam.X(0);
  const xEnd = cam.X(ROW.lengthM);
  const visL = Math.max(-100, x0);
  const visR = Math.min(1180, xEnd);
  const glyphMode = clamp((adv - 10) / 6); // 1 = zeros as glyphs
  const lineMode = clamp((5 - adv) / 3); // 1 = solid line
  const v = rideV(f) * (adv / ROW.adv);
  ctx.save();
  // ── zeros as glyphs (with motion blur while riding)
  if (glyphMode > 0.003) {
    const spr = zeroSprite();
    const sh = (adv / 0.6) * (128 / 144);
    const sw = (adv / 0.6) * (88 / 144);
    const i0 = Math.max(0, Math.floor((visL - x0) / adv) - 1);
    const i1 = Math.min(typed(f) - 1, Math.ceil((visR - x0) / adv) + 1);
    const ghosts = v > 4 ? 4 : 1;
    for (let g = 0; g < ghosts; g++) {
      const off = ghosts > 1 ? (g / (ghosts - 1)) * v * 0.9 : 0;
      ctx.globalAlpha = A * glyphMode * (ghosts > 1 ? (g === 0 ? 0.55 : 0.28) : 1);
      for (let i = i0; i <= i1; i++) {
        const cx = x0 + (i + 0.5) * adv + off;
        ctx.drawImage(spr, cx - sw / 2, y + sh * 0.18 - sh * 0.83 + 4, sw, sh);
      }
    }
    // 「0.」 prefix
    ctx.globalAlpha = A * glyphMode;
    ctx.font = MONO(adv / 0.6, 400);
    ctx.fillStyle = C.pale;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('0.', x0 - PREFIX_W, y + adv * 0.55);
    // typing cursor
    if (typed(f) * adv < 1200 && f < T.ride) {
      const cx = x0 + typed(f) * adv;
      if (Math.floor(f / 4) % 2 === 0) {
        ctx.fillStyle = C.pale;
        ctx.fillRect(cx + 4, y - adv * 0.7, adv * 0.55, adv * 1.3);
      }
    }
  }
  // ── dotted transition (each zero a dot)
  const dotMode = (1 - glyphMode) * (1 - lineMode);
  if (dotMode > 0.003) {
    const i0 = Math.max(0, Math.floor((visL - x0) / adv));
    const i1 = Math.ceil((visR - x0) / adv);
    ctx.globalAlpha = A * dotMode;
    ctx.fillStyle = C.pale;
    const r = clamp(adv * 0.32, 0.8, 3.2);
    for (let i = i0; i <= i1 && i - i0 < 1500; i++) ctx.fillRect(x0 + (i + 0.5) * adv - r / 2, y - r / 2, r, r);
  }
  // ── the solid line (with a soft glow band)
  if (lineMode > 0.003) {
    const a = A * lineMode;
    const xa = Math.max(-10, x0);
    const xb = Math.min(1090, xEnd);
    if (xb > xa) {
      const gr = ctx.createLinearGradient(0, y - 12, 0, y + 12);
      gr.addColorStop(0, 'rgba(255,159,46,0)');
      gr.addColorStop(0.5, `rgba(255,159,46,${(0.45 * (1 + lineBoost)).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(255,159,46,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = gr;
      ctx.fillRect(xa, y - 12, xb - xa, 24);
      ctx.fillStyle = 'rgba(255,190,110,0.95)';
      ctx.fillRect(xa, y - 1, xb - xa, 2);
    }
  }
  ctx.restore();
}

/** the mm ruler under the zeros + the 「1 mm」 callout */
function drawRuler(ctx: Ctx, f: number) {
  const cam = camAt(f);
  const adv = 1e-3 * cam.s;
  const a = rowAlpha(f) * clamp((adv - 12) / 12) * seg(f, T.row + 6, T.row + 16);
  if (a <= 0.003) return;
  const x0 = cam.X(0);
  const yb = ROW.y + 46;
  ctx.save();
  ctx.strokeStyle = rgbaHex(C.amber, 0.7 * a);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(Math.max(0, x0), yb);
  ctx.lineTo(1080, yb);
  const i0 = Math.max(0, Math.floor(-x0 / adv));
  const i1 = Math.ceil((1080 - x0) / adv);
  for (let i = i0; i <= i1; i++) {
    const x = x0 + i * adv;
    const L = i % 10 === 0 ? 26 : i % 5 === 0 ? 17 : 10;
    ctx.moveTo(x, yb);
    ctx.lineTo(x, yb + L);
  }
  ctx.stroke();
  ctx.font = MONO(18, 400);
  ctx.fillStyle = rgbaHex(C.amber, 0.75 * a);
  ctx.textAlign = 'center';
  for (let i = i0; i <= i1; i++) if (i % 10 === 0 && i > 0) ctx.fillText(`${i / 10} cm`, x0 + i * adv, yb + 48);
  ctx.restore();
  // 1 mm callout on the third zero
  const ca = a * seg(f, T.c7 + 4, T.c7 + 12) * (1 - seg(f, T.ride + 6, T.ride + 14));
  if (ca > 0.003) {
    const xa = x0 + 2 * adv;
    dimLineH(ctx, xa, xa + adv, ROW.y - 66, ease.outCubic(seg(f, T.c7 + 4, T.c7 + 14)), '#FFFFFF', 0.9 * ca, 0, 7);
    drawRich(ctx, [{ t: '1 mm' }], xa + adv / 2, ROW.y - 84, { font: MONO(26, 700), size: 26, color: '#FFFFFF', align: 'center', alpha: ca });
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${(0.5 * ca).toFixed(3)})`;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(xa, ROW.y - 60);
    ctx.lineTo(xa, ROW.y + 46);
    ctx.moveTo(xa + adv, ROW.y - 60);
    ctx.lineTo(xa + adv, ROW.y + 46);
    ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ context layers (world metres, pivot = row start area)
/** desk: top view, centred on the glass at the row start; the paper tape carrying the row runs off its right edge */
const DESK = { x0: -0.86, x1: 0.84, y0: -0.44, y1: 0.4 } as const;
function drawDesk(ctx: Ctx, cam: Cam, a: number) {
  if (a <= 0.003) return;
  const X = cam.X;
  const Y = cam.Y;
  const S = cam.s;
  ctx.save();
  ctx.globalAlpha = a;
  const dx0 = X(DESK.x0);
  const dx1 = X(DESK.x1);
  const dy0 = Y(DESK.y0);
  const dy1 = Y(DESK.y1);
  // lamp light pool (warm, soft)
  const lx = X(-0.6);
  const ly = Y(-0.26);
  const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, 0.75 * S);
  pool.addColorStop(0, 'rgba(255,190,110,0.16)');
  pool.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = 'rgba(30,18,6,0.7)';
  ctx.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
  ctx.fillStyle = pool;
  ctx.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
  ctx.strokeStyle = rgbaHex(C.amber, 0.75);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
  ctx.strokeStyle = rgbaHex(C.amber, 0.3);
  ctx.strokeRect(dx0 + 0.025 * S, dy0 + 0.025 * S, dx1 - dx0 - 0.05 * S, dy1 - dy0 - 0.05 * S);
  // wood grain
  const N = makeNoise(31);
  ctx.strokeStyle = rgbaHex(C.amber, 0.09);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 30; k++) {
    const wy = DESK.y0 + 0.03 + (k / 30) * (DESK.y1 - DESK.y0 - 0.06);
    for (let j = 0; j <= 48; j++) {
      const wx = DESK.x0 + 0.03 + (j / 48) * (DESK.x1 - DESK.x0 - 0.06);
      const yy = wy + 0.01 * N.n2(wx * 2.2, k * 0.7) + 0.004 * N.n2(wx * 9, k * 3.1);
      if (j === 0) ctx.moveTo(X(wx), Y(yy));
      else ctx.lineTo(X(wx), Y(yy));
    }
  }
  ctx.stroke();
  // paper tape under the row (runs off the desk to the right)
  ctx.fillStyle = 'rgba(255,227,163,0.09)';
  ctx.fillRect(X(-0.005), Y(-0.008), 1200 - X(-0.005), Math.max(1, 0.016 * S));
  // the lamp (top view: shade ring + base)
  ctx.strokeStyle = rgbaHex(C.pale, 0.55);
  ctx.beginPath();
  ctx.arc(lx, ly, 0.11 * S, 0, Math.PI * 2);
  ctx.moveTo(lx + 0.05 * S, ly);
  ctx.arc(lx, ly, 0.05 * S, 0, Math.PI * 2);
  ctx.stroke();
  // notebook with ruled lines + a pencil
  ctx.strokeStyle = rgbaHex(C.amber, 0.45);
  ctx.strokeRect(X(0.3), Y(-0.36), 0.3 * S, 0.21 * S);
  ctx.beginPath();
  for (let k = 1; k < 7; k++) {
    ctx.moveTo(X(0.32), Y(-0.36 + k * 0.03));
    ctx.lineTo(X(0.58), Y(-0.36 + k * 0.03));
  }
  ctx.moveTo(X(0.18), Y(0.27));
  ctx.lineTo(X(0.36), Y(0.2));
  ctx.stroke();
  // books
  ctx.strokeRect(X(-0.78), Y(0.08), 0.24 * S, 0.27 * S);
  ctx.strokeRect(X(-0.76), Y(0.11), 0.2 * S, 0.21 * S);
  // the glass (top view) at the row start
  const gx = X(-0.05);
  const gy = Y(0);
  const gr = 0.042 * S;
  ctx.fillStyle = rgbaHex(C.amber, 0.2);
  ctx.beginPath();
  ctx.arc(gx, gy, gr * 0.86, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbaHex(C.pale, 0.95);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(gx, gy, gr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

interface CityGeo {
  minor: Float32Array; // segments x0,y0,x1,y1 (metres)
  major: Float32Array;
  river: Float32Array; // polyline
  lights: Float32Array;
}
const CITY = () =>
  memo('S03:city', (): CityGeo => {
    const r = mulberry32(77);
    const N = makeNoise(5);
    const minor: number[] = [];
    const major: number[] = [];
    const ang = 0.21;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const rot = (x: number, y: number): [number, number] => [x * ca - y * sa, x * sa + y * ca];
    const R = (x: number, y: number) => Math.hypot(x, y) < 5200 * (0.82 + 0.3 * N.n2(x / 3000, y / 3000));
    const B = 140;
    for (let k = -42; k <= 42; k++) {
      for (let j = -42; j < 42; j++) {
        if (r() < 0.12) continue;
        // horizontal street piece
        const a = rot(j * B, k * B + 60);
        const b = rot((j + 1) * B, k * B + 60);
        if (R(a[0], a[1]) && R(b[0], b[1])) minor.push(a[0], a[1], b[0], b[1]);
        const c = rot(k * B + 40, j * B);
        const d = rot(k * B + 40, (j + 1) * B);
        if (r() < 0.12) continue;
        if (R(c[0], c[1]) && R(d[0], d[1])) minor.push(c[0], c[1], d[0], d[1]);
      }
    }
    // radial avenues (gently curving, ending at the edge of town) + two ring roads
    for (let q = 0; q < 9; q++) {
      const th = (q / 9) * Math.PI * 2 + 0.2 + 0.15 * N.n2(q * 7.3, 1.1);
      const len = 4200 + 1600 * (0.5 + 0.5 * N.n2(q * 2.1, 9.7));
      let px = 0;
      let py = 0;
      for (let s = 1; s <= 24; s++) {
        const rr = (s / 24) * len;
        const w = th + 0.18 * N.n2(q * 3.1, s * 0.06) * (rr / len);
        const nx = Math.cos(w) * rr;
        const ny = Math.sin(w) * rr;
        major.push(px, py, nx, ny);
        px = nx;
        py = ny;
      }
    }
    for (const rr of [1500, 3300]) {
      for (let s = 0; s < 72; s++) {
        const t0 = (s / 72) * Math.PI * 2;
        const t1 = ((s + 1) / 72) * Math.PI * 2;
        const w0 = rr * (1 + 0.07 * N.n2(Math.cos(t0) * 1.3 + rr, Math.sin(t0) * 1.3));
        const w1 = rr * (1 + 0.07 * N.n2(Math.cos(t1) * 1.3 + rr, Math.sin(t1) * 1.3));
        major.push(Math.cos(t0) * w0, Math.sin(t0) * w0, Math.cos(t1) * w1, Math.sin(t1) * w1);
      }
    }
    const river: number[] = [];
    for (let s = 0; s <= 80; s++) {
      const x = -9000 + (s / 80) * 18000;
      river.push(x, 1400 + 900 * Math.sin(x / 2600) + 300 * N.n2(x / 1500, 3));
    }
    const lights: number[] = [];
    for (let i = 0; i < 900; i++) {
      const rr = 5200 * Math.pow(r(), 0.8);
      const th = r() * Math.PI * 2;
      lights.push(Math.cos(th) * rr, Math.sin(th) * rr);
    }
    return { minor: new Float32Array(minor), major: new Float32Array(major), river: new Float32Array(river), lights: new Float32Array(lights) };
  });

function drawCity(ctx: Ctx, cam: Cam, a: number) {
  if (a <= 0.003) return;
  const G = CITY();
  const ox = cam.cw;
  const X = (x: number) => cam.X(ox + x);
  const Y = (y: number) => cam.Y(y);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgbaHex(C.amber, 0.28);
  ctx.beginPath();
  for (let i = 0; i < G.minor.length; i += 4) {
    ctx.moveTo(X(G.minor[i]), Y(G.minor[i + 1]));
    ctx.lineTo(X(G.minor[i + 2]), Y(G.minor[i + 3]));
  }
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgbaHex(C.amber, 0.55);
  ctx.beginPath();
  for (let i = 0; i < G.major.length; i += 4) {
    ctx.moveTo(X(G.major[i]), Y(G.major[i + 1]));
    ctx.lineTo(X(G.major[i + 2]), Y(G.major[i + 3]));
  }
  ctx.stroke();
  // river
  ctx.lineWidth = Math.max(2, 180 * cam.s);
  ctx.strokeStyle = 'rgba(7,6,4,0.9)';
  ctx.beginPath();
  for (let i = 0; i < G.river.length; i += 2) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, X(G.river[i]), Y(G.river[i + 1]));
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgbaHex(C.pale, 0.4);
  ctx.stroke();
  // lights
  ctx.fillStyle = rgbaHex(C.pale, 0.8);
  for (let i = 0; i < G.lights.length; i += 2) {
    const s = 1 + (i % 7 === 0 ? 1 : 0);
    ctx.fillRect(X(G.lights[i]) - s / 2, Y(G.lights[i + 1]) - s / 2, s, s);
  }
  ctx.restore();
}

const RE = 6.371e6;
const AU = 1.496e11;
const EARTH_DOTS = () =>
  memo('S03:earthDots', () => {
    const N = makeNoise(12);
    const pts: number[] = [];
    // fibonacci sphere, continents = fbm threshold
    const n = 9000;
    for (let i = 0; i < n; i++) {
      const yy = 1 - (2 * (i + 0.5)) / n;
      const rr = Math.sqrt(1 - yy * yy);
      const th = i * 2.399963;
      const x = Math.cos(th) * rr;
      const z = Math.sin(th) * rr;
      const v = N.fbm3(x * 1.6, yy * 1.6, z * 1.6, 4);
      if (v > 0.06) pts.push(x, yy, z, v);
    }
    return new Float32Array(pts);
  });

function drawEarth(ctx: Ctx, cam: Cam, a: number, f: number, moonA: number) {
  if (a <= 0.003 && moonA <= 0.003) return;
  const ex = cam.X(cam.cw);
  const ey = cam.Y(RE);
  const R = RE * cam.s;
  ctx.save();
  if (a > 0.003) {
    ctx.globalAlpha = a;
    // atmosphere halo
    const h = ctx.createRadialGradient(ex, ey, R * 0.96, ex, ey, R * 1.12);
    h.addColorStop(0, 'rgba(255,159,46,0.35)');
    h.addColorStop(1, 'rgba(255,159,46,0)');
    ctx.fillStyle = h;
    ctx.beginPath();
    ctx.arc(ex, ey, R * 1.12, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(ex - R * 0.3, ey - R * 0.4, R * 0.1, ex, ey, R);
    body.addColorStop(0, '#2A1A08');
    body.addColorStop(1, '#0D0804');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(ex, ey, R, 0, Math.PI * 2);
    ctx.fill();
    // graticule
    ctx.strokeStyle = rgbaHex(C.amber, 0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      const yy = (k / 3) * R;
      const rx = Math.sqrt(Math.max(0, R * R - yy * yy));
      ctx.ellipse(ex, ey + yy, rx, rx * 0.12, 0, 0, Math.PI * 2);
    }
    for (let k = 0; k < 6; k++) {
      const rx = Math.abs(Math.cos((k / 6) * Math.PI + f * 0.004)) * R;
      ctx.moveTo(ex + rx, ey);
      ctx.ellipse(ex, ey, rx, R, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    // dot-matrix continents (orthographic, slowly turning; tilted 23°)
    const P = EARTH_DOTS();
    const rotA = f * 0.006 + 1.2;
    const cr = Math.cos(rotA);
    const sr = Math.sin(rotA);
    const ct = Math.cos(0.4);
    const st = Math.sin(0.4);
    const ds = clamp(R / 240, 1, 2.6);
    for (let i = 0; i < P.length; i += 4) {
      const x = P[i] * cr + P[i + 2] * sr;
      const z = -P[i] * sr + P[i + 2] * cr;
      const y = P[i + 1] * ct - z * st;
      const zz = P[i + 1] * st + z * ct;
      if (zz < 0) continue;
      const lum = 0.35 + 0.65 * zz;
      ctx.fillStyle = rgbaHex(P[i + 3] > 0.25 ? C.pale : C.amber, lum * 0.85);
      ctx.fillRect(ex + x * R - ds / 2, ey - y * R - ds / 2, ds, ds);
    }
    ctx.strokeStyle = rgbaHex(C.amber, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, R, 0, Math.PI * 2);
    ctx.stroke();
  }
  // the Moon's orbit
  if (moonA > 0.003) {
    ctx.globalAlpha = moonA;
    const mr = 3.844e8 * cam.s;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = rgbaHex(C.amber, 0.45);
    ctx.beginPath();
    ctx.arc(ex, ey, mr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const th = 2.3;
    ctx.fillStyle = C.pale;
    ctx.beginPath();
    ctx.arc(ex + Math.cos(th) * mr, ey + Math.sin(th) * mr, Math.max(2, 1.737e6 * cam.s), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const PLANETS = [0.387, 0.723, 1, 1.524, 5.203, 9.537, 19.19, 30.07];
function drawSolar(ctx: Ctx, cam: Cam, a: number) {
  if (a <= 0.003) return;
  const sx = cam.X(cam.cw);
  const sy = cam.Y(RE + AU);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineWidth = 1;
  PLANETS.forEach((d, i) => {
    const r = d * AU * cam.s;
    if (r < 1.5 || r > 3000) return;
    ctx.strokeStyle = rgbaHex(C.amber, i === 2 ? 0.7 : 0.32);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    const th = i === 2 ? -Math.PI / 2 : hash01(i, 21) * Math.PI * 2;
    ctx.fillStyle = i === 2 ? '#FFFFFF' : C.pale;
    ctx.beginPath();
    ctx.arc(sx + Math.cos(th) * r, sy + Math.sin(th) * r, i >= 4 ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#FFF4DC';
  ctx.beginPath();
  ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** self-similar star layers around the Sun: each decade k has its own stars, converging as we pull back */
function drawStarLayers(ctx: Ctx, cam: Cam, f: number, dz: number) {
  const sunX = cam.X(cam.cw);
  const sunY = cam.Y(RE + AU);
  ctx.save();
  for (let k = 15; k <= 21; k++) {
    const a = bell(cam.z, k - 0.6, k + 1.9, 0.6) * (k >= 20 ? 1 - smoothstep(20.2, 20.9, cam.z) : 1);
    if (a <= 0.003) continue;
    const spread = 4 * Math.pow(10, k);
    const n = 90;
    for (let i = 0; i < n; i++) {
      const h1 = hash01(i + k * 1000, 61);
      const h2 = hash01(i + k * 1000, 62);
      const h3 = hash01(i + k * 1000, 63);
      // avoid the immediate neighbourhood of the Sun (those belong to the previous decade)
      const rr = spread * (0.15 + 0.85 * Math.sqrt(h1));
      const th = h2 * Math.PI * 2;
      const x = sunX + Math.cos(th) * rr * cam.s;
      const y = sunY + Math.sin(th) * rr * cam.s * 0.9;
      if (x < -20 || x > 1100 || y < -20 || y > 1940) continue;
      const m = 0.35 + 0.65 * h3 * h3;
      // radial streak while the zoom is fast (points rush toward the pivot)
      const st = Math.min(0.1, dz * 0.22);
      ctx.strokeStyle = rgbaHex(h3 > 0.85 ? '#FFFFFF' : C.pale, 0.75 * a * m);
      ctx.lineWidth = 0.8 + 1.2 * m;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (x - sunX) * st + 0.5, y + (y - sunY) * st);
      ctx.stroke();
    }
  }
  ctx.restore();
}


/** powers-of-ten rings around the pivot (1 m, 10 m, 100 m …): they shrink toward the pivot as we pull back */
function drawRings(ctx: Ctx, f: number, cam: Cam) {
  const A = seg(f, T.zoom + 2, T.zoom + 10) * (1 - seg(f, T.zoomEnd - 18, T.zoomEnd - 4));
  if (A <= 0.003) return;
  const cx = cam.X(cam.cw);
  const cy = ROW.y;
  const k0 = Math.floor(cam.z) - 3;
  ctx.save();
  ctx.font = MONO(15, 400);
  ctx.textBaseline = 'alphabetic';
  for (let k = k0; k <= k0 + 4; k++) {
    const r = Math.pow(10, k) * cam.s;
    const a = A * smoothstep(40, 140, r) * (1 - smoothstep(620, 900, r));
    if (a <= 0.003) continue;
    ctx.strokeStyle = rgbaHex(C.amber, 0.22 * a);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const lx = cx - r * 0.7071;
    const ly = cy - r * 0.7071;
    ctx.fillStyle = rgbaHex(C.amber, 0.55 * a);
    ctx.fillRect(lx - 2, ly - 2, 4, 4);
    drawRich(ctx, sup(`10^{${k}} m`), lx - 8, ly - 8, { font: MONO(15, 400), size: 15, color: C.amber, align: 'right', alpha: 0.6 * a });
  }
  ctx.restore();
}

/** light pulses travelling along the finished row (reading the number), during the hold */
export function drawPulses(ctx: Ctx, f: number) {
  const A = seg(f, T.zoomEnd + 4, T.zoomEnd + 16) * (1 - seg(f, T.galaxyOut, T.galaxyOut + 8));
  if (A <= 0.003) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let p = 0; p < 3; p++) {
    const period = 46;
    const ph = ((f - T.zoomEnd + p * (period / 3)) % period) / period;
    const x = ROW.x0 + (990 - ROW.x0) * ph;
    const env = Math.sin(Math.PI * ph);
    const gr = ctx.createLinearGradient(x - 120, 0, x + 6, 0);
    gr.addColorStop(0, 'rgba(255,220,160,0)');
    gr.addColorStop(1, `rgba(255,236,200,${(0.75 * env * A).toFixed(3)})`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - 120, ROW.y - 1.5, 126, 3);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ scale labels
interface LabelDef {
  zh: string;
  sc: string;
  stop: number;
  anchor: (cam: Cam) => [number, number];
  side: 1 | -1;
}
const LABELS: LabelDef[] = [
  { zh: '书桌', sc: '≈ 1 m', stop: STOPS.desk, anchor: (c) => [c.X(DESK.x0), c.Y(DESK.y0)], side: 1 },
  { zh: '城市', sc: '≈ 10 km', stop: STOPS.city, anchor: (c) => [c.X(c.cw - 3200), c.Y(-3600)], side: 1 },
  { zh: '地球', sc: '≈ 1.3×10^{4} km', stop: STOPS.earth, anchor: (c) => [c.X(c.cw) - RE * c.s * 0.71, c.Y(RE) - RE * c.s * 0.71], side: 1 },
  { zh: '太阳系', sc: '≈ 60 AU', stop: STOPS.solar, anchor: (c) => [c.X(c.cw) - 30.07 * AU * c.s * 0.71, c.Y(RE + AU) - 30.07 * AU * c.s * 0.71], side: 1 },
];
function drawScaleLabels(ctx: Ctx, f: number, cam: Cam) {
  for (const L of LABELS) {
    const a = seg(f, L.stop - 9, L.stop - 3) * (1 - seg(f, L.stop + 5, L.stop + 10));
    if (a <= 0.003) continue;
    const [ax, ay] = L.anchor(cam);
    const tx = clamp(ax - 10, 120, 600);
    const ty = clamp(ay - 70, 330, 1300);
    ctx.save();
    ctx.strokeStyle = rgbaHex(C.pale, 0.7 * a);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(tx, ty + 12);
    ctx.lineTo(tx + 150, ty + 12);
    ctx.stroke();
    ctx.fillStyle = rgbaHex(C.pale, a);
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawRich(ctx, [{ t: L.zh }], tx, ty, { font: SANS(34, 400), size: 34, color: C.pale, alpha: a, reveal: seg(f, L.stop - 9, L.stop - 5) });
    drawRich(ctx, sup(L.sc), tx, ty + 44, { font: MONO(22, 400), size: 22, color: C.amber, alpha: 0.85 * a });
  }
}

/** bottom-left odometer: field of view 10ⁿ m */
function drawOdometer(ctx: Ctx, f: number, cam: Cam) {
  const a = seg(f, T.zoom - 4, T.zoom + 6) * (1 - seg(f, T.zoomEnd + 10, T.zoomEnd + 22));
  if (a <= 0.003) return;
  const n = cam.z;
  const ni = Math.round(n);
  const frac = n - Math.floor(n);
  drawRich(ctx, [{ t: '视野宽度' }], 90, 1556, { font: SANS(22, 400), size: 22, color: C.amber, alpha: 0.75 * a });
  // exponent rolls: show the integer exponent with a short vertical slide when it changes
  const roll = clamp((frac - 0.85) / 0.15) * (ni === Math.floor(n) + 1 ? 1 : 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(80, 1560, 400, 70);
  ctx.clip();
  drawRich(ctx, sup(`10^{${ni}} m`), 90, 1612 - roll * 6, { font: MONO(44, 700), size: 44, color: C.pale, alpha: a });
  ctx.restore();
}

// ------------------------------------------------------------------ the galaxy (amber, barred) on the line
export function galaxyAlpha(f: number) {
  const cam = camAt(f);
  return smoothstep(20.72, 21.2, cam.z) * (1 - seg(f, T.galaxyOut, T.galaxyOut + 22));
}
export const GAL_R = (cam: Cam) => (0.5e5 * LY) * cam.s;

export function drawGalaxyLayer(ctx: Ctx, f: number) {
  if (f < T.zoom) return;
  const cam = camAt(f);
  const a = galaxyAlpha(f);
  // background star dust that belongs to the final framing
  const bgA = smoothstep(19.6, 21.2, cam.z) * (1 - seg(f, T.galaxyOut, T.galaxyOut + 30));
  if (bgA > 0.003) drawStarfield(ctx, { seed: 9, t: f / 30, palette: 'amber', density: 0.55, alpha: 0.42 * bgA, zoom: Math.pow(10, (ZEND - cam.z) * 0.35), cx: 540, cy: 960, twinkle: 0.5 });
  if (a <= 0.003) return;
  const R = GAL_R(cam);
  if (R > 1400) return;
  const cx = cam.X(ROW.lengthM / 2);
  const dissolve = ease.inQuad(seg(f, T.galaxyOut, T.galaxyOut + 20)) * 0.7;
  drawGalaxy(ctx, { cx, cy: ROW.y, radius: R, tilt: 1.08, angle: -0.04, arms: 2, bar: 0.6, pitch: 0.22, seed: 11, t: f / 30 + 3, palette: 'amber', alpha: a, dissolve, spin: 0.05, exposure: 1.35, n: 4200 });
}

/** card 9: dimension lines — the galaxy (10⁵ ly) above, the whole row (2.6×10⁵ ly) below */
function drawDims(ctx: Ctx, f: number) {
  const out = 1 - seg(f, T.galaxyOut - 4, T.galaxyOut + 10);
  const k1 = ease.inOutCubic(seg(f, T.dims, T.dims + 22));
  const k2 = ease.inOutCubic(seg(f, T.dims + 10, T.dims + 34));
  if (k1 <= 0 || out <= 0) return;
  const cam = camAt(f);
  const R = GAL_R(cam);
  const yG = ROW.y - 150;
  dimLineH(ctx, 540 - R, 540 + R, yG, k1, C.pale, 0.85 * out, 0, 9);
  // extension lines down to the disc edge
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = rgbaHex(C.pale, 0.35 * out * k1);
  ctx.beginPath();
  ctx.moveTo(540 - R, yG + 10);
  ctx.lineTo(540 - R, ROW.y - 20);
  ctx.moveTo(540 + R, yG + 10);
  ctx.lineTo(540 + R, ROW.y - 20);
  ctx.stroke();
  ctx.restore();
  const l1 = seg(f, T.dims + 10, T.dims + 22) * out;
  drawRich(ctx, [{ t: '银河系 ', font: SANS(30, 400) }, ...sup('≈ 10^{5} 光年')], 540, yG - 22, { font: SANS(30, 400), size: 30, color: C.pale, align: 'center', alpha: l1 });
  const yR = ROW.y + 110;
  dimLineH(ctx, ROW.x0, 990, yR, k2, C.amber, 0.85 * out, 0, 9);
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = rgbaHex(C.amber, 0.35 * out * k2);
  ctx.beginPath();
  ctx.moveTo(ROW.x0, ROW.y + 14);
  ctx.lineTo(ROW.x0, yR - 10);
  ctx.moveTo(990, ROW.y + 14);
  ctx.lineTo(990, yR - 10);
  ctx.stroke();
  ctx.restore();
  const l2 = seg(f, T.dims + 22, T.dims + 34) * out;
  drawRich(ctx, [{ t: '这一行 ', font: SANS(30, 400) }, ...sup('≈ 2.6×10^{5} 光年')], 540, yR + 50, { font: SANS(30, 400), size: 30, color: C.amber, align: 'center', alpha: l2 });
  // both ends of the one number: 「0.」 … the first non-zero digit after 2.5×10²⁴ zeros
  const e = seg(f, T.dims + 30, T.dims + 40) * out;
  drawRich(ctx, [{ t: '0.' }], ROW.x0, ROW.y - 18, { font: MONO(30, 700), size: 30, color: C.pale, alpha: e });
  drawRich(ctx, sup('第 2.5×10^{24} 位'), 990, ROW.y - 18, { font: MONO(20, 400), size: 20, color: C.amber, align: 'right', alpha: 0.85 * e });
}

/** the finished row as a ruler: a tick every 10⁴ light-years, labels every 5×10⁴ */
function drawLyRuler(ctx: Ctx, f: number) {
  const a = seg(f, T.dims + 30, T.dims + 50) * (1 - seg(f, T.galaxyOut - 4, T.galaxyOut + 8));
  if (a <= 0.003) return;
  const pxPerLy = 900 / (ROW.lengthM / LY);
  ctx.save();
  ctx.strokeStyle = rgbaHex(C.amber, 0.45 * a);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; ; k++) {
    const x = ROW.x0 + k * 1e4 * pxPerLy;
    if (x > 990) break;
    const big = k % 5 === 0;
    ctx.moveTo(x, ROW.y + 4);
    ctx.lineTo(x, ROW.y + (big ? 16 : 9));
  }
  ctx.stroke();
  ctx.font = MONO(13, 400);
  ctx.textAlign = 'center';
  ctx.fillStyle = rgbaHex(C.amber, 0.5 * a);
  for (let k = 5; ; k += 5) {
    const x = ROW.x0 + k * 1e4 * pxPerLy;
    if (x > 960) break;
    ctx.fillText(`${k}万`, x, ROW.y + 32);
  }
  ctx.restore();
}

/** HUD during the row: number of zeros written so far vs needed */
function drawRowHud(ctx: Ctx, f: number) {
  const a = seg(f, T.row + 8, T.row + 14) * (1 - seg(f, T.zoom + 6, T.zoom + 14));
  if (a <= 0.003) return;
  const cam = camAt(f);
  const adv = 1e-3 * cam.s;
  const written = Math.max(0, Math.min(typed(f), Math.floor((1080 - cam.X(0)) / adv)));
  const s = String(written).padStart(9, '0').replace(/(\d{3})(?=\d)/g, '$1 ');
  drawRich(ctx, [{ t: `ZEROS  ${s}` }], 90, 252, { font: MONO(26, 400), size: 26, color: C.amber, alpha: 0.9 * a, tracking: 1.5 });
  drawRich(ctx, sup('NEEDED ≈ 2.5×10^{24}'), 90, 290, { font: MONO(26, 400), size: 26, color: C.pale, alpha: 0.75 * a, tracking: 1.5 });
}

// ------------------------------------------------------------------ entry points
export function drawZoom(ctx: Ctx, f: number) {
  if (f < T.row) return;
  const cam = camAt(f);
  const dz = Math.abs(zoomDz(f));
  if (f >= T.zoom - 2) {
    // back to front: stars, solar system, the Earth (the city sits on its surface), the city, the desk
    drawStarLayers(ctx, cam, f, dz);
    drawSolar(ctx, cam, bell(cam.z, 10.4, 15.6, 0.8));
    drawEarth(ctx, cam, bell(cam.z, 4.7, 9.4, 1.0), f, bell(cam.z, 7.9, 10.8, 0.7));
    drawCity(ctx, cam, bell(cam.z, 2.4, 6.0, 0.7));
    drawDesk(ctx, cam, bell(cam.z, -1.1, 1.9, 0.6));
  }
  drawRuler(ctx, f);
  drawRowHud(ctx, f);
  if (f >= T.zoom) {
    drawRings(ctx, f, cam);
    drawScaleLabels(ctx, f, cam);
    drawOdometer(ctx, f, cam);
  }
  drawDims(ctx, f);
  drawLyRuler(ctx, f);
}

export function glowZoom(ctx: Ctx, f: number) {
  if (f < T.zoom) return;
  const cam = camAt(f);
  // the Sun and the Earth's halo
  const sa = bell(cam.z, 10.4, 15.6, 0.8);
  if (sa > 0) glow(ctx, '#FFE3A3', cam.X(cam.cw), cam.Y(RE + AU), 40, 0.9 * sa);
  const ea = bell(cam.z, 4.7, 9.4, 1.0);
  if (ea > 0) glow(ctx, C.amber, cam.X(cam.cw), cam.Y(RE), RE * cam.s * 1.5, 0.25 * ea);
  const ca = bell(cam.z, 2.4, 6.0, 0.7);
  if (ca > 0) glow(ctx, C.amber, cam.X(cam.cw), cam.Y(0), 6500 * cam.s, 0.14 * ca);
}

export { mulberry32 as _m32 };
