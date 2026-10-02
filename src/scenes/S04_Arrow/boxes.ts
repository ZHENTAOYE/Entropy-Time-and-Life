// Beat G — the thought experiment, drawn in ink on the paper of the spent-ink world: two identical boxes of the
// same uniform gas. 「无引力」: it just jiggles — uniform is already its most probable state (S tick at the top).
// 「有引力」: the same uniform gas falls together into a clump that heats up and sprays light (gold sparks that leave
// through the walls — radiation carries the entropy away) while its S tick CLIMBS. Same picture, opposite verdicts.
// Then the right box swells to fill the frame and the whole spent-ink universe starts to gather.
import { FONT } from '../../lib/fonts';
import { clamp, ease, fold, lerp, memo, seg, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { T } from './timing';

export const BOX_FONTS: Array<[string, string]> = [
  [`400 32px ${FONT.sans}`, '无引力有引力'],
  [`italic 600 36px ${FONT.latin}`, 'S'],
];

const S = 390;
const M = 14; // inner margin for the gas
export const BOXES = [
  { x: 82, y: 470 },
  { x: 608, y: 470 },
];
const CLUMP = { x: 190, y: 200 };

interface Gas {
  n: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  rf: Float32Array; // final clump radius
  om: Float32Array; // orbit angular speed
  dl: Float32Array; // infall delay 0..1
  sz: Float32Array;
}
function gas(): Gas {
  return memo('s04:gas', () => {
    const n = 196;
    const r = mulberry32(2024);
    const G: Gas = { n, x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), rf: new Float32Array(n), om: new Float32Array(n), dl: new Float32Array(n), sz: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      // stratified uniform start (visibly uniform, not clumpy by chance)
      const gx = i % 14,
        gy = Math.floor(i / 14);
      G.x[i] = ((gx + 0.15 + 0.7 * r()) / 14) * (S - 2 * M);
      G.y[i] = ((gy + 0.15 + 0.7 * r()) / 14) * (S - 2 * M);
      const a = r() * Math.PI * 2,
        v = 26 + r() * 40;
      G.vx[i] = Math.cos(a) * v;
      G.vy[i] = Math.sin(a) * v;
      G.rf[i] = 5 + 38 * Math.pow(r(), 1.5);
      G.om[i] = (1.6 + 2.2 * r()) * (r() < 0.8 ? 1 : -1);
      G.dl[i] = r();
      G.sz[i] = 2.1 + r() * 1.3;
    }
    return G;
  });
}
const gasPos = (G: Gas, i: number, t: number): [number, number] => [M + fold(G.x[i] + G.vx[i] * t, S - 2 * M), M + fold(G.y[i] + G.vy[i] * t, S - 2 * M)];

/** mean collapse of the right box (0..1) */
export const collapseK = (f: number) => ease.inOutSine(seg(f, T.collapse[0] + 8, T.collapse[1] + 6));
/** S of the right box: low while uniform, climbing as it clumps and radiates */
export const rightS = (f: number) => lerp(0.24, 0.88, ease.inOutSine(seg(f, T.collapse[0] + 4, T.sparks[1] - 10)));

export function drawBoxes(ctx: CanvasRenderingContext2D, f: number, ink: string) {
  const kin = seg(f, T.boxesIn[0], T.boxesIn[1]);
  if (kin <= 0 || f > T.boxesOut[1]) return;
  const G = gas();
  const t = (f - T.boxesIn[0]) / 30;
  const tc = (T.collapse[0] - T.boxesIn[0]) / 30;
  const kOutL = ease.inOutCubic(seg(f, T.boxesOut[0], T.boxesOut[0] + 22));
  const kOutR = ease.inCubic(seg(f, T.boxesOut[0] + 4, T.boxesOut[1]));

  for (let b = 0; b < 2; b++) {
    const B = BOXES[b];
    const right = b === 1;
    ctx.save();
    // exit motion: left box slides away, right box swells to fill the frame
    let sc = 1,
      dx = 0,
      al = 1;
    if (!right) {
      dx = -160 * kOutL;
      al = 1 - kOutL;
    } else {
      sc = 1 + 6 * kOutR;
      al = 1 - smoothstep(0.35, 1, kOutR);
    }
    if (al <= 0.003) {
      ctx.restore();
      continue;
    }
    const cxB = B.x + S / 2,
      cyB = B.y + S / 2;
    ctx.translate(cxB + dx, cyB);
    ctx.scale(sc, sc);
    ctx.translate(-S / 2, -S / 2);
    ctx.globalAlpha = al;

    // paper inside the box (calms the haze), then the frame drawn on like a pen stroke
    ctx.fillStyle = 'rgba(244,238,226,0.72)';
    ctx.globalAlpha = al * smoothstep(0.45, 1, kin) * (right ? 1 - smoothstep(0.1, 0.6, kOutR) : 1);
    ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = al;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6 / sc;
    const per = 4 * S;
    ctx.setLineDash([per * ease.inOutCubic(kin), per]);
    ctx.beginPath();
    ctx.moveTo(0, S);
    ctx.lineTo(0, 0);
    ctx.lineTo(S, 0);
    ctx.lineTo(S, S);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // corner ticks (a lab plate)
    ctx.lineWidth = 1 / sc;
    ctx.globalAlpha = al * 0.6 * kin;
    for (const [x, y] of [
      [0, 0],
      [S, 0],
      [0, S],
      [S, S],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }

    // the gas
    const kp = smoothstep(0.3, 1, kin);
    const q0 = right ? collapseK(f) : 0;
    // clump glow (heated by the infall)
    if (right && q0 > 0.05) {
      const R = 70 + 30 * q0;
      const g = ctx.createRadialGradient(CLUMP.x, CLUMP.y, 0, CLUMP.x, CLUMP.y, R);
      g.addColorStop(0, `rgba(255,214,120,${0.95 * q0})`);
      g.addColorStop(0.25, `rgba(255,170,60,${0.45 * q0})`);
      g.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.globalAlpha = al;
      ctx.fillStyle = g;
      ctx.fillRect(CLUMP.x - R, CLUMP.y - R, 2 * R, 2 * R);
    }
    ctx.fillStyle = ink;
    for (let i = 0; i < G.n; i++) {
      let [x, y] = gasPos(G, i, t);
      if (right && q0 > 0) {
        // free fall into the clump: outer gas arrives later; then it orbits (virialised)
        const d0 = 0.35 * G.dl[i];
        const q = ease.inOutCubic(clamp((q0 - d0) / (1 - d0 * 0.6)));
        const [gx, gy] = gasPos(G, i, tc);
        const r0 = Math.hypot(gx - CLUMP.x, gy - CLUMP.y);
        const a0 = Math.atan2(gy - CLUMP.y, gx - CLUMP.x);
        const ang = a0 + G.om[i] * (t - tc) * q * 0.9 + 1.4 * q * Math.sign(G.om[i]);
        const R = lerp(r0, G.rf[i], q);
        const cxp = CLUMP.x + Math.cos(ang) * R,
          cyp = CLUMP.y + Math.sin(ang) * R * 0.92;
        x = lerp(x, cxp, q);
        y = lerp(y, cyp, q);
      }
      ctx.globalAlpha = al * kp * 0.88;
      ctx.beginPath();
      ctx.arc(x, y, G.sz[i] / Math.sqrt(sc), 0, Math.PI * 2);
      ctx.fill();
    }

    // sparks: light leaving the heated clump — straight through the walls
    if (right) {
      const r = mulberry32(31);
      ctx.lineCap = 'round';
      for (let k = 0; k < 54; k++) {
        const e = lerp(T.sparks[0], T.sparks[1] - 12, Math.pow(r(), 0.8));
        const th = r() * Math.PI * 2;
        const v = 300 + r() * 260;
        const len = 22 + r() * 26;
        const age = (f - e) / 30;
        if (age <= 0) continue;
        const d = 18 + v * age;
        if (d > 760) continue;
        const ca = Math.cos(th),
          sa = Math.sin(th);
        const fa = 1 - smoothstep(380, 760, d);
        const hx = CLUMP.x + ca * d,
          hy = CLUMP.y + sa * d;
        const tx = CLUMP.x + ca * Math.max(18, d - len),
          ty = CLUMP.y + sa * Math.max(18, d - len);
        const lg = ctx.createLinearGradient(hx, hy, tx, ty);
        lg.addColorStop(0, 'rgba(214,120,10,1)');
        lg.addColorStop(1, 'rgba(240,160,40,0)');
        ctx.globalAlpha = al * fa;
        ctx.strokeStyle = lg;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = '#FFE08A';
        ctx.beginPath();
        ctx.arc(hx, hy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // mini S-gauge inside the right wall: the same uniform start, opposite verdicts
    const sv = right ? rightS(f) : 0.9;
    const gx = S - 22;
    const gy0 = S - 26,
      gy1 = 26;
    ctx.globalAlpha = al * 0.45 * kp;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1 / sc;
    ctx.beginPath();
    ctx.moveTo(gx, gy0);
    ctx.lineTo(gx, gy1);
    ctx.stroke();
    const ty = lerp(gy0, gy1, sv);
    ctx.globalAlpha = al * kp;
    ctx.lineWidth = 3.2 / sc;
    ctx.strokeStyle = right ? '#B8651A' : ink;
    ctx.beginPath();
    ctx.moveTo(gx - 13, ty);
    ctx.lineTo(gx + 13, ty);
    ctx.stroke();
    if (right) {
      // where it started
      ctx.globalAlpha = al * kp * 0.35;
      ctx.lineWidth = 1 / sc;
      const y0 = lerp(gy0, gy1, 0.24);
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(gx - 9, y0);
      ctx.lineTo(gx + 9, y0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = al * kp;
    ctx.fillStyle = right ? '#B8651A' : ink;
    ctx.font = `italic 600 36px ${FONT.latin}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText('S', gx - 18, ty - 2);

    ctx.restore();

    // label under the box
    ctx.save();
    ctx.globalAlpha = al * smoothstep(0.45, 1, kin) * (right ? 1 - smoothstep(0, 0.3, kOutR) : 1);
    ctx.fillStyle = ink;
    ctx.font = `400 32px ${FONT.sans}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px';
    } catch {
      /* older canvas */
    }
    ctx.fillText(right ? '有引力' : '无引力', B.x + S / 2 + dx, B.y + S + 50);
    ctx.restore();
  }
}
