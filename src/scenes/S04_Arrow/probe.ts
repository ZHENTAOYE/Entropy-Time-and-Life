// Beat F — the uniformity probe: a temperature trace drawn across the plasma, flat to one part in 10⁵ (it stays
// flat across the spent ink, too: both fields are uniform — yet their entropies are opposite).
import { ease, lerp, seg } from '../../lib/math';
import { T } from './timing';

/** A temperature trace across the plasma: flat to one part in 10⁵ (it stays flat across the ink, too). */
export function drawProbe(ctx: CanvasRenderingContext2D, f: number, ink: string) {
  const k = seg(f, T.probe[0], T.probe[0] + 22);
  const out = 1 - seg(f, T.probe[1] - 14, T.probe[1]);
  if (k <= 0 || out <= 0) return;
  const y = 1180;
  const x0 = 90,
    x1 = 990;
  const xe = lerp(x0, x1, ease.inOutCubic(k));
  ctx.save();
  ctx.globalAlpha = 0.75 * out;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // the trace: tiny fluctuations, 1 px — "almost perfectly uniform"
  for (let x = x0; x <= xe; x += 6) {
    const n = Math.sin(x * 0.051 + f * 0.11) * 0.6 + Math.sin(x * 0.137 - f * 0.07) * 0.5 + Math.sin(x * 0.29 + 1.3) * 0.3;
    const yy = y + n;
    if (x === x0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  // end ticks (a measurement)
  ctx.globalAlpha = 0.6 * out;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y - 12);
  ctx.lineTo(x0, y + 12);
  if (k >= 1) {
    ctx.moveTo(x1, y - 12);
    ctx.lineTo(x1, y + 12);
  }
  ctx.stroke();
  ctx.restore();
}
