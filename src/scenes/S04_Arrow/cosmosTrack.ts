// The cosmic web schedule of S04 (one CosmicWeb layer, mounted f140–554 and f610–953) + the additive content drawn
// into it (it shares the web's fate: goes out with the inversion, etc.). All times come from timing.ts.
//
//   rewind  f146–276  the iris opens on the present-day lit web + a merger remnant. Locked to the look-back counter:
//                     until 1亿年 nothing moves but the time-compression streaks; 1亿 → 100亿年 space contracts (zoom
//                     1 → 0.62, field galaxies converge) and the merger un-merges; 100 → 136亿年 stars un-light and the
//                     galaxies dissolve into gas, filaments thicken and smooth (c 1 → 0); 136 → 137亿年 the dark ages;
//                     137 → 138亿年 the heat surge into plasma (heat 0 → 1). Slam on the floor of time at f276.
//   plasma  f276–554  the floor of time: boiling white-hot plasma, slow push 0.62 → 0.92 (whiteout into the ink)
//   ink     f610–732  INVERTED web (ink on paper): uniform spent ink; from f676 it gathers into filaments (c ↑)
//   flip    f732–758  invert → 0 with the front far above the frame: the light rises from the bottom (C7 has gone)
//   ignite  f744–808  stars ignite at the nodes (flashes, shock rings, spikes, gold sparks)
//   camera  f628–932  zoom 1.45 → 0.8, roll 0 → 6°; f935–953 = WEB_FINAL (t = f / 30 throughout)
import { WebParams, drawMerger, drawStarfield } from '../../lib/cosmos';
import { clamp, ease, lerp, memo, prog, seg, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { T } from './timing';

export { IX, IY, ZMIN, webParams } from './webTrack';
import { ZMIN } from './webTrack';
import { irisRadius } from './arrow';

// ───────────────────────── field galaxies (converge as space contracts) ─────────────────────────
interface FieldGal {
  x: number;
  y: number;
  r: number;
  tilt: number;
  ang: number;
  warm: number;
  b: number;
}
function fieldGalaxies(): FieldGal[] {
  return memo('s04:fieldgal', () => {
    const r = mulberry32(5150);
    const out: FieldGal[] = [];
    for (let i = 0; i < 46; i++) {
      out.push({
        x: (r() - 0.5) * 1700,
        y: (r() - 0.5) * 2900,
        r: 5 + Math.pow(r(), 2.2) * 22,
        tilt: 0.25 + r() * 0.75,
        ang: r() * Math.PI,
        warm: r(),
        b: 0.35 + r() * 0.65,
      });
    }
    return out;
  });
}
function galSprite(): HTMLCanvasElement {
  return memo('s04:galsprite', () => {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,250,235,1)');
    g.addColorStop(0.08, 'rgba(255,236,200,0.85)');
    g.addColorStop(0.3, 'rgba(200,205,255,0.32)');
    g.addColorStop(0.65, 'rgba(150,160,255,0.08)');
    g.addColorStop(1, 'rgba(120,130,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  });
}
function moteSprite(): HTMLCanvasElement {
  return memo('s04:motesprite', () => {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = 'rgba(255,255,255,0.75)';
    x.beginPath();
    x.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  });
}

/** Foreground motes (out-of-focus stars / embers), 1.3× parallax with the camera zoom. */
export function drawMotes(ctx: CanvasRenderingContext2D, f: number, zoom: number, warm: number, alpha: number) {
  if (alpha <= 0.002) return;
  const r = mulberry32(909);
  const sp = moteSprite();
  const zz = Math.pow(zoom, 1.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const x0 = (r() - 0.5) * 1500,
      y0 = (r() - 0.5) * 2400;
    const rad = 6 + Math.pow(r(), 1.6) * 26;
    const a = 0.05 + r() * 0.09;
    const ph = r() * 6.28;
    const vx = (r() - 0.5) * 14,
      vy = -6 - r() * 10;
    const x = 540 + (x0 + vx * (f / 30)) * zz;
    const y = 960 + (y0 + vy * (f / 30)) * zz;
    const s = rad * 2 * (0.8 + 0.2 * zz);
    const tw = 0.8 + 0.2 * Math.sin(f * 0.07 + ph);
    ctx.globalAlpha = a * alpha * tw;
    ctx.filter = 'none';
    ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
    void warm;
  }
  ctx.restore();
}

/** Additive content drawn INTO the CosmicWeb canvas (logical px, 'lighter'). */
export function drawCosmosExtras(ctx: CanvasRenderingContext2D, f: number, P: WebParams) {
  const t = f / 30;
  if (f < T.slam + 6) {
    const a = P.zoom; // scale factor of space (1 → ZMIN)
    const kd = prog(f, T.mergerDissolve[0], T.mergerDissolve[1], ease.inOutSine);
    // background starfield of the rewind: radial streaks (time tampered with)
    const streak = 0.65 * smoothstep(150, 172, f) * (1 - smoothstep(240, 268, f));
    const sfA = 0.55 * (1 - smoothstep(240, 266, f));
    if (sfA > 0.01) drawStarfield(ctx, { seed: 12, t, density: 0.7, alpha: sfA, zoom: 1 / Math.max(ZMIN, a), cx: 540, cy: 900, streak, palette: 'natural' });
    // field galaxies converge (Hubble flow run backward) while their stars un-light and they melt into the gas
    const gs = galSprite();
    const melt = prog(f, T.mergerDissolve[0] + 2, T.mergerDissolve[1], ease.inOutSine);
    const gA = 1 - prog(f, 244, 262);
    if (gA > 0.01) {
      for (const g of fieldGalaxies()) {
        const x = 540 + g.x * a,
          y = 900 + g.y * a;
        if (x < -80 || x > 1160 || y < -80 || y > 2000) continue;
        const R = g.r * (1 + 1.4 * melt);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(g.ang);
        ctx.scale(1, g.tilt + (1 - g.tilt) * melt);
        ctx.globalAlpha = g.b * gA * (1 - 0.6 * melt);
        ctx.drawImage(gs, -R * 2, -R * 2, R * 4, R * 4);
        ctx.restore();
      }
    }
    // the hero: a merger remnant, played backward (un-merges), then un-lights into gas
    const mA = 1 - prog(f, 244, 264, ease.inOutSine);
    // (still hidden behind the arrow layer until the iris has opened past its lower edge, y ≈ 1200)
    const hidden = f < T.iris[1] && irisRadius(f) < 1290 - 1220;
    if (mA > 0.01 && f >= T.cosmosOn && !hidden) {
      const p = lerp(0.98, 0.22, prog(f, T.merger[0], T.merger[1], ease.inOutSine));
      drawMerger(ctx, { cx: 540, cy: 900, scale: 235 * lerp(1, 0.78, prog(f, T.contract[0], T.contract[1])), p, tilt: 0.55, angle: 0.4, seed: 3, n: 2400, t, dissolve: kd, alpha: mA, exposure: 0.8, palette: 'natural' });
    }
  }
  // the slam: a shock ring on the floor of time
  const ks = seg(f, T.slam, T.slam + 34);
  if (ks > 0 && ks < 1) {
    const R = 1900 * ease.outCubic(ks);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [lw, al] of [
      [140, 0.1],
      [50, 0.16],
      [12, 0.3],
    ] as Array<[number, number]>) {
      ctx.globalAlpha = al * (1 - ks);
      ctx.strokeStyle = '#FFF4DC';
      ctx.lineWidth = lw * (1 - 0.5 * ks);
      ctx.beginPath();
      ctx.arc(540, 960, R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  // foreground motes: stars in the cosmic phases (gone before the last frame)
  const mot = f < 590 ? 1 - smoothstep(244, 276, f) : smoothstep(T.flip[1], T.flip[1] + 34, f) * (1 - smoothstep(T.hudOut[0], T.hudOut[1], f));
  drawMotes(ctx, f, P.zoom, 0, clamp(mot));
}
