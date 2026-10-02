// The three experiments shown in the A/B panels. A plays the recording forward, B plays the same recording backward.
import { clamp, ease, lerp, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { C, PA, PANEL_H, PANEL_W, PB, T } from './constants';
import { arrow, Ctx, glow, latin, mono, rgbaHex, ring } from './paint';
import { GAS_DISC, GAS_FRAMES, GAS_R, gasRun, rackRun, RACK_R, runPos, runSpeed, TWO, TWO_T, twoPos, twoVel } from './sims';

export type Which = 'A' | 'B';

// ------------------------------------------------------------------ playback maps (screen frame -> recording time)
/** recording time of the 2-ball run seen in panel A (with the tape slowing to a stop after the run) */
export function g2(f: number): number {
  if (f <= T.run2End) return f - T.run2;
  const s = seg(f, T.run2End, T.slowEnd);
  return TWO_T + (T.slowEnd - T.run2End) * (s - (s * s) / 2);
}
export const tau2 = (w: Which, f: number) => (w === 'A' ? g2(f) : TWO_T - g2(f));
export const RUN10_LEN = T.run10End - T.run10; // 46
export const RUN400_LEN = T.run400End - T.run400; // 68
export const k10 = (w: Which, f: number) => {
  const k = clamp(f - T.run10, 0, RUN10_LEN);
  return w === 'A' ? k : RUN10_LEN - k;
};
export const k400 = (w: Which, f: number) => {
  const k = Math.max(0, f - T.run400);
  return w === 'A' ? Math.min(k, GAS_FRAMES - 1) : Math.max(0, RUN400_LEN - k);
};

export type Stage = 2 | 10 | 400;
/** Stage shown at frame f, plus the wipe progress into it (1 = fully shown). */
export function stageAt(f: number): { cur: Stage; prev: Stage | null; wipe: number } {
  if (f < T.wipe10) return { cur: 2, prev: null, wipe: 1 };
  if (f < T.wipe10 + 8) return { cur: 10, prev: 2, wipe: seg(f, T.wipe10, T.wipe10 + 8) };
  if (f < T.wipe400) return { cur: 10, prev: null, wipe: 1 };
  if (f < T.wipe400 + 8) return { cur: 400, prev: 10, wipe: seg(f, T.wipe400, T.wipe400 + 8) };
  return { cur: 400, prev: null, wipe: 1 };
}

// ------------------------------------------------------------------ ball look
function rimBall(ctx: Ctx, x: number, y: number, R: number, a: number, tint: string, solidCore = false) {
  const gr = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.05, x, y, R);
  if (solidCore) {
    gr.addColorStop(0, rgbaHex('#FFFFFF', a));
    gr.addColorStop(0.55, rgbaHex(C.core, 0.92 * a));
    gr.addColorStop(1, rgbaHex(tint, 0.75 * a));
  } else {
    gr.addColorStop(0, rgbaHex(C.core, 0.55 * a));
    gr.addColorStop(0.25, rgbaHex(tint, 0.14 * a));
    gr.addColorStop(0.8, rgbaHex(tint, 0.18 * a));
    gr.addColorStop(1, rgbaHex(tint, 0.42 * a));
  }
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbaHex(tint, a);
  ctx.lineWidth = Math.max(1.5, R * 0.085);
  ctx.stroke();
  // specular glint
  ctx.fillStyle = rgbaHex('#FFFFFF', 0.85 * a);
  ctx.beginPath();
  ctx.arc(x - R * 0.38, y - R * 0.4, Math.max(1, R * 0.12), 0, Math.PI * 2);
  ctx.fill();
}

function centreMark(ctx: Ctx, x: number, y: number, R: number, a: number) {
  ctx.strokeStyle = rgbaHex(C.core, 0.5 * a);
  ctx.lineWidth = 1;
  ctx.setLineDash([R * 0.5, 3, 2, 3]);
  ctx.beginPath();
  ctx.moveTo(x - R - 9, y);
  ctx.lineTo(x + R + 9, y);
  ctx.moveTo(x, y - R - 9);
  ctx.lineTo(x, y + R + 9);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** small italic math label with a real subscript, e.g. v₁ (subscript digits in mono: Cormorant's old-style 1 reads
 * as an "ı"). Returns the width. */
function subLabel(ctx: Ctx, base: string, sub: string, x: number, y: number, a: number, col: string, dry = false): number {
  ctx.font = latin(34, true, 600);
  const w = ctx.measureText(base).width;
  ctx.font = mono(17, 700);
  const ws = ctx.measureText(sub).width;
  if (dry) return w + 2 + ws;
  ctx.fillStyle = rgbaHex(col, a);
  ctx.textAlign = 'left';
  ctx.font = latin(34, true, 600);
  ctx.fillText(base, x, y);
  ctx.font = mono(17, 700);
  ctx.fillText(sub, x + w + 2, y + 7);
  return w + 2 + ws;
}

/** Leader direction of the mass label per panel and ball: a diagonal roughly perpendicular to the ball's on-screen
 * velocity, so the label never sits on its v arrow (ahead) or its strobe trail (behind), chosen once for the whole
 * label window (40-78) so it never jumps. A ball 1 moves right -> label up-right; A ball 2 moves left -> down-left;
 * B ball 1 moves down-right -> down-left; B ball 2 moves up-left -> down-left. */
const LEADER: Record<Which, ReadonlyArray<readonly [number, number]>> = {
  A: [
    [1, -1],
    [-1, 1],
  ],
  B: [
    [-1, 1],
    [-1, 1],
  ],
};
function massLabel(ctx: Ctx, w: Which, i: 0 | 1, x: number, y: number, R: number, px: number, py: number, a: number) {
  const [lx, ly] = LEADER[w][i];
  const val = i === 0 ? ' = 1.5' : ' = 1.0';
  const wm = subLabel(ctx, 'm', i === 0 ? '1' : '2', 0, 0, 0, C.core, true);
  ctx.font = mono(24, 400);
  const tw = wm + ctx.measureText(val).width;
  const ex = x + lx * R * 0.72;
  const ey = y + ly * R * 0.72;
  const kx = ex + lx * 24;
  const ky = ey + ly * 24;
  const hx = kx + lx * (tw + 14);
  let tx = lx > 0 ? kx + 7 : hx + 7;
  // keep the label inside the panel
  tx = clamp(tx, px + 16, px + PANEL_W - 16 - tw);
  ctx.strokeStyle = rgbaHex(C.core, 0.6 * a);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(kx, ky);
  ctx.lineTo(hx, ky);
  ctx.stroke();
  const by = ky - 8;
  subLabel(ctx, 'm', i === 0 ? '1' : '2', tx, by, 0.95 * a, C.core);
  ctx.font = mono(24, 400);
  ctx.fillStyle = rgbaHex(C.core, 0.9 * a);
  ctx.textAlign = 'left';
  ctx.fillText(val, tx + wm, by);
}

// ------------------------------------------------------------------ N = 2
export function dim2(f: number): number {
  // evidence dims under the stamps, then again under the law (the equation is written over the strobe exposure)
  const a = 1 - 0.45 * ease.inOutQuad(seg(f, T.qStamp, T.qStamp + 10));
  const b = 1 - 0.45 * ease.inOutQuad(seg(f, T.eqIn - 4, T.eqIn + 10));
  return a * b;
}

export function drawTwo(ctx: Ctx, w: Which, f: number, px: number, py: number, glowLayer: boolean, intro: number) {
  const tau = tau2(w, f);
  const dim = dim2(f);
  const tint = C.cyan;
  const pos = (i: 0 | 1, tt: number): [number, number] => {
    const p = twoPos(i, tt);
    return [px + p[0], py + p[1]];
  };
  const fEnd = Math.min(f, T.run2End);
  if (glowLayer) {
    if (intro < 1) return;
    for (const i of [0, 1] as const) {
      const [x, y] = pos(i, tau);
      glow(ctx, C.cyan, x, y, TWO.R[i] * 3.2, 0.42 * dim);
    }
    const fl = seg(f, T.collide2, T.collide2 + 10);
    if (fl > 0 && fl < 1) glow(ctx, C.core, px + TWO.contact[0], py + TWO.contact[1], 150 * (0.4 + fl), 0.9 * (1 - fl) * (1 - fl));
    return;
  }
  // trajectory trace (dotted) from the start of the recording to now
  if (f > T.run2) {
    ctx.save();
    ctx.setLineDash([2, 7]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgbaHex(tint, 0.38 * dim);
    for (const i of [0, 1] as const) {
      ctx.beginPath();
      const t0 = tau2(w, T.run2);
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const tt = lerp(t0, tau, s / steps);
        // keep the kink at the collision exact
        const [x, y] = pos(i, tt);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // ensure the vertex at the contact is included
      ctx.stroke();
    }
    ctx.restore();
  }
  // strobe exposure: ghost outlines every 4 frames of screen time
  if (f > T.run2) {
    ctx.lineWidth = 1.2;
    for (let fp = T.run2; fp <= fEnd; fp += 4) {
      const age = f - fp;
      const a = (0.1 + 0.42 * Math.exp(-age / 22)) * dim;
      for (const i of [0, 1] as const) {
        const [x, y] = pos(i, tau2(w, fp));
        ctx.strokeStyle = rgbaHex(tint, a);
        ctx.beginPath();
        ctx.arc(x, y, TWO.R[i], 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // collision annotation: line of centres + contact ring
  if (f >= T.collide2) {
    const c1 = [px + TWO.c[0][0], py + TWO.c[0][1]];
    const c2 = [px + TWO.c[1][0], py + TWO.c[1][1]];
    const nx = TWO.n[0];
    const ny = TWO.n[1];
    const k = ease.outCubic(seg(f, T.collide2, T.collide2 + 10));
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = rgbaHex(C.core, 0.5 * dim);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c1[0] - nx * 70 * k, c1[1] - ny * 70 * k);
    ctx.lineTo(c2[0] + nx * 70 * k, c2[1] + ny * 70 * k);
    ctx.stroke();
    // tangent plane
    ctx.beginPath();
    const cx = px + TWO.contact[0];
    const cy = py + TWO.contact[1];
    ctx.moveTo(cx + ny * 48 * k, cy - nx * 48 * k);
    ctx.lineTo(cx - ny * 48 * k, cy + nx * 48 * k);
    ctx.stroke();
    ctx.restore();
    ring(ctx, cx, cy, 6, 90, seg(f, T.collide2, T.collide2 + 16), C.core, 0.9, 2);
    ring(ctx, cx, cy, 6, 150, seg(f, T.collide2 + 2, T.collide2 + 24), C.cyan, 0.6, 1.2);
  }
  // balls (before intro completes, the opening's cell division draws them)
  if (intro >= 1) {
    for (const i of [0, 1] as const) {
      const [x, y] = pos(i, tau);
      rimBall(ctx, x, y, TWO.R[i], dim, tint);
      centreMark(ctx, x, y, TWO.R[i], dim);
    }
  }
  // velocity vectors (on-screen motion direction; B's are reversed)
  const va = (1 - seg(f, T.run2End - 4, T.run2End + 10)) * seg(f, T.run2 + 2, T.run2 + 10) * dim;
  if (va > 0.01) {
    for (const i of [0, 1] as const) {
      const [x, y] = pos(i, tau);
      let [vx, vy] = twoVel(i, tau);
      if (w === 'B') {
        vx = -vx;
        vy = -vy;
      }
      const sp = Math.hypot(vx, vy);
      const ux = vx / sp;
      const uy = vy / sp;
      const R = TWO.R[i];
      const L = sp * 10;
      arrow(ctx, x + ux * (R + 4), y + uy * (R + 4), x + ux * (R + 4 + L), y + uy * (R + 4 + L), 11, rgbaHex(C.core, 0.9 * va), 2);
      // label beyond the arrow tip; it steps aside while the two balls converge on the contact (the two labels
      // would meet there) and fades at the panel walls rather than sliding onto its own arrowhead
      const lw = subLabel(ctx, 'v', '1', 0, 0, 0, C.core, true);
      const lxp = x + ux * (R + 16 + L) - lw / 2 + uy * 16;
      const lyp = y + uy * (R + 16 + L) + 11 - ux * 16;
      const edge = Math.min(lxp - px, px + PANEL_W - (lxp + lw), lyp - 24 - py, py + PANEL_H - lyp);
      const near = Math.max(1 - seg(f, T.collide2 - 20, T.collide2 - 12), seg(f, T.collide2 + 8, T.collide2 + 16));
      const la = va * near * clamp((edge - 6) / 24);
      if (la > 0.01) subLabel(ctx, 'v', i === 0 ? '1' : '2', lxp, lyp, 0.9 * la, C.core);
    }
  }
  // mass labels with leader lines (m₁ = 1.5, m₂ = 1.0: mass ratio = area ratio of the discs)
  const ma = seg(f, T.run2 + 4, T.run2 + 14) * (1 - seg(f, T.collide2 - 14, T.collide2 - 4)) * dim;
  if (ma > 0.01) {
    for (const i of [0, 1] as const) {
      const [x, y] = pos(i, tau);
      massLabel(ctx, w, i, x, y, TWO.R[i], px, py, ma);
    }
  }
}

// ------------------------------------------------------------------ check mark (the law HUD's 不变 ✓)
/** a vector check mark (font independent) centred at (x, y), height h */
export function checkMark(ctx: Ctx, x: number, y: number, h: number, col: string, a: number, k = 1) {
  if (a <= 0.01 || k <= 0) return;
  const p0: [number, number] = [x - h * 0.42, y + h * 0.02];
  const p1: [number, number] = [x - h * 0.12, y + h * 0.32];
  const p2: [number, number] = [x + h * 0.46, y - h * 0.38];
  const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const L = (l1 + l2) * clamp(k);
  ctx.strokeStyle = rgbaHex(col, a);
  ctx.lineWidth = Math.max(2, h * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  if (L <= l1) ctx.lineTo(p0[0] + ((p1[0] - p0[0]) * L) / l1, p0[1] + ((p1[1] - p0[1]) * L) / l1);
  else {
    ctx.lineTo(p1[0], p1[1]);
    const q = (L - l1) / l2;
    ctx.lineTo(p1[0] + (p2[0] - p1[0]) * q, p1[1] + (p2[1] - p1[1]) * q);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

// ------------------------------------------------------------------ N = 10 (9-ball diamond + cue)
export function drawRack(ctx: Ctx, w: Which, f: number, px: number, py: number, glowLayer: boolean) {
  const run = rackRun();
  const k = k10(w, f);
  const kPrev = (j: number) => k10(w, f - j);
  const R = RACK_R;
  const breakF = w === 'A' ? T.run10 + 10 : T.run10 + RUN10_LEN - 10;
  // contact point of the break: between cue and apex at recording frame 10
  const apex = runPos(run, 0, 10);
  const cue = runPos(run, 9, 10);
  const bx = px + (apex[0] + cue[0]) / 2;
  const by = py + (apex[1] + cue[1]) / 2;
  if (glowLayer) {
    for (let i = 0; i < run.n; i++) {
      const [x, y] = runPos(run, i, k);
      glow(ctx, i === 9 ? C.core : C.cyan, px + x, py + y, R * (i === 9 ? 3.6 : 2.8), i === 9 ? 0.55 : 0.32);
    }
    const fl = seg(f, breakF, breakF + 10);
    if (fl > 0 && fl < 1) glow(ctx, C.core, bx, by, 170 * (0.5 + fl), 0.95 * (1 - fl) * (1 - fl));
    return;
  }
  // motion streaks (last 7 frames of screen time)
  ctx.lineCap = 'round';
  for (let i = 0; i < run.n; i++) {
    let [x0, y0] = runPos(run, i, k);
    for (let j = 1; j <= 7; j++) {
      const [x1, y1] = runPos(run, i, kPrev(j));
      if (Math.hypot(x1 - x0, y1 - y0) > 80) break; // wall fold
      ctx.strokeStyle = rgbaHex(i === 9 ? C.core : C.cyan, 0.28 * (1 - j / 8));
      ctx.lineWidth = R * 1.1 * (1 - j / 9);
      ctx.beginPath();
      ctx.moveTo(px + x0, py + y0);
      ctx.lineTo(px + x1, py + y1);
      ctx.stroke();
      x0 = x1;
      y0 = y1;
    }
  }
  ctx.lineCap = 'butt';
  ring(ctx, bx, by, 8, 140, seg(f, breakF, breakF + 18), C.core, 0.9, 2.2);
  ring(ctx, bx, by, 8, 230, seg(f, breakF + 2, breakF + 26), C.cyan, 0.5, 1.2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < run.n; i++) {
    const [x, y] = runPos(run, i, k);
    rimBall(ctx, px + x, py + y, R, 1, C.cyan, i === 9);
    if (i < 9) {
      ctx.font = mono(13, 700);
      ctx.fillStyle = rgbaHex(C.core, 0.95);
      ctx.fillText(String(i + 1), px + x + 0.5, py + y + 1);
    }
  }
  ctx.textBaseline = 'alphabetic';
}

// ------------------------------------------------------------------ N = 400 (a hot dense drop released)
export const SPEED_COLS = ['#1C8DB0', '#39E1FF', '#9CF1FF', '#E6FCFF'];
/** speed buckets at 0.625 / 1.25 / 1.875 σ of the thermal speed (σ = 3.6 px/frame per component) */
export const SPEED_BUCKET = (s: number) => (s < 2.25 ? 0 : s < 4.5 ? 1 : s < 6.75 ? 2 : 3);
const DENSITY_W = [0.013, 0.018, 0.024, 0.032];
/** B's push-in on the condensing drop: 1.00 -> 1.06 over f366-390, released (snapped back) by the !! shake. */
export function pushInB(f: number): number {
  const k = ease.inOutQuad(seg(f, T.pushIn, T.run400End));
  const rel = ease.outCubic(seg(f, T.verdict2, T.verdict2 + 4));
  return 1 + 0.06 * k * (1 - rel);
}
/** `skip(i)`: balls that are no longer part of the panel (panel A's balls once the finale swarm launches them). */
export function drawGas(ctx: Ctx, w: Which, f: number, px: number, py: number, glowLayer: boolean, alpha = 1, fringe = 0, skip?: (i: number) => boolean) {
  const k = k400(w, f);
  const kp = k400(w, f - 2.4);
  const run = gasRun(Math.max(k, kp) + 1);
  const n = run.n;
  const burstF = w === 'A' ? T.run400 : T.run400End;
  const dcx = px + GAS_DISC.x;
  const dcy = py + GAS_DISC.y;
  if (glowLayer) {
    ctx.globalAlpha = 1;
    const tint = w === 'B' && fringe > 0 ? '#FF7A90' : C.cyan;
    // density glow: every ball is a wide, faint additive splat (weighted by its speed bucket). Where the balls are
    // packed the splats pile up into one luminous hot drop; spread out they thin to a faint haze — A's drop blooms
    // out and dims, B's haze gathers and brightens until the snap.
    for (let i = 0; i < n; i++) {
      if (skip && skip(i)) continue;
      const [x, y] = runPos(run, i, k);
      glow(ctx, tint, px + x, py + y, 52, DENSITY_W[SPEED_BUCKET(runSpeed(run, i, k))] * alpha);
      glow(ctx, tint, px + x, py + y, 13, 0.16 * alpha);
    }
    const fl = seg(f, burstF, burstF + 14);
    if (fl > 0 && fl < 1) glow(ctx, w === 'A' ? C.core : '#FFD0D8', dcx, dcy, 260 * (0.45 + fl), (1 - fl) * (1 - fl) * alpha);
    return;
  }
  // short motion trails
  ctx.strokeStyle = rgbaHex(C.cyan, 0.34 * alpha);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (skip && skip(i)) continue;
    const [x0, y0] = runPos(run, i, kp);
    const [x1, y1] = runPos(run, i, k);
    if (Math.abs(x1 - x0) + Math.abs(y1 - y0) > 50) continue;
    ctx.moveTo(px + x0, py + y0);
    ctx.lineTo(px + x1, py + y1);
  }
  ctx.stroke();
  // chromatic fringe (time tampered) for the revealed reverse panel
  if (fringe > 0.01) {
    const off = 2.5 + 2.5 * fringe;
    ctx.globalCompositeOperation = 'lighter';
    for (const [col, dx] of [
      ['rgba(255,59,92,', off],
      ['rgba(40,140,255,', -off],
    ] as Array<[string, number]>) {
      ctx.fillStyle = col + (0.5 * fringe * alpha).toFixed(3) + ')';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [x, y] = runPos(run, i, k);
        ctx.moveTo(px + x + dx + GAS_R, py + y);
        ctx.arc(px + x + dx, py + y, GAS_R, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // dots, bucketed by speed (temperature)
  for (let b = 0; b < 4; b++) {
    ctx.fillStyle = rgbaHex(SPEED_COLS[b], alpha);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (skip && skip(i)) continue;
      if (SPEED_BUCKET(runSpeed(run, i, k)) !== b) continue;
      const [x, y] = runPos(run, i, k);
      ctx.moveTo(px + x + GAS_R, py + y);
      ctx.arc(px + x, py + y, GAS_R, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ring(ctx, dcx, dcy, 60, 300, seg(f, burstF, burstF + 20), w === 'A' ? C.core : '#FFC2CC', 0.9 * alpha, 2);
  ring(ctx, dcx, dcy, 80, 420, seg(f, burstF + 3, burstF + 30), w === 'A' ? C.cyan : C.red, 0.55 * alpha, 1.2);
}

/** World-space positions of all gas balls in panel A at frame f (used by the finale swarm). */
export function gasWorldA(f: number, px: number, py: number): Float32Array {
  const k = k400('A', f);
  const run = gasRun(k + 1);
  const out = new Float32Array(run.n * 2);
  for (let i = 0; i < run.n; i++) {
    const [x, y] = runPos(run, i, k);
    out[i * 2] = px + x;
    out[i * 2 + 1] = py + y;
  }
  return out;
}

