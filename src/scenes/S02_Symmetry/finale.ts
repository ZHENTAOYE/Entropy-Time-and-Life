// Finale: the 400 balls of panel A lift off and assemble the word 很多 inside the last line; then "many" evaporates
// back into the dark, four balls survive and glide to P4, and the S03 box + divider draw around them (OUT).
import { FONT } from '../../lib/fonts';
import { clamp, ease, lerp, memo, seg } from '../../lib/math';
import { sampleShape } from '../../lib/points';
import { hash01 } from '../../lib/random';
import { BOX, C, P4, P4_R, PA, T } from './constants';
import { Ctx, glow, rgbaHex } from './paint';
import { gasWorldA, k400, SPEED_BUCKET, SPEED_COLS } from './stages';
import { GAS_FRAMES, GAS_N, GAS_R, GAS_SUBSTEPS, gasFingerprint, gasRun, runSpeed } from './sims';
import { SWARM_BAKE } from './swarm400';

// ------------------------------------------------------------------ card 7 layout (line 2 = 藏在“ 很多 ”之中。)
export const C7 = {
  size: 58,
  big: 200,
  tracking: 0.08,
  line1Y: 640, // clear of BOX.y0 = 700: line 1 diffuses upward only (exitUp), away from the box's top edge
  line2Y: 926,
  gap: 16,
};
export interface Card7Layout {
  leftRight: number; // right edge of "藏在“"
  rightLeft: number; // left edge of "”之中。"
  bigCx: number;
  bigCy: number;
}
export function card7Layout(): Card7Layout {
  return memo('S02:c7layout', () => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const tr = C7.size * C7.tracking;
    c.font = `600 ${C7.size}px ${FONT.serif}`;
    const wL = Array.from('藏在“').reduce((a, ch) => a + c.measureText(ch).width + tr, 0);
    const wR = Array.from('”之中。').reduce((a, ch) => a + c.measureText(ch).width + tr, 0) - tr;
    c.font = `900 ${C7.big}px ${FONT.serif}`;
    const wB = c.measureText('很多').width;
    const total = wL + C7.gap + wB + C7.gap + wR;
    const x0 = 540 - total / 2;
    return {
      leftRight: x0 + wL,
      rightLeft: x0 + wL + C7.gap * 2 + wB,
      bigCx: x0 + wL + C7.gap + wB / 2,
      bigCy: C7.line2Y,
    };
  });
}

/** 400 evenly spread target points on the glyphs 很多 (farthest-point subsampling of a dense glyph sample). */
export function manyTargets(): Float32Array {
  return memo('S02:manyTargets', () => {
    const L = card7Layout();
    // sample a small canvas around the word only (a full-frame readback per tab is wasteful)
    const BW = 640;
    const BH = 320;
    const local = sampleShape('S02:many', BW, BH, (g) => {
      g.font = `900 ${C7.big}px ${FONT.serif}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('很多', BW / 2, BH / 2);
    }, { step: 3, jitter: 0.6, shuffle: false, seed: 22 });
    const dense = new Float32Array(local.length);
    for (let i = 0; i < local.length; i += 2) {
      dense[i] = local[i] + L.bigCx - BW / 2;
      dense[i + 1] = local[i + 1] + L.bigCy - BH / 2;
    }
    const m = dense.length / 2;
    const out = new Float32Array(GAS_N * 2);
    const dmin = new Float32Array(m).fill(1e12);
    // start from the left-most point
    let cur = 0;
    for (let i = 1; i < m; i++) if (dense[i * 2] < dense[cur * 2]) cur = i;
    for (let k = 0; k < GAS_N; k++) {
      const cx = dense[cur * 2];
      const cy = dense[cur * 2 + 1];
      out[k * 2] = cx;
      out[k * 2 + 1] = cy;
      let best = -1;
      let bi = 0;
      for (let i = 0; i < m; i++) {
        const dx = dense[i * 2] - cx;
        const dy = dense[i * 2 + 1] - cy;
        const d = dx * dx + dy * dy;
        if (d < dmin[i]) dmin[i] = d;
        if (dmin[i] > best) {
          best = dmin[i];
          bi = i;
        }
      }
      cur = bi;
    }
    return out;
  });
}

interface Plan {
  start: Float32Array; // world positions at launch
  launch: Float32Array; // launch frame per ball
  v0: Float32Array; // gas velocity at launch (px/frame), carried into the flight so the lift-off has no kink
  target: Float32Array; // assigned glyph point per ball
  survivor: Int32Array; // ball index for each P4 point
  isSurvivor: Uint8Array;
  /** gas colour (speed bucket) of each ball at its launch, rgb triplets — the flight blends it to the core white */
  rgb0: Uint8Array;
}
const FLIGHT = 20;
const LAUNCH_SPREAD = 8; // launches T.swarm .. T.swarm + 7
const launchFrame = (i: number) => T.swarm + Math.floor(hash01(i, 777) * LAUNCH_SPREAD);

/** What the swarm takes over from panel A's recorded gas: positions at T.swarm (for the rank matching), each ball's
 * position and velocity on its own launch frame, and its speed bucket (colour) there. */
export interface SwarmInputs {
  p0: Float32Array;
  start: Float32Array;
  v0: Float32Array;
  bucket: Uint8Array;
}
/** Everything the swarm inputs depend on. The baked table (swarm400.ts) is used only while this matches its `sig`. */
export const swarmSig = () =>
  [T.swarm, T.run400, LAUNCH_SPREAD, GAS_N, GAS_FRAMES, GAS_SUBSTEPS, GAS_R, PA.x, PA.y, gasFingerprint()].join('|');
/** The swarm inputs read from the live N = 400 recording (needs ~112 recorded frames of the simulation). */
export function swarmInputsLive(): SwarmInputs {
  const n = GAS_N;
  // the balls are still flying inside panel A while they wait: sample positions at T.swarm
  const p0 = gasWorldA(T.swarm, PA.x, PA.y);
  const start = new Float32Array(n * 2);
  const v0 = new Float32Array(n * 2);
  const bucket = new Uint8Array(n);
  const byLaunch = new Map<number, Float32Array>();
  const run = gasRun(k400('A', T.swarm + LAUNCH_SPREAD) + 1);
  for (let i = 0; i < n; i++) {
    const L = launchFrame(i);
    let p = byLaunch.get(L);
    if (!p) {
      p = gasWorldA(L, PA.x, PA.y);
      byLaunch.set(L, p);
    }
    start[i * 2] = p[i * 2];
    start[i * 2 + 1] = p[i * 2 + 1];
    const kk = Math.round(k400('A', L));
    v0[i * 2] = run.vel[(kk * n + i) * 2];
    v0[i * 2 + 1] = run.vel[(kk * n + i) * 2 + 1];
    bucket[i] = SPEED_BUCKET(runSpeed(run, i, kk));
  }
  return { p0, start, v0, bucket };
}
/** Baked inputs when valid (a render tab showing only the finale then never has to re-simulate the gas), else live. */
function swarmInputs(): SwarmInputs {
  return memo('S02:swarmInputs', () => (SWARM_BAKE.sig === swarmSig() ? SWARM_BAKE : swarmInputsLive()));
}

export function swarmPlan(): Plan {
  return memo('S02:swarmPlan', () => {
    const n = GAS_N;
    const tg = manyTargets();
    const { p0, start, v0, bucket } = swarmInputs();
    const launch = new Float32Array(n);
    for (let i = 0; i < n; i++) launch[i] = launchFrame(i);
    // rank matching: 20 strips by x, each sorted by y -> coherent, non-crossing flow
    const order = (xy: Float32Array) => {
      const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => xy[a * 2] - xy[b * 2] || a - b);
      const out: number[] = [];
      for (let s = 0; s < 20; s++) {
        const strip = idx.slice(s * 20, s * 20 + 20).sort((a, b) => xy[a * 2 + 1] - xy[b * 2 + 1] || a - b);
        out.push(...strip);
      }
      return out;
    };
    const ob = order(p0);
    const ot = order(tg);
    const target = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) {
      target[ob[k] * 2] = tg[ot[k] * 2];
      target[ob[k] * 2 + 1] = tg[ot[k] * 2 + 1];
    }
    const rgb0 = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
      const hex = parseInt(SPEED_COLS[bucket[i]].slice(1), 16);
      rgb0[i * 3] = (hex >> 16) & 255;
      rgb0[i * 3 + 1] = (hex >> 8) & 255;
      rgb0[i * 3 + 2] = hex & 255;
    }
    // survivors: the glyph balls closest to each P4 point (unique)
    const survivor = new Int32Array(4);
    const isSurvivor = new Uint8Array(n);
    P4.forEach(([qx, qy], j) => {
      let best = 1e12;
      let bi = 0;
      for (let i = 0; i < n; i++) {
        if (isSurvivor[i]) continue;
        const d = (target[i * 2] - qx) ** 2 + (target[i * 2 + 1] - qy) ** 2;
        if (d < best) {
          best = d;
          bi = i;
        }
      }
      survivor[j] = bi;
      isSurvivor[bi] = 1;
    });
    return { start, launch, v0, target, survivor, isSurvivor, rgb0 };
  });
}

/** Position, radius and alpha of swarm ball i at frame f (f >= T.swarm). */
function ballState(pl: Plan, i: number, f: number, live: Float32Array | null): [number, number, number, number] {
  const L = pl.launch[i];
  if (f < L) return [live ? live[i * 2] : pl.start[i * 2], live ? live[i * 2 + 1] : pl.start[i * 2 + 1], GAS_R, 1];
  const sx = pl.start[i * 2];
  const sy = pl.start[i * 2 + 1];
  const tx = pl.target[i * 2];
  const ty = pl.target[i * 2 + 1];
  const t = ease.inOutCubic(seg(f, L, L + FLIGHT));
  // bowed path: all bows turn the same way -> a gathering swirl. The control point never rises above 80 px below
  // the chord's midpoint, so the balls drop out of the panel early and the swarm has crossed card 7's line 1
  // (y 640) by f444, before 「时间之箭，」 condenses there
  const mx = (sx + tx) / 2 + (ty - sy) * 0.28;
  const my = Math.max((sy + ty) / 2 - (tx - sx) * 0.28, (sy + ty) / 2 + 80);
  const u = 1 - t;
  // momentum carried over from the gas: d/df = v0 at launch, decays to 0 by landing
  const s0 = f - L;
  const carry = s0 * Math.exp(-s0 / 4) * u;
  let x = u * u * sx + 2 * u * t * mx + t * t * tx + pl.v0[i * 2] * carry;
  let y = u * u * sy + 2 * u * t * my + t * t * ty + pl.v0[i * 2 + 1] * carry;
  let r = lerp(GAS_R, 3.3, t);
  let a = 1;
  // thermal jiggle once landed (still a gas of many)
  const land = seg(f, L + FLIGHT - 4, L + FLIGHT + 6);
  if (land > 0) {
    const ph1 = hash01(i, 31) * 6.28;
    const ph2 = hash01(i, 32) * 6.28;
    x += Math.sin(f * 0.71 + ph1) * 1.1 * land;
    y += Math.cos(f * 0.83 + ph2) * 1.1 * land;
  }
  // the end: many evaporates, four survive (glide 496-512, grow to r = 10 by 514)
  if (pl.isSurvivor[i]) {
    const j = pl.survivor.indexOf(i);
    const k = ease.inOutCubic(seg(f, T.evaporate, T.evaporate + 16));
    x = lerp(x, P4[j][0], k);
    y = lerp(y, P4[j][1], k);
    r = lerp(r, P4_R, ease.inOutQuad(seg(f, T.evaporate + 4, T.evaporate + 18)));
  } else {
    const e0 = T.evaporate + hash01(i, 41) * 6;
    const e = seg(f, e0, e0 + 12);
    if (e > 0) {
      const ang = hash01(i, 42) * 6.28;
      const dist = 14 + 30 * hash01(i, 43);
      x += Math.cos(ang) * dist * ease.outQuad(e);
      y += Math.sin(ang) * dist * ease.outQuad(e) - 10 * e;
      r *= 1 - 0.5 * e;
      a = 1 - ease.inQuad(e);
    }
  }
  return [x, y, r, a];
}

const CORE_RGB: [number, number, number] = [0xe6, 0xfc, 0xff];

export function drawSwarm(ctx: Ctx, f: number, glowLayer: boolean) {
  if (f < T.swarm) return;
  const pl = swarmPlan();
  const n = GAS_N;
  // balls that have not launched yet are still drawn by panel A's gas (world.ts), inside the panel and under the HUD
  if (glowLayer) {
    for (let i = 0; i < n; i++) {
      if (f < pl.launch[i]) continue;
      const [x, y, r, a] = ballState(pl, i, f, null);
      if (a <= 0.01) continue;
      const surv = pl.isSurvivor[i] && f >= T.evaporate;
      glow(ctx, C.cyan, x, y, surv ? r * 3.4 : 12, (surv ? 0.55 : 0.16) * a);
    }
    return;
  }
  // flight trails (same look as the gas trails they continue)
  ctx.strokeStyle = 'rgba(57,225,255,0.3)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (f < pl.launch[i] || f > pl.launch[i] + FLIGHT) continue;
    const [x0, y0] = ballState(pl, i, Math.max(pl.launch[i] - 1.6, f - 2.2), null);
    const [x1, y1] = ballState(pl, i, f, null);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  // balls
  const survivors: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    if (f < pl.launch[i]) continue;
    const [x, y, r, a] = ballState(pl, i, f, null);
    if (a <= 0.01) continue;
    if (pl.isSurvivor[i] && f >= T.evaporate) {
      survivors.push([x, y, r]);
      continue;
    }
    // in flight: the gas colour of the ball (its speed) heats/cools to the core white of the word
    const c = ease.inOutQuad(seg(f, pl.launch[i], pl.launch[i] + FLIGHT));
    const g0 = pl.rgb0.subarray(i * 3, i * 3 + 3);
    // a slow brightness wave travels through the assembled word: still a gas of many
    const landed = seg(f, pl.launch[i] + FLIGHT * 0.6, pl.launch[i] + FLIGHT);
    const wave = 0.5 + 0.5 * Math.sin(x * 0.022 - y * 0.008 - f * 0.22);
    const lit = 1 - landed * 0.28 * (1 - wave);
    const rr = Math.round(lerp(g0[0], CORE_RGB[0], c));
    const gg = Math.round(lerp(g0[1], CORE_RGB[1], c));
    const bb = Math.round(lerp(g0[2], CORE_RGB[2], c));
    ctx.fillStyle = `rgba(${rr},${gg},${bb},${clamp(a * lit).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y, r] of survivors) drawP4Dot(ctx, x, y, r);
}

/** The handoff dot (also drawn on the final frame): cyan disc with a white-hot core. */
export function drawP4Dot(ctx: Ctx, x: number, y: number, r: number) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, C.core);
  gr.addColorStop(0.45, '#9CF1FF');
  gr.addColorStop(1, C.cyan);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** The S03 box closes symmetrically: the top and bottom edges grow out of the centre line (x = 540, where the divider
 * will stand), turn the corners and the sides close at mid-height (y = 900) — the last pixels drawn are the side
 * mid-points, so the box never cuts through the diffusing line 2 of card 7 (y = 926). Then the divider drops. */
const boxK = (f: number) => ease.inOutCubic(seg(f, T.boxDraw, T.outHold - 2));
/** the four quarter strokes: start (top/bottom centre) -> corner -> side mid-point */
function boxQuarters(): Array<Array<[number, number]>> {
  const { x0, y0, x1, y1, divider } = BOX;
  const ym = (y0 + y1) / 2;
  return [
    [[divider, y0], [x0, y0], [x0, ym]],
    [[divider, y0], [x1, y0], [x1, ym]],
    [[divider, y1], [x0, y1], [x0, ym]],
    [[divider, y1], [x1, y1], [x1, ym]],
  ];
}
/** point at arc length L along a polyline (and the total length) */
function along(pts: Array<[number, number]>, L: number): [number, number] {
  let rest = L;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const l = Math.hypot(bx - ax, by - ay);
    if (rest <= l) return [ax + ((bx - ax) * rest) / l, ay + ((by - ay) * rest) / l];
    rest -= l;
  }
  return pts[pts.length - 1];
}
const polyLen = (pts: Array<[number, number]>) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

export function drawBox(ctx: Ctx, f: number) {
  const k = boxK(f);
  if (k <= 0) return;
  const { y0, y1, divider } = BOX;
  ctx.save();
  ctx.strokeStyle = rgbaHex(C.cyan, 0.9);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  for (const q of boxQuarters()) {
    const L = polyLen(q);
    ctx.setLineDash([L * k, L * 2]);
    ctx.beginPath();
    ctx.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const d = ease.inOutCubic(seg(f, T.dividerDraw, T.outHold));
  if (d > 0) {
    ctx.beginPath();
    ctx.moveTo(divider, y0);
    ctx.lineTo(divider, y0 + (y1 - y0) * d);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBoxGlow(ctx: Ctx, f: number) {
  const k = boxK(f);
  if (k <= 0) return;
  // a soft travelling highlight at the four drawing heads (and at the divider's head)
  const fade = 1 - seg(f, T.outHold - 6, T.outHold);
  if (fade <= 0) return;
  for (const q of boxQuarters()) {
    const [hx, hy] = along(q, polyLen(q) * k);
    glow(ctx, C.cyan, hx, hy, 26, 0.5 * fade);
  }
  const d = ease.inOutCubic(seg(f, T.dividerDraw, T.outHold));
  if (d > 0 && d < 1) glow(ctx, C.cyan, BOX.divider, BOX.y0 + (BOX.y1 - BOX.y0) * d, 24, 0.5 * fade);
}

export const swarmLanding = () => {
  const pl = swarmPlan();
  let last = 0;
  for (let i = 0; i < GAS_N; i++) last = Math.max(last, pl.launch[i] + FLIGHT);
  return last;
};
