// The first colour inside the grey: one gold point at GOLD_POINT. It stutters alive like an ember catching, then
// settles into the exact look S06 starts from (r 3.5, #FFC94A disc, #FFF7E0 core, halo to 3r, flicker 0.82–1).
import { GOLD_POINT } from '../../lib/handoff';
import { clamp, ease, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { T } from './timing';

export function goldOn(f: number): number {
  if (f < T.gold) return 0;
  const a = f - T.gold;
  if (a < 2 || a >= 16) return 1; // the first spark, then steady
  // catching: irregular on/off, more often on as it goes
  const p = 0.3 + 0.7 * (a / 16);
  return hash01(Math.floor(f), 4243) < p ? 1 : 0.18;
}

export function drawGold(ctx: CanvasRenderingContext2D, f: number) {
  const on = goldOn(f);
  if (on <= 0.001) return;
  const a = f - T.gold;
  const r = GOLD_POINT.r * (a < 10 ? 0.55 + 0.45 * ease.outBack(seg(a, 0, 10)) : 1);
  const flick = 0.82 + 0.18 * hash01(Math.floor(f), 4242);
  const x = GOLD_POINT.x;
  const y = GOLD_POINT.y;
  ctx.save();
  // a faint warm breath around it while it catches
  const breath = (1 - seg(a, 4, 40)) * 0.14 * on;
  if (breath > 0.003) {
    const g0 = ctx.createRadialGradient(x, y, 0, x, y, 60);
    g0.addColorStop(0, `rgba(255,201,74,${breath})`);
    g0.addColorStop(1, 'rgba(255,201,74,0)');
    ctx.fillStyle = g0;
    ctx.fillRect(x - 60, y - 60, 120, 120);
  }
  const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
  halo.addColorStop(0, `rgba(255,201,74,${0.35 * flick * on})`);
  halo.addColorStop(1, 'rgba(255,201,74,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.fillStyle = `rgba(255,201,74,${clamp(on)})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,247,224,${0.7 * flick * on})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
