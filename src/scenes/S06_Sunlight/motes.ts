// Foreground depth: out-of-focus photon motes drifting in front of everything (1.3× parallax).
import { clamp, memo, seg } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { Cam, DIVE_T } from './camera';
import { tintDot } from './textures';
import { T } from './timing';

interface Mote {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
  ph: number;
}
const motes = () =>
  memo('s06:motes', () => {
    const r = mulberry32(8080);
    const out: Mote[] = [];
    for (let i = 0; i < 34; i++)
      out.push({ x: r() * 1080, y: r() * 1920, r: 6 + Math.pow(r(), 2) * 26, a: 0.05 + r() * 0.1, vx: (r() - 0.5) * 0.5, vy: (r() - 0.5) * 0.4, ph: r() * 6.28 });
    return out;
  });

export function drawMotes(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  const on = seg(frame, 10, 50);
  if (on <= 0) return;
  const M = motes();
  const gold = tintDot('255,201,74');
  const red = tintDot('255,70,50');
  const green = tintDot('158,224,106');
  const zf = 1 + (cam.z - 1) * 1.3;
  const ground = clamp((cam.lz - 0.7) / 0.3);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < M.length; i++) {
    const m = M[i];
    let x = m.x + m.vx * frame + Math.sin(frame * 0.02 + m.ph) * 12;
    let y = m.y + m.vy * frame + Math.cos(frame * 0.017 + m.ph) * 10;
    // parallax-zoom about the dive target
    x = cam.sx + (x - DIVE_T.x) * zf * (1 - ground) + (x - cam.sx) * ground;
    y = cam.sy + (y - DIVE_T.y) * zf * (1 - ground) + (y - 860) * ground + 860 * ground - cam.sy * ground;
    const s = m.r * (1 + (zf - 1) * 0.15 * (1 - ground)) * 2;
    if (x < -s || x > 1080 + s || y < -s || y > 1920 + s) continue;
    const spr = ground > 0.5 ? green : y < 900 ? gold : red;
    ctx.globalAlpha = m.a * on * (frame > T.diveStart && frame < T.diveEnd ? 0.6 : 1);
    ctx.drawImage(spr, x - s, y - s, 2 * s, 2 * s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
