// S08 — footprint sprites and the per-frame relief texture fed to the sand shader.
// Relief canvas (screen-aligned, RELIEF_SCALE of the frame, CPU-backed): R = raised sand (displacement rim, push-off
// mound ahead of the toes, heel rim), G = depression.
// The print geometry follows S07's residual-heat field (same heel / lateral band / ball / five toes) so the thermal
// prints of the handoff turn into the very same dents, but as a *pressure* print: a heel narrower than the ball, an
// empty medial arch, five separate toe pits dug deep by the push-off, and the sand they shoved forward.
import { memo } from '../../lib/math';
import { cpuCanvas } from './CpuCanvas';
import { Cam, FOOT_L, PRINTS, Print, printBlur, printDepth } from './trail';

export const RELIEF_SCALE = 0.5;
const SPR_MARGIN = 56;
const SPR_W = Math.round(FOOT_L * 0.5 + SPR_MARGIN * 2);
const SPR_H = Math.round(FOOT_L + SPR_MARGIN * 2);
/** blur levels (world px) of the pre-baked sprites */
export const BLUR_LEVELS = [0.7, 1.5, 2.5, 4, 6, 9, 13, 18, 24];

interface Part {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  d: number;
}
/** Left foot, toes up, big toe on the inner (+x) side. Units of foot length, origin at the print centre. */
const PARTS: Part[] = [
  { x: -0.01, y: 0.3, rx: 0.13, ry: 0.155, rot: 0, d: 1 }, // heel (narrower than the ball)
  { x: -0.09, y: 0.075, rx: 0.052, ry: 0.17, rot: -0.083, d: 0.45 }, // lateral band (the medial arch stays empty)
  { x: 0.0, y: -0.15, rx: 0.185, ry: 0.122, rot: -0.12, d: 0.92 }, // ball
  { x: 0.125, y: -0.365, rx: 0.05, ry: 0.068, rot: 0.05, d: 1 }, // big toe
  { x: 0.03, y: -0.352, rx: 0.031, ry: 0.044, rot: 0, d: 0.95 },
  { x: -0.038, y: -0.33, rx: 0.029, ry: 0.04, rot: 0, d: 0.93 },
  { x: -0.096, y: -0.305, rx: 0.027, ry: 0.036, rot: 0, d: 0.9 },
  { x: -0.148, y: -0.27, rx: 0.025, ry: 0.032, rot: 0, d: 0.88 },
];
/** raised sand: push-off mound ahead of the toes (points to the future), a lower heel rim behind */
const MOUNDS: Part[] = [
  { x: 0.0, y: -0.44, rx: 0.2, ry: 0.075, rot: -0.1, d: 1 },
  { x: -0.01, y: 0.445, rx: 0.12, ry: 0.05, rot: 0, d: 0.55 },
];

function drawParts(ctx: CanvasRenderingContext2D, parts: Part[], cx: number, cy: number, L: number, style: (d: number) => string) {
  for (const p of parts) {
    ctx.fillStyle = style(p.d);
    ctx.beginPath();
    ctx.ellipse(cx + p.x * L, cy + p.y * L, p.rx * L, p.ry * L, p.rot, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw the foot silhouette (left foot) into ctx centred at (cx, cy), length L, using fillStyle per part depth. */
export function footPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, L: number, depthToStyle: (d: number) => string) {
  drawParts(ctx, PARTS, cx, cy, L, depthToStyle);
}

type MaskKind = 'dep' | 'sole' | 'mound';
/** raw masks in the R channel of an opaque black CPU canvas: 'dep' = depression depth, 'sole' = whole plantar
 *  silhouette (for shadows), 'mound' = raised sand */
function maskCanvas(kind: MaskKind): HTMLCanvasElement {
  return memo(`S08:maskCv:${kind}`, () => {
    const c = cpuCanvas(SPR_W, SPR_H);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SPR_W, SPR_H);
    ctx.globalCompositeOperation = 'lighten';
    const st = (d: number) => `rgb(${Math.round(d * 255)},0,0)`;
    if (kind === 'mound') drawParts(ctx, MOUNDS, SPR_W / 2, SPR_H / 2, FOOT_L, st);
    else if (kind === 'dep') drawParts(ctx, PARTS, SPR_W / 2, SPR_H / 2, FOOT_L, st);
    else {
      drawParts(ctx, PARTS, SPR_W / 2, SPR_H / 2, FOOT_L, () => 'rgb(255,0,0)');
      // the arch: the foot is there (it casts a shadow) even where it doesn't touch the sand
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.beginPath();
      ctx.ellipse(SPR_W / 2 - 0.02 * FOOT_L, SPR_H / 2 + 0.07 * FOOT_L, 0.12 * FOOT_L, 0.24 * FOOT_L, 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  });
}

/** Gaussian blur (std σ, world px) of a mask, as floats 0..1 (Skia's blur on a CPU canvas: fast, deterministic) */
export function blurMask(kind: MaskKind, sigma: number): Float32Array {
  return memo(`S08:blurMask3:${kind}:${sigma}`, () => {
    const tmp = memo('S08:blurTmp', () => cpuCanvas(SPR_W, SPR_H));
    const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.filter = `blur(${sigma}px)`;
    ctx.drawImage(maskCanvas(kind), 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    const d = ctx.getImageData(0, 0, SPR_W, SPR_H).data;
    const m = new Float32Array(SPR_W * SPR_H);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4] / 255;
    return m;
  });
}

function toCanvas(r: Float32Array | null, g: Float32Array | null, b: Float32Array | null): HTMLCanvasElement {
  const c = cpuCanvas(SPR_W, SPR_H);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.createImageData(SPR_W, SPR_H);
  for (let i = 0; i < SPR_W * SPR_H; i++) {
    img.data[i * 4] = r ? Math.min(255, r[i] * 255) : 0;
    img.data[i * 4 + 1] = g ? Math.min(255, g[i] * 255) : 0;
    img.data[i * 4 + 2] = b ? Math.min(255, b[i] * 255) : 0;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** relief sprite for blur level i (raised sand in R, depression in G) — built lazily, only the levels in use */
export function reliefSprite(i: number): HTMLCanvasElement {
  return memo(`S08:reliefSprite3:${i}`, () => {
    const s = BLUR_LEVELS[i];
    const dep = blurMask('dep', s);
    const wide = blurMask('dep', s + 6);
    const mound = blurMask('mound', s + 2.5);
    const rim = new Float32Array(dep.length);
    // displacement rim all around + the push-off mound / heel rim; never inside the dent itself
    for (let k = 0; k < rim.length; k++) rim[k] = Math.max(0, Math.max(0, wide[k] - dep[k]) * 1.5 + mound[k] * 0.85 - dep[k] * 1.6);
    return toCanvas(rim, dep, null);
  });
}

/** soft shadow sprites of the whole sole silhouette (alpha), by penumbra width (world px) */
export const SHADOW_LEVELS = [0.9, 2, 4, 7, 11, 16, 22];
export function shadowSprite(i: number): HTMLCanvasElement {
  return memo(`S08:shadowSprite3:${i}`, () => {
    const a = blurMask('sole', SHADOW_LEVELS[i]);
    const c = cpuCanvas(SPR_W, SPR_H);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.createImageData(SPR_W, SPR_H);
    for (let k = 0; k < a.length; k++) {
      img.data[k * 4] = 10;
      img.data[k * 4 + 1] = 9;
      img.data[k * 4 + 2] = 20;
      img.data[k * 4 + 3] = Math.min(255, a[k] * 255);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}

/** Draw a sprite for print p under camera c (ctx is in logical screen px). */
export function drawPrintSprite(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement, p: Print, c: Cam, scale = 1, dx = 0, dy = 0) {
  const sx = c.ax + (p.x + dx - c.cx) * c.z;
  const sy = c.ay + (p.y + dy - c.cy) * c.z;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.ang);
  ctx.scale(p.side * c.z * scale * -1, c.z * scale); // sprites are left feet; mirror for the right
  ctx.drawImage(spr, -SPR_W / 2, -SPR_H / 2);
  ctx.restore();
}

/** pick two adjacent levels and the mix between them */
export function levelPick(levels: number[], b: number): [number, number] {
  let i = 0;
  while (i < levels.length - 2 && levels[i + 1] < b) i++;
  const t = Math.max(0, Math.min(1, (b - levels[i]) / (levels[i + 1] - levels[i])));
  return [i, t];
}

/** Paint the relief texture for frame f. Returns the (memoised, CPU-backed) canvas. */
export function paintRelief(f: number, c: Cam): HTMLCanvasElement {
  const cv = memo('S08:reliefCanvas2', () => cpuCanvas(Math.round(1080 * RELIEF_SCALE), Math.round(1920 * RELIEF_SCALE)));
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(RELIEF_SCALE, 0, 0, RELIEF_SCALE, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of PRINTS) {
    const d = printDepth(p, f);
    if (d < 0.004) continue;
    const sx = c.ax + (p.x - c.cx) * c.z;
    const sy = c.ay + (p.y - c.cy) * c.z;
    const rr = FOOT_L * c.z;
    if (sx < -rr || sx > 1080 + rr || sy < -rr || sy > 1920 + rr) continue;
    const [i, t] = levelPick(BLUR_LEVELS, printBlur(p, f));
    if (t < 0.98) {
      ctx.globalAlpha = d * (1 - t);
      drawPrintSprite(ctx, reliefSprite(i), p, c);
    }
    if (t > 0.02) {
      ctx.globalAlpha = d * t;
      drawPrintSprite(ctx, reliefSprite(i + 1), p, c);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return cv;
}

