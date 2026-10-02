// Photons as wave packets. ENERGY = number of crests (E = h·f at equal packet duration):
//   sunlight   0.5 µm  → one tight gold packet with 20 crests
//   infrared  10   µm  → 20 lazy red packets with ONE crest each (λ ×20).
import { clamp, ease, lerp, memo, mixHex, seg, smoothstep } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { Cam, applyWorld } from './camera';
import { EARTH, LANE, LIMB_Y, P, SUN_BOTTOM, limbY } from './palette';
import { sunGeom } from './sky';
import { earthGeom } from './earth';
import { ANN_Y, COL_IN, COL_OUT, ledgerFade } from './ledger';
import { T, unzipAt } from './timing';
import { tintDot } from './textures';
import { FONT } from '../../lib/fonts';
import { worldToScreen } from './camera';

const TAU = Math.PI * 2;

/** Draw one wave packet as a polyline. (x0,y0) = tail, direction (dx,dy) unit, length L. */
export function wave(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  L: number,
  lambda: number,
  amp: number,
  phase: number,
  envPow = 1,
  s0 = 0,
  s1 = 1,
) {
  const nx = -dy;
  const ny = dx;
  const N = Math.max(8, Math.ceil(((s1 - s0) * L) / Math.min(4, lambda / 6)));
  ctx.beginPath();
  for (let k = 0; k <= N; k++) {
    const u = s0 + ((s1 - s0) * k) / N;
    const s = u * L;
    // flat-top envelope with soft ends
    const env = Math.pow(Math.sin(Math.PI * clamp(u)), envPow);
    const off = amp * env * Math.sin((TAU * s) / lambda + phase);
    const x = x0 + dx * s + nx * off;
    const y = y0 + dy * s + ny * off;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Append a wave packet polyline to a Path2D (batched drawing). */
export function wavePath(path: Path2D, x0: number, y0: number, dx: number, dy: number, L: number, lambda: number, amp: number, phase: number, envPow = 1, s0 = 0, s1 = 1) {
  const nx = -dy;
  const ny = dx;
  const N = Math.max(6, Math.ceil(((s1 - s0) * L) / Math.min(4, lambda / 5)));
  for (let k = 0; k <= N; k++) {
    const u = s0 + ((s1 - s0) * k) / N;
    const s = u * L;
    const env = Math.pow(Math.sin(Math.PI * clamp(u)), envPow);
    const off = amp * env * Math.sin((TAU * s) / lambda + phase);
    const x = x0 + dx * s + nx * off;
    const y = y0 + dy * s + ny * off;
    if (k === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
}
/** Append a single-crest wavelet to a Path2D. */
export function waveletPath(path: Path2D, x0: number, y0: number, dx: number, dy: number, L: number, amp: number) {
  const nx = -dy;
  const ny = dx;
  const N = Math.max(10, Math.ceil(L / 7));
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const env = Math.pow(Math.sin(Math.PI * u), 1.3);
    const off = amp * env * Math.cos(TAU * (u - 0.5));
    const x = x0 + dx * u * L + nx * off;
    const y = y0 + dy * u * L + ny * off;
    if (k === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
}

/** A single-crest wavelet (one quantum of the long-wave light): crest in the middle, soft troughs at the ends. */
export function wavelet(ctx: CanvasRenderingContext2D, x0: number, y0: number, dx: number, dy: number, L: number, amp: number) {
  const nx = -dy;
  const ny = dx;
  const N = Math.max(10, Math.ceil(L / 5));
  ctx.beginPath();
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const env = Math.pow(Math.sin(Math.PI * u), 1.3);
    const off = amp * env * Math.cos(TAU * (u - 0.5));
    const x = x0 + dx * u * L + nx * off;
    const y = y0 + dy * u * L + ny * off;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** crest-bead position of a wavelet (the "one unit of energy" marker) */
export const waveletCrest = (x0: number, y0: number, dx: number, dy: number, L: number, amp: number): [number, number] => [x0 + dx * L * 0.5 - dy * amp, y0 + dy * L * 0.5 + dx * amp];

function bead(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sprite: HTMLCanvasElement, core: string) {
  const R = r * 3.4;
  ctx.drawImage(sprite, x - R, y - R, 2 * R, 2 * R);
  ctx.fillStyle = core;
  ctx.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
}

// ---------------------------------------------------------------- ambient streams (beat 1, beat 5)
interface Drop {
  x: number;
  ph: number;
  sp: number;
  len: number;
}
const goldRain = () =>
  memo('s06:goldRain', () => {
    const r = mulberry32(11);
    const out: Drop[] = [];
    for (let i = 0; i < 34; i++) out.push({ x: 150 + r() * 340, ph: r(), sp: 24 + r() * 10, len: 70 + r() * 50 });
    return out;
  });
interface Rise {
  x: number;
  ph: number;
  ang: number;
  sp: number;
}
const redRise = () =>
  memo('s06:redRise', () => {
    const r = mulberry32(12);
    const out: Rise[] = [];
    for (let i = 0; i < 46; i++) out.push({ x: 590 + r() * 400, ph: r(), ang: 0.05 + r() * 0.55, sp: 6 + r() * 4 });
    return out;
  });

/** Ledger glyph areas (收/还 heads, the IN/OUT readings, W/m², the category tiles): the streams dim to 22 % in here so
 *  the numerals stay clean (world ≈ screen while the streams run: the camera push is ≤ 0.3 % before f122). */
const LEDGER_HOLES: Array<[number, number, number, number]> = [
  [270, 262, 390, 366],
  [690, 262, 810, 366],
  [196, 538, 464, 692],
  [616, 538, 884, 692],
  [436, 446, 644, 566],
];
const holes = () =>
  memo('s06:ledgerHoles', () => {
    const inside = new Path2D();
    for (const [x0, y0, x1, y1] of LEDGER_HOLES) inside.rect(x0, y0, x1 - x0, y1 - y0);
    const outside = new Path2D();
    outside.rect(-4000, -4000, 9000, 9000);
    outside.addPath(inside);
    return { inside, outside };
  });
/** draw `fn` at full strength outside the ledger glyph areas and at `k` inside them */
function masked(ctx: CanvasRenderingContext2D, k: number, fn: () => void) {
  const H = holes();
  ctx.save();
  ctx.clip(H.outside, 'evenodd');
  fn();
  ctx.restore();
  ctx.save();
  ctx.clip(H.inside);
  ctx.globalAlpha *= k;
  fn();
  ctx.restore();
}

/** Beat-1 ledger streams: gold short-wave rain (left / IN), red long-wave rising (right / OUT). */
export function drawStreams(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glow = false) {
  const on = Math.min(seg(frame, T.ledgerIn - 4, T.ledgerIn + 26), 1 - seg(frame, T.streamsDim - 8, T.streamsDim + 16));
  if (on <= 0.001) return;
  const sun = sunGeom(frame);
  const earth = earthGeom(frame);
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  // gold rain (parallel, one direction)
  const top = sun.cy + sun.r - 10;
  const G = goldRain();
  const gp = new Path2D();
  const heads = new Path2D();
  for (let i = 0; i < G.length; i++) {
    const d = G[i];
    const bottom = earth.cy - Math.sqrt(Math.max(0, earth.r * earth.r - (d.x - earth.cx) ** 2));
    const span = bottom - top + d.len;
    const yh = top + ((frame * d.sp + d.ph * span) % span);
    const s0 = clamp((top - (yh - d.len)) / d.len);
    const s1 = clamp((bottom - (yh - d.len)) / d.len);
    if (s1 <= s0) continue;
    wavePath(gp, d.x, yh - d.len, 0, 1, d.len, 8, 2.6, frame * 1.7 + i, 0.5, s0, s1);
    if (yh < bottom) heads.rect(d.x - 1.5, yh - 1.5, 3, 3);
  }
  ctx.strokeStyle = glow ? `rgba(255,201,74,${0.5 * on})` : `rgba(255,222,140,${0.75 * on})`;
  ctx.lineWidth = glow ? 5 : 1.2;
  ctx.fillStyle = `rgba(255,247,224,${0.9 * on})`;
  masked(ctx, 0.22, () => {
    ctx.stroke(gp);
    if (!glow) ctx.fill(heads);
  });
  // red rising (every direction-ish, lazy long waves), bucketed by fade
  const R = redRise();
  const rp = [new Path2D(), new Path2D(), new Path2D()];
  for (let i = 0; i < R.length; i++) {
    const d = R[i];
    const y0 = limbY(d.x) + (earth.cy - EARTH.cy);
    const travel = 900;
    const t = (frame * d.sp + d.ph * travel) % travel;
    const dx = Math.sin(d.ang);
    const dy = -Math.cos(d.ang);
    const fade = Math.min(clamp(t / 80), 1 - clamp((t - 450) / 450));
    if (fade <= 0.05) continue;
    waveletPath(rp[Math.min(2, Math.floor(fade * 3))], d.x + dx * t, y0 + dy * t, dx, dy, 150, 7);
  }
  masked(ctx, 0.22, () => {
    for (let b = 0; b < 3; b++) {
      const f = (b + 0.5) / 3;
      ctx.strokeStyle = glow ? `rgba(255,59,47,${0.4 * on * f})` : `rgba(255,90,70,${0.6 * on * f})`;
      ctx.lineWidth = glow ? 7 : 1.5;
      ctx.stroke(rp[b]);
    }
  });
  ctx.restore();
}

// ---------------------------------------------------------------- the hero photon (beat 3)
export const HERO = { x: 540, crests: 20, lambda: 11, amp: 10, redL: 210, redAmp: 15 } as const;
const HERO_L = HERO.crests * HERO.lambda; // 220

/** emission order → angle (rad from vertical, + = right). Jittered fan over ±76°, shuffled order. */
export const fanAngles = () =>
  memo('s06:fan', () => {
    const r = mulberry32(2020);
    const slots = Array.from({ length: 20 }, (_, i) => i);
    slots.sort((a, b) => Math.abs(a - 9.5) + r() * 7 - (Math.abs(b - 9.5) + r() * 7));
    return slots.map((s) => ((-76 + (152 * (s + 0.5 + (hash01(s, 9) - 0.5) * 0.5)) / 20) * Math.PI) / 180);
  });

/** head y of the descending gold packet */
export function heroHead(frame: number) {
  const p = seg(frame, T.photonEmit, T.photonLand);
  // fast, then a slow-motion arrival
  return lerp(SUN_BOTTOM - 20, LIMB_Y - 2, ease.outSine(p));
}

/** number of crests already consumed by the surface (continuous) */
export const consumed = (frame: number) => clamp((frame - T.unzip0 + 1) / T.unzipStep, 0, HERO.crests);

export interface RedPacket {
  x: number; // tail (towards the impact)
  y: number;
  dx: number;
  dy: number;
  m: number; // morph 0..1 (gold crest → red packet)
  a: number; // alpha
  i: number;
}

/** State of red packet i (emission order) at a frame, or null if not born. */
export function redPacket(i: number, frame: number): RedPacket | null {
  const t0 = unzipAt(i);
  const tau = frame - t0;
  if (tau < 0) return null;
  const ang = fanAngles()[i];
  const dx = Math.sin(ang);
  const dy = -Math.cos(ang);
  const m = ease.inOutCubic(clamp(tau / 10));
  // launches fast, then drifts on slowly (a slow-motion "ledger" view of the fan)
  const D = 200 + 330 * hash01(i, 5);
  const dist = 6 + D * (1 - Math.exp(-tau / 15)) + 1.4 * tau;
  const fade = 1 - seg(frame, T.ghostEnd - 8 + (i % 5) * 5, T.ghostEnd + 24 + (i % 5) * 6);
  // dim as they rise into the ledger rows
  const farY = LIMB_Y - 4 + dy * (dist + HERO.redL);
  const a = fade * (0.16 + 0.84 * clamp((farY - 820) / 280));
  return { x: HERO.x + dx * dist, y: LIMB_Y - 4 + dy * dist, dx, dy, m, a, i };
}

/** Draw the hero gold packet (descending / parked & being consumed), with one bead per crest. */
export function drawHero(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glow = false) {
  if (frame < T.photonEmit - 2 || frame > unzipAt(19) + 14) return;
  const c = consumed(frame);
  if (c >= HERO.crests) return;
  const head = heroHead(frame);
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const tailY = head - HERO_L + c * HERO.lambda;
  const L = head - tailY;
  const sun = sunGeom(frame);
  const visTop = sun.cy + sun.r - 4;
  const s0 = clamp((visTop - tailY) / L);
  // phase locked so that crests sit at fixed positions along the packet (the beads count them)
  const ph = 0;
  if (glow) {
    ctx.strokeStyle = 'rgba(255,201,74,0.9)';
    ctx.lineWidth = 16;
    wave(ctx, HERO.x, tailY, 0, 1, L, HERO.lambda, HERO.amp, ph, 0.25, s0, 1);
  } else {
    // faint ray (the single direction it came from)
    ctx.strokeStyle = 'rgba(255,201,74,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(HERO.x, visTop);
    ctx.lineTo(HERO.x, head);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,201,74,0.55)';
    ctx.lineWidth = 5;
    wave(ctx, HERO.x, tailY, 0, 1, L, HERO.lambda, HERO.amp, ph, 0.25, s0, 1);
    ctx.strokeStyle = '#FFF4D6';
    ctx.lineWidth = 1.6;
    wave(ctx, HERO.x, tailY, 0, 1, L, HERO.lambda, HERO.amp, ph, 0.25, s0, 1);
    // crest beads (positive crests of sin(2πs/λ) at s = (k + 1/4)λ, measured from the tail)
    const n = HERO.crests - Math.floor(c);
    for (let k = 0; k < n; k++) {
      const s = (k + 0.25) * HERO.lambda;
      const y = tailY + s;
      if (y < visTop) continue;
      bead(ctx, HERO.x - HERO.amp * 0.98, y, 1.8, tintDot('255,214,120'), '#FFFFFF');
    }
    // bright leading point
    const hg = ctx.createRadialGradient(HERO.x, head, 0, HERO.x, head, 34);
    hg.addColorStop(0, 'rgba(255,247,224,0.9)');
    hg.addColorStop(1, 'rgba(255,201,74,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(HERO.x - 34, head - 34, 68, 68);
  }
  ctx.restore();
}

/** Draw the 20 red packets (each a single crest peeled off the gold packet). */
export function drawRed(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glow = false) {
  if (frame < T.unzip0 || frame > T.ghostEnd + 60) return;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < HERO.crests; i++) {
    const p = redPacket(i, frame);
    if (!p || p.a <= 0.002) continue;
    // morph: crest length λg → redL, amplitude 10 → 15, colour gold → red
    const L = lerp(HERO.lambda * 1.6, HERO.redL, p.m);
    const A = lerp(HERO.amp, HERO.redAmp, p.m);
    const col = p.m < 0.5 ? mixHex(P.gold, P.irHot, p.m * 2) : mixHex(P.irHot, P.ir, (p.m - 0.5) * 2);
    // the crest pivots from the packet's axis to its own direction
    const ddx = lerp(0, p.dx, p.m);
    const ddy = lerp(-1, p.dy, p.m);
    const n = Math.hypot(ddx, ddy) || 1;
    const dx = ddx / n;
    const dy = ddy / n;
    if (glow) {
      ctx.globalAlpha = p.a;
      ctx.strokeStyle = col;
      ctx.lineWidth = 14;
      wavelet(ctx, p.x, p.y, dx, dy, L, A);
    } else {
      // the ray it travels on
      ctx.globalAlpha = p.a * 0.22 * p.m;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(HERO.x + dx * 18, LIMB_Y - 4 + dy * 18);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalAlpha = p.a * 0.45;
      ctx.lineWidth = 5;
      wavelet(ctx, p.x, p.y, dx, dy, L, A);
      ctx.globalAlpha = p.a;
      ctx.strokeStyle = mixHex('#FFE0C8', col, 0.3 + 0.6 * p.m);
      ctx.lineWidth = 1.8;
      wavelet(ctx, p.x, p.y, dx, dy, L, A);
      const [bx, by] = waveletCrest(p.x, p.y, dx, dy, L, A);
      bead(ctx, bx, by, 2.4, tintDot('255,80,60'), '#FFE6DC');
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Impact flash on the limb when the gold photon lands + a pulse per peeled crest. */
export function drawImpact(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  const t = frame - T.photonLand;
  if (t < -2 || t > 120) return;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const k = Math.exp(-Math.max(0, t) / 14) * clamp((t + 2) / 2);
  const R = 40 + 260 * ease.outCubic(clamp(t / 30));
  // the flash lives above the limb (the narration lane below it stays calm)
  ctx.beginPath();
  ctx.rect(-2000, -4000, 6000, LIMB_Y + 26 + 4000);
  ctx.clip();
  const g = ctx.createRadialGradient(HERO.x, LIMB_Y, 0, HERO.x, LIMB_Y, R);
  g.addColorStop(0, `rgba(255,236,190,${0.8 * k})`);
  g.addColorStop(0.3, `rgba(255,160,80,${0.35 * k})`);
  g.addColorStop(1, 'rgba(255,59,47,0)');
  ctx.fillStyle = g;
  ctx.fillRect(HERO.x - R, LIMB_Y - R, 2 * R, 2 * R);
  // limb light-up travelling along the atmosphere
  const spread = 600 * ease.outCubic(clamp(t / 50));
  const la = 0.5 * Math.exp(-Math.max(0, t) / 30);
  const lg = ctx.createLinearGradient(HERO.x - spread, 0, HERO.x + spread, 0);
  lg.addColorStop(0, 'rgba(255,90,60,0)');
  lg.addColorStop(0.5, `rgba(255,150,90,${la})`);
  lg.addColorStop(1, 'rgba(255,90,60,0)');
  ctx.strokeStyle = lg;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = HERO.x - spread; x <= HERO.x + spread; x += 8) {
    const y = limbY(x) - 2;
    if (x === HERO.x - spread) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // per-crest emission pulses
  for (let i = 0; i < HERO.crests; i++) {
    const tt = frame - unzipAt(i);
    if (tt < 0 || tt > 10) continue;
    const kk = 1 - tt / 10;
    const rr = 10 + tt * 5;
    const pg = ctx.createRadialGradient(HERO.x, LIMB_Y - 4, 0, HERO.x, LIMB_Y - 4, rr);
    pg.addColorStop(0, `rgba(255,220,170,${0.7 * kk})`);
    pg.addColorStop(1, 'rgba(255,80,50,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(HERO.x - rr, LIMB_Y - 4 - rr, 2 * rr, 2 * rr);
  }
  ctx.restore();
}

/** Beat 4: all the other ways out (S03's counting, in this scene's own glyph). The same 20 one-crest wavelets, dimmed,
 *  in re-shuffled arrangements around the impact point — each held 6 frames with a soft cross-fade (≤ 2 on screen):
 *  the same energy, the same 20 photons, another arrangement… and another. */
const GHOST_HOLD = 6;
export function drawGhostFans(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  const on = Math.min(seg(frame, T.ghostStart, T.ghostStart + 14), 1 - seg(frame, T.ghostEnd - 24, T.ghostEnd));
  if (on <= 0) return;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const ox = HERO.x;
  const oy = LIMB_Y - 4;
  const t = frame - T.ghostStart;
  const cur = Math.floor(t / GHOST_HOLD);
  for (let id = cur - 1; id <= cur; id++) {
    if (id < 0) continue;
    // trapezoid weight: in over 3 frames, hold, out over 3 frames (overlapping the next one)
    const a0 = id * GHOST_HOLD;
    const w = Math.min(clamp((t - a0 + 1) / 3), 1 - clamp((t - a0 - GHOST_HOLD + 1) / 3));
    if (w <= 0.01) continue;
    const a = on * w;
    const P = new Path2D();
    const B = new Path2D();
    // a fresh permutation of the 20 fan slots
    const slots = Array.from({ length: 20 }, (_, i) => i);
    for (let i = 19; i > 0; i--) {
      const j = Math.floor(hash01(id * 37 + i, 77) * (i + 1));
      const tmp = slots[i];
      slots[i] = slots[j];
      slots[j] = tmp;
    }
    for (let i = 0; i < 20; i++) {
      const sl = slots[i] + 0.5 + (hash01(id * 20 + i, 79) - 0.5) * 0.8;
      const ang = ((-80 + (160 * sl) / 20) * Math.PI) / 180;
      const dx = Math.sin(ang);
      const dy = -Math.cos(ang);
      const d = 150 + 430 * Math.sqrt(hash01(id * 20 + i, 78));
      const x0 = ox + dx * d;
      const y0 = oy + dy * d;
      waveletPath(P, x0, y0, dx, dy, HERO.redL, HERO.redAmp);
      const [bx, by] = waveletCrest(x0, y0, dx, dy, HERO.redL, HERO.redAmp);
      B.rect(bx - 1.6, by - 1.6, 3.2, 3.2);
    }
    ctx.strokeStyle = `rgba(255,70,52,${(0.26 * a).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke(P);
    ctx.fillStyle = `rgba(255,170,150,${(0.4 * a).toFixed(3)})`;
    ctx.fill(B);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- B5: one direction in, all directions out
// The Sun's light arrives as a PARALLEL beam (it subtends 0.5°: one direction). Every gold packet (8 crests, λ 8 px)
// that lands on the limb bursts into 8 one-crest red wavelets (λ ×20 ≈ 160 px — B3's bookkeeping: energy = crests)
// that leave over the whole hemisphere (Lambertian: sin φ uniform), travel to the top and the sides of the frame and
// thin out with distance: the same energy, spread over every direction.
const BEAM_N = 30;
const BEAM_V = 30; // px/frame
const BEAM_L = 64; // 8 crests × λ 8
const BEAM_TOP = SUN_BOTTOM - 6;
const beamX = (i: number) => 130 + (820 * (i + 0.5)) / BEAM_N;
export const beamOn = (frame: number) => Math.min(ease.inOutQuad(seg(frame, T.beamIn, T.beamIn + 30)), 1 - seg(frame, T.diveStart + 6, T.diveStart + 34));

/** Beat 5: the ordered beam — parallel rays from one direction (low entropy: concentrated, all aligned). */
export function drawBeam(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glow = false) {
  const on = beamOn(frame);
  if (on <= 0) return;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const rays = new Path2D();
  const packets = new Path2D();
  const heads = new Path2D();
  for (let i = 0; i < BEAM_N; i++) {
    const x = beamX(i);
    const bottom = limbY(x) - 2;
    const span = bottom - BEAM_TOP;
    rays.moveTo(x, BEAM_TOP);
    rays.lineTo(x, bottom);
    const L = BEAM_L;
    for (let k = 0; k < 2; k++) {
      const yh = BEAM_TOP + ((frame * BEAM_V + (hash01(i, 3) + k * 0.5) * (span + L)) % (span + L));
      const s0 = clamp((BEAM_TOP - (yh - L)) / L);
      const s1 = clamp((bottom - (yh - L)) / L);
      if (s1 <= s0) continue;
      wavePath(packets, x, yh - L, 0, 1, L, 8, 3, 0, 0.5, s0, s1);
      if (yh < bottom) heads.rect(x - 1.5, yh - 1.5, 3, 3);
    }
  }
  if (!glow) {
    const g = ctx.createLinearGradient(0, BEAM_TOP, 0, LIMB_Y);
    g.addColorStop(0, `rgba(255,214,140,${0.16 * on})`);
    g.addColorStop(1, `rgba(255,201,74,${0.07 * on})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.stroke(rays);
  }
  ctx.strokeStyle = glow ? `rgba(255,201,74,${0.5 * on})` : `rgba(255,226,150,${0.8 * on})`;
  ctx.lineWidth = glow ? 5 : 1.3;
  ctx.stroke(packets);
  if (!glow) {
    ctx.fillStyle = `rgba(255,247,224,${0.9 * on})`;
    ctx.fill(heads);
  }
  ctx.restore();
}

const IR_LIFE = 112;
const IR_M = 8;
/** fraction of the landed packets whose re-emission we draw (the rest leave unseen: keeps every fan legible) */
const IR_SHOW = 0.16;
/** how much the sky has filled with infrared (B5) */
export const irFill = (frame: number) => ease.inOutSine(seg(frame, T.irStart + 10, T.irStart + 90)) * (1 - seg(frame, T.diveStart + 4, T.diveStart + 40));

/** The red fans: a landed beam packet → 8 wavelets over the whole hemisphere (closed form in t). */
export function drawIR(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glow = false) {
  if (frame < T.irStart || frame > T.diveStart + 40 + IR_LIFE) return;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const NBK = 4;
  const W: Path2D[] = Array.from({ length: NBK }, () => new Path2D());
  const beads = new Path2D();
  const flashes = new Path2D();
  // the dive leaves the fans behind (they would fly at the camera ×36 magnified)
  const diveOut = 1 - ease.inOutSine(seg(frame, T.diveStart - 2, T.diveStart + 26));
  if (diveOut <= 0.01) {
    ctx.restore();
    return;
  }
  for (let i = 0; i < BEAM_N; i++) {
    const x = beamX(i);
    const bottom = limbY(x) - 2;
    const span = bottom - BEAM_TOP;
    const Ps = span + BEAM_L;
    const nx = (x - EARTH.cx) / EARTH.r;
    const nrmA = Math.atan2(-Math.sqrt(Math.max(0, 1 - nx * nx)), nx); // outward normal angle (screen)
    for (let k = 0; k < 2; k++) {
      // landing n of packet k: frame·V + (h + k/2)·Ps ≡ span (mod Ps)
      const ph = (hash01(i, 3) + k * 0.5) * Ps;
      const nMax = Math.floor((frame * BEAM_V + ph - span) / Ps);
      for (let n = nMax; n > nMax - 5; n--) {
        const tl = (span - ph + n * Ps) / BEAM_V; // landing frame (head reaches the limb)
        const age = frame - tl;
        if (age < 0 || age > IR_LIFE) continue;
        const seed = i * 7919 + k * 104729 + n * 31337;
        if (hash01(seed, 500) > IR_SHOW) continue;
        const on = beamOn(tl) * seg(tl, T.irStart, T.irStart + 8);
        if (on <= 0.02) continue;
        if (age < 6 && !glow) {
          const fk = 1 - age / 6;
          flashes.rect(x - 3 * fk - 0.6, bottom - 3 * fk - 0.6, 6 * fk + 1.2, 6 * fk + 1.2);
        }
        const life = IR_LIFE * (0.8 + 0.2 * hash01(seed, 505));
        if (age > life) continue;
        const fade = 0.85 * (1 - smoothstep(0.62 * life, life, age));
        // one burst = an expanding HALF-RING of 8 quanta (same speed, evenly spread over ±85°, slightly turned):
        // its circumference grows, its count does not — the same energy, ever thinner, in every direction
        const vB = 6.4 + 3.2 * hash01(seed, 506);
        const turn = (hash01(seed, 507) - 0.5) * 0.35;
        for (let m = 0; m < IR_M; m++) {
          const u = hash01(seed + m, 501);
          const phi = ((-85 + (170 * (m + 0.5 + (u - 0.5) * 0.35)) / IR_M) * Math.PI) / 180 + turn;
          const ang = nrmA + phi;
          const dx = Math.cos(ang);
          const dy = Math.sin(ang);
          const v = vB * (0.96 + 0.08 * hash01(seed + m, 502));
          const L = 130 + 60 * hash01(seed + m, 503);
          const amp = 7 + 4 * hash01(seed + m, 504);
          const d = v * age; // head distance
          const tail = d - L;
          const s0 = tail < 0 ? -tail / L : 0;
          if (s0 >= 0.97) continue;
          // the same energy spread over ever more sky: the ring's quanta drift apart (dilution = spacing), each
          // stays visible to the frame edges; the crowded first ~120 px at the limb are softened
          let a = on * fade * (0.35 + 0.65 * smoothstep(0, 140, d)) * clamp(d / 40) * (0.78 + 0.22 / (1 + d / 380));
          const cym = bottom + dy * (tail + L * 0.5);
          if (cym > LANE.y0 - 40 && cym < LANE.y1 + 40) a *= 0.25; // keep the narration lane calm
          a *= diveOut;
          if (a < 0.03) continue;
          const b = Math.min(NBK - 1, Math.floor(a * NBK));
          wletPath(W[b], x + dx * tail, bottom + dy * tail, dx, dy, L, amp, s0);
          if (!glow && s0 < 0.5 && a > 0.15) {
            const cxm = x + dx * (tail + L * 0.5);
            const bx = cxm - dy * amp;
            const by = cym + dx * amp;
            beads.rect(bx - 1.4, by - 1.4, 2.8, 2.8);
          }
        }
      }
    }
  }
  for (let b = 0; b < NBK; b++) {
    const a = (b + 0.5) / NBK;
    ctx.strokeStyle = glow ? `rgba(255,59,47,${(0.42 * a).toFixed(3)})` : `rgba(255,96,72,${(0.8 * a).toFixed(3)})`;
    ctx.lineWidth = glow ? 6 : 1.5;
    ctx.stroke(W[b]);
  }
  if (!glow) {
    ctx.fillStyle = 'rgba(255,214,196,0.85)';
    ctx.fill(beads);
    ctx.fillStyle = 'rgba(255,236,190,0.9)';
    ctx.fill(flashes);
  }
  ctx.restore();
}

/** single-crest wavelet path from s0 (fraction of its length already emerged) to its head */
function wletPath(path: Path2D, x0: number, y0: number, dx: number, dy: number, L: number, amp: number, s0: number) {
  const nx = -dy;
  const ny = dx;
  const N = Math.max(6, Math.ceil(((1 - s0) * L) / 8));
  for (let k = 0; k <= N; k++) {
    const u = s0 + ((1 - s0) * k) / N;
    const env = Math.pow(Math.sin(Math.PI * u), 1.3);
    const off = amp * env * Math.cos(TAU * (u - 0.5));
    const x = x0 + dx * u * L + nx * off;
    const y = y0 + dy * u * L + ny * off;
    if (k === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
}

// ---------------------------------------------------------------- labels: ride the photons, then pin into the ledger
// 阳光 · 0.5 µm rides the falling gold packet, 红外 · 10 µm one outgoing red packet; both then glide into the ledger
// under their counters (IN 1 | OUT 20) with λ ×20 between them, and stay until the ledger leaves (f306).
export const LABEL_FONTS: Array<[string, string]> = [
  [`400 26px ${FONT.mono}`, '·0.5µm10 λ×20'],
  [`600 30px ${FONT.serif}`, '阳光红外'],
];
export const labelsOn = (f: number) => f >= T.photonEmit && f < T.ledgerOut + 28;

/** the red packet that carries the 红外 label: the one heading closest to 55° right */
const labelPick = () =>
  memo('s06:labelPick', () => {
    const A = fanAngles();
    let best = 0;
    for (let i = 0; i < 8; i++) if (Math.abs(A[i] - 0.96) < Math.abs(A[best] - 0.96)) best = i;
    return best;
  });

function tagWidth(ctx: CanvasRenderingContext2D, cn: string, rest: string) {
  ctx.save();
  ctx.font = `600 30px ${FONT.serif}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '2px';
  const w1 = ctx.measureText(cn).width;
  ctx.font = `400 26px ${FONT.mono}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '2px';
  const w2 = ctx.measureText(rest).width;
  ctx.restore();
  return { w1, w2, W: w1 + 10 + w2 };
}

/** a tag centred at (x, y) */
function tag(ctx: CanvasRenderingContext2D, x: number, y: number, cn: string, rest: string, color: string, glow: string, a: number) {
  const { w1, W } = tagWidth(ctx, cn, rest);
  const x0 = x - W / 2;
  ctx.save();
  ctx.globalAlpha = a;
  // dark pill so the tag stays legible over the photons and the ledger
  ctx.fillStyle = 'rgba(4,5,11,0.85)';
  ctx.beginPath();
  ctx.roundRect(x0 - 15, y - 24, W + 30, 48, 24);
  ctx.fill();
  ctx.strokeStyle = glow.replace(/[\d.]+\)$/, '0.35)');
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 30px ${FONT.serif}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '2px';
  ctx.fillText(cn, x0, y + 1);
  ctx.font = `400 26px ${FONT.mono}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '2px';
  ctx.fillText(rest, x0 + w1 + 10, y + 1);
  ctx.restore();
}

const glide = (a: [number, number], b: [number, number], t: number): [number, number] => {
  const e = ease.inOutCubic(clamp(t));
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e)];
};

export function drawPhotonLabels(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  if (!labelsOn(frame)) return;
  const lf = ledgerFade(frame);
  if (lf.vis <= 0.01) return;
  // 阳光 · 0.5 µm: rides the packet's tail, waits by the impact, glides under the IN counter
  const aIn = seg(frame, T.photonEmit + 2, T.photonEmit + 8) * lf.vis;
  if (aIn > 0.01) {
    const hy = Math.min(heroHead(frame), LIMB_Y - 2);
    const ride = worldToScreen(cam, HERO.x + 150, hy - 150);
    const [x, y] = glide(ride, [COL_IN, ANN_Y], seg(frame, T.photonLand + 8, T.photonLand + 34));
    tag(ctx, x, y + lf.dy, '阳光', '· 0.5 µm', P.gold, 'rgba(255,201,74,0.6)', aIn);
  }
  // 红外 · 10 µm: rides one red packet, then glides under the OUT counter
  const pick = labelPick();
  const rp = redPacket(pick, frame);
  const aOut = rp ? seg(frame, unzipAt(pick) + 8, unzipAt(pick) + 14) * lf.vis : 0;
  if (rp && aOut > 0.01) {
    const mid = HERO.redL * 0.5;
    const [px, py] = worldToScreen(cam, rp.x + rp.dx * mid, rp.y + rp.dy * mid);
    const ride: [number, number] = [Math.min(px + 120, 860), py - 40];
    const [x, y] = glide(ride, [COL_OUT, ANN_Y], seg(frame, unzipAt(pick) + 22, unzipAt(19) + 12));
    tag(ctx, x, y + lf.dy, '红外', '· 10 µm', '#FF6A55', 'rgba(255,59,47,0.6)', aOut);
  }
  // λ ×20 between them: the wavelength ratio (= the photon ratio at equal energy)
  const aL = seg(frame, unzipAt(19) + 14, unzipAt(19) + 24) * lf.vis;
  if (aL > 0.01) {
    ctx.save();
    ctx.globalAlpha = aL;
    ctx.font = `400 26px ${FONT.mono}`;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = '3px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(243,239,230,0.9)';
    ctx.shadowColor = 'rgba(243,239,230,0.5)';
    ctx.shadowBlur = 8;
    ctx.fillText('λ ×20', 540, ANN_Y + 1 + lf.dy);
    ctx.restore();
  }
}
