// Photons as wave packets. ENERGY = number of crests (E = h·f at equal packet duration):
//   sunlight   0.5 µm  → one tight gold packet with 20 crests
//   infrared  10   µm  → 20 lazy red packets with ONE crest each (λ ×20).
import { clamp, ease, lerp, memo, mixHex, seg } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { Cam, applyWorld } from './camera';
import { EARTH, LIMB_Y, P, SUN_BOTTOM, limbY } from './palette';
import { earthGeom, sunGeom } from './sky';
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
  ctx.stroke(gp);
  if (!glow) {
    ctx.fillStyle = `rgba(255,247,224,${0.9 * on})`;
    ctx.fill(heads);
  }
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
  for (let b = 0; b < 3; b++) {
    const f = (b + 0.5) / 3;
    ctx.strokeStyle = glow ? `rgba(255,59,47,${0.4 * on * f})` : `rgba(255,90,70,${0.6 * on * f})`;
    ctx.lineWidth = glow ? 7 : 1.5;
    ctx.stroke(rp[b]);
  }
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

/** Beat 4: ghost fans — all the other ways the 20 photons could have left (counting arrangements). */
export function drawGhostFans(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  const on = Math.min(seg(frame, T.ghostStart, T.ghostStart + 14), 1 - seg(frame, T.ghostEnd - 24, T.ghostEnd));
  if (on <= 0) return;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const period = 2;
  const cur = Math.floor(frame / period);
  const ox = HERO.x;
  const oy = LIMB_Y - 4;
  for (let g = 0; g < 5; g++) {
    const id = cur - g;
    const age = (frame - id * period) / (period * 5);
    const a = on * (1 - age);
    if (a <= 0) continue;
    const rays = new Path2D();
    const dots = new Path2D();
    for (let i = 0; i < 20; i++) {
      const ang = (hash01(id * 20 + i, 77) - 0.5) * 2 * 1.33;
      const L = 200 + 520 * Math.sqrt(hash01(id * 20 + i, 78));
      const x = ox + Math.sin(ang) * L;
      const y = oy - Math.cos(ang) * L;
      rays.moveTo(ox + Math.sin(ang) * 24, oy - Math.cos(ang) * 24);
      rays.lineTo(x, y);
      dots.moveTo(x + 3.2, y);
      dots.arc(x, y, 3.2, 0, TAU);
    }
    ctx.strokeStyle = `rgba(255,70,55,${a * 0.24})`;
    ctx.lineWidth = 1;
    ctx.stroke(rays);
    ctx.fillStyle = `rgba(255,150,120,${a * 0.8})`;
    ctx.fill(dots);
  }
  ctx.restore();
}

/** Beat 5: the ordered beam — parallel rays from one direction (low entropy: concentrated, all aligned). */
export function drawBeam(ctx: CanvasRenderingContext2D, frame: number, cam: Cam, glow = false) {
  const on = Math.min(ease.inOutQuad(seg(frame, T.beamIn, T.beamIn + 30)), 1 - seg(frame, T.diveStart + 6, T.diveStart + 34));
  if (on <= 0) return;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  const N = 30;
  const top = SUN_BOTTOM - 6;
  const rays = new Path2D();
  const packets = new Path2D();
  const heads = new Path2D();
  for (let i = 0; i < N; i++) {
    const x = 130 + (820 * (i + 0.5)) / N;
    const bottom = limbY(x) - 2;
    const span = bottom - top;
    rays.moveTo(x, top);
    rays.lineTo(x, bottom);
    const L = 70;
    for (let k = 0; k < 2; k++) {
      const yh = top + ((frame * 30 + (hash01(i, 3) + k * 0.5) * (span + L)) % (span + L));
      const s0 = clamp((top - (yh - L)) / L);
      const s1 = clamp((bottom - (yh - L)) / L);
      if (s1 <= s0) continue;
      wavePath(packets, x, yh - L, 0, 1, L, 8, 3, 0, 0.5, s0, s1);
      if (yh < bottom) heads.rect(x - 1.5, yh - 1.5, 3, 3);
    }
  }
  if (!glow) {
    const g = ctx.createLinearGradient(0, top, 0, LIMB_Y);
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

// ---------------------------------------------------------------- labels riding on the photons (canvas text)
export const LABEL_FONTS: Array<[string, string]> = [
  [`400 22px ${FONT.mono}`, '·0.5µm10 '],
  [`600 24px ${FONT.serif}`, '阳光红外'],
];
export const labelsOn = (f: number) => f >= T.photonEmit && f < T.ghostEnd - 40;

/** the red packet that carries the 红外 label: the one heading closest to 55° right */
const labelPick = () =>
  memo('s06:labelPick', () => {
    const A = fanAngles();
    let best = 0;
    for (let i = 0; i < 8; i++) if (Math.abs(A[i] - 0.96) < Math.abs(A[best] - 0.96)) best = i;
    return best;
  });

function tag(ctx: CanvasRenderingContext2D, x: number, y: number, cn: string, rest: string, color: string, glow: string, a: number, align: 'left' | 'right') {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `600 24px ${FONT.serif}`;
  const w1 = ctx.measureText(cn).width;
  ctx.font = `400 22px ${FONT.mono}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '3px';
  const w2 = ctx.measureText(rest).width;
  const W = w1 + 8 + w2;
  const x0 = align === 'left' ? x : x - W;
  // dark pill so the tag stays legible while it crosses the ledger
  ctx.fillStyle = 'rgba(4,5,11,0.72)';
  ctx.beginPath();
  ctx.roundRect(x0 - 10, y - 19, W + 20, 38, 19);
  ctx.fill();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `600 24px ${FONT.serif}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '2px';
  ctx.fillText(cn, x0, y + 1);
  ctx.font = `400 22px ${FONT.mono}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '3px';
  ctx.fillText(rest, x0 + w1 + 8, y + 1);
  ctx.restore();
}

/** 阳光 · 0.5 µm on the falling packet (gone before it lands), 红外 · 10 µm on one outgoing red packet */
export function drawPhotonLabels(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  if (!labelsOn(frame)) return;
  const a = Math.min(seg(frame, T.photonEmit + 2, T.photonEmit + 7), 1 - seg(frame, T.photonLand - 12, T.photonLand - 6));
  if (a > 0.01) {
    const hy = heroHead(frame);
    const [sx, sy] = worldToScreen(cam, HERO.x + 30, hy - 120);
    tag(ctx, sx, sy, '阳光', '· 0.5 µm', P.gold, 'rgba(255,201,74,0.6)', a, 'left');
  }
  const pick = labelPick();
  const rp = redPacket(pick, frame);
  const ra = rp ? Math.min(seg(frame, unzipAt(pick) + 10, unzipAt(pick) + 18), 1 - seg(frame, T.ghostEnd - 66, T.ghostEnd - 48)) : 0;
  if (rp && ra > 0.01) {
    const mid = HERO.redL * 0.5;
    const [sx, sy] = worldToScreen(cam, rp.x + rp.dx * mid, rp.y + rp.dy * mid);
    const side = rp.dx >= 0 ? 1 : -1;
    tag(ctx, side > 0 ? Math.min(sx + 34, 760) : Math.max(110, sx - 34), sy, '红外', '· 10 µm', '#FF6A55', 'rgba(255,59,47,0.6)', ra * rp.a, side > 0 ? 'left' : 'right');
  }
}
