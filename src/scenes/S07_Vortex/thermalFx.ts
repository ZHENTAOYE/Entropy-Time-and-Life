// Thermal-phase overlays on the main canvas: the sensor scan line, infrared wave packets leaving the skin
// (the same long lazy red waves as S06's 20 photons), the ledger streams of beat 9.
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { bodyData } from './body';
import { Cam, project } from './camera';
import { T } from './timing';

export const scanY = (f: number) => 1960 * ease.inOutSine(seg(f, T.scan0, T.scan1)) - 20;

export function drawScanLine(ctx: CanvasRenderingContext2D, f: number) {
  if (f < T.scan0 || f > T.scan1 + 2) return;
  const y = scanY(f);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y - 60, 0, y + 6);
  g.addColorStop(0, 'rgba(252,255,164,0)');
  g.addColorStop(0.85, 'rgba(251,155,6,0.25)');
  g.addColorStop(1, 'rgba(252,255,164,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 60, 1080, 64);
  ctx.fillStyle = 'rgba(255,255,230,0.95)';
  ctx.fillRect(0, y - 1, 1080, 2);
  // sensor ticks along the line
  ctx.fillStyle = 'rgba(255,240,200,0.7)';
  for (let x = 30; x < 1080; x += 60) ctx.fillRect(x, y - 7, 1, 14);
  ctx.restore();
}

/** IR wave packets radiating from the skin (λ drawn ~20× the visible light of S06's gold packet). */
export function drawIRWaves(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.01) return;
  const B = bodyData();
  const E = B.edge;
  const ne = E.length / 2;
  const p0 = new Float32Array(3);
  const p1 = new Float32Array(3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const N = 46;
  const life = 46;
  for (let j = 0; j < N; j++) {
    const per = life + Math.floor(hash01(j, 401) * 20);
    const ph = Math.floor(hash01(j, 402) * per);
    const gen = Math.floor((f + ph) / per);
    const age = f + ph - gen * per;
    if (age > life) continue;
    const sd = j * 977 + gen * 131;
    const ei = Math.floor(hash01(sd, 403) * ne);
    const ex = E[ei * 2];
    const eh = E[ei * 2 + 1];
    if (eh < 60) continue;
    // outward direction in the figure plane, from the body's axis
    let dx = ex - 0;
    let dh = eh - 560;
    const dl = Math.hypot(dx, dh) || 1;
    dx /= dl;
    dh /= dl;
    if (!project(cam, ex, eh, 0, p0, 0) || !project(cam, ex + dx * 100, eh + dh * 100, 0, p1, 0)) continue;
    let ux = p1[0] - p0[0];
    let uy = p1[1] - p0[1];
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    const vx = -uy;
    const vy = ux;
    const travel = 10 + age * 13;
    const len = 150;
    const lam = 30;
    const amp = 7;
    const a = alpha * (1 - ease.inQuad(age / life)) * smoothstep(0, 5, age);
    ctx.beginPath();
    for (let s = 0; s <= len; s += 4) {
      const env = Math.sin((s / len) * Math.PI);
      const off = Math.sin(((s + travel) / lam) * Math.PI * 2 - f * 0.0) * amp * env;
      const x = p0[0] + ux * (travel + s - len) + vx * off;
      const y = p0[1] + uy * (travel + s - len) + vy * off;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(255,70,45,${0.55 * a})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,59,47,${0.14 * a})`;
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  ctx.restore();
}

export { clamp };
