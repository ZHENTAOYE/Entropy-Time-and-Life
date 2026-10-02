// Side-view world: deep space, stars, the Sun (top), and the heat-death grey that the opening dissolves away.
// (The Earth and the dive: earth.ts.)
import { GOLD_POINT } from '../../lib/handoff';
import { clamp, ease, lerp, memo, seg } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { hash01, mulberry32 } from '../../lib/random';
import { Cam, DIVE_T, applyWorld } from './camera';
import { P, SUN } from './palette';
import { granTex, nebulaTex } from './textures';
import { T } from './timing';

const noise = makeNoise(6006);

// ---------------------------------------------------------------- geometry over time
/** The gold point rises and swells into the Sun. */
export function sunGeom(frame: number) {
  const p = seg(frame, T.sunGrowStart, T.sunGrowEnd);
  const e = ease.inOutCubic(p);
  const r = GOLD_POINT.r * Math.pow(SUN.r / GOLD_POINT.r, ease.inOutQuad(p));
  const bottom = lerp(GOLD_POINT.y + GOLD_POINT.r, SUN.cy + SUN.r, e);
  return { cx: SUN.cx, cy: bottom - r, r, p };
}

/** colour-flood radius around the gold point (screen px): the front leaves the frame at ~f26 */
export const floodR = (frame: number) => 1660 * ease.inOutSine(seg(frame, T.floodStart, 36)) + 30 * ease.outQuad(seg(frame, T.floodStart, T.floodStart + 6));

const sunScreen = (frame: number, cam: Cam): [number, number] => {
  const s = sunGeom(frame);
  return [cam.sx + (s.cx - DIVE_T.x) * cam.z, cam.sy + (s.cy - DIVE_T.y) * cam.z];
};

// ---------------------------------------------------------------- stars
interface Star {
  x: number;
  y: number;
  r: number;
  b: number;
  tw: number;
  hue: number;
}
const stars = () =>
  memo('s06:stars', () => {
    const r = mulberry32(5150);
    const out: Star[] = [];
    for (let i = 0; i < 340; i++) {
      const big = r() < 0.08;
      out.push({ x: r() * 1300 - 110, y: r() * 2000 - 200, r: big ? 1.3 + r() * 1.2 : 0.5 + r() * 0.8, b: big ? 0.8 : 0.25 + r() * 0.5, tw: r() * 6.28, hue: r() });
    }
    return out;
  });

// ---------------------------------------------------------------- background
export function drawBackground(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  ctx.fillStyle = P.space;
  ctx.fillRect(0, 0, 1080, 1920);
  const sun = sunGeom(frame);
  const zodi = clamp(sun.r / SUN.r) * (1 - cam.p);
  // star parallax: weaker zoom than the world
  const sz = 1 + (cam.z - 1) * 0.12;
  const ox = cam.sx - DIVE_T.x * sz;
  const oy = cam.sy - DIVE_T.y * sz;
  const R = floodR(frame);
  const [px, py] = sunScreen(frame, cam);
  // nebula dust (pops in behind the flood front)
  ctx.globalAlpha = 0.55 * (1 - cam.p) * (frame < 34 ? clamp(R / 900) : 1);
  ctx.drawImage(nebulaTex(), ox + -40 * sz, oy + -100 * sz, 1160 * sz, 2100 * sz);
  ctx.globalAlpha = 1;
  // warm zodiacal light from the Sun
  if (zodi > 0.01) {
    const Rz = 1700 * cam.z;
    const g = ctx.createRadialGradient(px, py, sun.r * cam.z * 0.5, px, py, Rz);
    g.addColorStop(0, `rgba(255,170,80,${0.22 * zodi})`);
    g.addColorStop(0.35, `rgba(200,110,60,${0.08 * zodi})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
  }
  // the point's light floods the cleared space with a short EXPOSURE OVERSHOOT (the eye adapting to light after the
  // grey): bright warm light fills the opening hole right out to the dissolving front, then settles (f5–38) and
  // relaxes into the zodiacal light as the Sun condenses (f22–50). Sun palette only; a soft glow, never a hard disc.
  const dawn = Math.min(seg(frame, T.floodStart, T.floodStart + 4), 1 - ease.inOutSine(seg(frame, 22, 50)));
  if (dawn > 0.01) {
    const E = 1 + 1.2 * (1 - seg(frame, 5, 38)) ** 2;
    const k = (a: number) => Math.min(1, a * dawn * E).toFixed(3);
    const Rd = Math.max(90, Math.min(R + 30, 1500));
    const g = ctx.createRadialGradient(px, py, 0, px, py, Rd);
    g.addColorStop(0, `rgba(255,248,230,${k(1)})`);
    g.addColorStop(0.03, `rgba(255,230,170,${k(0.7)})`);
    g.addColorStop(0.1, `rgba(255,205,120,${k(0.46)})`);
    g.addColorStop(0.25, `rgba(255,170,72,${k(0.28)})`);
    g.addColorStop(0.45, `rgba(240,140,50,${k(0.17)})`);
    g.addColorStop(0.7, `rgba(210,110,40,${k(0.1)})`);
    g.addColorStop(0.93, `rgba(190,100,40,${k(0.07)})`);
    g.addColorStop(1, 'rgba(160,80,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1920);
  }
  // stars (they pop in just behind the front)
  const S = stars();
  const vis = 1 - ease.inQuad(cam.p);
  if (vis > 0.01) {
    const Pth: Path2D[] = Array.from({ length: 12 }, () => new Path2D());
    const popping = frame < 40;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      const x = ox + s.x * sz;
      const y = oy + s.y * sz;
      if (x < -5 || x > 1085 || y < -5 || y > 1925) continue;
      let pop = 1;
      if (popping) {
        const d = Math.hypot(x - GOLD_POINT.x, y - GOLD_POINT.y);
        if (d > R) continue;
        pop = 1 + 2.2 * Math.exp(-(((R - d) / 70) ** 2));
      }
      const tw = 0.65 + 0.35 * Math.sin(frame * 0.11 + s.tw * 7 + i);
      const a = Math.min(1, s.b * tw * pop);
      const hue = s.hue < 0.2 ? 0 : s.hue > 0.85 ? 1 : 2;
      const rr = s.r * (1 + (sz - 1) * 0.5) * (pop > 1.5 ? 1.5 : 1);
      Pth[hue * 4 + Math.min(3, Math.floor(a * 4))].rect(x - rr, y - rr, rr * 2, rr * 2);
    }
    const cols = ['255,214,170', '170,200,255', '235,238,255'];
    if (dawn > 0.01) ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 12; k++) {
      ctx.fillStyle = `rgba(${cols[Math.floor(k / 4)]},${(((k % 4) + 0.6) / 4) * vis})`;
      ctx.fill(Pth[k]);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------- the Sun
// Limb darkening I(μ) = 1 − 0.6(1 − μ) mapped onto #FFF7E0 (centre) … #FF8A1F (limb); soft-light granulation
// (large cells, ≤ 0.10) baked into TWO variants with different offsets that cross-fade and counter-rotate: the
// surface boils. Chromosphere ring, live prominences and spicules on top.
const LD_RAMP: Array<[number, [number, number, number]]> = [
  [0.4, [255, 128, 26]],
  [0.5, [255, 152, 42]],
  [0.62, [255, 186, 82]],
  [0.78, [255, 220, 142]],
  [0.9, [255, 238, 196]],
  [1, [255, 248, 230]],
];
const ldColour = (I: number) => {
  let k = 0;
  while (k < LD_RAMP.length - 2 && I > LD_RAMP[k + 1][0]) k++;
  const [i0, c0] = LD_RAMP[k];
  const [i1, c1] = LD_RAMP[k + 1];
  const t = clamp((I - i0) / (i1 - i0));
  return `rgb(${Math.round(c0[0] + (c1[0] - c0[0]) * t)},${Math.round(c0[1] + (c1[1] - c0[1]) * t)},${Math.round(c0[2] + (c1[2] - c0[2]) * t)})`;
};

const sunDiscCache = (variant: number) =>
  memo('s06:sunDisc:' + variant, () => {
    const r = SUN.r;
    const R = Math.ceil(r * 1.08);
    // ½ resolution (drawn at full size): 4× cheaper to build per tab; the limb stays clean under the chromosphere
    const c = document.createElement('canvas');
    c.width = R;
    c.height = R;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.scale(0.5, 0.5);
    const cx = R;
    const cy = R;
    const d = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const mu = Math.sqrt(Math.max(0, 1 - t * t));
      d.addColorStop(t, ldColour(1 - 0.6 * (1 - mu)));
    }
    ctx.fillStyle = d;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // granulation (soft-light), foreshortened towards the limb by a radial fade
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.24;
    const pat = ctx.createPattern(granTex(), 'repeat')!;
    pat.setTransform(new DOMMatrix().translate(variant * 61, variant * 37).rotate(variant * 33).scale(176 / 128));
    ctx.fillStyle = pat;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.restore();
    // chromosphere ring
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.07);
    rg.addColorStop(0, 'rgba(255,200,90,0)');
    rg.addColorStop(0.62, 'rgba(255,190,80,0.2)');
    rg.addColorStop(0.68, 'rgba(255,236,190,0.32)');
    rg.addColorStop(0.75, 'rgba(255,150,60,0.22)');
    rg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.07, 0, Math.PI * 2);
    ctx.fill();
    return { c, R };
  });

const sunHaloCache = () =>
  memo('s06:sunHalo', () => {
    const r = SUN.r;
    const H = Math.ceil(r * 2.4 + 40);
    const k = 0.25; // a soft glow: ¼ resolution is plenty
    const c = document.createElement('canvas');
    c.width = Math.ceil(2 * H * k);
    c.height = Math.ceil(2 * H * k);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.scale(k, k);
    const cx = H;
    const cy = H;
    const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, H);
    halo.addColorStop(0, 'rgba(255,200,100,0.75)');
    halo.addColorStop(0.1, 'rgba(255,160,70,0.28)');
    halo.addColorStop(0.45, 'rgba(255,120,50,0.05)');
    halo.addColorStop(1, 'rgba(255,100,40,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, H, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let q = 0; q < 16; q++) {
      const a = Math.PI * 2 * hash01(q, 31);
      const L = r * (0.5 + 0.9 * hash01(q, 32));
      const w = 0.05 + 0.06 * hash01(q, 33);
      const g = ctx.createLinearGradient(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + L), cy + Math.sin(a) * (r + L));
      g.addColorStop(0, 'rgba(255,180,90,0.07)');
      g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - w) * r * 0.98, cy + Math.sin(a - w) * r * 0.98);
      ctx.lineTo(cx + Math.cos(a) * (r + L), cy + Math.sin(a) * (r + L));
      ctx.lineTo(cx + Math.cos(a + w) * r * 0.98, cy + Math.sin(a + w) * r * 0.98);
      ctx.closePath();
      ctx.fill();
    }
    return { c, H };
  });

export function drawSun(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glowPass = false) {
  const s = sunGeom(frame);
  ctx.save();
  applyWorld(ctx, cam);
  const { cx, cy, r } = s;
  if (glowPass) {
    // bloom source: the disc with its own limb darkening (a flat bright disc washed the volume out), strong while it is
    // a star, gentler (and over-exposing only the centre) once it is big
    const big = clamp((r - 60) / 300);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.1);
    bg.addColorStop(0, `rgba(255,240,200,${0.95 - 0.3 * big})`);
    bg.addColorStop(0.6, `rgba(255,214,140,${0.9 - 0.42 * big})`);
    bg.addColorStop(0.88, `rgba(255,160,70,${0.85 - 0.5 * big})`);
    bg.addColorStop(0.92, `rgba(255,130,50,${0.8 - 0.5 * big})`);
    bg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const k = r / SUN.r;
  if (r < 50) {
    // still a point / small star: cheap procedural drawing
    const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 3 + 20);
    halo.addColorStop(0, 'rgba(255,214,120,0.75)');
    halo.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 3 - 20, cy - r * 3 - 20, 2 * (r * 3 + 20), 2 * (r * 3 + 20));
    const d = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    d.addColorStop(0, '#FFFDF2');
    d.addColorStop(0.8, '#FFE39A');
    d.addColorStop(1, '#FFA040');
    ctx.fillStyle = d;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const fadeIn = clamp((r - 50) / 40);
  // corona (cached, gently breathing)
  const HC = sunHaloCache();
  const br = 1 + 0.015 * Math.sin(frame * 0.05);
  ctx.globalAlpha = fadeIn;
  ctx.drawImage(HC.c, cx - HC.H * k * br, cy - HC.H * k * br, 2 * HC.H * k * br, 2 * HC.H * k * br);
  // disc: two granulation variants cross-fade and counter-rotate (boiling surface)
  const A = sunDiscCache(0);
  const B = sunDiscCache(1);
  const w = 0.5 + 0.5 * Math.sin(frame * 0.07);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(frame * 0.0011);
  ctx.drawImage(A.c, -A.R * k, -A.R * k, 2 * A.R * k, 2 * A.R * k);
  ctx.rotate(-frame * 0.0022);
  ctx.globalAlpha = fadeIn * w;
  ctx.drawImage(B.c, -B.R * k, -B.R * k, 2 * B.R * k, 2 * B.R * k);
  ctx.restore();
  ctx.globalAlpha = 1;
  // prominences: slow magnetic loops of plasma standing on the lower limb
  if (r > 120) {
    ctx.globalCompositeOperation = 'lighter';
    const PR: Array<[number, number, number, number]> = [
      [0.42, 0.07, 34, 0.3],
      [1.95, 0.05, 26, 2.1],
      [2.62, 0.09, 42, 4.0],
    ];
    for (const [a0, w0, h0, ph] of PR) {
      const h = (h0 + 8 * Math.sin(frame * 0.021 + ph)) * k * fadeIn;
      const p0 = [cx + Math.cos(a0 - w0) * r, cy + Math.sin(a0 - w0) * r];
      const p1 = [cx + Math.cos(a0 + w0) * r, cy + Math.sin(a0 + w0) * r];
      for (let q = 0; q < 3; q++) {
        const hh = h * (1 - q * 0.22);
        const cpx = cx + Math.cos(a0 + (q - 1) * 0.012) * (r + 2 * hh);
        const cpy = cy + Math.sin(a0 + (q - 1) * 0.012) * (r + 2 * hh);
        ctx.strokeStyle = q === 0 ? 'rgba(255,106,61,0.26)' : 'rgba(255,196,130,0.4)';
        ctx.lineWidth = q === 0 ? 12 * k : 2.6 * k;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo(cpx, cpy, p1[0], p1[1]);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // the chromosphere: a crisp, over-bright hairline along the limb (the disc cache is ½ res)
  if (r > 60) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,244,214,${(0.42 * fadeIn).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.8, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,120,60,${(0.22 * fadeIn).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // spicule fringe along the lower limb (live)
  if (r > 80) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,170,70,0.16)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let q = 0; q <= 120; q++) {
      const a = ((q + hash01(q, 404) * 0.8) / 120) * Math.PI;
      const nv = noise.n2(q * 0.37, frame * 0.04);
      if (nv < 0.05) continue;
      const L = nv * 22;
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + L), cy + Math.sin(a) * (r + L));
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ---------------------------------------------------------------- heat-death grey (opening)
// The grey DISSOLVES GRAIN BY GRAIN (S05's random walk run backwards): every ½-res grain has a threshold
//   T = d / m(θ)·(1 + 16 % warp) + W(d)·(g − ½) + 36·(c − ½)
// (d = distance from the point, m(θ) = 1 + 7 % fbm on the circle — an organic, angle-dependent front; g = the grain's
// own random number; c = clumps of grains; W widens with d). A grain clears when the light radius R(t) passes its T;
// grains within a few px of R glint warm white-gold — the light reaching them. No ring, no disc.
const GW = 540;
const GH = 960;
const CS = 4; // coarse grid step (½-res px) of the smooth part of T
const TL = 24; // tile size (½-res px): only tiles on the light front are computed per pixel
const NTX = Math.ceil(GW / TL);
const NTY = Math.ceil(GH / TL);
/** the grain's own random number (stable per ½-res pixel) */
const grain = (i: number) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const greyField = () =>
  memo('s06:greyField', () => {
    const nz = makeNoise(5055);
    const ang = new Float32Array(1024);
    for (let k = 0; k < 1024; k++) {
      const a = (k / 1024) * Math.PI * 2;
      ang[k] = 1 + 0.1 * nz.fbm2(Math.cos(a) * 2.2 + 3, Math.sin(a) * 2.2 - 1, 4);
    }
    // the smooth part of T (organic front + clumps) and the grain spread W, on a coarse grid
    const r = mulberry32(5150);
    const CW = Math.ceil(GW / CS) + 1;
    const CH = Math.ceil(GH / CS) + 1;
    const SM = new Float32Array(CW * CH);
    const WW = new Float32Array(CW * CH);
    const LW = 55;
    const LH = 97;
    const cl = new Float32Array(LW * LH);
    const wp = new Float32Array(LW * LH);
    for (let j = 0; j < LH; j++)
      for (let i = 0; i < LW; i++) {
        cl[j * LW + i] = r();
        wp[j * LW + i] = nz.fbm2(i / 9 + 7.3, j / 9 - 2.1, 4);
      }
    const bilL = (A: Float32Array, fx: number, fy: number) => {
      const x0 = Math.min(LW - 2, Math.floor(fx));
      const y0 = Math.min(LH - 2, Math.floor(fy));
      const tx = fx - x0;
      const ty = fy - y0;
      const a = A[y0 * LW + x0] + (A[y0 * LW + x0 + 1] - A[y0 * LW + x0]) * tx;
      const b = A[(y0 + 1) * LW + x0] + (A[(y0 + 1) * LW + x0 + 1] - A[(y0 + 1) * LW + x0]) * tx;
      return a + (b - a) * ty;
    };
    for (let gy = 0; gy < CH; gy++)
      for (let gx = 0; gx < CW; gx++) {
        const x = gx * CS;
        const y = gy * CS;
        const dx = x * 2 + 1 - GOLD_POINT.x;
        const dy = y * 2 + 1 - GOLD_POINT.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const k = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 1024) & 1023;
        const fx = Math.min(x / GW, 1) * (LW - 1);
        const fy = Math.min(y / GH, 1) * (LH - 1);
        SM[gy * CW + gx] = (d / ang[k]) * (1 + 0.16 * bilL(wp, fx, fy)) + 36 * (bilL(cl, fx, fy) - 0.5);
        WW[gy * CW + gx] = 26 + 0.075 * d;
      }
    // per-tile bounds of T
    const tMin = new Float32Array(NTX * NTY);
    const tMax = new Float32Array(NTX * NTY);
    let maxT = 0;
    for (let ty = 0; ty < NTY; ty++)
      for (let tx = 0; tx < NTX; tx++) {
        let lo = 1e9;
        let hi = -1e9;
        for (let gy = (ty * TL) / CS; gy <= Math.min(CH - 1, ((ty + 1) * TL) / CS); gy++)
          for (let gx = (tx * TL) / CS; gx <= Math.min(CW - 1, ((tx + 1) * TL) / CS); gx++) {
            const g = gy * CW + gx;
            lo = Math.min(lo, SM[g] - WW[g] / 2);
            hi = Math.max(hi, SM[g] + WW[g] / 2);
          }
        tMin[ty * NTX + tx] = lo - 2;
        tMax[ty * NTX + tx] = hi + 2;
        maxT = Math.max(maxT, hi + 2);
      }
    // boiling luminance noise — S05's own law: #5C5C5C + (a + b − 1)·15.3 per ½-res pixel (σ ≈ 6 %), upscaled with
    // smoothing: four 256² tiles (bytes + canvases), a new tile + offset every frame
    const tiles: Uint8Array[] = [];
    const tileCv: HTMLCanvasElement[] = [];
    for (let t = 0; t < 4; t++) {
      const rr = mulberry32(900 + t * 17);
      const a = new Uint8Array(256 * 256);
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const cx = c.getContext('2d', { willReadFrequently: true })!;
      const im = cx.createImageData(256, 256);
      for (let i = 0; i < a.length; i++) {
        a[i] = Math.max(0, Math.min(255, Math.round(92 + (rr() + rr() - 1) * 15.3)));
        im.data[i * 4] = a[i];
        im.data[i * 4 + 1] = a[i];
        im.data[i * 4 + 2] = a[i];
        im.data[i * 4 + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
      tiles.push(a);
      tileCv.push(c);
    }
    const cv = document.createElement('canvas');
    cv.width = GW;
    cv.height = GH;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    return { SM, WW, CW, tMin, tMax, maxT, tiles, tileCv, cv, cx, img: cx.createImageData(TL, TL) };
  });

/** the grey is drawn until the light radius has passed its last grain (~f33) */
export const greyOn = (frame: number) => frame < T.floodEnd && (frame < T.floodStart || floodR(frame) < greyField().maxT + 10);

/** Draw the dissolving grey (logical coordinates; its own ½-res raster upscaled ×2 like S05's). The boiling noise
 *  is blitted natively; only the tiles the light front is crossing are computed grain by grain. */
export function drawGrey(ctx: CanvasRenderingContext2D, frame: number) {
  if (!greyOn(frame)) return;
  const G = greyField();
  const R = frame < T.floodStart ? -1e9 : floodR(frame);
  const tile = G.tiles[frame & 3];
  const rr = mulberry32(frame * 131 + 7);
  const ox = Math.floor(rr() * 256);
  const oy = Math.floor(rr() * 256);
  const g = G.cx;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, GW, GH);
  for (let y = -oy; y < GH; y += 256) for (let x = -ox; x < GW; x += 256) g.drawImage(G.tileCv[frame & 3], x, y);
  const D = G.img.data;
  const CW = G.CW;
  for (let ty = 0; ty < NTY; ty++)
    for (let tx = 0; tx < NTX; tx++) {
      const ti = ty * NTX + tx;
      if (G.tMin[ti] - R > 8) continue; // still fully grey
      const x0 = tx * TL;
      const y0 = ty * TL;
      if (G.tMax[ti] - R < -10) {
        g.clearRect(x0, y0, TL, TL); // fully cleared
        continue;
      }
      for (let yy = 0; yy < TL; yy++) {
        const y = y0 + yy;
        const fy = y / CS;
        const gy = Math.floor(fy);
        const wy = fy - gy;
        const row = ((y + oy) & 255) << 8;
        for (let xx = 0; xx < TL; xx++) {
          const x = x0 + xx;
          const o = (yy * TL + xx) * 4;
          if (x >= GW || y >= GH) {
            D[o + 3] = 0;
            continue;
          }
          const fx = x / CS;
          const gx = Math.floor(fx);
          const wx = fx - gx;
          const q = gy * CW + gx;
          const sm0 = G.SM[q] + (G.SM[q + 1] - G.SM[q]) * wx;
          const sm1 = G.SM[q + CW] + (G.SM[q + CW + 1] - G.SM[q + CW]) * wx;
          const w0 = G.WW[q] + (G.WW[q + 1] - G.WW[q]) * wx;
          const w1 = G.WW[q + CW] + (G.WW[q + CW + 1] - G.WW[q + CW]) * wx;
          const t = sm0 + (sm1 - sm0) * wy + (w0 + (w1 - w0) * wy) * (grain(y * GW + x) - 0.5) - R;
          const v = tile[row | ((x + ox) & 255)];
          if (t > 7) {
            D[o] = v;
            D[o + 1] = v;
            D[o + 2] = v;
            D[o + 3] = 255;
          } else if (t > -9) {
            // the grain the light is reaching: it flares warm and goes
            const gl = 1 - Math.abs(t + 1) / 8;
            const k = gl * gl;
            D[o] = v + (255 - v) * k;
            D[o + 1] = v + (226 - v) * k;
            D[o + 2] = v + (150 - v) * k;
            D[o + 3] = Math.round(255 * Math.min(1, t > 0 ? 1 : k));
          } else D[o + 3] = 0;
        }
      }
      g.putImageData(G.img, x0, y0);
    }
  ctx.save();
  ctx.imageSmoothingEnabled = true; // as S05 (bilinear upscale of its ½-res grain)
  ctx.drawImage(G.cv, 0, 0, 1080, 1920);
  ctx.restore();
}

/** The gold point itself as S05 leaves it (r 3.5, flickering), drawn over the grey for the first frames. */
export function drawGoldPoint(ctx: CanvasRenderingContext2D, frame: number) {
  const s = sunGeom(frame);
  if (s.r > 14) return;
  const flick = 0.82 + 0.18 * hash01(frame, 4242);
  const k = clamp(1 - (s.r - 3.5) / 10);
  const halo = ctx.createRadialGradient(s.cx, s.cy, s.r * 0.5, s.cx, s.cy, s.r * 3);
  halo.addColorStop(0, `rgba(255,201,74,${0.35 * flick * k})`);
  halo.addColorStop(1, 'rgba(255,201,74,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(s.cx - s.r * 3, s.cy - s.r * 3, s.r * 6, s.r * 6);
  ctx.fillStyle = `rgba(255,201,74,${k})`;
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,247,224,${0.7 * flick * k})`;
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** Horizontal anamorphic flare on the point while it ignites (screen space). */
export function drawIgnitionFlare(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  const k = 0.6 * Math.min(seg(frame, 2, 10), 1 - seg(frame, 18, 40));
  if (k <= 0) return;
  const [x, y] = sunScreen(frame, cam);
  const L = 90 + 330 * ease.outCubic(seg(frame, 2, 30));
  const g = ctx.createLinearGradient(x - L, y, x + L, y);
  g.addColorStop(0, 'rgba(255,190,90,0)');
  g.addColorStop(0.5, `rgba(255,236,190,${0.55 * k})`);
  g.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - L, y - 1.5, 2 * L, 3);
  ctx.globalAlpha = 0.35 * k;
  ctx.fillRect(x - L * 0.6, y - 5, L * 1.2, 10);
  ctx.restore();
}
