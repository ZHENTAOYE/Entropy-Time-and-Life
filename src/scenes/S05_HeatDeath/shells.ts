// LIGHT SHELLS — the energy of every dying star is not lost, it SPREADS.
// Each star that burns out exhales its last light as a shell that expands at constant speed and dilutes
// (brightness ∝ E / R^1.25: the same energy over an ever larger ring); each evaporating black hole releases a
// brighter, bluer shell (Hawking's final burst). Overlapping shells fill the voids with a faint, even glow — the
// image visibly carries "the energy is all still there" before the heat death smooths it into grey.
// Drawn inside <CosmicWeb draw> (additive), so the shells random-walk into grey together with the web.
// Also: the Hawking glow + quanta streaming off each shrinking black hole (hotter as it gets smaller, T ∝ 1/M).
import { CosmicDrawInfo, DIE_W, WEB_FINAL, bhCandidates, blackHoles, webGeometry, webToScreen } from '../../lib/cosmos';
import { clamp, memo, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { bhAt, dieAt, DUR } from './timing';
import { ctxOf, fresh, glowSprite, mixRgb, scratch } from './gfx';

/** first frame at which a monotone curve reaches v (linear interpolation between frames) */
function invert(fn: (f: number) => number, v: number, from = 0, to = DUR): number {
  const tab = memo(`s05:inv:${fn === dieAt ? 'die' : 'bh'}`, () => {
    const a = new Float32Array(DUR + 1);
    for (let f = 0; f <= DUR; f++) a[f] = fn(f);
    return a;
  });
  for (let f = Math.max(1, from); f <= Math.min(to, DUR); f++) {
    if (tab[f] >= v) {
      const a = tab[f - 1];
      const b = tab[f];
      return f - 1 + (b > a ? (v - a) / (b - a) : 1);
    }
  }
  return Infinity;
}

export interface Shell {
  wx: number;
  wy: number;
  /** frame the shell is born */
  f0: number;
  E: number;
  kind: 0 | 1; // 0 = star, 1 = black hole
  /** the largest black hole: its pop is the last event in the universe */
  last?: boolean;
  key: string;
  seed: number;
}

/** the fixed set of shells (world positions + birth frames), chosen once from the WEB_FINAL framing */
export function shells(): Shell[] {
  return memo('s05:shells', () => {
    const bh = bhCandidates();
    const bhKeys = new Set(bh.map((b) => b.key));
    const out: Shell[] = [];
    const g = webGeometry({ ...WEB_FINAL }, 900, 1080, 1920, 3);
    for (const n of g.nodes) {
      if (bhKeys.has(n.key)) continue;
      const off = Math.max(-n.x, n.x - 1080, -n.y, n.y - 1920, 0);
      if (n.tier === 1 && (n.mass < 0.5 || off > 120)) continue;
      if (n.tier === 0 && off > 650) continue;
      const f0 = invert(dieAt, n.dieRank + DIE_W * 0.6);
      if (!isFinite(f0)) continue;
      out.push({ wx: n.wx, wy: n.wy, f0, E: n.tier === 0 ? 0.35 + 0.85 * n.mass : 0.15 + 0.45 * n.mass, kind: 0, key: n.key, seed: Math.floor(n.r * 1e6) });
    }
    for (const b of bh) {
      const f0 = invert(bhAt, b.evap, 80);
      out.push({ wx: b.wx, wy: b.wy, f0, E: 1.4 + 1.6 * b.mass, kind: 1, key: b.key, seed: 77, last: b.mass > 0.95 });
    }
    return out;
  });
}

/** pop frame of each black hole (for cues / reticles) */
export function bhPopFrames(): Array<{ key: string; f: number; mass: number }> {
  return memo('s05:popf', () => bhCandidates().map((b) => ({ key: b.key, f: invert(bhAt, b.evap, 80), mass: b.mass })));
}

const NB = 5;
const STAR_COL: Array<[number, number, number]> = [
  [255, 136, 84], // ember
  [232, 150, 118],
  [200, 160, 148], // dusk
  [172, 162, 156],
  [158, 156, 154], // warm grey
];
const BH_COL: Array<[number, number, number]> = [
  [215, 228, 255],
  [190, 200, 235],
  [160, 162, 185],
];
function ramp(cols: Array<[number, number, number]>, t: number): [number, number, number] {
  const x = clamp(t) * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(x));
  return mixRgb(cols[i], cols[i + 1], x - i);
}
const colOf = (kind: number, b: number) => (kind === 0 ? ramp(STAR_COL, b / (NB - 1)) : ramp(BH_COL, b / (NB - 1)));

/** relative ring widths of the wavefront sprites (thin fronts at large radius) */
const RELW = [0.16, 0.08, 0.04, 0.02];
/** thin wavefront ring (radius 0.8 of the half-size), pre-tinted */
function ringSprite(kind: number, b: number, wi: number): HTMLCanvasElement {
  return memo(`s05:ring:${kind}:${b}:${wi}`, () => {
    const S = wi >= 2 ? 256 : 160;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = ctxOf(c);
    const img = x.createImageData(S, S);
    const col = colOf(kind, b);
    const R0 = 0.8;
    const w = RELW[wi];
    for (let j = 0; j < S; j++)
      for (let i = 0; i < S; i++) {
        const rho = Math.hypot(i + 0.5 - S / 2, j + 0.5 - S / 2) / (S / 2);
        const d = (rho - R0) / w;
        // sharp leading edge, short soft wake behind it
        const a = d > 0 ? Math.exp(-d * d * 2.5) : Math.exp(-d * d * 0.35);
        const k = (j * S + i) * 4;
        img.data[k] = col[0];
        img.data[k + 1] = col[1];
        img.data[k + 2] = col[2];
        img.data[k + 3] = Math.round(clamp(a) * (1 - smoothstep(0.94, 1, rho)) * 255);
      }
    x.putImageData(img, 0, 0);
    return c;
  });
}
/** gaussian haze blob (σ = 1/3 of the half-size), pre-tinted */
function hazeSprite(kind: number, b: number): HTMLCanvasElement {
  return memo(`s05:haze:${kind}:${b}`, () => {
    const S = 96;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = ctxOf(c);
    const img = x.createImageData(S, S);
    const col = colOf(kind, b);
    for (let j = 0; j < S; j++)
      for (let i = 0; i < S; i++) {
        const rho = Math.hypot(i + 0.5 - S / 2, j + 0.5 - S / 2) / (S / 2);
        const a = Math.exp(-(rho * rho) * 4.5) * (1 - smoothstep(0.85, 1, rho));
        const k = (j * S + i) * 4;
        img.data[k] = col[0];
        img.data[k + 1] = col[1];
        img.data[k + 2] = col[2];
        img.data[k + 3] = Math.round(a * 255);
      }
    x.putImageData(img, 0, 0);
    return c;
  });
}

/** resolution of the wavefront buffer and of the haze buffer (fractions of 1080×1920) */
const SK = 0.2;
const HK = 0.125;
/**
 * ENERGY IS CONSERVED: a star's light E·KH (alpha·px²) leaves as a spreading local blob (fraction e^(−age/40),
 * σ growing) and the rest has already spread evenly over the whole frame (the radiation background). So the total
 * light only grows as stars die and then HOLDS — the grey the image settles into is that same energy, evened out.
 */
const KH = 3000;
const AREA = 1080 * 1920;
const RING_GAIN = 0.075;

/** CosmicWeb `draw` callback: radiation haze + wavefronts + Hawking light (ctx is in 'lighter', logical px). */
export function drawShells(ctx: CanvasRenderingContext2D, info: CosmicDrawInfo, f: number) {
  const p = info.params;
  const cam = info.geo.cam;
  const zk = p.zoom / 0.8;
  const rb = scratch('shells', 1080 * SK, 1920 * SK);
  const r = fresh(rb);
  r.globalCompositeOperation = 'lighter';
  const hb = scratch('haze', 1080 * HK, 1920 * HK);
  const h = fresh(hb);
  h.globalCompositeOperation = 'lighter';
  // the light already spread evenly (one level per colour bucket: weighted by age)
  let uni = 0;
  const uniCol = [0, 0, 0];
  let any = false;
  for (const s of shells()) {
    const a = f - s.f0;
    if (a < 0) continue;
    const birth = smoothstep(0, 2.5, a);
    const age = s.kind === 0 ? clamp(a / 110) : clamp(a / 80);
    const bi = Math.min(NB - 1, Math.round(age * (NB - 1)));
    const [x, y] = webToScreen(cam, s.wx, s.wy);
    // ── haze: the energy itself, spreading (σ grows, peak falls as 1/σ²); the rest is already spread evenly
    const wb = Math.exp(-a / 40);
    const e = s.E * KH * birth * (s.kind === 1 ? 0.2 : 1);
    const u = (e * (1 - wb)) / AREA;
    if (u > 0) {
      const c = colOf(s.kind, bi);
      uni += u;
      uniCol[0] += c[0] * u;
      uniCol[1] += c[1] * u;
      uniCol[2] += c[2] * u;
    }
    const sig = (14 + (s.kind === 0 ? 5.2 : 7) * a) * zk;
    const peak = (e * wb) / (6.2832 * sig * sig);
    if (peak > 0.002) {
      const S = sig * 6;
      if (!(x + S / 2 < 0 || y + S / 2 < 0 || x - S / 2 > 1080 || y - S / 2 > 1920)) {
        h.globalAlpha = clamp(peak);
        h.drawImage(hazeSprite(s.kind, bi), (x - S / 2) * HK, (y - S / 2) * HK, S * HK, S * HK);
        any = true;
      }
    }
    // ── wavefront: the last light, racing outward
    const v = s.kind === 0 ? 9 : 12;
    const R = (8 + v * a) * zk;
    const al = RING_GAIN * s.E * birth * (60 / (60 + R)) * (s.kind === 1 ? (s.last ? 4.5 : 0.6) : 1) * (1 - smoothstep(s.last ? 1500 : 900, s.last ? 2400 : 1700, R));
    if (al < 0.006) continue;
    const S = (R / 0.8) * 2;
    if (x + S / 2 < 0 || y + S / 2 < 0 || x - S / 2 > 1080 || y - S / 2 > 1920) continue;
    const rel = 6 / R + 0.018;
    let wi = 0;
    while (wi < RELW.length - 1 && RELW[wi + 1] >= rel) wi++;
    r.globalAlpha = clamp(al);
    r.drawImage(ringSprite(s.kind, bi, wi), (x - S / 2) * SK, (y - S / 2) * SK, S * SK, S * SK);
    any = true;
  }
  if (uni > 0.001) {
    h.globalAlpha = 1;
    h.fillStyle = `rgba(${Math.round(uniCol[0] / uni)},${Math.round(uniCol[1] / uni)},${Math.round(uniCol[2] / uni)},${clamp(uni).toFixed(4)})`;
    h.fillRect(0, 0, hb.width, hb.height);
    any = true;
  }
  const holes = blackHoles(p);
  if (any) {
    // black-hole shadows are not filled by the light passing around them
    for (const [b, k] of [
      [r, SK],
      [h, HK],
    ] as const) {
      b.globalAlpha = 1;
      b.globalCompositeOperation = 'destination-out';
      for (const o of holes) {
        if (o.k < 0.05 || o.r < 0.5) continue;
        const g = b.createRadialGradient(o.x * k, o.y * k, o.r * 0.9 * k, o.x * k, o.y * k, o.r * 1.9 * k);
        g.addColorStop(0, `rgba(0,0,0,${o.k})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = g;
        b.fillRect((o.x - o.r * 2) * k, (o.y - o.r * 2) * k, o.r * 4 * k, o.r * 4 * k);
      }
    }
    r.globalAlpha = 1;
    r.globalCompositeOperation = 'lighter';
    r.imageSmoothingEnabled = true;
    r.drawImage(hb, 0, 0, rb.width, rb.height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(rb, 0, 0, 1080, 1920);
    ctx.restore();
  }
  // Hawking light: the smaller the hole, the hotter it glows and the faster it sheds quanta
  const cands = memo('s05:bhmass', () => new Map(bhCandidates().map((c) => [c.key, c.mass])));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = glowSprite();
  for (const h of holes) {
    if (h.k < 0.05 || h.r < 0.3) continue;
    const m = cands.get(h.key) ?? 0.5;
    const r0 = (9 + 15 * m) * Math.sqrt(p.zoom) * h.k;
    const left = Math.pow(clamp(h.r / Math.max(0.01, r0)), 3);
    const hk = clamp(1 - left);
    // halo
    const hr = h.r * (3.2 + 1.5 * hk);
    ctx.globalAlpha = clamp(0.1 + 0.55 * hk * hk) * h.k;
    ctx.drawImage(glow, h.x - hr, h.y - hr, hr * 2, hr * 2);
    // quanta
    const n = Math.round(5 + 34 * hk * hk);
    const seed = Math.floor(m * 9973) + 11;
    ctx.fillStyle = 'rgb(214,228,255)';
    for (let j = 0; j < n; j++) {
      const ph = p.t * (0.9 + 1.6 * hk) + hash01(j, seed);
      const cyc = Math.floor(ph);
      const u = ph - cyc;
      const th = 6.2831853 * hash01(cyc * 31 + j, seed + 1);
      const d = h.r * (1.15 + (2.2 + 2 * hk) * u);
      const al = (1 - u) * (1 - u) * (0.35 + 0.65 * hk) * h.k;
      if (al < 0.03) continue;
      const sz = 1.3 + 0.9 * hk;
      ctx.globalAlpha = al;
      ctx.fillRect(h.x + Math.cos(th) * d - sz / 2, h.y + Math.sin(th) * d - sz / 2, sz, sz);
    }
  }
  ctx.restore();
}
