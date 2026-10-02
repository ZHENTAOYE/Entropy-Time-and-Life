// Post: the web image + fast-forward treatment (radial time-smear of the highlights, chromatic fringes — the film's
// sign that time is being tampered with), the vignette (gone at equilibrium) and, once the cosmos has reached
// equilibrium, a cheap JS replica of its grey: #5C5C5C + (h1 + h2 − 1)·6 % per half-res pixel, new every frame,
// upscaled with smoothing — statistically identical to the cosmos shader at eq = 1.
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { ffK } from './timing';
import { ctxOf, fresh, scratch } from './gfx';

const HW = 540;
const HH = 960;

/** web image + fast-forward smear / fringes (all built at half res, composited with ONE upscale) */
export function drawWebPost(ctx: CanvasRenderingContext2D, src: CanvasImageSource, f: number) {
  ctx.drawImage(src, 0, 0, 1080, 1920);
  // the smear belongs to the stellar fast-forward; it is gone before the black holes (their rings would smear)
  const k = ffK(f) * (1 - ease.inOutSine(seg(f, 92, 132)));
  if (k < 0.01) return;
  // half-res bright-pass: x·x·x keeps the stars, drops the gas
  const hp = scratch('ff_half', HW, HH);
  const h = fresh(hp);
  h.imageSmoothingEnabled = true;
  h.drawImage(src, 0, 0, HW, HH);
  h.globalCompositeOperation = 'multiply';
  h.drawImage(hp, 0, 0);
  h.drawImage(hp, 0, 0);
  const fx = scratch('ff_fx', HW, HH);
  const s = fresh(fx);
  s.globalCompositeOperation = 'lighter';
  // radial time-smear: zoom-burst copies about the centre (light streaks outward, like a ▶▶ through the ages)
  const cx = HW / 2;
  const cy = HH / 2;
  for (let i = 1; i <= 9; i++) {
    const z = 1 + 0.018 * i * k;
    s.globalAlpha = 0.26 * (1 - i / 10.5);
    s.drawImage(hp, cx - cx * z, cy - cy * z, HW * z, HH * z);
  }
  // chromatic fringes: red ghost right, cyan ghost left (jittering a little, like the timecode's split)
  const d = ((2.5 + 2.5 * hash01(f, 515)) * k) / 2;
  const tint = scratch('ff_tint', HW, HH);
  for (const [col, dx] of [
    ['rgb(255,40,80)', d],
    ['rgb(40,200,255)', -d],
  ] as const) {
    const t = fresh(tint);
    t.drawImage(hp, 0, 0);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = col;
    t.fillRect(0, 0, HW, HH);
    s.globalAlpha = 0.9;
    s.drawImage(tint, dx, 0);
  }
  // the transport kick when ▶▶ engages: a short overexposed pulse of the highlights
  const kick = Math.exp(-Math.max(0, f - 2) / 3) * (f >= 2 ? 1 : 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(0.9 * k + 0.8 * kick);
  ctx.drawImage(fx, 0, 0, 1080, 1920);
  ctx.restore();
}

/** vignette sprite (ellipse 75 % × 62 %, stops 55 % → 100 %, like lib/overlays Vignette), drawn scaled */
function vignetteSprite(): HTMLCanvasElement {
  return memo('s05:vig', () => {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    const x = ctxOf(c);
    x.setTransform(270 / 1080, 0, 0, 480 / 1920, 0, 0);
    x.translate(540, 960);
    x.scale(810, 1190.4);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g;
    x.fillRect(-1, -1, 2, 2);
    return c;
  });
}
export function drawVignette(ctx: CanvasRenderingContext2D, strength: number) {
  if (strength < 0.003) return;
  ctx.save();
  ctx.globalAlpha = clamp(strength);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(vignetteSprite(), 0, 0, 1080, 1920);
  ctx.restore();
}

/** the equilibrium grey (#5C5C5C ± 6 % boiling noise), new every frame */
export function drawGrey(ctx: CanvasRenderingContext2D, f: number) {
  const c = scratch('grey', HW, HH);
  const x = ctxOf(c);
  const img = memo('s05:greyimg', () => x.createImageData(HW, HH));
  const d = img.data;
  const fs = (f * 2654435761) >>> 0;
  let s1 = (fs ^ 0x9e3779b9) >>> 0;
  for (let i = 0, k = 0; i < HW * HH; i++, k += 4) {
    // two xorshift draws per pixel (fast, deterministic per frame)
    s1 ^= s1 << 13;
    s1 ^= s1 >>> 17;
    s1 ^= s1 << 5;
    const a = (s1 >>> 0) / 4294967296;
    s1 ^= s1 << 13;
    s1 ^= s1 >>> 17;
    s1 ^= s1 << 5;
    const b = (s1 >>> 0) / 4294967296;
    const v = 92 + (a + b - 1) * 15.3;
    d[k] = v;
    d[k + 1] = v;
    d[k + 2] = v;
    d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'copy';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, 1080, 1920);
  ctx.restore();
}
