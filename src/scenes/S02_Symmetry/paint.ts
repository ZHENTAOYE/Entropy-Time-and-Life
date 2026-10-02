// Low-level painting helpers for S02's blueprint language: grid, glow sprites, panel chrome, mono text.
import { FONT } from '../../lib/fonts';
import { clamp, ease, hexToRgb, memo, seg } from '../../lib/math';
import { C, GRID, PANEL_H, PANEL_W } from './constants';

export type Ctx = CanvasRenderingContext2D;

export const rgbaHex = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a)})`;
};

/** Full-frame blueprint grid (minor 50 px, major 200 px, registration crosses), rendered once. */
export function gridCanvas(): HTMLCanvasElement {
  return memo('S02:grid', () => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1920;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const { ox, oy, minor, major } = GRID;
    g.lineWidth = 1;
    // minor
    g.strokeStyle = C.gridMinor;
    g.beginPath();
    for (let x = ox % minor; x <= 1080; x += minor) {
      g.moveTo(Math.round(x) + 0.5, 0);
      g.lineTo(Math.round(x) + 0.5, 1920);
    }
    for (let y = oy % minor; y <= 1920; y += minor) {
      g.moveTo(0, Math.round(y) + 0.5);
      g.lineTo(1080, Math.round(y) + 0.5);
    }
    g.stroke();
    // major
    g.strokeStyle = C.gridMajor;
    g.beginPath();
    for (let x = ox % major; x <= 1080; x += major) {
      g.moveTo(Math.round(x) + 0.5, 0);
      g.lineTo(Math.round(x) + 0.5, 1920);
    }
    for (let y = oy % major; y <= 1920; y += major) {
      g.moveTo(0, Math.round(y) + 0.5);
      g.lineTo(1080, Math.round(y) + 0.5);
    }
    g.stroke();
    // registration crosses on major intersections
    g.strokeStyle = 'rgba(57,225,255,0.22)';
    g.beginPath();
    for (let x = ox % major; x <= 1080; x += major) {
      for (let y = oy % major; y <= 1920; y += major) {
        g.moveTo(x - 6, y + 0.5);
        g.lineTo(x + 7, y + 0.5);
        g.moveTo(x + 0.5, y - 6);
        g.lineTo(x + 0.5, y + 7);
      }
    }
    g.stroke();
    return c;
  });
}

/** Radial glow sprite (pre-multiplied look when drawn with 'lighter'). */
export function glowSprite(hex: string): HTMLCanvasElement {
  return memo('S02:glow:' + hex, () => {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const [r, gg, b] = hexToRgb(hex);
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grad.addColorStop(0.18, `rgba(${r},${gg},${b},0.55)`);
    grad.addColorStop(0.45, `rgba(${r},${gg},${b},0.16)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    return c;
  });
}

export function glow(ctx: Ctx, hex: string, x: number, y: number, radius: number, alpha: number) {
  if (alpha <= 0.003 || radius <= 0.5) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.drawImage(glowSprite(hex), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

export function mono(size: number, weight = 400) {
  return `${weight} ${size}px ${FONT.mono}`;
}
export function sans(size: number, weight = 400) {
  return `${weight} ${size}px ${FONT.sans}`;
}
export function latin(size: number, italic = true, weight = 600) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT.latin}`;
}

/** Draw text with tracking (letter spacing in px). Returns the advance width. */
export function trackedText(ctx: Ctx, s: string, x: number, y: number, tracking: number, align: 'left' | 'center' | 'right' = 'left'): number {
  const chars = Array.from(s);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + tracking;
  });
  ctx.textAlign = prevAlign;
  return total;
}

/** Typewriter: number of visible characters of s at local frame (cps = chars per frame). */
export function typed(s: string, local: number, cpf = 1.2): string {
  const n = Math.max(0, Math.floor(local * cpf));
  return Array.from(s).slice(0, n).join('');
}

function panelInnerSprite(tint: string): HTMLCanvasElement {
  return memo('S02:panelInner:' + tint, () => {
    const c = document.createElement('canvas');
    c.width = PANEL_W;
    c.height = PANEL_H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const gr = g.createLinearGradient(0, 0, 0, PANEL_H);
    gr.addColorStop(0, rgbaHex(tint, 0.05));
    gr.addColorStop(1, rgbaHex(tint, 0.015));
    g.fillStyle = gr;
    g.fillRect(0, 0, PANEL_W, PANEL_H);
    g.fillStyle = rgbaHex(tint, 0.16);
    for (let y = 25; y < PANEL_H; y += 25) for (let x = 25; x < PANEL_W; x += 25) g.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    return c;
  });
}

/** Soft "light table" glow behind both panels (quarter resolution, upscaled). */
export function lightTableSprite(centres: Array<[number, number]>): HTMLCanvasElement {
  return memo('S02:lightTable', () => {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.scale(0.25, 0.25);
    g.globalCompositeOperation = 'lighter';
    for (const [cx, cy] of centres) {
      const gr = g.createRadialGradient(cx, cy, 20, cx, cy, 620);
      gr.addColorStop(0, 'rgba(14,52,72,0.32)');
      gr.addColorStop(1, 'rgba(14,52,72,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 1080, 1920);
    }
    return c;
  });
}

/** Same falloff as lib/overlays Vignette (ellipse 75% x 62%, clear to 55 %, `strength` black at the rim), baked into a
 * quarter-res sprite and drawn inside the canvas — a full-frame CSS gradient layer is costly to composite. */
export function vignetteSprite(strength: number): HTMLCanvasElement {
  return memo('S02:vignette:' + strength, () => {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.setTransform(270 * 0.75, 0, 0, 480 * 0.62, 135, 240);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${strength})`);
    g.fillStyle = gr;
    g.fillRect(-2, -2, 4, 4);
    return c;
  });
}

/** Blueprint panel chrome: frame (drawn on along its perimeter), corner brackets, rulers, inner dot grid. */
export function drawPanelChrome(ctx: Ctx, px: number, py: number, draw: number, alpha: number, tint: string, inner: number) {
  if (alpha <= 0.002 || draw <= 0) return;
  const W = PANEL_W;
  const H = PANEL_H;
  ctx.save();
  // inner fill + dot grid (fades in after the frame is drawn) — cached sprite
  if (inner > 0) {
    ctx.globalAlpha = clamp(inner * alpha);
    ctx.drawImage(panelInnerSprite(tint), px, py);
    ctx.globalAlpha = 1;
  }
  // frame drawn along the perimeter from the top-left corner (both directions)
  const per = 2 * (W + H);
  const L = per * 0.5 * ease.inOutCubic(clamp(draw));
  ctx.strokeStyle = rgbaHex(tint, 0.55 * alpha);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([L, per]);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + W, py);
  ctx.lineTo(px + W, py + H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py + H);
  ctx.lineTo(px + W, py + H);
  ctx.stroke();
  ctx.setLineDash([]);
  // corner brackets
  const b = clamp((draw - 0.55) / 0.45);
  if (b > 0) {
    const arm = 26 * ease.outCubic(b);
    const o = 7;
    ctx.strokeStyle = rgbaHex(tint, 0.95 * alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const corners: Array<[number, number, number, number]> = [
      [px - o, py - o, 1, 1],
      [px + W + o, py - o, -1, 1],
      [px - o, py + H + o, 1, -1],
      [px + W + o, py + H + o, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.moveTo(cx + sx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * arm);
    }
    ctx.stroke();
    // rulers (top and left, outside)
    ctx.strokeStyle = rgbaHex(tint, 0.4 * alpha * b);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) {
      const len = x % 100 === 0 ? 9 : x % 50 === 0 ? 6 : 3;
      ctx.moveTo(px + x + 0.5, py - 14);
      ctx.lineTo(px + x + 0.5, py - 14 - len);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Stroke-only glyph with soft fill (blueprint stamp look). */
export function outlineText(ctx: Ctx, s: string, x: number, y: number, stroke: string, fill: string, lw: number) {
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.strokeText(s, x, y);
}

/** Expanding ring pulse. t: 0..1 */
export function ring(ctx: Ctx, x: number, y: number, r0: number, r1: number, t: number, hex: string, a: number, lw = 1.5) {
  if (t <= 0 || t >= 1) return;
  const e = ease.outCubic(t);
  ctx.strokeStyle = rgbaHex(hex, a * (1 - t) * (1 - t));
  ctx.lineWidth = lw * (1 - 0.5 * t);
  ctx.beginPath();
  ctx.arc(x, y, r0 + (r1 - r0) * e, 0, Math.PI * 2);
  ctx.stroke();
}

/** Window helper: 0 before a, ramps to 1 by a+inLen, holds, ramps down to 0 between b-outLen and b. */
export const win = (f: number, a: number, b: number, inLen = 8, outLen = 8) => Math.min(seg(f, a, a + inLen), 1 - seg(f, b - outLen, b));

/** Arrow with a filled head. */
export function arrow(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, head: number, color: string, lw: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const hx = x1 - Math.cos(a) * head * 0.8;
  const hy = y1 - Math.sin(a) * head * 0.8;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.42) * head, y1 - Math.sin(a - 0.42) * head);
  ctx.lineTo(x1 - Math.cos(a + 0.42) * head, y1 - Math.sin(a + 0.42) * head);
  ctx.closePath();
  ctx.fill();
}
