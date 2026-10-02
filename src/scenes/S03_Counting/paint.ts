// Low-level painting helpers for S03's data language (Ikeda-style unit-vis in amber): glow sprites, grid,
// mono labels with raised exponents, dimension lines, barcodes.
import { FONT } from '../../lib/fonts';
import { clamp, hexToRgb, memo } from '../../lib/math';
import { C, GRID } from './constants';

export type Ctx = CanvasRenderingContext2D;

export const rgbaHex = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a).toFixed(3)})`;
};

/** Radial glow sprite (draw with 'lighter'). */
export function glowSprite(hex: string): HTMLCanvasElement {
  return memo('S03:glow:' + hex, () => {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d')!;
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

export function glow(ctx: Ctx, hex: string, x: number, y: number, r: number, a: number) {
  if (a <= 0.003 || r <= 0.5) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * clamp(a);
  ctx.drawImage(glowSprite(hex), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prev;
}

/** The S02 blueprint grid in amber (minor 50, major 200, registration crosses). Rendered once. */
export function gridCanvas(): HTMLCanvasElement {
  return memo('S03:grid', () => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1920;
    const g = c.getContext('2d')!;
    const { ox, oy, minor, major } = GRID;
    g.lineWidth = 1;
    g.strokeStyle = C.grid;
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
    g.strokeStyle = 'rgba(255,159,46,0.22)';
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

/** Same falloff as lib/overlays Vignette (ellipse 75% × 62%, clear to 55 %), baked small. */
export function vignetteSprite(strength: number): HTMLCanvasElement {
  return memo('S03:vignette:' + strength, () => {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    const g = c.getContext('2d')!;
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

// ------------------------------------------------------------------ text
export const MONO = (size: number, weight = 400) => `${weight} ${size}px ${FONT.mono}`;
export const SANS = (size: number, weight = 400) => `${weight} ${size}px ${FONT.sans}`;
export const SERIF = (size: number, weight = 600) => `${weight} ${size}px ${FONT.serif}`;
export const LATIN = (size: number, weight = 600, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT.latin}`;

/** A run of text; `sup` = raised exponent (0.58 em, raised 0.42 em of the base size). */
export type Run = { t: string; sup?: boolean; font?: string; color?: string };

/** Width of a rich line (runs share `font` unless overridden; letterSpacing in px per glyph). */
export function richWidth(ctx: Ctx, runs: Run[], font: string, size: number, tracking = 0): number {
  let w = 0;
  for (const r of runs) {
    ctx.font = r.font ?? (r.sup ? font.replace(/\d+(\.\d+)?px/, `${(size * 0.58).toFixed(1)}px`) : font);
    const tr = r.sup ? tracking * 0.58 : tracking;
    for (const ch of Array.from(r.t)) w += ctx.measureText(ch).width + tr;
  }
  return w;
}

/**
 * Draw a rich line with optional exponents. `x` is the left edge (or centre / right with align), `y` the alphabetic
 * baseline. `reveal` (0..1) types it on left → right (Ikeda type-on); the last revealed glyph flickers bright.
 */
export function drawRich(
  ctx: Ctx,
  runs: Run[],
  x: number,
  y: number,
  opt: { font: string; size: number; color: string; align?: 'left' | 'center' | 'right'; tracking?: number; reveal?: number; alpha?: number; cursor?: boolean; frame?: number },
) {
  const { font, size, color, align = 'left', tracking = 0, reveal = 1, alpha = 1 } = opt;
  if (alpha <= 0.003 || reveal <= 0) return;
  const total = runs.reduce((a, r) => a + Array.from(r.t).length, 0);
  const shown = Math.floor(total * clamp(reveal) + 1e-6);
  const w = richWidth(ctx, runs, font, size, tracking);
  let cx = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let i = 0;
  for (const r of runs) {
    const f = r.font ?? (r.sup ? font.replace(/\d+(\.\d+)?px/, `${(size * 0.58).toFixed(1)}px`) : font);
    ctx.font = f;
    const tr = r.sup ? tracking * 0.58 : tracking;
    const yy = r.sup ? y - size * 0.42 : y;
    for (const ch of Array.from(r.t)) {
      const adv = ctx.measureText(ch).width + tr;
      if (i < shown) {
        const head = i === shown - 1 && reveal < 1;
        ctx.globalAlpha = alpha * (head ? 1 : 1);
        ctx.fillStyle = head ? C.white : r.color ?? color;
        ctx.fillText(ch, cx, yy);
      }
      cx += adv;
      i++;
    }
  }
  if (opt.cursor && reveal < 1) {
    const blink = Math.floor((opt.frame ?? 0) / 4) % 2 === 0;
    if (blink) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      // cursor sits after the last shown glyph: recompute
      let px = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
      let j = 0;
      for (const r of runs) {
        ctx.font = r.font ?? (r.sup ? font.replace(/\d+(\.\d+)?px/, `${(size * 0.58).toFixed(1)}px`) : font);
        const tr = r.sup ? tracking * 0.58 : tracking;
        for (const ch of Array.from(r.t)) {
          if (j < shown) px += ctx.measureText(ch).width + tr;
          j++;
        }
      }
      ctx.fillRect(px + 2, y - size * 0.78, size * 0.5, size * 0.9);
    }
  }
  ctx.restore();
}

/** Parse "2^{10} = 1 024" style strings into runs (^{…} = exponent). */
export function sup(s: string, color?: string): Run[] {
  const out: Run[] = [];
  const re = /\^\{([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), color });
    out.push({ t: m[1].replace(/-/g, '−'), sup: true, color });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), color });
  return out;
}

// ------------------------------------------------------------------ technical drawing
/** Horizontal dimension line with end ticks and a centred label slot (gap) — drawn on with `k` (0..1). */
export function dimLineH(ctx: Ctx, x0: number, x1: number, y: number, k: number, color: string, alpha: number, gap = 0, tick = 10) {
  if (k <= 0 || alpha <= 0.003) return;
  const cx = (x0 + x1) / 2;
  const half = ((x1 - x0) / 2) * clamp(k);
  ctx.save();
  ctx.strokeStyle = rgbaHex(color, alpha);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const g = Math.min(gap / 2, half);
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - g, y);
  ctx.moveTo(cx + g, y);
  ctx.lineTo(cx + half, y);
  // end ticks (appear as the line reaches them)
  ctx.moveTo(cx - half, y - tick);
  ctx.lineTo(cx - half, y + tick);
  ctx.moveTo(cx + half, y - tick);
  ctx.lineTo(cx + half, y + tick);
  ctx.stroke();
  // arrow heads
  ctx.fillStyle = rgbaHex(color, alpha);
  const ah = 7;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - half + ah * 1.6, y - ah * 0.6);
  ctx.lineTo(cx - half + ah * 1.6, y + ah * 0.6);
  ctx.closePath();
  ctx.moveTo(cx + half, y);
  ctx.lineTo(cx + half - ah * 1.6, y - ah * 0.6);
  ctx.lineTo(cx + half - ah * 1.6, y + ah * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Hairline leader with a dot at the anchor; drawn on from (x0,y0) to (x1,y1) with k. Optional elbow. */
export function leader(ctx: Ctx, pts: Array<[number, number]>, k: number, color: string, alpha: number) {
  if (k <= 0 || alpha <= 0.003 || pts.length < 2) return;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total * clamp(k);
  ctx.save();
  ctx.strokeStyle = rgbaHex(color, alpha);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    const t = Math.min(1, left / d);
    ctx.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t);
    left -= d;
  }
  ctx.stroke();
  ctx.fillStyle = rgbaHex(color, alpha);
  ctx.beginPath();
  ctx.arc(pts[0][0], pts[0][1], 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Corner brackets around a rect (viewfinder / data callout). */
export function brackets(ctx: Ctx, x: number, y: number, w: number, h: number, len: number, color: string, alpha: number, lw = 1.5) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.strokeStyle = rgbaHex(color, alpha);
  ctx.lineWidth = lw;
  ctx.beginPath();
  const L = Math.min(len, w / 2, h / 2);
  ctx.moveTo(x, y + L);
  ctx.lineTo(x, y);
  ctx.lineTo(x + L, y);
  ctx.moveTo(x + w - L, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + L);
  ctx.moveTo(x + w, y + h - L);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - L, y + h);
  ctx.moveTo(x + L, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - L);
  ctx.stroke();
  ctx.restore();
}

/**
 * A microstate barcode: `bits` cells across width w (bit = 1 → lit = particle on the LEFT).
 * Lit cells amber/pale, dark cells a faint outline tone.
 */
export function barcode(ctx: Ctx, x: number, y: number, w: number, h: number, code: number, nBits: number, lit: string, alpha: number, dark = 0.12) {
  if (alpha <= 0.003) return;
  const cw = w / nBits;
  const gap = cw > 5 ? 1 : 0;
  for (let b = 0; b < nBits; b++) {
    const on = (code >> (nBits - 1 - b)) & 1;
    ctx.fillStyle = on ? rgbaHex(lit, alpha) : rgbaHex(C.amber, alpha * dark);
    ctx.fillRect(x + b * cw, y, cw - gap, h);
  }
}

export const popcount = (v: number) => {
  let c = 0;
  while (v) {
    c += v & 1;
    v >>>= 1;
  }
  return c;
};

/** Binomial coefficient as a float (fine up to n ≈ 1000). */
export function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
