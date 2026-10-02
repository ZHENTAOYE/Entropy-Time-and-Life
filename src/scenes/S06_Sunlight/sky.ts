// Side-view world: deep space, stars, the Sun (top) and the Earth (bottom), the heat-death grey that the opening
// floods away, and the cloud deck the camera falls through during the dive.
import { GOLD_POINT } from '../../lib/handoff';
import { clamp, ease, lerp, memo, seg } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { hash01, mulberry32 } from '../../lib/random';
import { Cam, DIVE_T, ZF, applyWorld } from './camera';
import { EARTH_CAP, earthCap } from './earthGL';
import { EARTH, P, SUN } from './palette';
import { cloudPuffs, granTex, greyTiles, nebulaTex, terrainTex } from './textures';
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

export function earthGeom(frame: number) {
  const e = ease.outCubic(seg(frame, T.earthRiseStart, T.earthRiseEnd));
  return { cx: EARTH.cx, cy: lerp(EARTH.cy + 760, EARTH.cy, e), r: EARTH.r, e };
}

/** colour-flood radius around the gold point (screen px): the front leaves the frame at ~f26 */
export const floodR = (frame: number) => 1500 * ease.inOutSine(seg(frame, T.floodStart, 34)) + 30 * ease.outQuad(seg(frame, T.floodStart, T.floodStart + 6));

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
  // DAWN: the returning light floods out of the point — luminous and saturated (never a dimming), white-gold at the
  // centre → orange → rose → ultramarine at the front; relaxes into deep space as the Sun condenses (f22–50).
  const dawn = Math.min(seg(frame, T.floodStart, T.floodStart + 3), 1 - ease.inOutSine(seg(frame, 22, 50)));
  if (dawn > 0.01) {
    const Rd = Math.max(30, R);
    const g = ctx.createRadialGradient(px, py, 0, px, py, Rd);
    g.addColorStop(0, `rgba(255,248,226,${dawn})`);
    g.addColorStop(0.1, `rgba(255,232,170,${0.97 * dawn})`);
    g.addColorStop(0.3, `rgba(255,170,90,${0.9 * dawn})`);
    g.addColorStop(0.56, `rgba(214,96,104,${0.8 * dawn})`);
    g.addColorStop(0.8, `rgba(84,86,190,${0.75 * dawn})`);
    g.addColorStop(0.95, `rgba(40,62,160,${0.6 * dawn})`);
    g.addColorStop(1, 'rgba(26,42,106,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, Rd, 0, Math.PI * 2);
    ctx.fill();
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
  [0.4, [255, 138, 31]],
  [0.52, [255, 168, 58]],
  [0.66, [255, 204, 106]],
  [0.82, [255, 232, 170]],
  [1, [255, 248, 228]],
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
    const c = document.createElement('canvas');
    c.width = 2 * R;
    c.height = 2 * R;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
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
    ctx.globalAlpha = 0.1;
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
    const k = 0.5;
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
    // bloom source: the disc (strong while it is a star, still generous when big)
    ctx.globalAlpha = 0.95 - 0.25 * clamp((r - 60) / 300);
    ctx.fillStyle = '#FFE09A';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
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
        ctx.strokeStyle = q === 0 ? 'rgba(255,110,50,0.24)' : 'rgba(255,190,120,0.32)';
        ctx.lineWidth = q === 0 ? 7 * k : 2 * k;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo(cpx, cpy, p1[0], p1[1]);
        ctx.stroke();
      }
    }
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

// ---------------------------------------------------------------- the Earth
/** how far behind the planet the Sun sits (terminator just under the narration lane) */
const BETA = 1.42;

export function drawEarth(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, irGlow: number) {
  const e = earthGeom(frame);
  ctx.save();
  applyWorld(ctx, cam);
  const { cx, cy, r } = e;
  const dy = cy - EARTH.cy;
  const zk = Math.max(1, cam.z);
  // atmosphere outer glow (forward-scattered sunlight above the limb)
  const ag = ctx.createRadialGradient(cx, cy, r - 2, cx, cy, r + 120);
  ag.addColorStop(0, 'rgba(150,225,255,0.62)');
  ag.addColorStop(0.06, 'rgba(91,200,255,0.3)');
  ag.addColorStop(0.32, 'rgba(60,140,255,0.07)');
  ag.addColorStop(1, 'rgba(40,100,255,0)');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 120, Math.PI, 2 * Math.PI);
  ctx.fill();
  // IR aura (the Earth glows in the infrared)
  if (irGlow > 0.001) {
    const ig = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 300);
    ig.addColorStop(0, `rgba(255,59,47,${0.22 * irGlow})`);
    ig.addColorStop(0.25, `rgba(200,30,40,${0.08 * irGlow})`);
    ig.addColorStop(1, 'rgba(120,14,26,0)');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 300, Math.PI, 2 * Math.PI);
    ctx.fill();
  }
  // the planet: GPU-shaded cap (map-projected clouds & continents, terminator, Rayleigh limb)
  if (cam.lz < 0.5) {
    const cap = earthCap(frame, BETA);
    ctx.drawImage(cap, 0, EARTH_CAP.y0 + dy, EARTH_CAP.w * 2, EARTH_CAP.h * 2);
  }
  // land under the dive target, lit at dusk, fading in as we descend (soft circular edge)
  const terrA = clamp((cam.lz - 0.05) / 0.2);
  if (terrA > 0.01) {
    const half = (1300 * 13) / ZF;
    ctx.save();
    ctx.globalAlpha = terrA;
    ctx.drawImage(terrainTex(), DIVE_T.x - half, DIVE_T.y + dy - half, 2 * half, 2 * half);
    ctx.restore();
  }
  // crisp atmosphere rim
  ctx.strokeStyle = 'rgba(190,236,255,0.95)';
  ctx.lineWidth = 2 / zk;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(91,200,255,0.3)';
  ctx.lineWidth = 10 / Math.sqrt(zk);
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();
}

/** The cloud deck: the camera falls through it during the dive (screen-space parallax, faster than the ground). */
export function drawDiveClouds(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  if (frame < T.diveStart + 8 || frame > T.diveStart + 44) return;
  const puffs = cloudPuffs();
  const cx = cam.sx;
  const cy = cam.sy;
  ctx.save();
  // a thin veil while we are inside the deck
  const veil = Math.exp(-(((frame - (T.diveStart + 27)) / 7) ** 2)) * 0.22;
  if (veil > 0.01) {
    ctx.fillStyle = `rgba(190,205,225,${veil})`;
    ctx.fillRect(0, 0, 1080, 1920);
  }
  for (let i = 0; i < 16; i++) {
    const t0 = T.diveStart + 10 + hash01(i, 91) * 22;
    const age = frame - t0;
    if (age < 0 || age > 18) continue;
    const s = Math.exp(age * 0.16);
    const a = Math.sin(Math.PI * (age / 18)) * (0.55 + 0.3 * hash01(i, 92));
    const ang = hash01(i, 93) * Math.PI * 2;
    const d0 = 60 + 260 * hash01(i, 94);
    const x = cx + Math.cos(ang) * d0 * s;
    const y = cy + Math.sin(ang) * d0 * s * 0.8;
    const w = (260 + 220 * hash01(i, 95)) * s;
    ctx.globalAlpha = a;
    ctx.drawImage(puffs[i % 3], x - w / 2, y - w * 0.4, w, w * 0.8);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- heat-death grey (opening)
/** Grey noise covering everything outside the expanding colour flood. */
export function drawGrey(ctx: CanvasRenderingContext2D, frame: number) {
  const R = floodR(frame);
  if (R > 1400) return;
  const tiles = greyTiles();
  const tile = tiles[frame % tiles.length];
  const r = mulberry32(frame * 131 + 7);
  const ox = -Math.floor(r() * 256);
  const oy = -Math.floor(r() * 256);
  ctx.imageSmoothingEnabled = false;
  for (let y = oy * 2; y < 1920; y += 512) for (let x = ox * 2; x < 1080; x += 512) ctx.drawImage(tile, x, y, 512, 512);
  ctx.imageSmoothingEnabled = true;
  if (R < 1) return;
  // punch the flood hole (soft edge just inside the light front)
  ctx.globalCompositeOperation = 'destination-out';
  const cx = GOLD_POINT.x;
  const cy = GOLD_POINT.y;
  const edge = 14 + R * 0.04;
  const g = ctx.createRadialGradient(cx, cy, Math.max(0, R - edge), cx, cy, R + 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/** The light front of the flood: an additive white-gold shock ring, clearly brighter than the grey, with a thin
 *  blue fringe outside. Drawn on the main canvas (and into the bloom source). */
export function drawFloodFront(ctx: CanvasRenderingContext2D, frame: number, k = 1) {
  const R = floodR(frame);
  if (R < 6 || R > 1400) return;
  const fade = Math.min(1, R / 30) * (1 - seg(R, 1150, 1400));
  const cx = GOLD_POINT.x;
  const cy = GOLD_POINT.y;
  const w = 30 + R * 0.024;
  const r0 = Math.max(0, R - w);
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, R + 16);
  const span = R + 16 - r0;
  const at = (rr: number) => clamp((rr - r0) / span);
  g.addColorStop(0, 'rgba(255,220,150,0)');
  g.addColorStop(at(R - w * 0.45), `rgba(255,226,160,${0.35 * fade * k})`);
  g.addColorStop(at(R - 3), `rgba(255,241,200,${0.8 * fade * k})`);
  g.addColorStop(at(R + 3), `rgba(200,225,255,${0.5 * fade * k})`);
  g.addColorStop(at(R + 9), `rgba(110,160,255,${0.28 * fade * k})`);
  g.addColorStop(1, 'rgba(91,140,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 16, 0, Math.PI * 2);
  ctx.fill();
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
  const k = Math.min(seg(frame, 2, 12), 1 - seg(frame, 26, 56));
  if (k <= 0) return;
  const [x, y] = sunScreen(frame, cam);
  const L = 160 + 900 * ease.outCubic(seg(frame, 2, 30));
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
