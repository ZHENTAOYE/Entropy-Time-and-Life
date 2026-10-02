// The Earth (side view) and the dive onto its land.
//  · CAP: the visible cap of the sphere, shaded ONCE per tab on the CPU at ¼ resolution (r1 used a WebGL shader +
//    readback every frame: ~250–300 ms per still). Orthographic sphere lit by the Sun above-and-behind: a lit crescent
//    at the limb, a soft terminator, the calm dark face below (the narration lane), Rayleigh-blue limb; clouds and
//    continents from 3D simplex fbm on the sphere (no map, no seams), evaluated only where the day side can show
//    them. The Earth does not visibly rotate in 19 s (0.08°), so the cap is static. Drawn clipped to the vector disc
//    (crisp limb at any zoom).
//  · DIVE: the cap hands over (by lz ≈ 0.26, hidden by a cloud deck) to dusk LAND drawn as ONE tileable relief
//    texture at five scales ×4 apart, cross-faded in log-zoom (each layer lives only while it is magnified 0.25–4×):
//    detail is resolved at every zoom of the ×36 dive. Everything is clipped to the planet disc; the whole world fades
//    to #04050B over f426–454 (frame-based: ≤ ~2/255 mean luminance per frame) and is not drawn after (no pop).
import { clamp, ease, memo, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { hash01, mulberry32 } from '../../lib/random';
import { Cam, applyWorld, groundScale, worldToScreen } from './camera';
import { EARTH, LIMB_Y } from './palette';
import { cloudPuffs } from './textures';
import { T } from './timing';
import { lerp, seg } from '../../lib/math';

/** how far behind the planet the Sun sits (terminator just under the narration lane) */
const BETA = 1.42;

export function earthGeom(frame: number) {
  const e = ease.outCubic(seg(frame, T.earthRiseStart, T.earthRiseEnd));
  return { cx: EARTH.cx, cy: lerp(EARTH.cy + 760, EARTH.cy, e), r: EARTH.r, e };
}

/** the world fades to deep space towards the end of the dive — over FRAMES (≈1–2/255 mean luminance per frame), not
 *  over log-zoom (which crosses lz 0.6 → 0.86 in only 8 frames); nothing of it is drawn once it has reached 0 */
export const worldFade = (frame: number) => 1 - smoothstep(T.diveStart + 30, T.diveStart + 58, frame);

/** planet disc in screen space (for clipping rivers / terrain) */
export function earthDisc(frame: number, cam: Cam): [number, number, number] {
  const e = earthGeom(frame);
  const [x, y] = worldToScreen(cam, e.cx, e.cy);
  return [x, y, e.r * cam.z];
}

// ---------------------------------------------------------------- the cap (CPU, once per tab)
const CAP_K = 1 / 4;
const CAP_Y0 = LIMB_Y - 6;
const CAP_Y1 = 1960;

const earthCap = () =>
  memo('s06:earthCapCPU', () => {
    const W = Math.ceil(1080 * CAP_K);
    const H = Math.ceil((CAP_Y1 - CAP_Y0) * CAP_K);
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    const img = cx.createImageData(W, H);
    shadeCap(W, H, img.data, CAP_K);
    cx.putImageData(img, 0, 0);
    return cv;
  });

/** Shade the cap into RGBA bytes (pure; exported for the dev benchmark). */
export function shadeCap(W: number, H: number, D: Uint8ClampedArray, k: number) {
  const n = makeNoise(4242);
  // map frame: pole tilted back and a little sideways
  const nrm = (v: number[]) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const pole = nrm([0.16, 0.52, -0.84]);
  const e1 = nrm([-pole[1], pole[0], 0]); // (0,0,1) × pole
  const e2 = [pole[1] * e1[2] - pole[2] * e1[1], pole[2] * e1[0] - pole[0] * e1[2], pole[0] * e1[1] - pole[1] * e1[0]];
  const Sy = 1 / Math.hypot(1, BETA);
  const Sz = -BETA / Math.hypot(1, BETA);
  // half vector of S and the view (0,0,1)
  const hl = Math.hypot(0, Sy, Sz + 1);
  const Hy = Sy / hl;
  const Hz = (Sz + 1) / hl;
  const R = EARTH.r;
  // the three noise fields (continents h, dryness, clouds) on a 2× coarser grid, bilinear per pixel (¼ of the cost)
  const GW2 = Math.ceil(W / 2) + 1;
  const GH2 = Math.ceil(H / 2) + 1;
  const NH = new Float32Array(GW2 * GH2);
  const ND = new Float32Array(GW2 * GH2);
  const NC = new Float32Array(GW2 * GH2);
  for (let gy = 0; gy < GH2; gy++) {
    const Y = CAP_Y0 + (gy * 2 + 0.5) / k;
    for (let gx = 0; gx < GW2; gx++) {
      const X = (gx * 2 + 0.5) / k;
      const xp = (X - EARTH.cx) / R;
      const yp = (EARTH.cy - Y) / R;
      const rho2 = Math.min(xp * xp + yp * yp, 0.9999);
      const zp = Math.sqrt(1 - rho2);
      if (yp * Sy + zp * Sz < -0.16) continue;
      const qx = xp * e1[0] + yp * e1[1] + zp * e1[2];
      const qy = xp * e2[0] + yp * e2[1] + zp * e2[2];
      const qz = xp * pole[0] + yp * pole[1] + zp * pole[2];
      const g = gy * GW2 + gx;
      NH[g] = n.fbm3(qx * 1.7 + 3.1, qy * 1.7 + 0.4, qz * 1.7 + 7.7, 4) * 1.05 - 0.1;
      ND[g] = n.n3(qx * 2.6 + 7, qy * 2.6, qz * 2.6) * 0.5;
      const lat = Math.asin(clamp(qz, -1, 1));
      const w = n.n3(qx * 2 + 1.3, qy * 2, qz * 2 + 4.2) * 0.6;
      const c = n.fbm3(qx * 3.1 + w * 1.6, qy * 3.1 - w, qz * 3.1 + w * 0.8, 4);
      const band = 0.1 * Math.exp(-((lat / 0.12) ** 2)) + 0.08 * Math.exp(-(((Math.abs(lat) - 0.85) / 0.18) ** 2)) - 0.06 * Math.exp(-(((Math.abs(lat) - 0.45) / 0.12) ** 2));
      NC[g] = c + band;
    }
  }
  const bil = (A: Float32Array, px: number, py: number) => {
    const fx = px / 2;
    const fy = py / 2;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const g = y0 * GW2 + x0;
    const a = A[g] + (A[g + 1] - A[g]) * tx;
    const b = A[g + GW2] + (A[g + GW2 + 1] - A[g + GW2]) * tx;
    return a + (b - a) * ty;
  };
  for (let py = 0; py < H; py++) {
    const Y = CAP_Y0 + (py + 0.5) / k;
    for (let px = 0; px < W; px++) {
      const X = (px + 0.5) / k;
      const xp = (X - EARTH.cx) / R;
      const yp = (EARTH.cy - Y) / R;
      let rho2 = xp * xp + yp * yp;
      const i = (py * W + px) * 4;
      if (rho2 >= 1.02) {
        D[i + 3] = 0;
        continue;
      }
      rho2 = Math.min(rho2, 0.9999);
      const zp = Math.sqrt(1 - rho2);
      const ndl = yp * Sy + zp * Sz;
      const day = smoothstep(-0.1, 0.3, ndl);
      const lam = Math.max(ndl, 0);
      let sr = 0.03;
      let sg = 0.105;
      let sb = 0.215;
      let cloud = 0;
      if (day > 0.01) {
        // continents
        const h = bil(NH, px, py);
        const land = smoothstep(0, 0.03, h);
        const shallow = smoothstep(-0.1, 0, h);
        const oR = lerp(0.03, 0.075, shallow);
        const oG = lerp(0.105, 0.27, shallow);
        const oB = lerp(0.215, 0.4, shallow);
        const dry = smoothstep(-0.05, 0.15, bil(ND, px, py));
        let lr = lerp(0.13, 0.5, dry);
        let lg = lerp(0.22, 0.4, dry);
        let lb = lerp(0.09, 0.25, dry);
        const rock = smoothstep(0.1, 0.26, h);
        lr = lerp(lr, 0.33, rock);
        lg = lerp(lg, 0.29, rock);
        lb = lerp(lb, 0.25, rock);
        sr = lerp(oR, lr, land);
        sg = lerp(oG, lg, land);
        sb = lerp(oB, lb, land);
        // clouds: domain-warped fbm, ITCZ / storm belts by latitude
        cloud = smoothstep(0.02, 0.3, bil(NC, px, py));
      }
      const oceanF = smoothstep(0.02, 0.12, sb - sr);
      const ndh = Math.max(0, yp * Hy + zp * Hz);
      const spec = Math.pow(ndh, 90) * oceanF * (1 - cloud) * 0.32 * day;
      const lk = 0.025 + 2 * lam * day;
      const ck = 0.015 + 1.55 * lam * day;
      const cc = cloud * 0.94;
      let r = lerp(sr * lk * (1 - 0.25 * cloud) + spec, 0.92 * ck, cc);
      let g = lerp(sg * lk * (1 - 0.25 * cloud) + spec * 0.92, 0.95 * ck, cc);
      let b = lerp(sb * lk * (1 - 0.25 * cloud) + spec * 0.78, 1.0 * ck, cc);
      r += 0.008 * (1 - day);
      g += 0.018 * (1 - day);
      b += 0.04 * (1 - day);
      // Rayleigh: blue limb + a thin blue veil over the day side
      const rim = Math.pow(1 - zp, 2.4);
      const rk = clamp(rim * 0.85);
      const rl = 0.25 + 0.9 * smoothstep(-0.3, 0.4, ndl);
      r = lerp(r, 0.32 * rl, rk) + 0.05 * day * 0.5;
      g = lerp(g, 0.62 * rl, rk) + 0.12 * day * 0.5;
      b = lerp(b, 0.98 * rl, rk) + 0.24 * day * 0.5;
      D[i] = Math.min(255, r * 255);
      D[i + 1] = Math.min(255, g * 255);
      D[i + 2] = Math.min(255, b * 255);
      D[i + 3] = 255;
    }
  }
}

// ---------------------------------------------------------------- dusk land (tileable relief, 256²)
const TS = 256;
const landTex = () =>
  memo('s06:landTex', () => {
    const rnd = mulberry32(1717);
    // periodic value noise (lattice wraps → the texture tiles)
    const octave = (cells: number) => {
      const L = new Float32Array(cells * cells);
      for (let i = 0; i < L.length; i++) L[i] = rnd();
      const out = new Float32Array(TS * TS);
      const k = cells / TS;
      for (let y = 0; y < TS; y++) {
        const fy = y * k;
        const y0 = Math.floor(fy);
        const ty = fy - y0;
        const sy = ty * ty * (3 - 2 * ty);
        const r0 = (y0 % cells) * cells;
        const r1 = ((y0 + 1) % cells) * cells;
        for (let x = 0; x < TS; x++) {
          const fx = x * k;
          const x0 = Math.floor(fx);
          const tx = fx - x0;
          const sx = tx * tx * (3 - 2 * tx);
          const c0 = x0 % cells;
          const c1 = (x0 + 1) % cells;
          const a = L[r0 + c0] + (L[r0 + c1] - L[r0 + c0]) * sx;
          const b = L[r1 + c0] + (L[r1 + c1] - L[r1 + c0]) * sx;
          out[y * TS + x] = a + (b - a) * sy;
        }
      }
      return out;
    };
    const O = [4, 8, 16, 32, 64].map(octave);
    const M = [octave(4), octave(16)];
    // ridged multifractal relief (ridge lines and valleys, not blobs)
    const h = new Float32Array(TS * TS);
    for (let i = 0; i < h.length; i++) {
      let v = 0;
      let amp = 0.5;
      let wgt = 1;
      for (let o = 0; o < 5; o++) {
        const r = 1 - Math.abs(O[o][i] * 2 - 1);
        const rr = r * r * wgt;
        v += rr * amp;
        wgt = Math.min(1, rr * 1.6 + 0.25);
        amp *= 0.5;
      }
      h[i] = v + O[0][i] * 0.25;
    }
    const cv = document.createElement('canvas');
    cv.width = TS;
    cv.height = TS;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.createImageData(TS, TS);
    const D = img.data;
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const i = y * TS + x;
        const hx = h[y * TS + ((x + 1) % TS)] - h[y * TS + ((x + TS - 1) % TS)];
        const hy = h[((y + 1) % TS) * TS + x] - h[((y + TS - 1) % TS) * TS + x];
        // low dusk light from the top of the frame: slopes facing up catch it (soft, low contrast)
        const shade = clamp(0.55 - hy * 5 - hx * 1.5);
        const veg = M[0][i] * 0.65 + M[1][i] * 0.35; // vegetation / soil patches
        const t = clamp((h[i] - 0.25) / 0.5);
        // dark slate-olive land at dusk; warm only where a slope catches the last light
        const br = [30 + 16 * (1 - veg) + 10 * t, 36 + 10 * veg + 4 * t, 30 + 6 * veg];
        const sh = [11, 14, 21];
        const k = 0.35 + 0.65 * shade;
        const hi = Math.pow(shade, 4);
        D[i * 4] = sh[0] + (br[0] - sh[0]) * k + 26 * hi;
        D[i * 4 + 1] = sh[1] + (br[1] - sh[1]) * k + 15 * hi;
        D[i * 4 + 2] = sh[2] + (br[2] - sh[2]) * k + 3 * hi;
        D[i * 4 + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  });

/** Dusk land under the dive (draw into a ½-res pass in logical coordinates). Five scales of one relief texture,
 *  ×4 apart, each weighted by a hat in log₄(on-screen tile size / 700 px): Σw = 1, ≤ 2 layers alive at a time. */
export function drawLand(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, alpha: number) {
  if (alpha <= 0.005) return;
  const [ex, ey, er] = earthDisc(frame, cam);
  const s = groundScale(cam, 13); // the river's ground → screen scale: the land is fixed to the rivers
  const tex = landTex();
  const disc = new Path2D();
  disc.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let j = -1; j <= 3; j++) {
    const P = 1200 / Math.pow(4, j); // tile period in river-ground units
    const scr = P * s;
    const w = 1 - Math.abs(Math.log(scr / 700) / Math.log(4));
    if (w <= 0) continue;
    const pat = ctx.createPattern(tex, 'repeat')!;
    const ox = (hash01(j + 5, 11) - 0.5) * P;
    const oy = (hash01(j + 5, 12) - 0.5) * P;
    pat.setTransform(new DOMMatrix().translate(cam.sx + ox * s, cam.sy + oy * s).scale(scr / TS));
    ctx.globalAlpha = w * alpha;
    ctx.fillStyle = pat;
    ctx.fill(disc);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the Earth (world space)
export function drawEarth(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, irGlow: number, irFill: number) {
  const wf = worldFade(frame);
  if (wf <= 0.001) return;
  const e = earthGeom(frame);
  const [, sy] = worldToScreen(cam, e.cx, e.cy - e.r - (irFill > 0.002 ? 1150 : 122));
  if (sy >= 1920) return; // still below the frame (with its glow)
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalAlpha = wf;
  const { cx, cy, r } = e;
  const dy = cy - EARTH.cy;
  const zk = Math.max(1, cam.z);
  // the sky fills with infrared (B5): a broad, faint red glow above the whole limb
  if (irFill > 0.002) {
    const g = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 1150);
    g.addColorStop(0, `rgba(255,59,47,${0.2 * irFill})`);
    g.addColorStop(0.3, `rgba(170,24,34,${0.1 * irFill})`);
    g.addColorStop(1, 'rgba(122,14,26,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1150, Math.PI, 2 * Math.PI);
    ctx.fill();
  }
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
  // the planet: shaded cap, clipped to the vector disc; hands over to the land during the dive
  const capA = 1 - smoothstep(0.03, 0.15, cam.lz);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // under the cap (and once it has faded): the planet's night body
  ctx.fillStyle = '#05101F';
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  if (capA > 0.003) {
    const cap = earthCap();
    ctx.globalAlpha = wf * capA;
    ctx.drawImage(cap, 0, CAP_Y0 + dy, 1080, CAP_Y1 - CAP_Y0);
  }
  ctx.restore();
  // crisp atmosphere rim (a hairline at any zoom; gone by lz 0.3 — the limb then leaves the frame anyway)
  const rimA = 1 - smoothstep(0.15, 0.3, cam.lz);
  if (rimA > 0.003) {
    ctx.globalAlpha = wf * rimA;
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
  }
  ctx.restore();
}

/** land alpha during the dive (takes over from the cap before it is magnified, out with the world) */
export const landAlpha = (frame: number, cam: Cam) => smoothstep(0.02, 0.13, cam.lz) * worldFade(frame);

/** The cloud deck: the camera falls through it during the dive (screen-space parallax, faster than the ground). */
export function drawDiveClouds(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  if (frame < T.diveStart + 6 || frame > T.diveStart + 36) return;
  const puffs = cloudPuffs();
  const cx = cam.sx;
  const cy = cam.sy;
  ctx.save();
  // a thin veil while we are inside the deck
  const veil = Math.exp(-(((frame - (T.diveStart + 20)) / 6) ** 2)) * 0.06;
  if (veil > 0.01) {
    ctx.fillStyle = `rgba(190,205,225,${veil})`;
    ctx.fillRect(0, 0, 1080, 1920);
  }
  for (let i = 0; i < 16; i++) {
    const t0 = T.diveStart + 6 + hash01(i, 91) * 16;
    const age = frame - t0;
    if (age < 0 || age > 14) continue;
    const s = Math.exp(age * 0.2);
    const a = Math.sin(Math.PI * (age / 14)) * (0.2 + 0.2 * hash01(i, 92));
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
