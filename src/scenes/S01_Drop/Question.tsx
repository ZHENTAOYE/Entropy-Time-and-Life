// 「为什么？」 — the only big word of S01, on pure black after the hard cut (f330).
// Serif 200 (question / void), warm white. The glyph metrics of 「？」 are measured once at runtime (after the font
// slice is loaded) so that its DOT lands exactly on Q_DOT (lib/handoff.ts) — S02 starts from that dot.
// Beat: f331–336 fade in · hold · f362+ the three characters, then the hook of 「？」, DIFFUSE: each glyph breaks into
// a few thousand grains that spread like ink (√t spreading along a smooth flow, constant mass → paler as they
// spread). The dot never moves: it slowly gathers to r = Q_DOT.r. Last frame: black + the dot only.
import React from 'react';
import { CanvasLayer } from '../../lib/Canvas';
import { FONT, useFontsReady } from '../../lib/fonts';
import { Q_DOT, COLOR } from '../../lib/handoff';
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { makeNoise } from '../../lib/noise';
import { F } from './timeline';

export const Q_SIZE = 136;
const Q_WEIGHT = 200;
const Q_TRACK = 0.04; // em (size + tracking solved so the block is optically centred with the dot pinned at Q_DOT)
const Q_TEXT = '为什么？';
const Q_FONT = `${Q_WEIGHT} ${Q_SIZE}px ${FONT.serif}`;

interface QLayout {
  /** baseline y and per-character left x */
  base: number;
  xs: number[];
  /** dot of 「？」 as measured in the font: centre + equivalent radius */
  dot: { x: number; y: number; r: number; top: number };
  /** glyph grains per character: [x0,y0,…] in frame px */
  grains: Float32Array[];
}

/** Measure the 「？」 dot (lowest connected blob) relative to the glyph origin (left, alphabetic baseline). */
function measureDot(): { dx: number; dy: number; r: number; top: number; adv: number } {
  const S = Q_SIZE;
  const W = Math.ceil(S * 1.6),
    H = Math.ceil(S * 1.6);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const ox = Math.round(S * 0.3),
    oy = Math.round(S * 1.2);
  ctx.font = Q_FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.fillText('？', ox, oy);
  const adv = ctx.measureText('？').width;
  const d = ctx.getImageData(0, 0, W, H).data;
  const on = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) on[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  // connected components (4-neighbour flood fill); keep the one with the lowest centroid
  const lab = new Int32Array(W * H).fill(-1);
  let best = { cy: -1, cx: 0, n: 0, top: 0 };
  const stack: number[] = [];
  let id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!on[s] || lab[s] >= 0) continue;
    let n = 0,
      sx = 0,
      sy = 0,
      top = 1e9;
    stack.push(s);
    lab[s] = id;
    while (stack.length) {
      const q = stack.pop()!;
      const x = q % W,
        y = (q / W) | 0;
      n++;
      sx += x;
      sy += y;
      if (y < top) top = y;
      const nb = [q - 1, q + 1, q - W, q + W];
      for (const k of nb) {
        if (k < 0 || k >= W * H || !on[k] || lab[k] >= 0) continue;
        if ((k === q - 1 && x === 0) || (k === q + 1 && x === W - 1)) continue;
        lab[k] = id;
        stack.push(k);
      }
    }
    id++;
    if (n > 20 && sy / n > best.cy) best = { cy: sy / n, cx: sx / n, n, top };
  }
  return { dx: best.cx + 0.5 - ox, dy: best.cy + 0.5 - oy, r: Math.sqrt(best.n / Math.PI), top: best.top - oy, adv };
}

function layout(): QLayout {
  return memo('s01-q-layout', () => {
    const m = measureDot();
    const chars = Array.from(Q_TEXT);
    const c = document.createElement('canvas').getContext('2d')!;
    c.font = Q_FONT;
    const advs = chars.map((ch) => c.measureText(ch).width);
    const tr = Q_TRACK * Q_SIZE;
    // place the 「？」 so that its measured dot sits exactly on Q_DOT
    const qx = Q_DOT.x - m.dx;
    const base = Q_DOT.y - m.dy;
    const xs: number[] = [];
    let x = qx;
    xs[chars.length - 1] = qx;
    for (let i = chars.length - 2; i >= 0; i--) {
      x -= advs[i] + tr;
      xs[i] = x;
    }
    const dot = { x: Q_DOT.x, y: Q_DOT.y, r: m.r, top: base + m.top };
    // grains: sample each character's ink on its own canvas region
    const grains = chars.map((ch, i) => {
      const W = 1080,
        H = 1920;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d', { willReadFrequently: true })!;
      g.font = Q_FONT;
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#fff';
      g.fillText(ch, xs[i], base);
      const x0 = Math.max(0, Math.floor(xs[i] - 10)),
        x1 = Math.min(W, Math.ceil(xs[i] + advs[i] + 10));
      const y0 = Math.max(0, Math.floor(base - Q_SIZE * 1.1)),
        y1 = Math.min(H, Math.ceil(base + Q_SIZE * 0.35));
      const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const pts: number[] = [];
      const step = 1.6;
      for (let yy = 0; yy < y1 - y0; yy += step)
        for (let xx = 0; xx < x1 - x0; xx += step) {
          const ix = Math.floor(xx + hash01(pts.length + 7, i * 13 + 1) * step);
          const iy = Math.floor(yy + hash01(pts.length + 3, i * 13 + 2) * step);
          if (ix >= x1 - x0 || iy >= y1 - y0) continue;
          if (data[(iy * (x1 - x0) + ix) * 4 + 3] < 120) continue;
          const px = x0 + ix + 0.5,
            py = y0 + iy + 0.5;
          // the dot of 「？」 is not a grain: it stays
          if (i === chars.length - 1 && Math.hypot(px - dot.x, py - dot.y) < m.r * 2.1) continue;
          pts.push(px, py);
        }
      return new Float32Array(pts);
    });
    return { base, xs, dot, grains };
  });
}

/** diffusion start per character (为, 什, 么, hook of ？) */
const D_START = [F.qDiffuse, F.qDiffuse + 2, F.qDiffuse + 4, F.qDiffuse + 6];
const D_LEN = 18;

export const Question: React.FC = () => {
  const ready = useFontsReady([[Q_FONT, Q_TEXT]]);
  return (
    <CanvasLayer
      draw={(ctx, { frame: f }) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 1080, 1920);
        if (!ready || f < F.qIn) return;
        const L = layout();
        const aIn = ease.inOutQuad(seg(f, F.qIn, F.qIn + 5));
        const chars = Array.from(Q_TEXT);
        const noise = makeNoise(11);
        ctx.font = Q_FONT;
        ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < chars.length; i++) {
          const q = seg(f, D_START[i], D_START[i] + D_LEN);
          const crisp = aIn * (1 - smooth01(q / 0.3));
          if (crisp > 0.002) {
            ctx.save();
            ctx.globalAlpha = crisp;
            ctx.fillStyle = COLOR.voice;
            ctx.shadowColor = 'rgba(243,239,230,0.32)';
            ctx.shadowBlur = 22;
            if (i === chars.length - 1) {
              // the hook only (the dot is the circle below)
              ctx.beginPath();
              ctx.rect(L.xs[i] - 20, L.base - Q_SIZE * 1.2, Q_SIZE * 1.4, L.dot.top - 2 - (L.base - Q_SIZE * 1.2));
              ctx.clip();
            }
            ctx.fillText(chars[i], L.xs[i], L.base);
            ctx.restore();
          }
          if (q > 0 && q < 1) {
            const pts = L.grains[i];
            const n = pts.length / 2;
            const e = ease.outCubic(q);
            const spreadR = 14 + 150 * Math.sqrt(q); // √t spreading
            const a = aIn * clamp(q / 0.12) * Math.pow(1 - q, 1.6);
            ctx.fillStyle = COLOR.voice;
            for (let k = 0; k < n; k++) {
              const x0 = pts[k * 2],
                y0 = pts[k * 2 + 1];
              const h1 = hash01(k, 101 + i),
                h2 = hash01(k, 203 + i),
                h3 = hash01(k, 307 + i);
              // coherent flow (tendrils) + per-grain random walk
              const fx = noise.n3(x0 * 0.006, y0 * 0.006, 1.3 * i + e * 0.9);
              const fy = noise.n3(x0 * 0.006 + 17, y0 * 0.006, 1.3 * i + e * 0.9);
              const th = h1 * Math.PI * 2 + 1.4 * Math.sin(e * 3 + h2 * 6);
              const rr = spreadR * (0.25 + 0.75 * h2) * e;
              const x = x0 + Math.cos(th) * rr * 0.6 + fx * spreadR * 0.9 * e;
              const y = y0 + Math.sin(th) * rr * 0.6 + fy * spreadR * 0.9 * e - 26 * e;
              const al = a * (0.45 + 0.55 * h3);
              if (al < 0.01) continue;
              ctx.globalAlpha = al;
              const s = 1.1 + 1.3 * h3 * (1 + e);
              ctx.fillRect(x - s / 2, y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
          }
        }
        // the dot: never moves, gathers to Q_DOT.r
        const g = ease.inOutSine(seg(f, D_START[0], D_START[3] + D_LEN));
        const r = L.dot.r + (Q_DOT.r - L.dot.r) * g;
        ctx.globalAlpha = aIn;
        ctx.fillStyle = COLOR.voice;
        ctx.beginPath();
        ctx.arc(Q_DOT.x, Q_DOT.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }}
    />
  );
};

function smooth01(t: number) {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
}
