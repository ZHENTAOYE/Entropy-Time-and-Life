// S08 — foreground depth: out-of-focus sand grains blown across the lens (sand phase) that turn into slowly rising
// gold dust once the scene goes dark. Screen space with a parallax push from the camera zoom.
import { memo } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { Cam, K_N, Z_NET } from './trail';
import { cpuCanvas } from './CpuCanvas';

function moteSprite(rgb: string): HTMLCanvasElement {
  return memo('S08:mote:' + rgb, () => {
    const c = cpuCanvas(64, 64);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.35, `rgba(${rgb},0.5)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  });
}

export function drawMotes(ctx: CanvasRenderingContext2D, f: number, cam: Cam, sandK: number, goldK: number) {
  const sand = moteSprite('246,223,178');
  const gold = moteSprite('255,205,120');
  const push = Math.log(cam.z); // zoom drives a parallax push/pull of the foreground
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 44; i++) {
    const h1 = hash01(i, 801);
    const h2 = hash01(i, 802);
    const h3 = hash01(i, 803);
    const depth = 0.4 + h3 * 0.9; // 0.4 near … 1.3 nearer
    const r = (6 + 26 * h3) * (1 + 0.15 * Math.sin(f * 0.05 + i));
    // sand phase: blown right → left; dark phase: rising slowly
    const vx = -(2.5 + 4 * h2) * depth * sandK - 0.2 * goldK;
    const vy = -(0.35 + 0.6 * h1) * goldK + Math.sin(f * 0.02 + i) * 0.2;
    let x = ((i * 0.618034) % 1) * 1400 + h1 * 60 + vx * f;
    let y = h2 * 2200 + vy * f;
    // parallax from zoom (about the frame centre)
    const k = Math.exp(push * 0.35 * depth);
    x = 540 + (x - 540) * k;
    y = 960 + (y - 960) * k;
    x = ((x % 1400) + 1400) % 1400 - 160;
    y = ((y % 2200) + 2200) % 2200 - 140;
    const a = (0.05 + 0.1 * h3) * (sandK + goldK * 1.4);
    if (a < 0.003) continue;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(goldK > sandK ? gold : sand, x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

/**
 * For S09: the gold dust exactly as on S08's last frame, continuing in time.
 * t = S08-local frame (S09: 570 + its frame); zoom = extra pull-back factor relative to S08's final camera (1 = same).
 * Draw on a canvas of any scale (logical 1080×1920 px).
 */
export function drawMotesS08(ctx: CanvasRenderingContext2D, t: number, zoom = 1) {
  const zFinal = Z_NET * K_N;
  drawMotes(ctx, t, { cx: 0, cy: 0, ax: 540, ay: 960, z: zFinal * zoom }, 0, 1);
}
