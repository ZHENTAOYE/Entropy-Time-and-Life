// Beat 6: a glass of water as a technical drawing, filled with a shimmering molecular gas (the waterfall's bits pour
// in). For 「全挤到一边的概率：」 the molecules crowd into the left half — a hypothetical drawn in white — then spread
// back on their own (the arrow again). Then the glass shrinks into an icon at the start of the row of zeros.
import { clamp, ease, lerp, memo, seg } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { C, T } from './constants';
import { Ctx, MONO, SANS, drawRich, glow, rgbaHex, sup } from './paint';

const G = { cx: 540, rim: 500, base: 1190, rimHW: 236, baseHW: 178, wall: 9, baseT: 46, water: 590 } as const;
const hwAt = (y: number) => lerp(G.rimHW, G.baseHW, (y - G.rim) / (G.base - G.rim));
const NM = 2600;

const MOL = () =>
  memo('S03:molecules', () => {
    const r = mulberry32(2025);
    const u = new Float32Array(NM);
    const y = new Float32Array(NM);
    const ph = new Float32Array(NM);
    const sp = new Float32Array(NM);
    const z = new Float32Array(NM);
    for (let i = 0; i < NM; i++) {
      // uniform in the water trapezoid (area-weighted in y)
      let yy = 0;
      for (;;) {
        yy = lerp(G.water + 8, G.base - G.baseT - 6, r());
        if (r() < hwAt(yy) / G.rimHW) break;
      }
      u[i] = r();
      y[i] = yy;
      ph[i] = r() * 6.283;
      sp[i] = 0.5 + r() * 0.9;
      z[i] = r();
    }
    return { u, y, ph, sp, z };
  });

/** glass transform: full size → small icon above the start of the row */
export function glassXf(f: number): { s: number; tx: number; ty: number; a: number } {
  const k = ease.inOutCubic(seg(f, T.row - 6, T.row + 16));
  const s = lerp(1, 0.17, k);
  // icon centre target (130, 846): glass centre (540, 845) maps there
  const tx = lerp(0, 132 - 540 * 0.17, k);
  const ty = lerp(0, 812 - 845 * 0.17, k);
  const a = seg(f, T.glass, T.glass + 8) * (1 - seg(f, T.ride + 14, T.ride + 26));
  return { s, tx, ty, a };
}

/** squeeze factor (0 = uniform, 1 = all molecules in the left half) */
export function squeezeAt(f: number, i = 0): number {
  const d = hash01(i, 77) * 6;
  const inK = ease.inOutCubic(seg(f, T.squeeze + d * 0.5, T.squeeze + 18 + d * 0.5));
  const outK = ease.outCubic(seg(f, T.relax + d, T.relax + 22 + d));
  return inK * (1 - outK);
}

function drawGlassOutline(ctx: Ctx, f: number, a: number, iconMode: number) {
  const draw = ease.inOutCubic(seg(f, T.glass, T.glass + 24));
  ctx.save();
  ctx.lineJoin = 'round';
  const L = 2600;
  ctx.setLineDash([L * draw, L]);
  // outer wall
  ctx.strokeStyle = rgbaHex(C.amber, 0.9 * a);
  ctx.lineWidth = lerp(2, 6, iconMode);
  ctx.beginPath();
  ctx.moveTo(G.cx - G.rimHW, G.rim);
  ctx.lineTo(G.cx - G.baseHW, G.base);
  ctx.lineTo(G.cx + G.baseHW, G.base);
  ctx.lineTo(G.cx + G.rimHW, G.rim);
  ctx.stroke();
  // inner wall
  ctx.lineWidth = lerp(1.2, 3, iconMode);
  ctx.strokeStyle = rgbaHex(C.amber, 0.5 * a);
  ctx.beginPath();
  ctx.moveTo(G.cx - G.rimHW + G.wall, G.rim + 2);
  ctx.lineTo(G.cx - G.baseHW + G.wall, G.base - G.baseT);
  ctx.lineTo(G.cx + G.baseHW - G.wall, G.base - G.baseT);
  ctx.lineTo(G.cx + G.rimHW - G.wall, G.rim + 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // rim + water surface ellipses (3/4 view)
  const ea = a * seg(f, T.glass + 10, T.glass + 22);
  ctx.strokeStyle = rgbaHex(C.amber, 0.85 * ea);
  ctx.lineWidth = lerp(1.5, 5, iconMode);
  ctx.beginPath();
  ctx.ellipse(G.cx, G.rim, G.rimHW, 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  const ww = hwAt(G.water) - G.wall;
  ctx.strokeStyle = rgbaHex(C.pale, 0.7 * ea);
  ctx.lineWidth = lerp(1.2, 4, iconMode);
  ctx.beginPath();
  ctx.ellipse(G.cx, G.water, ww, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
  // base ellipse
  ctx.strokeStyle = rgbaHex(C.amber, 0.45 * ea);
  ctx.beginPath();
  ctx.ellipse(G.cx, G.base - G.baseT, G.baseHW - G.wall, 10, 0, 0, Math.PI);
  ctx.stroke();
  // specular streaks (glass)
  const sa = ea * (1 - iconMode);
  if (sa > 0.01) {
    const gr = ctx.createLinearGradient(0, G.rim + 30, 0, G.base - 60);
    gr.addColorStop(0, rgbaHex('#FFF4DC', 0));
    gr.addColorStop(0.25, rgbaHex('#FFF4DC', 0.32 * sa));
    gr.addColorStop(0.7, rgbaHex('#FFF4DC', 0.1 * sa));
    gr.addColorStop(1, rgbaHex('#FFF4DC', 0));
    ctx.strokeStyle = gr;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(G.cx - G.rimHW + 30, G.rim + 40);
    ctx.lineTo(G.cx - G.baseHW + 26, G.base - 90);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(G.cx + G.rimHW - 40, G.rim + 60);
    ctx.lineTo(G.cx + G.baseHW - 34, G.base - 160);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGlass(ctx: Ctx, f: number) {
  const X = glassXf(f);
  if (X.a <= 0.003 || f < T.glass) return;
  const iconMode = clamp((1 - X.s) / 0.83);
  ctx.save();
  ctx.translate(X.tx, X.ty);
  ctx.scale(X.s, X.s);
  // water body tint
  const wa = X.a * seg(f, T.glass + 14, T.glass + 34);
  if (wa > 0.003) {
    const gr = ctx.createLinearGradient(0, G.water, 0, G.base - G.baseT);
    gr.addColorStop(0, rgbaHex(C.amber, 0.08 * wa));
    gr.addColorStop(1, rgbaHex(C.amber, 0.02 * wa));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(G.cx - hwAt(G.water) + G.wall, G.water);
    ctx.lineTo(G.cx - G.baseHW + G.wall, G.base - G.baseT);
    ctx.lineTo(G.cx + G.baseHW - G.wall, G.base - G.baseT);
    ctx.lineTo(G.cx + hwAt(G.water) - G.wall, G.water);
    ctx.fill();
  }
  // squeeze: the empty half, hatched
  const sq = squeezeAt(f, 0);
  if (sq > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(G.cx, G.water);
    ctx.lineTo(G.cx + hwAt(G.water) - G.wall, G.water);
    ctx.lineTo(G.cx + G.baseHW - G.wall, G.base - G.baseT);
    ctx.lineTo(G.cx, G.base - G.baseT);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = rgbaHex(C.amber, 0.16 * sq * X.a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -40; k < 40; k++) {
      ctx.moveTo(G.cx + k * 22, G.water);
      ctx.lineTo(G.cx + k * 22 + 600, G.water + 600);
    }
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = `rgba(255,255,255,${(0.7 * sq * X.a).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(G.cx, G.water - 30);
    ctx.lineTo(G.cx, G.base - G.baseT + 30);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // molecules
  const M = MOL();
  const pour = (i: number) => seg(f, T.glass + 6 + (M.y[i] - G.water) / 30 + hash01(i, 8) * 10, T.glass + 14 + (M.y[i] - G.water) / 30 + hash01(i, 8) * 10);
  const step = iconMode > 0.6 ? 4 : iconMode > 0.3 ? 2 : 1;
  for (let i = 0; i < NM; i += step) {
    const p = pour(i);
    if (p <= 0) continue;
    const y0 = M.y[i];
    const hw = hwAt(y0) - G.wall - 4;
    const s = squeezeAt(f, i);
    // left-half mapping when squeezed; the relaxation overshoots a little and wanders (diffusion)
    const uu = lerp(M.u[i], M.u[i] * 0.5, s);
    const jx = Math.sin(f * 0.21 * M.sp[i] + M.ph[i]) * 5 + Math.sin(f * 0.53 * M.sp[i] + M.ph[i] * 2.3) * 2.5;
    const jy = Math.cos(f * 0.19 * M.sp[i] + M.ph[i] * 1.7) * 5 + Math.cos(f * 0.61 * M.sp[i] + M.ph[i]) * 2;
    let x = G.cx - hw + uu * 2 * hw + jx;
    let y = y0 + jy;
    // pouring in from above
    y = lerp(G.rim - 260 - hash01(i, 9) * 200, y, ease.inQuad(p));
    x = clamp(x, G.cx - hw, G.cx + hw);
    const depth = M.z[i];
    const r = (1 + depth * 1.6) * (step > 1 ? 1.6 : 1);
    const white = s > 0.02;
    ctx.fillStyle = white ? '#FFFFFF' : depth > 0.7 ? C.pale : C.amber;
    ctx.globalAlpha = X.a * (white ? 0.45 + 0.5 * depth : 0.35 + 0.55 * depth) * p;
    ctx.fillRect(x - r / 2, y - r / 2, r, r);
  }
  ctx.globalAlpha = 1;
  drawGlassOutline(ctx, f, X.a, iconMode);
  ctx.restore();

  // annotations (full size only)
  const la = X.a * seg(f, T.glass + 26, T.glass + 34) * (1 - seg(f, T.row - 8, T.row));
  if (la > 0.003) {
    // volume bracket on the right
    ctx.save();
    ctx.strokeStyle = rgbaHex(C.amber, 0.6 * la);
    ctx.lineWidth = 1.25;
    const bx = G.cx + G.rimHW + 40;
    ctx.beginPath();
    ctx.moveTo(bx - 8, G.water);
    ctx.lineTo(bx, G.water);
    ctx.lineTo(bx, G.base - G.baseT);
    ctx.lineTo(bx - 8, G.base - G.baseT);
    ctx.stroke();
    ctx.restore();
    drawRich(ctx, [{ t: '250 mL' }], bx + 14, 860, { font: MONO(27, 400), size: 27, color: C.pale, alpha: 0.9 * la });
    drawRich(ctx, [{ t: '一杯水' }], bx + 14, 898, { font: SANS(25, 400), size: 25, color: C.amber, alpha: 0.8 * la });
    drawRich(ctx, sup('N ≈ 8×10^{24}'), G.cx - G.rimHW - 36, 860, { font: MONO(27, 400), size: 27, color: C.pale, alpha: 0.9 * la, align: 'right' });
    drawRich(ctx, [{ t: '个分子' }], G.cx - G.rimHW - 36, 898, { font: SANS(25, 400), size: 25, color: C.amber, alpha: 0.8 * la, align: 'right' });
  }
  // the hypothetical tag
  const sq2 = squeezeAt(f, 0);
  if (sq2 > 0.02) {
    drawRich(ctx, [{ t: '假如：全在左边' }], G.cx - hwAt(G.water) / 2, G.water - 46, { font: SANS(28, 400), size: 28, color: '#FFFFFF', align: 'center', alpha: 0.92 * sq2 * X.a });
    drawRich(ctx, [{ t: '空' }], G.cx + hwAt(900) / 2, 905, { font: SANS(30, 300), size: 30, color: C.amber, align: 'center', alpha: 0.6 * sq2 * X.a });
  }
}

export function glowGlass(ctx: Ctx, f: number) {
  const X = glassXf(f);
  if (X.a <= 0.003 || f < T.glass) return;
  const sq = squeezeAt(f, 0);
  ctx.save();
  ctx.translate(X.tx, X.ty);
  ctx.scale(X.s, X.s);
  glow(ctx, sq > 0.05 ? '#FFFFFF' : C.amber, G.cx - 90 * sq, 880, 330, (0.18 + 0.14 * sq) * X.a * seg(f, T.glass + 14, T.glass + 34));
  ctx.restore();
}
