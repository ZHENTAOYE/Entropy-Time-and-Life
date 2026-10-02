// S09 — canvas plumbing. ONE visible CPU-backed canvas per beat (every extra full-frame layer costs a full CPU
// composite in the SwiftShader renderer), offscreen scratch canvases, small drawing helpers.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { hexToRgb, memo } from '../../lib/math';

/** The scene's visible canvas: redrawn synchronously every frame (and whenever `version` changes). */
export const Layer: React.FC<{ draw: (ctx: CanvasRenderingContext2D, frame: number) => void; version?: string; style?: React.CSSProperties }> = ({
  draw,
  version = '',
  style,
}) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<string | null>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    const key = frame + '|' + version;
    if (!c || last.current === key) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    reset(ctx);
    ctx.clearRect(0, 0, c.width, c.height);
    draw(ctx, frame);
    last.current = key;
  });
  return <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, ...style }} />;
};

export function reset(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.imageSmoothingEnabled = true;
}

/** A reusable offscreen CPU canvas (per name), resized when needed. */
export function scratch(name: string, w: number, h: number): HTMLCanvasElement {
  const c = memo(`s09:scratch:${name}`, () => document.createElement('canvas'));
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  return c;
}
export function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true })!;
}
/** reset a scratch canvas' context to identity / defaults and clear it */
export function fresh(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = ctxOf(c);
  reset(x);
  x.clearRect(0, 0, c.width, c.height);
  return x;
}

export function rgbStr(c: readonly number[], a = 1): string {
  return a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(4)})`;
}
export function hexA(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
}
export type RGB = readonly [number, number, number];
export const mixRgb = (a: RGB, b: RGB, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** radial glow sprite (white core → colour → transparent), cached per colour */
export function glowSprite(hex: string, core = 1): HTMLCanvasElement {
  return memo(`s09:glow:${hex}:${core}`, () => {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = ctxOf(c);
    const [r, gg, b] = hexToRgb(hex);
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, `rgba(${Math.round(r + (255 - r) * core)},${Math.round(gg + (255 - gg) * core)},${Math.round(b + (255 - b) * core)},1)`);
    grad.addColorStop(0.12, `rgba(${r},${gg},${b},0.75)`);
    grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.2)`);
    grad.addColorStop(0.7, `rgba(${r},${gg},${b},0.04)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    return c;
  });
}
/** additive glow dot of radius r (px) */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number, core = 1) {
  if (a <= 0.003 || r <= 0.3) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, a);
  ctx.drawImage(glowSprite(hex, core), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prev;
}

/** soft dark ellipse behind a text block (legibility over busy imagery) */
export function softBacking(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a: number, rgb: RGB = [4, 4, 8]) {
  if (a <= 0.003) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgbStr(rgb, a));
  g.addColorStop(0.55, rgbStr(rgb, a * 0.75));
  g.addColorStop(1, rgbStr(rgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * A cheap blur (σ ≈ factor/2 px): progressive 2× downsampling (each a 2×2 box average) and one bilinear upscale back
 * to the source size. A canvas `filter: blur()` costs 100+ ms per call in this renderer, even at quarter resolution.
 */
export function cheapBlur(name: string, src: HTMLCanvasElement, factor: 2 | 4 | 8): HTMLCanvasElement {
  const w = src.width,
    h = src.height;
  let cur = src;
  for (let f = 2, k = 0; f <= factor; f *= 2, k++) {
    const c = scratch(`${name}:d${k}`, Math.max(1, Math.round(w / f)), Math.max(1, Math.round(h / f)));
    const g = fresh(c);
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const out = scratch(`${name}:up`, w, h);
  const go = fresh(out);
  go.imageSmoothingEnabled = true;
  go.drawImage(cur, 0, 0, w, h);
  return out;
}

/** the vignette's alpha profile (lib Vignette: ellipse 75 % × 62 %, linear from 55 % to 100 %) at 1/4 resolution */
function vignetteImage(rgb: RGB): HTMLCanvasElement {
  return memo(`s09:vig:${rgb.join(',')}`, () => {
    const W = 270,
      H = 480;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = ctxOf(c);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const px = (x + 0.5) * 4,
          py = (y + 0.5) * 4;
        const r = Math.hypot((px - 540) / 810, (py - 960) / 1190.4);
        const a = Math.min(1, Math.max(0, (r - 0.55) / 0.45));
        const k = (y * W + x) * 4;
        img.data[k] = rgb[0];
        img.data[k + 1] = rgb[1];
        img.data[k + 2] = rgb[2];
        img.data[k + 3] = Math.round(255 * a);
      }
    g.putImageData(img, 0, 0);
    return c;
  });
}
/** radial vignette (one upscaled blit of a cached quarter-res profile; a clipped full-frame gradient costs ~0.3 s) */
export function vignette(ctx: CanvasRenderingContext2D, strength: number, rgb: RGB = [0, 0, 0]) {
  if (strength <= 0.003) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(1, strength);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(vignetteImage(rgb), 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
