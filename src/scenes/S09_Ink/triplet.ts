// S09 B2: the triplet of hard cuts 星系。/ 细胞。/ 你。 — three structures on circles of the SAME centre and radius
// (DISC), so the cuts are graphic matches: spiral arms ↔ cytoskeleton ↔ iris fibres. Each cut: a 2-frame flash and a
// 1.12 → 1.0 settle. (The eye lives in eye.ts.)
//   galaxy — an inclined spiral (natural light) over a starfield, a few foreground stars with diffraction spikes.
//   cell   — a confocal fluorescence portrait of a living cell: cyan membrane & ER, violet microtubules radiating from
//            the centrosome (the same filament-and-node language as the cosmic web), magenta actin, a blue nucleus with
//            chromatin, and GOLD mitochondria — the places where the cell burns free energy (gold = low entropy in
//            the film's colour code), vesicles riding the microtubules.
import { drawGalaxy, drawSpikes, drawStarfield } from '../../lib/cosmos';
import { clamp, ease, memo, seg } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { makeNoise } from '../../lib/noise';
import { ctxOf, fresh, glow, scratch } from './canvas';
import { DISC, HIT } from './timing';

/** the punch-in camera: scale 1.12 → 1.0 over 12 frames after the cut, about the disc centre */
export function punchScale(f: number, hit: number) {
  return 1 + 0.12 * (1 - ease.outCubic(seg(f, hit, hit + 12)));
}
/** 2-frame flash at a cut (additive light burst) */
export function flashAt(f: number, hit: number) {
  const k = f - hit;
  return k === 0 ? 0.38 : k === 1 ? 0.13 : 0;
}

// ───────────────────────────── 星系 ─────────────────────────────
export function drawGalaxyShot(ctx: CanvasRenderingContext2D, f: number) {
  const t = (f - HIT.galaxy) / 30;
  ctx.fillStyle = '#020309';
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.save();
  const sc = punchScale(f, HIT.galaxy);
  ctx.translate(DISC.x, DISC.y);
  ctx.scale(sc, sc);
  ctx.translate(-DISC.x, -DISC.y);
  ctx.globalCompositeOperation = 'lighter';
  drawStarfield(ctx, { seed: 17, t: 8 + t, density: 0.9, x: t * 14, y: -t * 6, alpha: 0.9, cx: DISC.x, cy: DISC.y });
  drawGalaxy(ctx, {
    cx: DISC.x,
    cy: DISC.y,
    radius: DISC.r * 1.32,
    tilt: 1.04,
    angle: -0.5,
    arms: 2,
    bar: 0.35,
    pitch: 0.3,
    seed: 9,
    t: 20 + t,
    spin: 0.08,
    palette: 'natural',
    exposure: 0.95,
    n: 9000,
  });
  // foreground stars of our own galaxy, with diffraction spikes (fixed to the lens)
  for (const [x, y, L, k] of [
    [212, 420, 70, 0.9],
    [905, 1268, 54, 0.7],
    [820, 300, 34, 0.55],
    [150, 1350, 28, 0.5],
  ] as const) {
    glow(ctx, '#DCE6FF', x, y, L * 0.5, 0.7 * k, 1);
    drawSpikes(ctx, x, y, L, 'blue', 1);
  }
  ctx.restore();
}

// ───────────────────────────── 细胞 ─────────────────────────────
interface CellGeo {
  memb: Array<[number, number, number]>; // harmonic k, amplitude, phase
  bumps: Array<[number, number, number]>; // angle, width, height (lamellipodia)
  mt: Float32Array[]; // microtubule polylines (relative to the cell centre, unit = px)
  actin: Float32Array; // short cortex segments x0,y0,x1,y1
  fibres: Float32Array; // stress fibres x0,y0,x1,y1
  mito: Float32Array; // x, y, angle, length, width, bend, phase
  ves: Float32Array; // mt index, s0, speed, size, hue
  dots: Float32Array; // brownian vesicles x, y, size, phase
  nucleus: HTMLCanvasElement;
}
const NUC = { x: -34, y: 26, rx: 168, ry: 142, rot: 0.32 };
const CENTRO: readonly [number, number] = [70, -132];

function membR(g: CellGeo, th: number, t: number): number {
  let r = 1;
  for (const [k, a, ph] of g.memb) r += a * Math.sin(k * th + ph + t * 0.35 * (k % 2 ? 1 : -1));
  for (const [a0, w, h] of g.bumps) {
    let d = th - a0;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r += h * Math.exp(-(d * d) / (w * w)) * (1 + 0.15 * Math.sin(t * 1.3 + a0));
  }
  return DISC.r * 0.97 * r;
}
function inNucleus(x: number, y: number, grow = 1): boolean {
  const c = Math.cos(-NUC.rot),
    s = Math.sin(-NUC.rot);
  const dx = x - NUC.x,
    dy = y - NUC.y;
  const u = (dx * c - dy * s) / (NUC.rx * grow),
    v = (dx * s + dy * c) / (NUC.ry * grow);
  return u * u + v * v < 1;
}
function cellGeo(): CellGeo {
  return memo('s09:cell', () => {
    const r = mulberry32(6061);
    const nz = makeNoise(61);
    const g: CellGeo = {
      memb: [
        [2, 0.035, r() * 6],
        [3, 0.04, r() * 6],
        [4, 0.02, r() * 6],
        [5, 0.015, r() * 6],
        [7, 0.008, r() * 6],
      ],
      bumps: [
        [-0.6, 0.35, 0.07],
        [2.4, 0.28, 0.05],
        [3.9, 0.22, 0.04],
      ],
      mt: [],
      actin: new Float32Array(0),
      fibres: new Float32Array(0),
      mito: new Float32Array(0),
      ves: new Float32Array(0),
      dots: new Float32Array(0),
      nucleus: document.createElement('canvas'),
    };
    // microtubules: from the centrosome outward, gently curving, deflected around the nucleus
    for (let i = 0; i < 230; i++) {
      const th0 = (i / 230) * Math.PI * 2 + (r() - 0.5) * 0.08;
      let x = CENTRO[0] + Math.cos(th0) * 6,
        y = CENTRO[1] + Math.sin(th0) * 6;
      let th = th0;
      const curl = (r() - 0.5) * 0.05;
      const pts: number[] = [x, y];
      for (let k = 0; k < 90; k++) {
        th += curl + 0.12 * nz.n2(x * 0.008 + i, y * 0.008);
        let nx = x + Math.cos(th) * 7,
          ny = y + Math.sin(th) * 7;
        if (inNucleus(nx, ny, 1.04)) {
          // slide along the nuclear envelope
          const a = Math.atan2(ny - NUC.y, nx - NUC.x);
          nx = x + Math.cos(a + Math.PI / 2 * Math.sign(Math.sin(th - a))) * 7;
          ny = y + Math.sin(a + Math.PI / 2 * Math.sign(Math.sin(th - a))) * 7;
          th = Math.atan2(ny - y, nx - x);
        }
        x = nx;
        y = ny;
        const R = Math.hypot(x, y);
        if (R > DISC.r * 0.93 * (1 + 0.03 * Math.sin(th * 3))) break;
        pts.push(x, y);
      }
      if (pts.length > 8) g.mt.push(new Float32Array(pts));
    }
    // actin cortex: short tangential segments in a band under the membrane; stress fibres across the cell
    const act: number[] = [];
    for (let i = 0; i < 520; i++) {
      const th = r() * Math.PI * 2;
      const R = DISC.r * (0.8 + 0.15 * Math.sqrt(r()));
      const x = Math.cos(th) * R,
        y = Math.sin(th) * R;
      const a = th + Math.PI / 2 + (r() - 0.5) * 1.2;
      const L = 8 + r() * 22;
      act.push(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L);
    }
    g.actin = new Float32Array(act);
    const fib: number[] = [];
    for (let i = 0; i < 14; i++) {
      const a = -0.55 + (r() - 0.5) * 0.5;
      const off = (r() - 0.5) * 520;
      const L = 260 + r() * 260;
      const cx = -Math.sin(a) * off,
        cy = Math.cos(a) * off;
      fib.push(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
    }
    g.fibres = new Float32Array(fib);
    // mitochondria (gold): in the cytoplasm, denser around the nucleus
    const mi: number[] = [];
    let tries = 0;
    while (mi.length < 130 * 7 && tries < 6000) {
      tries++;
      const th = r() * Math.PI * 2;
      const R = DISC.r * (0.3 + 0.6 * Math.pow(r(), 0.8));
      const x = Math.cos(th) * R,
        y = Math.sin(th) * R;
      if (inNucleus(x, y, 1.18)) continue;
      mi.push(x, y, th + Math.PI / 2 + (r() - 0.5) * 1.6, 12 + r() * 30, 4.5 + r() * 2.6, (r() - 0.5) * 0.9, r() * 6.28);
    }
    g.mito = new Float32Array(mi);
    // vesicles riding microtubules (motor transport) + free ones jiggling (Brownian)
    const ve: number[] = [];
    for (let i = 0; i < 70; i++) ve.push(Math.floor(r() * g.mt.length), r(), (r() < 0.5 ? -1 : 1) * (0.15 + 0.25 * r()), 2 + r() * 3, r());
    g.ves = new Float32Array(ve);
    const dt: number[] = [];
    for (let i = 0; i < 140; i++) {
      const th = r() * Math.PI * 2;
      const R = DISC.r * (0.25 + 0.68 * Math.sqrt(r()));
      const x = Math.cos(th) * R,
        y = Math.sin(th) * R;
      if (inNucleus(x, y, 1.05)) continue;
      dt.push(x, y, 1.2 + r() * 2.6, r() * 6.28);
    }
    g.dots = new Float32Array(dt);
    // the nucleus: chromatin texture (DAPI blue), two nucleoli
    const W = 400,
      H = 360;
    const c = g.nucleus;
    c.width = W;
    c.height = H;
    const x = ctxOf(c);
    const img = x.createImageData(W, H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const px = i - W / 2,
          py = j - H / 2;
        const cs = Math.cos(-NUC.rot),
          sn = Math.sin(-NUC.rot);
        const u = (px * cs - py * sn) / NUC.rx,
          v = (px * sn + py * cs) / NUC.ry;
        const q = u * u + v * v;
        if (q > 1.02) continue;
        const ch = 0.5 + 0.5 * nz.n2(px * 0.035, py * 0.035) * 0.6 + 0.25 * nz.n2(px * 0.11 + 9, py * 0.11);
        const rim = Math.exp(-Math.pow((1 - Math.sqrt(q)) * 9, 2)) * 0.55; // peripheral heterochromatin
        let nl = 0;
        for (const [ax, ay, ar] of [
          [-40, -18, 30],
          [46, 34, 22],
        ])
          nl += Math.exp(-((px - ax) ** 2 + (py - ay) ** 2) / (ar * ar));
        const val = clamp(0.22 + 0.55 * ch * ch + rim - 0.35 * nl);
        const edge = clamp((1.02 - q) * 18);
        const k = (j * W + i) * 4;
        img.data[k] = 40 + 120 * val;
        img.data[k + 1] = 70 + 130 * val;
        img.data[k + 2] = 200 + 55 * val;
        img.data[k + 3] = 255 * edge * (0.35 + 0.65 * val);
      }
    x.putImageData(img, 0, 0);
    return g;
  });
}

function polyAt(p: Float32Array, u: number): [number, number] {
  const n = p.length / 2 - 1;
  const fpos = clamp(u) * n;
  const i = Math.min(n - 1, Math.floor(fpos));
  const a = fpos - i;
  return [p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * a, p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * a];
}

export function drawCellShot(ctx: CanvasRenderingContext2D, f: number) {
  const t = (f - HIT.cell) / 30;
  const g = cellGeo();
  ctx.fillStyle = '#010205';
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.save();
  const sc = punchScale(f, HIT.cell);
  ctx.translate(DISC.x, DISC.y);
  ctx.scale(sc, sc);
  ctx.rotate(0.02 * t);
  ctx.globalCompositeOperation = 'lighter';
  // out-of-focus neighbours at the frame edges
  for (const [x, y, rr, col] of [
    [-520, -760, 330, '#1E6F86'],
    [560, 820, 380, '#2A2F86'],
    [-600, 720, 260, '#4A1F6E'],
  ] as const)
    glow(ctx, col, x, y, rr, 0.35, 0);
  // cytoplasm haze
  const hz = ctx.createRadialGradient(0, 0, DISC.r * 0.2, 0, 0, DISC.r * 1.05);
  hz.addColorStop(0, 'rgba(30,60,90,0.20)');
  hz.addColorStop(0.85, 'rgba(25,70,100,0.14)');
  hz.addColorStop(1, 'rgba(25,70,100,0)');
  ctx.fillStyle = hz;
  ctx.beginPath();
  ctx.arc(0, 0, DISC.r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // ER: faint cyan sheets wrapped around the nucleus
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 16; k++) {
    const gr = 1.08 + k * 0.045;
    ctx.strokeStyle = `rgba(95,227,255,${(0.1 * (1 - k / 16)).toFixed(3)})`;
    ctx.beginPath();
    for (let a = 0; a <= 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      const wob = 1 + 0.05 * Math.sin(th * 7 + k * 1.3 + t * 0.6) + 0.03 * Math.sin(th * 13 + k);
      const ux = Math.cos(th) * NUC.rx * gr * wob,
        uy = Math.sin(th) * NUC.ry * gr * wob;
      const x = NUC.x + ux * Math.cos(NUC.rot) - uy * Math.sin(NUC.rot);
      const y = NUC.y + ux * Math.sin(NUC.rot) + uy * Math.cos(NUC.rot);
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // microtubules (violet: the web's filament language)
  ctx.lineCap = 'round';
  const mtA = new Path2D(),
    mtB = new Path2D();
  g.mt.forEach((p, i) => {
    const P = i % 3 === 0 ? mtB : mtA;
    const wob = Math.sin(t * 1.7 + i) * 0.6;
    for (let k = 0; k < p.length; k += 2) {
      const x = p[k] + wob * (k / p.length) * 3,
        y = p[k + 1];
      if (k === 0) P.moveTo(x, y);
      else P.lineTo(x, y);
    }
  });
  ctx.strokeStyle = 'rgba(124,124,255,0.07)';
  ctx.lineWidth = 4;
  ctx.stroke(mtA);
  ctx.strokeStyle = 'rgba(150,140,255,0.32)';
  ctx.lineWidth = 0.8;
  ctx.stroke(mtA);
  ctx.strokeStyle = 'rgba(190,170,255,0.5)';
  ctx.lineWidth = 1.1;
  ctx.stroke(mtB);
  // the centrosome: where the network's nodes meet
  glow(ctx, '#B9A8FF', CENTRO[0], CENTRO[1], 46, 0.9, 1);
  // actin: magenta cortex and stress fibres
  ctx.strokeStyle = 'rgba(214,92,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let q = 0; q < g.actin.length; q += 4) {
    ctx.moveTo(g.actin[q], g.actin[q + 1]);
    ctx.lineTo(g.actin[q + 2], g.actin[q + 3]);
  }
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  for (let a = 0; a <= 120; a++) {
    const th = (a / 120) * Math.PI * 2;
    const R = membR(g, th, t) * 0.97;
    if (a === 0) ctx.moveTo(Math.cos(th) * R, Math.sin(th) * R);
    else ctx.lineTo(Math.cos(th) * R, Math.sin(th) * R);
  }
  ctx.clip();
  ctx.strokeStyle = 'rgba(214,92,255,0.16)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let q = 0; q < g.fibres.length; q += 4) {
    ctx.moveTo(g.fibres[q], g.fibres[q + 1]);
    ctx.lineTo(g.fibres[q + 2], g.fibres[q + 3]);
  }
  ctx.stroke();
  ctx.restore();
  // the nucleus
  ctx.drawImage(g.nucleus, NUC.x - g.nucleus.width / 2, NUC.y - g.nucleus.height / 2);
  // mitochondria (gold): capsules with a bright matrix line
  for (let q = 0; q < g.mito.length; q += 7) {
    const x = g.mito[q] + Math.sin(t * 0.9 + g.mito[q + 6]) * 1.6,
      y = g.mito[q + 1] + Math.cos(t * 0.8 + g.mito[q + 6]) * 1.6;
    const a = g.mito[q + 2] + Math.sin(t * 0.5 + g.mito[q + 6]) * 0.05,
      L = g.mito[q + 3],
      w = g.mito[q + 4],
      bend = g.mito[q + 5];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const P = new Path2D();
    P.moveTo(-L / 2, 0);
    P.quadraticCurveTo(0, bend * L * 0.6, L / 2, 0);
    ctx.strokeStyle = 'rgba(255,170,40,0.16)';
    ctx.lineWidth = w * 2.4;
    ctx.stroke(P);
    ctx.strokeStyle = 'rgba(255,190,64,0.62)';
    ctx.lineWidth = w;
    ctx.stroke(P);
    ctx.strokeStyle = 'rgba(255,236,180,0.6)';
    ctx.lineWidth = w * 0.25;
    ctx.stroke(P);
    ctx.restore();
  }
  // vesicles riding the microtubules (motor proteins walking), and free ones jiggling
  for (let q = 0; q < g.ves.length; q += 5) {
    const p = g.mt[g.ves[q]];
    const u = (((g.ves[q + 1] + g.ves[q + 2] * t * 0.35) % 1) + 1) % 1;
    const [x, y] = polyAt(p, u);
    const hot = g.ves[q + 4] > 0.5;
    glow(ctx, hot ? '#FFB8E6' : '#B8F4FF', x, y, g.ves[q + 3] * 3.2, 0.9, 1);
  }
  for (let q = 0; q < g.dots.length; q += 4) {
    const x = g.dots[q] + Math.sin(t * 7.1 + g.dots[q + 3] * 13) * 1.5,
      y = g.dots[q + 1] + Math.cos(t * 6.3 + g.dots[q + 3] * 7) * 1.5;
    ctx.fillStyle = 'rgba(200,240,255,0.55)';
    ctx.fillRect(x - g.dots[q + 2] * 0.5, y - g.dots[q + 2] * 0.5, g.dots[q + 2], g.dots[q + 2]);
  }
  // the plasma membrane: a living, slowly breathing contour
  const mem = new Path2D();
  for (let a = 0; a <= 180; a++) {
    const th = (a / 180) * Math.PI * 2;
    const R = membR(g, th, t);
    if (a === 0) mem.moveTo(Math.cos(th) * R, Math.sin(th) * R);
    else mem.lineTo(Math.cos(th) * R, Math.sin(th) * R);
  }
  ctx.strokeStyle = 'rgba(95,227,255,0.09)';
  ctx.lineWidth = 22;
  ctx.stroke(mem);
  ctx.strokeStyle = 'rgba(140,236,255,0.38)';
  ctx.lineWidth = 2;
  ctx.stroke(mem);
  ctx.strokeStyle = 'rgba(230,252,255,0.35)';
  ctx.lineWidth = 0.7;
  ctx.stroke(mem);
  ctx.restore();
}

/** fluorescence / photographic bloom: a blurred quarter-res copy added back (one full-frame blit) */
export function bloomPass(ctx: CanvasRenderingContext2D, k: number, blurPx = 5) {
  if (k <= 0.003) return;
  const q = scratch('trip-q', 270, 480);
  const qx = fresh(q);
  qx.filter = `blur(${blurPx}px)`;
  qx.drawImage(ctx.canvas, 0, 0, 270, 480);
  qx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = k;
  ctx.drawImage(q, 0, 0, 1080, 1920);
  ctx.restore();
}
