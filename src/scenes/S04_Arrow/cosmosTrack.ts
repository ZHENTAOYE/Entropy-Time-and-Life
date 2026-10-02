// The cosmic web schedule of S04 (one CosmicWeb layer, mounted f138–584 and f626–953) + the additive content drawn
// into it (it shares the web's fate: goes out with the inversion, etc.).
//
//   rewind  f150–290  present-day lit web + a merger remnant → un-ignite (stars un-light), un-merge, dissolve into
//                     gas knots, filaments thicken and smooth (c 1 → 0), everything warms (heat 0 → 1); space
//                     contracts (zoom 1 → 0.55, field galaxies converge on the centre). Slam on the floor at f288.
//   plasma  f290–584  the floor of time: boiling white-hot plasma, slow push 0.55 → 0.92 (whiteout into the ink)
//   ink     f626–704  INVERTED web (ink on paper) — the uniform ink gathers into filaments under gravity (c ↑)
//   flip    f704–746  invert → 0 with the front far above the frame: the light rises from the bottom
//   ignite  f728–802  stars ignite at the nodes (flashes, shock rings, spikes, gold sparks)
//   camera  f640–935  zoom 1.06 → 0.8, roll 0 → 6°; f935–953 = WEB_FINAL (t = f / 30 throughout)
import { WEB_FINAL, WebParams, drawMerger, drawStarfield } from '../../lib/cosmos';
import { clamp, ease, lerp, memo, prog, seg, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { T } from './timing';

export const IX = 540;
export const IY = -6000;

export function webParams(f: number): WebParams {
  const t = f / 30;
  if (f >= T.still) return { ...WEB_FINAL, t };
  if (f < T.cosmosOff + 20) {
    // rewind → plasma
    const ignite = 1 - prog(f, T.unIgnite[0], T.unIgnite[1], ease.inOutSine);
    const c = 1 - prog(f, T.unClump[0], T.unClump[1], ease.inOutSine);
    const heat = prog(f, T.heatUp[0], T.heatUp[1], ease.inOutCubic);
    const zoom = f < 290 ? lerp(1, 0.55, prog(f, T.contract[0], T.contract[1], ease.inOutCubic)) : lerp(0.55, 0.92, prog(f, 290, 600, ease.inOutSine));
    const roll = -0.05 * prog(f, 150, 290, ease.inOutSine) + 0.03 * prog(f, 300, 600, ease.inOutSine);
    const exposure = 1 - 0.3 * smoothstep(140, 176, f) * (1 - smoothstep(214, 262, f)) + 0.38 * prog(f, T.whiteOut[0], T.whiteOut[1], ease.inOutSine);
    // floor of time → Penrose: the camera tilts up (the plasma drifts down the frame)
    const cy = -0.9 * prog(f, 286, 560, ease.inOutSine);
    return { c, heat, ignite, igniteRate: 0.55, sparks: 1 - prog(f, 160, 214), zoom, roll, t, exposure, cy };
  }
  // gravity: inverted ink gathers → flip to light → ignition → camera settles on WEB_FINAL
  const kc = prog(f, T.camera[0], T.camera[1], ease.inOutCubic);
  const zoom = Math.exp(lerp(Math.log(1.45), Math.log(WEB_FINAL.zoom), kc));
  const roll = lerp(0, WEB_FINAL.roll, kc);
  const c = lerp(0.12, 1, prog(f, T.clump[0], 792, ease.inOutSine));
  let invert = 1;
  if (f >= T.flip[0]) invert = f >= T.flip[1] ? 0 : lerp(0.975, 0.66, prog(f, T.flip[0], T.flip[1], ease.inOutSine));
  const ignite = prog(f, T.ignite[0], T.ignite[1], ease.inOutSine);
  const sparks = prog(f, T.sparksUp[0], T.sparksUp[1], ease.inOutSine);
  return { c, heat: 0, ignite, igniteRate: 0.42, sparks, zoom, roll, t, invert, ix: IX, iy: IY };
}

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
  if (f < 300) {
    const a = P.zoom; // scale factor of space (1 → 0.55)
    const kd = prog(f, T.mergerDissolve[0], T.mergerDissolve[1], ease.inOutSine);
    // background starfield of the rewind: radial streaks (time tampered with)
    const streak = 0.65 * smoothstep(150, 172, f) * (1 - smoothstep(240, 280, f));
    const sfA = 0.55 * (1 - smoothstep(228, 270, f));
    if (sfA > 0.01) drawStarfield(ctx, { seed: 12, t, density: 0.7, alpha: sfA, zoom: 1 / Math.max(0.55, a), cx: 540, cy: 900, streak, palette: 'natural' });
    // field galaxies converge (Hubble flow run backward) and melt into the warming gas
    const gs = galSprite();
    const melt = prog(f, 196, 250, ease.inOutSine);
    const gA = 1 - prog(f, 226, 260);
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
    const mA = 1 - prog(f, 236, 266, ease.inOutSine);
    if (mA > 0.01 && f >= 138) {
      const p = lerp(0.98, 0.22, prog(f, T.merger[0], T.merger[1], ease.inOutSine));
      drawMerger(ctx, { cx: 540, cy: 840, scale: 235 * lerp(1, 0.78, prog(f, T.contract[0], T.contract[1])), p, tilt: 0.55, angle: 0.4, seed: 3, t, dissolve: kd, alpha: mA, exposure: 0.8, palette: 'natural' });
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
  const mot = f < 590 ? 1 - smoothstep(250, 290, f) : smoothstep(740, 780, f) * (1 - smoothstep(T.hudOut[0], T.hudOut[1], f));
  drawMotes(ctx, f, P.zoom, 0, clamp(mot));
}
