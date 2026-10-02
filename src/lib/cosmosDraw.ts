// Canvas side of the cosmic web: (1) the structure texture the shader shades, (2) the crisp light on top
// (star cores, diffraction spikes, ignition shock rings, photon sparks, black-hole photon rings).
import { clamp, lerp, memo, smoothstep } from './math';
import { hash01, mulberry32, seedOf } from './random';
import { BlackHole, Camera, WebGeometry, WebNode, WebParams, blackHoles, fullParams, webGeometry } from './cosmosWeb';

const TAU = Math.PI * 2;

/** CPU-backed 2D context (software raster: much faster than SwiftShader-GPU canvases for blur / many small draws). */
export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true })!;
}

/** reusable scratch canvas (module-level, per tab) */
export function scratchCanvas(name: string, w: number, h: number): HTMLCanvasElement {
  const c = memo(`cosmos:scratch:${name}`, () => document.createElement('canvas'));
  const W = Math.max(1, Math.round(w)),
    H = Math.max(1, Math.round(h));
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  return c;
}

/** filament / node widths (cells) as matter collapses */
export function webWidths(c: number) {
  const cc = Math.pow(clamp(c), 0.65);
  return {
    core: lerp(0.2, 0.0085, cc),
    glow: lerp(0.38, 0.07, cc),
    small: lerp(0.13, 0.005, cc),
    cc,
  };
}

function strokePolys(ctx: CanvasRenderingContext2D, geo: WebGeometry, layer: 0 | 1, width: (w: number) => number, alpha: (w: number) => number, color: string) {
  // bucket by quantised width/alpha to keep state changes low
  const buckets = new Map<number, number[]>();
  const vis = geo.vis[layer];
  if (vis <= 0) return;
  geo.edges.forEach((e, i) => {
    if (e.layer !== layer) return;
    const a = alpha(e.w) * vis;
    if (a < 0.004) return;
    const lw = width(e.w);
    const k = Math.round(lw * 4) * 64 + Math.round(a * 40);
    const b = buckets.get(k);
    if (b) b.push(i);
    else buckets.set(k, [i]);
  });
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [k, ids] of buckets) {
    const lw4 = Math.floor(k / 64),
      a40 = k - lw4 * 64;
    ctx.lineWidth = Math.max(0.35, lw4 / 4);
    ctx.globalAlpha = Math.min(1, a40 / 40);
    ctx.beginPath();
    for (const i of ids) {
      const s = geo.edges[i].sx;
      ctx.moveTo(s[0], s[1]);
      for (let j = 2; j < s.length; j += 2) ctx.lineTo(s[j], s[j + 1]);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** soft disc sprite (stops 1 → .55 @ .35 → 0), drawn with globalAlpha instead of a gradient per node */
function discSprite(rgb: string): HTMLCanvasElement {
  return memo(`cosmos:disc:${rgb}`, () => {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = ctx2d(c);
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.35, `rgba(${rgb},0.55)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  });
}
function discs(ctx: CanvasRenderingContext2D, nodes: WebNode[], pick: (n: WebNode) => [number, number] | null, rgb: string) {
  const spr = discSprite(rgb);
  for (const n of nodes) {
    const v = pick(n);
    if (!v) continue;
    const [r, a0] = v;
    const a = a0 * n.vis;
    if (a < 0.004 || r < 0.2) continue;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(spr, n.x - r, n.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * Rasterise the web into `target` (opaque, RGB channels: R = main filaments + clusters, G = gas envelope + lit halos,
 * B = tributaries + groups) at `scale` of the logical 1080×1920 frame. Returns the mean of each channel (0..1) when
 * `wantMean` (the plasma era needs it; it costs a read-back), else null.
 */
export function drawWebStructure(target: HTMLCanvasElement, geo: WebGeometry, params: WebParams, scale: number, W = 1080, H = 1920, wantMean = true): [number, number, number] | null {
  const p = fullParams(params);
  const ctx = ctx2d(target);
  const k = geo.cam.k;
  const wd = webWidths(p.c);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, target.width, target.height);

  // ── G: gas envelope (low res, heavy blur)
  const gs = scale * 0.25;
  const gc = scratchCanvas('glow', W * gs, H * gs);
  const g = ctx2d(gc);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, gc.width, gc.height);
  g.setTransform(gs, 0, 0, gs, 0, 0);
  g.globalCompositeOperation = 'lighter';
  const gA = lerp(0.1, 0.42, wd.cc);
  // depth: a farther slab of the web (half the scale, slower parallax) glimmering behind the near one
  if (wd.cc > 0.2) {
    const far = webGeometry({ ...p, zoom: p.zoom * 0.48, cx: p.cx + 41.3, cy: p.cy - 17.9, t: p.t * 0.5, roll: p.roll * 0.6, bh: 0 }, 40, W, H, 1);
    const kf = far.cam.k;
    const fa = gA * 0.5 * smoothstep(0.2, 0.8, wd.cc);
    strokePolys(g, far, 0, (w) => Math.max(1.2, 2 * wd.core * 3 * kf * (0.5 + 0.8 * w)), (w) => fa * (0.2 + 0.8 * w * w), 'rgb(0,255,0)');
    discs(g, far.nodes, (n) => (n.tier === 0 ? [kf * (0.05 + 0.08 * n.mass), fa * (0.4 + 1.6 * n.mass)] : null), '0,255,0');
  }
  strokePolys(g, geo, 0, (w) => 2 * wd.glow * k * (0.5 + 0.7 * w), (w) => gA * (0.35 + 0.65 * w), 'rgb(0,255,0)');
  strokePolys(g, geo, 1, (w) => 2 * wd.glow * 0.45 * k * (0.5 + 0.6 * w), (w) => gA * 0.35 * w, 'rgb(0,255,0)');
  discs(g, geo.nodes, (n) => (n.tier === 0 ? [wd.glow * k * (1.1 + 1.6 * n.mass), lerp(0.08, 0.5, wd.cc) * (0.3 + n.mass)] : null), '0,255,0');
  // lit stars ionise their surroundings
  discs(
    g,
    geo.nodes,
    (n) => (n.bright > 0.01 ? [k * (n.tier === 0 ? 0.2 + 0.25 * n.mass : 0.08 + 0.06 * n.mass) * (1 + 0.8 * n.flash), (n.bright / Math.max(0.01, n.vis)) * (n.tier === 0 ? 0.55 : 0.3) * (1 - 0.6 * n.redden)] : null),
    '0,255,0',
  );
  // blur where it is cheap (at 1/8 res), then upscale with bilinear smoothing — never a CSS blur at full res
  const gc2 = scratchCanvas('glow2', gc.width, gc.height);
  const g2 = ctx2d(gc2);
  g2.setTransform(1, 0, 0, 1, 0, 0);
  g2.globalCompositeOperation = 'copy';
  g2.filter = `blur(${Math.max(0.5, wd.glow * k * gs * 0.45).toFixed(2)}px)`;
  g2.drawImage(gc, 0, 0);
  g2.filter = 'none';
  g2.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(gc2, 0, 0, target.width, target.height);
  ctx.restore();

  // ── R / B: filaments (full structure res); blurred only while they are wide (plasma era)
  const lay = (name: string, layer: 0 | 1, color: string, wOf: (w: number) => number, aOf: (w: number) => number, nodePick: (n: WebNode) => [number, number] | null, blurPx: number) => {
    if (geo.vis[layer] <= 0) return;
    if (blurPx < 1.2) {
      // sharp: draw straight into the target (no scratch canvas, no filter pass)
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      strokePolys(ctx, geo, layer, wOf, aOf, `rgb(${color})`);
      discs(ctx, geo.nodes, nodePick, color);
      ctx.restore();
      return;
    }
    // wide + blurred (plasma era): rasterise at reduced resolution, blur there, upscale (bilinear) into the target
    const q = blurPx > 10 ? 0.25 : 0.5;
    const sc = scratchCanvas(name, target.width * q, target.height * q);
    const s = ctx2d(sc);
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.filter = 'none';
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, sc.width, sc.height);
    s.setTransform(scale * q, 0, 0, scale * q, 0, 0);
    s.globalCompositeOperation = 'lighter';
    strokePolys(s, geo, layer, wOf, aOf, `rgb(${color})`);
    discs(s, geo.nodes, nodePick, color);
    const sc2 = scratchCanvas(name + '2', sc.width, sc.height);
    const s2 = ctx2d(sc2);
    s2.setTransform(1, 0, 0, 1, 0, 0);
    s2.globalCompositeOperation = 'copy';
    s2.filter = `blur(${(blurPx * q).toFixed(2)}px)`;
    s2.drawImage(sc, 0, 0);
    s2.filter = 'none';
    s2.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sc2, 0, 0, target.width, target.height);
    ctx.restore();
  };
  // conserve mass along a filament as it narrows: intensity ∝ √(w_final / w) (no brightness bump mid-collapse)
  const massK = Math.sqrt(0.0085 / wd.core);
  const rA = lerp(0.07, 0.62, wd.cc) * lerp(1, massK, smoothstep(0.3, 0.7, wd.cc));
  lay(
    'core',
    0,
    '255,0,0',
    (w) => Math.max(0.9, 2 * wd.core * k * (0.45 + 0.85 * w)),
    (w) => rA * (0.3 + 0.7 * w),
    (n) => (n.tier === 0 ? [Math.max(2.2, wd.core * k * (3 + 5 * n.mass)), lerp(0.1, 0.9, wd.cc) * (0.35 + 0.8 * n.mass)] : null),
    Math.max(0, wd.core * k * scale * 0.5),
  );
  const bA = lerp(0.05, 0.5, wd.cc) * lerp(1, Math.sqrt(0.005 / wd.small), smoothstep(0.3, 0.7, wd.cc));
  lay(
    'small',
    1,
    '0,0,255',
    (w) => Math.max(0.7, 2 * wd.small * k * (0.5 + 0.7 * w)),
    (w) => bA * w,
    (n) => (n.tier === 1 ? [Math.max(1.2, wd.small * k * (2 + 3 * n.mass)), lerp(0.04, 0.45, wd.cc) * n.mass * n.mass] : null),
    Math.max(0, wd.small * k * scale * 0.5),
  );
  if (!wantMean) return null;

  // channel means (for the plasma era's normalised contrast)
  const mc = scratchCanvas('mean', 12, 20);
  const m = ctx2d(mc);
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.imageSmoothingEnabled = true;
  m.drawImage(target, 0, 0, 12, 20);
  const d = m.getImageData(0, 0, 12, 20).data;
  let r = 0,
    gg = 0,
    b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    gg += d[i + 1];
    b += d[i + 2];
  }
  const N = (d.length / 4) * 255;
  return [r / N, gg / N, b / N];
}

/**
 * 256×256 tileable noise for the shader (once per tab), raw RGBA bytes (uploaded without a canvas, so A is exact):
 *   r = 3-octave value fbm (8 lattice cells / tile)     g = low-frequency value noise (2 cells / tile)
 *   b = ridged 3-octave fbm (16/32/64 cells): the thin bright wisps of the hot gas       a = 255
 */
export function noiseTileData(granulation = true): Uint8Array {
  return memo(`cosmos:noiseTile:${granulation}`, () => {
    const S = 256;
    const out = new Uint8Array(S * S * 4);
    const hp = (i: number, j: number, P: number, salt: number) => hash01((((i % P) + P) % P) * 7919 + (((j % P) + P) % P) * 104729 + salt * 15485863, 9001 + salt);
    // periodic value noise sampled on the tile grid, from a pre-hashed lattice (cold-start cost matters: stills
    // open a fresh page per frame)
    const octave = (P: number, salt: number): Float32Array => {
      const lat = new Float32Array(P * P);
      for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) lat[j * P + i] = hp(i, j, P, salt);
      const o = new Float32Array(S * S);
      const sc = P / S;
      for (let y = 0; y < S; y++) {
        const v = y * sc;
        const j = Math.floor(v),
          fy = v - j,
          uy = fy * fy * (3 - 2 * fy);
        const j1 = j + 1 === P ? 0 : j + 1;
        for (let x = 0; x < S; x++) {
          const u = x * sc;
          const i = Math.floor(u),
            fx = u - i,
            ux = fx * fx * (3 - 2 * fx);
          const i1 = i + 1 === P ? 0 : i + 1;
          const a = lat[j * P + i],
            b = lat[j * P + i1],
            c = lat[j1 * P + i],
            d = lat[j1 * P + i1];
          o[y * S + x] = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
        }
      }
      return o;
    };
    const r8 = octave(8, 1),
      r16 = octave(16, 2),
      r32 = octave(32, 3),
      g2 = octave(2, 4),
      g4 = octave(4, 5);
    if (!granulation) {
      // the cold web only needs r / g (the wisps are the plasma's; built lazily the first time heat > 0)
      for (let q = 0; q < S * S; q++) {
        out[q * 4] = (0.5 * r8[q] + 0.3 * r16[q] + 0.2 * r32[q]) * 255;
        out[q * 4 + 1] = (0.75 * g2[q] + 0.25 * g4[q]) * 255;
      }
      return out;
    }
    // fine turbulence of the hot gas: ridged fbm (thin bright wisps where the noise crosses its median)
    const b16 = octave(16, 21),
      b32 = octave(32, 22),
      b64 = octave(64, 23);
    for (let q = 0; q < S * S; q++) {
      const k = q * 4;
      out[k] = (0.5 * r8[q] + 0.3 * r16[q] + 0.2 * r32[q]) * 255;
      out[k + 1] = (0.75 * g2[q] + 0.25 * g4[q]) * 255;
      const rid = 0.55 * (1 - Math.abs(2 * b16[q] - 1)) + 0.3 * (1 - Math.abs(2 * b32[q] - 1)) + 0.15 * (1 - Math.abs(2 * b64[q] - 1));
      out[k + 2] = clamp(rid * rid * 1.15) * 255;
      out[k + 3] = 255;
    }
    return out;
  });
}

// ───────────────────────── point splat layer ─────────────────────────
/**
 * Full-frame additive point buffer (RGBA bytes, A = 255, saturating adds). Thousands of tiny lights (galaxy dust,
 * group stars, photon sparks) cost ~1 ms to splat instead of thousands of canvas calls. Either `commit()` it
 * additively onto a canvas, or `putTo()` it as the opaque base of a frame (then add the rest with 'lighter').
 */
export class PointSplat {
  W: number;
  H: number;
  s: number;
  img: ImageData;
  d: Uint8ClampedArray;
  u32: Uint32Array;
  private can_: HTMLCanvasElement | null = null;
  used = false;
  constructor(W: number, H: number, s: number) {
    this.W = W;
    this.H = H;
    this.s = s;
    this.img = new ImageData(W, H);
    this.d = this.img.data;
    this.u32 = new Uint32Array(this.d.buffer);
  }
  /** staging canvas for commit() (created on first use: putTo() needs none) */
  get can(): HTMLCanvasElement {
    if (!this.can_) {
      this.can_ = document.createElement('canvas');
      this.can_.width = this.W;
      this.can_.height = this.H;
    }
    return this.can_;
  }
  static get(lw: number, lh: number, s: number): PointSplat {
    const W = Math.round(lw * s),
      H = Math.round(lh * s);
    const ps = memo(`cosmos:splat:${W}x${H}`, () => new PointSplat(W, H, s));
    ps.s = s;
    ps.u32.fill(0xff000000);
    ps.used = false;
    return ps;
  }
  /** add light (r,g,b in 0..255 units) at logical (x, y); size = footprint diameter in logical px */
  add(x: number, y: number, size: number, r: number, g: number, b: number) {
    const s = this.s;
    const X = x * s,
      Y = y * s,
      S = size * s;
    const W = this.W,
      H = this.H,
      d = this.d;
    this.used = true;
    if (S <= 1.7) {
      const fx = X - 0.5,
        fy = Y - 0.5;
      const ix = Math.floor(fx),
        iy = Math.floor(fy);
      if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) return;
      const tx = fx - ix,
        ty = fy - iy;
      const a = S * S; // energy ∝ area
      const w00 = (1 - tx) * (1 - ty) * a,
        w10 = tx * (1 - ty) * a,
        w01 = (1 - tx) * ty * a,
        w11 = tx * ty * a;
      let k = (iy * W + ix) * 4;
      d[k] += r * w00;
      d[k + 1] += g * w00;
      d[k + 2] += b * w00;
      d[k + 4] += r * w10;
      d[k + 5] += g * w10;
      d[k + 6] += b * w10;
      k += W * 4;
      d[k] += r * w01;
      d[k + 1] += g * w01;
      d[k + 2] += b * w01;
      d[k + 4] += r * w11;
      d[k + 5] += g * w11;
      d[k + 6] += b * w11;
      return;
    }
    const R = S * 0.5;
    const x0 = Math.max(0, Math.floor(X - R - 1)),
      x1 = Math.min(W - 1, Math.ceil(X + R + 1));
    const y0 = Math.max(0, Math.floor(Y - R - 1)),
      y1 = Math.min(H - 1, Math.ceil(Y + R + 1));
    const inv = 1 / (R * R * 0.45);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - X,
          dy = yy + 0.5 - Y;
        const w = Math.exp(-(dx * dx + dy * dy) * inv);
        if (w < 0.01) continue;
        const k = (yy * W + xx) * 4;
        d[k] += r * w;
        d[k + 1] += g * w;
        d[k + 2] += b * w;
      }
  }
  /** black out a disc (e.g. a black hole's shadow swallows the light behind it) */
  clearDisc(x: number, y: number, r: number) {
    const s = this.s;
    const X = x * s,
      Y = y * s,
      R = r * s;
    const y0 = Math.max(0, Math.floor(Y - R)),
      y1 = Math.min(this.H - 1, Math.ceil(Y + R));
    const x0 = Math.max(0, Math.floor(X - R)),
      x1 = Math.min(this.W - 1, Math.ceil(X + R));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const d = Math.hypot(xx + 0.5 - X, yy + 0.5 - Y);
        if (d < R) this.u32[yy * this.W + xx] = 0xff000000;
      }
  }
  /** a short streak (photon spark) from (x0,y0) to (x1,y1), brightness fading towards the tail */
  streak(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number) {
    const L = Math.hypot(x1 - x0, y1 - y0) * this.s;
    const n = Math.max(2, Math.ceil(L / 0.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const k = 0.25 + 0.75 * t;
      this.add(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1.2, r * k * 0.7, g * k * 0.7, b * k * 0.7);
    }
  }
  /** add the buffer onto ctx ('lighter'), in logical px */
  commit(ctx: CanvasRenderingContext2D, lw: number, lh: number) {
    if (!this.used) return;
    ctx2d(this.can).putImageData(this.img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.can, 0, 0, lw, lh);
    ctx.restore();
  }
  /** REPLACE the pixels of a canvas of the same device size with the buffer (opaque black + points) */
  putTo(ctx: CanvasRenderingContext2D) {
    ctx.putImageData(this.img, 0, 0);
  }
}
function splatFor(ctx: CanvasRenderingContext2D, lw = 1080, lh = 1920): PointSplat {
  const m = ctx.getTransform();
  return PointSplat.get(lw, lh, Math.hypot(m.a, m.b) || 1);
}

// ───────────────────────── galaxy dust (Zel'dovich approximation) ─────────────────────────
/**
 * Particles = galaxies. Each has a Lagrangian start q (spread through the surrounding void) and an Eulerian end f
 * (on its filament / in its cluster); position = q + D(c)·(f − q) — the Zel'dovich approximation, so as `c` grows
 * the viewer literally watches matter stream out of the voids onto the web. Stored per edge / node (world coords).
 */
function edgeDust(e: WebGeometry['edges'][number]): Float32Array {
  return memo(`cosmos:dust:${e.key}`, () => {
    const pts = e.pts;
    const nSeg = pts.length / 2 - 1;
    let len = 0;
    for (let i = 0; i < nSeg; i++) len += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
    const n = Math.round(len * (e.layer === 0 ? 150 : 34) * (0.15 + 0.85 * e.w));
    const out = new Float32Array(n * 5);
    const r = mulberry32(seedOf(e.key));
    // beads: matter along a filament gathers in clumps
    const beads = Math.max(2, Math.round(len * (e.layer === 0 ? 9 : 6)));
    for (let k = 0; k < n; k++) {
      const bead = Math.floor(r() * beads);
      const u = Math.min(0.999, Math.max(0, (bead + 0.5 + (r() + r() + r() - 1.5) * 0.45) / beads));
      const sf = u * nSeg;
      const si = Math.min(nSeg - 1, Math.floor(sf));
      const ft = sf - si;
      const ax = pts[si * 2],
        ay = pts[si * 2 + 1],
        bx = pts[si * 2 + 2],
        by = pts[si * 2 + 3];
      const tx = bx - ax,
        ty = by - ay;
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl,
        ny = tx / tl;
      const g = (r() + r() + r() - 1.5) * 0.9;
      const fx = ax + tx * ft + nx * g * 0.012,
        fy = ay + ty * ft + ny * g * 0.012;
      const side = r() < 0.5 ? -1 : 1;
      const off = side * (0.04 + 0.42 * Math.pow(r(), 0.8));
      const along = (r() - 0.5) * 0.25;
      out[k * 5] = fx;
      out[k * 5 + 1] = fy;
      out[k * 5 + 2] = fx + nx * off + (tx / tl) * along;
      out[k * 5 + 3] = fy + ny * off + (ty / tl) * along;
      out[k * 5 + 4] = Math.pow(r(), 3.2) * (0.4 + 0.6 * e.w);
    }
    return out;
  });
}
function nodeDust(n: WebNode): Float32Array {
  return memo(`cosmos:ndust:${n.key}`, () => {
    const cnt = Math.round(n.tier === 0 ? 10 + 90 * n.mass : 3 + 10 * n.mass);
    const out = new Float32Array(cnt * 5);
    const r = mulberry32(seedOf(n.key) ^ 0x5bd1e995);
    const sig = n.tier === 0 ? 0.012 + 0.03 * n.mass : 0.008;
    for (let k = 0; k < cnt; k++) {
      const g1 = r() + r() + r() - 1.5,
        g2 = r() + r() + r() - 1.5;
      const fx = n.wx + g1 * sig * 1.4,
        fy = n.wy + g2 * sig * 1.4;
      const a = r() * Math.PI * 2,
        rr = 0.06 + 0.4 * Math.sqrt(r());
      out[k * 5] = fx;
      out[k * 5 + 1] = fy;
      out[k * 5 + 2] = fx + Math.cos(a) * rr;
      out[k * 5 + 3] = fy + Math.sin(a) * rr;
      out[k * 5 + 4] = Math.pow(r(), 2.4) * (0.5 + 0.5 * n.mass);
    }
    return out;
  });
}

/** Draw the galaxy dust (additive, logical px). Visible as the universe cools (heat → 0) and clumps (c → 1). */
export function drawWebDust(ctx: CanvasRenderingContext2D | null, geo: WebGeometry, params: WebParams, sizeK = 1, splat?: PointSplat) {
  const p = fullParams(params);
  const vis = smoothstep(0.15, 0.75, p.c) * (1 - smoothstep(0.02, 0.12, p.heat)) * (1 - 0.8 * p.die);
  if (vis < 0.01) return;
  const D = Math.pow(smoothstep(0.0, 1.0, p.c), 0.9);
  const cam: Camera = geo.cam;
  const ps = splat ?? splatFor(ctx!);
  const sz = 1.25 * sizeK * Math.pow(p.zoom / 0.8, 0.25);
  const k = cam.k,
    cr = cam.cr * k,
    sr = cam.sr * k;
  const add = (arr: Float32Array, gain: number) => {
    if (gain <= 0.004) return;
    for (let i = 0; i < arr.length; i += 5) {
      const wx = arr[i + 2] + (arr[i] - arr[i + 2]) * D - cam.cx;
      const wy = arr[i + 3] + (arr[i + 1] - arr[i + 3]) * D - cam.cy;
      const x = cam.px + cr * wx - sr * wy,
        y = cam.py + sr * wx + cr * wy;
      if (x < -4 || y < -4 || x > 1084 || y > 1924) continue;
      const m = Math.min(1, (0.12 + arr[i + 4]) * gain) * vis;
      // brighter galaxies are whiter, faint ones violet
      const w = smoothstep(0.35, 0.9, m);
      ps.add(x, y, sz * (0.8 + 1.2 * arr[i + 4]), (150 + 85 * w) * m, (140 + 100 * w) * m, 255 * m);
    }
  };
  for (const e of geo.edges) add(edgeDust(e), (e.layer === 0 ? 1 : 0.7) * geo.vis[e.layer]);
  for (const n of geo.nodes) add(nodeDust(n), (1 + 0.6 * n.bright) * n.vis);
  if (!splat && ctx) ps.commit(ctx, 1080, 1920);
}

// ───────────────────────── crisp light (overlay) ─────────────────────────
/** star glow sprite; `px` = drawn size so a sprite of matching resolution is used (cheap resampling) */
function starSprite(kind: 'blue' | 'red' | 'gold', px = 128): HTMLCanvasElement {
  const S = px <= 18 ? 16 : px <= 36 ? 32 : px <= 72 ? 64 : 128;
  return memo(`cosmos:sprite:${kind}:${S}`, () => {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const x = ctx2d(c);
    const col = kind === 'blue' ? [214, 230, 255] : kind === 'red' ? [255, 120, 70] : [255, 214, 150];
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, `rgba(255,255,255,1)`);
    g.addColorStop(0.06, `rgba(${col},0.95)`);
    g.addColorStop(0.18, `rgba(${col},0.35)`);
    g.addColorStop(0.45, `rgba(${col},0.08)`);
    g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  });
}
/** soft gaussian shell (ignition shock ring), ring at 0.78 of the sprite radius */
function ringSprite(): HTMLCanvasElement {
  return memo('cosmos:ring', () => {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = ctx2d(c);
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(190,212,255,0)');
    g.addColorStop(0.55, 'rgba(190,212,255,0.04)');
    g.addColorStop(0.72, 'rgba(205,222,255,0.55)');
    g.addColorStop(0.78, 'rgba(225,236,255,1)');
    g.addColorStop(0.86, 'rgba(205,222,255,0.35)');
    g.addColorStop(1, 'rgba(190,212,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  });
}
/** one arm-pair of a diffraction spike as a thin strip (horizontal or vertical), white-hot centre */
function spikeStrip(kind: 'blue' | 'red', vertical: boolean): HTMLCanvasElement {
  return memo(`cosmos:spike:${kind}:${vertical}`, () => {
    const Lx = 512,
      T = 16;
    const c = document.createElement('canvas');
    c.width = vertical ? T : Lx;
    c.height = vertical ? Lx : T;
    const x = ctx2d(c);
    const col = kind === 'blue' ? '200,222,255' : '255,140,90';
    x.globalCompositeOperation = 'lighter';
    for (const [w, a] of [
      [9, 0.07],
      [3.2, 0.3],
      [1.3, 0.85],
    ] as const) {
      const g = vertical ? x.createLinearGradient(0, 0, 0, Lx) : x.createLinearGradient(0, 0, Lx, 0);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.25, `rgba(${col},${a * 0.12})`);
      g.addColorStop(0.42, `rgba(${col},${a * 0.45})`);
      g.addColorStop(0.49, `rgba(${col},${a * 0.9})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(0.51, `rgba(${col},${a * 0.9})`);
      g.addColorStop(0.58, `rgba(${col},${a * 0.45})`);
      g.addColorStop(0.75, `rgba(${col},${a * 0.12})`);
      g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g;
      if (vertical) x.fillRect(T / 2 - w / 2, 0, w, Lx);
      else x.fillRect(0, T / 2 - w / 2, Lx, w);
    }
    return c;
  });
}
/** Hubble-style 4-point diffraction spikes of half-length L px centred on (x, y) (thickness scales with `th`). */
export function drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, kind: 'blue' | 'red' = 'blue', th = 1) {
  const T = 16 * th;
  ctx.drawImage(spikeStrip(kind, false), x - L, y - T / 2, 2 * L, T);
  ctx.drawImage(spikeStrip(kind, true), x - T / 2, y - L, T, 2 * L);
}

export interface FlareOpts {
  /** draw groups (tier 1) as small stars (default true) */
  groups?: boolean;
  /** spike length multiplier (default 1) */
  spikes?: number;
  /** star/halo size multiplier (default 1) */
  size?: number;
  /** precomputed nodes (else computed from params) */
  nodes?: WebNode[];
}

/**
 * Point part of the web's crisp light (into a PointSplat): group stars, gold photon sparks, and the black-hole
 * shadows cut out of the points behind them. Pair with webFlareSprites().
 */
export function webFlarePoints(ps: PointSplat, params: WebParams, nodes: WebNode[], o: FlareOpts = {}) {
  const p = fullParams(params);
  const sizeK = (o.size ?? 1) * Math.pow(p.zoom / 0.8, 0.35);
  // ── photon sparks: light carrying away the binding energy of every clump (gold = free energy leaving)
  if (p.sparks > 0.001) {
    const T = 1.7;
    for (const n of nodes) {
      const em = p.sparks * (n.bright * 1.1 + 0.3 * n.mass * n.vis * n.host * smoothstep(0.3, 0.9, p.c) * (1 - p.die));
      if (em < 0.02) continue;
      const J = n.tier === 0 ? 6 : 1;
      const reach = (n.tier === 0 ? 70 + 150 * n.mass : 40 + 40 * n.mass) * sizeK;
      const seed = Math.floor(n.r * 100000) + (n.tier ? 7777 : 0);
      for (let j = 0; j < J; j++) {
        const ph = p.t / T + hash01(j, seed);
        const cyc = Math.floor(ph);
        const a = ph - cyc;
        if (hash01(cyc * 13 + j, seed + 3) > 0.35 + 0.65 * Math.min(1, em)) continue;
        const th = TAU * hash01(cyc * 7 + j, seed + 1);
        const d = 6 + a * reach;
        const len = (6 + 9 * n.mass) * sizeK * (1 - 0.5 * a);
        const al = Math.pow(1 - a, 1.6) * Math.min(1, em) * smoothstep(0, 0.08, a);
        if (al < 0.03) continue;
        const cx = Math.cos(th),
          sy = Math.sin(th);
        ps.streak(n.x + cx * (d + len), n.y + sy * (d + len), n.x + cx * d, n.y + sy * d, 255 * al, 214 * al, 140 * al);
      }
    }
  }
  // ── groups: a tiny star (core + soft halo)
  if (o.groups !== false)
    for (const n of nodes) {
      if (n.tier !== 1) continue;
      const fl = n.flash * n.vis * n.host;
      if (n.bright < 0.004 && fl < 0.004) continue;
      const rd = n.redden;
      const k = Math.min(1.2, 1.2 * n.bright + 0.8 * fl);
      const R0 = 214 * (1 - rd) + 255 * rd,
        G0 = 230 * (1 - rd) + 120 * rd,
        B0 = 255 * (1 - rd) + 70 * rd;
      ps.add(n.x, n.y, 1.6 * sizeK, 255 * k, 255 * k, 255 * k);
      ps.add(n.x, n.y, (6 + 9 * n.mass) * sizeK * (1 + fl), R0 * k * 0.3, G0 * k * 0.3, B0 * k * 0.3);
    }
  // black holes swallow the points behind their shadow
  for (const h of blackHoles(p)) if (h.k > 0.05 && h.r > 0.5) ps.clearDisc(h.x, h.y, h.r * 0.97);
}

/**
 * Sprite part of the web's crisp light, drawn additively on ctx (logical px): cluster cores + halos, 4-point
 * diffraction spikes, ignition shock rings, the last ember of dying stars and the black holes' photon rings.
 */
export function webFlareSprites(ctx: CanvasRenderingContext2D, params: WebParams, nodes: WebNode[], o: FlareOpts = {}) {
  const p = fullParams(params);
  const spikeK = o.spikes ?? 1;
  const sizeK = (o.size ?? 1) * Math.pow(p.zoom / 0.8, 0.35);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const blue = (px: number) => starSprite('blue', px),
    red = (px: number) => starSprite('red', px);
  const ring = ringSprite();
  for (const n of nodes) {
    const fl = n.flash * n.vis * n.host;
    if (n.bright < 0.004 && fl < 0.004) continue;
    const b = n.bright;
    const rd = n.redden;
    if (n.tier === 0) {
      const halo = (16 + 34 * n.mass) * sizeK * (1 + 1.2 * fl);
      ctx.globalAlpha = Math.min(1, 0.85 * b * (1 - rd) + 0.9 * fl);
      ctx.drawImage(blue(halo * 2), n.x - halo, n.y - halo, halo * 2, halo * 2);
      if (rd > 0) {
        ctx.globalAlpha = Math.min(1, 0.85 * b * rd);
        ctx.drawImage(red(halo * 2), n.x - halo, n.y - halo, halo * 2, halo * 2);
      }
      // diffraction spikes (fixed to the "telescope", so they don't roll with the camera)
      const L = (22 + 150 * n.mass * n.mass) * spikeK * sizeK * (0.4 + 0.6 * b) * (1 + 2.2 * fl);
      if (L > 6 && b + fl > 0.01) {
        ctx.globalAlpha = Math.min(1, b * 0.9 + fl * 0.6);
        drawSpikes(ctx, n.x, n.y, L, rd > 0.5 ? 'red' : 'blue', Math.sqrt(sizeK));
      }
      // ignition shock ring: a shell of light racing outwards over ~0.6 s
      if (fl > 0.02) {
        const age = 1 - fl;
        const rr = (10 + 120 * Math.pow(age, 0.6)) * sizeK * (0.45 + n.mass);
        ctx.globalAlpha = Math.min(1, 0.3 * fl * fl * (0.3 + n.mass));
        const R = rr / 0.78;
        ctx.drawImage(ring, n.x - R, n.y - R, 2 * R, 2 * R);
      }
    } else if (n.mass > 0.75 && n.bright > 0.05 && o.groups !== false) {
      const L = 14 * spikeK * sizeK * (1 + fl);
      ctx.globalAlpha = n.bright * 0.6;
      drawSpikes(ctx, n.x, n.y, L, 'blue', 0.7 * Math.sqrt(sizeK));
    }
  }
  // ── dying stars: a last ember as each goes out
  if (p.die > 0) {
    for (const n of nodes) {
      const e = clamp(1 - Math.abs(p.die - n.dieRank - 0.03) / 0.03) * n.host * n.vis;
      if (e <= 0.01 || n.lit < 0.5) continue;
      const r = (n.tier === 0 ? 10 + 14 * n.mass : 4 + 4 * n.mass) * sizeK;
      ctx.globalAlpha = e * 0.7;
      ctx.drawImage(red(r * 2), n.x - r, n.y - r, r * 2, r * 2);
    }
  }
  ctx.restore();
  // ── black holes: photon ring (lensed background light, Doppler-brightened on one side) + final pin-prick
  for (const h of blackHoles(p)) drawBlackHole(ctx, h, sizeK);
}

/**
 * All the crisp light of the web, drawn additively on a canvas in logical px (points + sprites). The shader draws
 * the matching gas glow, black-hole shadows and lensing — use both via <CosmicWeb> or call this in your own layer
 * (then pass flares={false} dust={false} to <CosmicWeb>).
 */
export function drawWebFlares(ctx: CanvasRenderingContext2D, params: WebParams, nodesIn: WebNode[], o: FlareOpts = {}, splat?: PointSplat) {
  const nodes = o.nodes ?? nodesIn;
  const ps = splat ?? splatFor(ctx);
  webFlarePoints(ps, params, nodes, o);
  webFlareSprites(ctx, params, nodes, o);
  if (!splat) ps.commit(ctx, 1080, 1920);
}

/** One black hole: lensed glow, photon ring (Doppler-beamed on one side) + inner higher-order ring; on evaporation a
 *  white pin-prick flash (Hawking's final burst). The shader draws the matching shadow and lensing of the web. */
export function drawBlackHole(ctx: CanvasRenderingContext2D, h: BlackHole, sizeK = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (h.k > 0.01 && h.r > 0.3) {
    const r = h.r;
    const g = ctx.createRadialGradient(h.x, h.y, r * 1.0, h.x, h.y, r * 3.4);
    g.addColorStop(0, 'rgba(255,190,130,0.28)');
    g.addColorStop(0.25, 'rgba(255,170,110,0.10)');
    g.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.globalAlpha = h.k;
    ctx.fillStyle = g;
    // annulus only: a radial gradient would paint the shadow itself with its first stop
    ctx.beginPath();
    ctx.arc(h.x, h.y, r * 3.4, 0, TAU);
    ctx.arc(h.x, h.y, r * 1.0, 0, TAU, true);
    ctx.fill();
    const R = r * 1.1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgb(255,214,170)';
    ctx.globalAlpha = 0.7 * h.k;
    ctx.lineWidth = Math.max(0.9, r * 0.09);
    ctx.beginPath();
    ctx.arc(h.x, h.y, R, 0, TAU);
    ctx.stroke();
    // relativistic beaming: the approaching side is brighter
    for (const [a0, a1, al, lw] of [
      [0.55, 1.45, 0.9, 0.16],
      [0.75, 1.25, 1, 0.22],
    ] as const) {
      ctx.globalAlpha = al * h.k;
      ctx.strokeStyle = 'rgb(255,240,220)';
      ctx.lineWidth = Math.max(1, r * lw);
      ctx.beginPath();
      ctx.arc(h.x, h.y, R, Math.PI * a0, Math.PI * a1);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.45 * h.k;
    ctx.lineWidth = Math.max(0.6, r * 0.04);
    ctx.beginPath();
    ctx.arc(h.x, h.y, r * 0.98, 0, TAU);
    ctx.stroke();
  }
  if (h.pop > 0.01) {
    const rr = (8 + 34 * h.pop) * sizeK;
    const s = starSprite('blue', rr * 2);
    ctx.globalAlpha = Math.min(1, h.pop * 1.2);
    ctx.drawImage(s, h.x - rr, h.y - rr, rr * 2, rr * 2);
    drawSpikes(ctx, h.x, h.y, 46 * h.pop * sizeK, 'blue', 0.8);
  }
  ctx.restore();
}
