// Main renderers of S07 for frame f (called from Layers.tsx in one layout effect).
import { memo, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { bodyOf, drawBody, drawSpoutGlow, drawVessels, morphStart, poolAlpha } from './bodyDraw';
import { Cam, camAt } from './camera';
import { offscreen } from './gfx';
import { drawThermal } from './thermal';
import { drawIRWaves, drawScanLine, scanY } from './thermalFx';
import { T } from './timing';
import { beatFlash } from './heart';
import { drawExhale } from './breath';
import { drawCensus, drawEye, drawTracer, drawVortex } from './vortexDraw';
import { drawS06, drawS06Motes, drawS06Sparks } from './s06';

/** dev-only switches for profiling (always all-on in the film) */
export const DEV = { vortex: true, motes: true, eye: true, tracer: true };

/** soft round sprite (pre-rendered once) */
function moteSprite(): HTMLCanvasElement {
  return memo('s07:mote', () => {
    const [c, x] = offscreen('mote', 64, 64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(200,248,255,1)');
    g.addColorStop(0.55, 'rgba(140,226,240,0.55)');
    g.addColorStop(0.85, 'rgba(120,220,235,0.12)');
    g.addColorStop(1, 'rgba(120,220,235,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  });
}

/** Foreground droplets (depth motes): out-of-focus water drops above the surface, 1.3× parallax. */
export function drawMotes(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.01) return;
  const spr = moteSprite();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const par = 1.3;
  for (let i = 0; i < 26; i++) {
    const r = 6 + 26 * hash01(i, 11);
    const x0 = hash01(i, 12) * 1180 - 50;
    const y0 = hash01(i, 13) * 2000 - 40;
    const vx = (hash01(i, 14) - 0.5) * 0.5;
    const vy = -0.15 - hash01(i, 15) * 0.35;
    const x = x0 + vx * f + (cam.ax - 540) * par;
    const y = ((((y0 + vy * f + (cam.ay - 860) * par * 0.6 - (1 - cam.sp) * 300) % 2000) + 2000) % 2000) - 40;
    ctx.globalAlpha = (0.05 + 0.1 * hash01(i, 16)) * alpha;
    ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r);
  }
  ctx.restore();
}

export interface LayerState {
  thermal: number;
  /** thermal image only above this y (the scan) */
  thermalClipY?: number;
  bloomA: number;
  bloomB: number;
}

export function layerState(f: number): LayerState {
  if (f < T.scan0) {
    // the morph's turning column is dense: less bloom while it stands up
    const m = smoothstep(T.morph0, T.morph0 + 12, f) * (1 - smoothstep(T.morph0 + 60, T.morph0 + 80, f));
    // at the cut: S06 blooms only its glow pass (inflow, sparks, sink), not its veins → a softer bloom first
    const cut = 1 - smoothstep(4, 40, f);
    return { thermal: 0, bloomA: 0.85 - 0.35 * m - 0.45 * cut, bloomB: 0.6 - 0.25 * m - 0.3 * cut };
  }
  const end = 1 - smoothstep(T.tilt2a + 10, T.tilt2b - 4, f); // the final floor must be exactly #05030F
  return {
    thermal: 1,
    thermalClipY: f < T.scan1 ? Math.max(0, scanY(f)) : undefined,
    bloomA: 0.5 * end,
    bloomB: 0.34 * end,
  };
}

export function renderThermal(ctx: CanvasRenderingContext2D, f: number) {
  drawThermal(ctx, f);
}

/** how the body particles are drawn over the thermal image, by beat */
function thermalBodyOpts(f: number) {
  const ledger = smoothstep(T.gauge0 - 4, T.gauge0 + 16, f) * (1 - smoothstep(T.freeze0, T.freeze1, f));
  const frozen = smoothstep(T.freeze0, T.freeze1 + 10, f) * (1 - smoothstep(T.restart, T.restart + 14, f));
  const restart = smoothstep(T.restart, T.restart + 10, f);
  return {
    alpha: 1,
    dot: 0.06 + 0.04 * restart,
    // the sensor sees no intake (it is not warm): the thread returns as the ledger's 吃进低熵
    ext: (0.9 * ledger + 0.5 * restart) * (1 - smoothstep(T.dissolve0 - 12, T.dissolve0 + 4, f)),
    tree: 0.15 + 0.45 * ledger + 0.4 * restart,
    out: 0.08 + 0.42 * ledger + 0.3 * restart,
    stillDots: 0.5 * frozen,
    cold: frozen,
  };
}

export function renderMain(ctx: CanvasRenderingContext2D, f: number) {
  const cam = camAt(f);
  const pool = poolAlpha(f);
  const morphing = f >= T.morph0;
  const thermalOn = f >= T.scan0;
  // ---------------- the whirlpool
  if (pool > 0.003) {
    if (DEV.eye) drawEye(ctx, f, cam, pool);
    if (DEV.vortex)
      drawVortex(ctx, f, cam, {
        alpha: 1,
        skip: morphing
          ? (j) => {
              const b = bodyOf(j);
              return b >= 0 && f >= morphStart(b);
            }
          : undefined,
        isPool: morphing ? (j) => bodyOf(j) < 0 : undefined,
        poolAlpha: pool,
        trail: 3,
      });
    // S06's last image over the whirlpool it hands over to (same log spiral, same sense of rotation)
    if (f < 40)
      drawS06(ctx, f, cam, {
        inflow: 1 - smoothstep(4, 34, f),
        veins: 1 - smoothstep(2, 28, f),
        land: 1 - smoothstep(0, 18, f),
        stream: 1 - smoothstep(4, 30, f),
      });
    drawS06Sparks(ctx, f, cam);
    drawCensus(ctx, f, cam);
    if (DEV.tracer) drawTracer(ctx, f, cam);
  }
  // ---------------- the body
  if (morphing) {
    const vesselA =
      f < T.scan0
        ? 1 - 0.45 * smoothstep(T.days0, T.days0 + 20, f) // quieter during the time-lapse: the skeleton must read
        : 0.12 + 0.3 * smoothstep(T.gauge0, T.gauge0 + 20, f) - 0.3 * smoothstep(T.freeze0, T.freeze1, f) + 0.25 * smoothstep(T.restart, T.restart + 20, f);
    const vA = vesselA * (1 + 1.1 * beatFlash(f)) * (1 - smoothstep(T.dissolve0, T.dissolve0 + 30, f));
    if (!thermalOn) {
      drawSpoutGlow(ctx, f, cam);
      if (f >= T.treeGrow0) drawVessels(ctx, f, cam, vA);
      drawBody(ctx, f, cam, { alpha: 1 });
      drawExhale(ctx, f, cam, smoothstep(T.flowOn0, T.flowOn1 + 10, f));
    } else if (f < T.scan1) {
      // during the scan: flow view below the line, thermal overlay above
      const sy = scanY(f);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, sy, 1080, 1920 - sy);
      ctx.clip();
      drawVessels(ctx, f, cam, 1);
      drawBody(ctx, f, cam, { alpha: 1 });
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 1080, sy);
      ctx.clip();
      drawBody(ctx, f, cam, thermalBodyOpts(f));
      ctx.restore();
    } else {
      drawVessels(ctx, f, cam, Math.max(0, vA));
      drawBody(ctx, f, cam, thermalBodyOpts(f));
      drawExhale(ctx, f, cam, 0.3 * (1 - smoothstep(T.dissolve0, T.dissolve0 + 20, f)));
    }
  }
  // ---------------- thermal overlays
  if (thermalOn) {
    const irA =
      smoothstep(T.scan1 - 6, T.scan1 + 14, f) * (1 - 0.5 * smoothstep(T.sunIn0, T.sunIn1, f) - 0.15 * smoothstep(T.gauge0, T.gauge0 + 20, f)) *
        (1 - smoothstep(T.freeze0, T.freeze0 + 6, f)) +
      0.45 * smoothstep(T.restart + 6, T.restart + 26, f) * (1 - smoothstep(T.dissolve0, T.dissolve0 + 26, f));
    drawIRWaves(ctx, f, cam, irA);
    drawScanLine(ctx, f);
  }
  if (DEV.motes) drawMotes(ctx, f, cam, smoothstep(10, 50, f) * (1 - seg(f, T.scan0, T.scan1)));
  if (f < 32) drawS06Motes(ctx, f, 1 - smoothstep(0, 30, f));
}
