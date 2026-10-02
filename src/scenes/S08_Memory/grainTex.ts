// S08 — macro sand grains at full resolution: a tileable, pre-lit grain-pack texture (domes lit from the low sun on
// the right, cast shadows to the left, ambient occlusion in the crevices, a few glinting grains), laid over the
// shaded sand with 'soft-light' (mid grey = no change), world-anchored, with the shader's depth of field.
import { memo } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { cpuCanvas } from './CpuCanvas';
import { Cam } from './trail';

const T = 240; // tile px
const C = 10; // grain cell px (≈ one grain)
/** world px per tile px (grain ≈ 11 tile px ≈ 2.7 world px, like the splash grains) */
const WORLD_PER_TILE = 0.3;

interface G {
  x: number;
  y: number;
  r: number;
  tone: number;
  hue: number;
  glint: boolean;
}

/** soft-light value (mid grey = no change) for a relative brightness v (0.55 = flat sand) */
const SL = (v: number) => Math.round(Math.max(0, Math.min(255, 128 + (v / 0.55 - 1) * 128 * 0.42)));

export function grainTile(): HTMLCanvasElement {
  return memo('S08:grainTile2', () => {
    const rnd = mulberry32(8080);
    const n = T / C;
    const gs: G[] = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        gs.push({
          x: (i + 0.5) * C + (rnd() - 0.5) * 7,
          y: (j + 0.5) * C + (rnd() - 0.5) * 7,
          r: 3.8 + rnd() * rnd() * 3.4,
          tone: 0.82 + rnd() * 0.36,
          hue: rnd(),
          glint: rnd() < 0.05,
        });
    // draw order shuffled (top view: arbitrary overlap)
    const order = gs.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const c = cpuCanvas(T, T);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const cr = SL(0.16);
    ctx.fillStyle = `rgb(${cr},${cr},${cr})`; // crevices
    ctx.fillRect(0, 0, T, T);
    const copies = (g: G, fn: (x: number, y: number) => void) => {
      for (const ox of [-T, 0, T])
        for (const oy of [-T, 0, T]) {
          const x = g.x + ox;
          const y = g.y + oy;
          if (x > -12 && x < T + 12 && y > -12 && y < T + 12) fn(x, y);
        }
    };
    // pass 1: cast shadows (to the left, away from the low sun on the right) + contact occlusion
    for (const i of order) {
      const g = gs[i];
      const v = SL(0.1);
      copies(g, (x, y) => {
        ctx.fillStyle = `rgba(${v},${v},${v},0.55)`;
        ctx.beginPath();
        ctx.ellipse(x - g.r * 0.55, y + g.r * 0.1, g.r * 1.12, g.r * 0.98, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // pass 2: lit domes (highlight toward the sun), a few tinted minerals, a few glints
    for (const i of order) {
      const g = gs[i];
      const tint = g.hue < 0.15 ? [1.06, 0.96, 0.9] : g.hue > 0.9 ? [0.92, 0.95, 1.04] : [1, 1, 1];
      const col = (v: number) => `rgb(${tint.map((t) => SL(v * g.tone * t)).join(',')})`;
      copies(g, (x, y) => {
        const gr = ctx.createRadialGradient(x + g.r * 0.42, y - g.r * 0.1, g.r * 0.05, x, y, g.r);
        gr.addColorStop(0, col(1.15));
        gr.addColorStop(0.45, col(0.62));
        gr.addColorStop(0.8, col(0.3));
        gr.addColorStop(1, col(0.18));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(x, y, g.r, 0, Math.PI * 2);
        ctx.fill();
        if (g.glint) {
          const gg = ctx.createRadialGradient(x + g.r * 0.35, y - g.r * 0.25, 0, x + g.r * 0.35, y - g.r * 0.25, 1.8);
          gg.addColorStop(0, 'rgba(255,255,255,1)');
          gg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gg;
          ctx.fillRect(x + g.r * 0.35 - 2, y - g.r * 0.25 - 2, 4, 4);
        }
      });
    }
    return c;
  });
}

/** Overlay the grain pack on what's in ctx (the shaded sand). amt 0..1; focus in screen px; dof 0..1 strength
 *  (same depth-of-field ellipse as the shader: defocus = smoothstep(0.16, 0.55, |(uv − focus)·(0.75, 1)|)·dof). */
export function drawGrainOverlay(ctx: CanvasRenderingContext2D, cam: Cam, amt: number, focus: [number, number], dof: number) {
  if (amt <= 0.01) return;
  const tile = grainTile();
  const layer = memo('S08:grainLayer', () => cpuCanvas(1080, 1920));
  const t = layer.getContext('2d', { willReadFrequently: true })!;
  const pat = t.createPattern(tile, 'repeat');
  if (!pat) return;
  const s = WORLD_PER_TILE * cam.z;
  pat.setTransform(new DOMMatrix([s, 0, 0, s, cam.ax - cam.cx * cam.z, cam.ay - cam.cy * cam.z]));
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalAlpha = 1;
  t.globalCompositeOperation = 'copy';
  t.fillStyle = pat;
  t.fillRect(0, 0, 1080, 1920);
  if (dof > 0.02) {
    t.globalCompositeOperation = 'destination-in';
    t.translate(focus[0], focus[1]);
    t.scale(0.75, 1);
    const g = t.createRadialGradient(0, 0, 0, 0, 0, 1920);
    for (let i = 0; i <= 8; i++) {
      const r = 0.16 + (0.39 * i) / 8;
      const u = i / 8;
      g.addColorStop(r, `rgba(0,0,0,${(1 - dof * u * u * (3 - 2 * u)).toFixed(3)})`);
    }
    t.fillStyle = g;
    t.fillRect(-focus[0] / 0.75, -focus[1], 1080 / 0.75, 1920);
    t.setTransform(1, 0, 0, 1, 0, 0);
  }
  t.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = amt;
  ctx.drawImage(layer, 0, 0, 1080, 1920);
  ctx.restore();
}
