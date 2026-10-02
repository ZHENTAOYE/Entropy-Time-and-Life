// HUD, drawn in the film-wide vocabulary (lib/hud.tsx look: mono 28 px timecode at (90, 250) with chromatic split
// while time is tampered with; the S-gauge hairline at x = 64). In S05 the instruments die with the universe:
//  · ▶▶ (the inverse of S01's ◀◀) loses its DIRECTION: the two arrows start pointing anywhere, the speed digits
//    scramble, the clock stops meaning anything — then the whole readout random-walks into the noise.
//  · STARS / BLACK HOLES counters count the actual lit nodes / holes on screen down to 0.
//  · the S-gauge climbs, pegs at the top (maximum entropy) and dissolves.
//  · reticles lock onto the last star and the black holes; they snap open when their target is gone.
import { WEB_FINAL, blackHoles, webGeometry, webNodes, webToScreen, webCamera } from '../../lib/cosmos';
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { F } from './fonts';
import { rgbStr } from './gfx';
import { buildMask, drawScattered } from './scatter';
import { GREY, RGB, VOICE, lerpRGB } from './text';
import { T, eqAt, ffK, knots, simTime, webAt } from './timing';
import { expoAt } from './lockup';
import { bhPopFrames } from './shells';
import { dieAt } from './timing';

const HX = 90;
const HY = 279; // timecode baseline (DOM top 250)

/** ▶▶ direction lost: 0..1 */
const lostK = (f: number) => ease.inOutSine(seg(f, T.hudLose[0], T.hudLose[1]));
const hudCol = (f: number): RGB => lerpRGB(VOICE, [168, 168, 168], ease.inOutSine(seg(f, 150, 260)));

function speedExp(f: number): number {
  if (f < T.lockIn) return Math.round(3 + 7 * ease.inOutSine(seg(f, T.ffOn, T.lockIn + 4)));
  return Math.max(9, Math.round(expoAt(f) - 1));
}

function tri(ctx: CanvasRenderingContext2D, cx: number, cy: number, ang: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(8.5, 0);
  ctx.lineTo(-6.5, -9);
  ctx.lineTo(-6.5, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** the timecode content (no chroma), in fillStyle */
function timecodeBody(ctx: CanvasRenderingContext2D, f: number, typed: number) {
  const L = lostK(f);
  // the two arrows lose their common direction
  const n1 = Math.sin(f * 0.137 + 1.3) * 0.6 + Math.sin(f * 0.291 + 4.1) * 0.4;
  const n2 = Math.sin(f * 0.113 + 2.9) * 0.6 + Math.sin(f * 0.347 + 0.7) * 0.4;
  const A = L * Math.PI * 1.25;
  tri(ctx, HX + 7, HY - 10, A * n1);
  tri(ctx, HX + 23, HY - 10, A * n2 + L * 0.6);
  if (typed < 0.2) return;
  ctx.font = F.hud;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // speed ×10ⁿ (raised exponent drawn by hand)
  let x = HX + 46;
  ctx.fillText('×10', x, HY);
  x += ctx.measureText('×10').width + 2;
  let e = String(speedExp(f));
  const scr = seg(f, T.hudLose[0] + 10, T.hudLose[1]);
  if (scr > 0) e = Array.from(e).map((c, i) => (hash01(Math.floor(f / 2) * 7 + i, 404) < scr ? String(Math.floor(hash01(Math.floor(f / 2) * 13 + i, 405) * 10)) : c)).join('');
  ctx.font = F.hudSup;
  ctx.fillText(e, x, HY - 13);
  x += ctx.measureText(e).width + 24;
  if (typed < 0.6) return;
  // clock: the simulation clock whirls (×1000), then freezes and flickers meaningless
  ctx.font = F.hud;
  const s = simTime(Math.min(f, T.hudLose[0] + 20)) * 1000;
  const parts = [Math.floor(s / 3600) % 100, Math.floor(s / 60) % 60, Math.floor(s) % 60, Math.floor((s % 1) * 30)];
  let clock = parts.map((v) => String(v).padStart(2, '0')).join(':');
  if (scr > 0) clock = Array.from(clock).map((c, i) => (c !== ':' && hash01(Math.floor(f / 3) * 11 + i, 406) < scr * 0.8 ? String(Math.floor(hash01(Math.floor(f / 3) * 17 + i, 407) * 10)) : c)).join('');
  ctx.fillText(clock, x, HY);
}

export function drawTimecode(ctx: CanvasRenderingContext2D, f: number) {
  if (f < T.ffOn) return;
  const typed = seg(f, T.ffOn, T.ffOn + 8);
  const col = hudCol(f);
  if (f < T.hudDie[0]) {
    ctx.save();
    const split = ffK(f) * (2 + 2 * hash01(f, 77));
    if (split > 0.2) {
      ctx.fillStyle = 'rgba(255,40,80,0.75)';
      ctx.translate(split, 0);
      timecodeBody(ctx, f, typed);
      ctx.fillStyle = 'rgba(40,220,255,0.75)';
      ctx.translate(-2 * split, 0);
      timecodeBody(ctx, f, typed);
      ctx.translate(split, 0);
    }
    ctx.fillStyle = rgbStr(col);
    timecodeBody(ctx, f, typed);
    ctx.restore();
    return;
  }
  const m = buildMask('timecode', 70, 240, 460, 60, (x) => timecodeBody(x, T.hudDie[0], 1));
  const k = seg(f, T.hudDie[0], T.hudDie[1]);
  drawScattered(ctx, m, 1 + 70 * k * k, lerpRGB(col, GREY, ease.inOutSine(k)), 1 - ease.inQuad(k), 333, f);
}

// ───────────── counters ─────────────
function onScreen(x: number, y: number) {
  return x > 0 && x < 1080 && y > 0 && y < 1920;
}
export function starCount(f: number): number {
  const p = webAt(f);
  let n = 0;
  for (const nd of webNodes(p)) if (onScreen(nd.x, nd.y) && nd.lit * nd.alive * nd.host * nd.vis > 0.5) n++;
  return n;
}
export function holeCount(f: number): number {
  return blackHoles(webAt(f)).filter((h) => h.k > 0.5 && h.r > 0.5).length;
}

export function drawCounters(ctx: CanvasRenderingContext2D, f: number) {
  const a = Math.min(seg(f, 30, 42), 1 - seg(f, 168, 186));
  if (a <= 0.003) return;
  ctx.save();
  ctx.font = F.hudSmall;
  ctx.textAlign = 'left';
  ctx.fillStyle = rgbStr(hudCol(f));
  const stars = f < 112 ? starCount(f) : 0;
  ctx.globalAlpha = a * 0.62;
  ctx.fillText('STARS', HX, HY + 44);
  ctx.fillText('BLACK HOLES', HX, HY + 74);
  ctx.globalAlpha = a * (stars === 0 ? 0.45 : 0.9);
  ctx.fillText(String(stars).padStart(4, '0'), HX + 190, HY + 44);
  const holes = f > 60 && f < 180 ? holeCount(f) : 0;
  ctx.globalAlpha = a * (holes === 0 ? 0.45 : 0.9);
  ctx.fillText(String(holes).padStart(4, '0'), HX + 190, HY + 74);
  ctx.restore();
}

// ───────────── S-gauge ─────────────
const GX = 64;
const GY0 = 560;
const GY1 = 1360;
const sAt = knots([
  [0, 0.72],
  [50, 0.77],
  [108, 0.85],
  [168, 0.91],
  [236, 0.975],
  [T.gaugePeg, 1],
]);
function gaugeBody(ctx: CanvasRenderingContext2D, f: number, col: RGB, glow: boolean) {
  const [r, g, b] = col;
  const grad = ctx.createLinearGradient(0, GY1, 0, GY0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.15)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.55)`);
  ctx.fillStyle = grad;
  ctx.fillRect(GX, GY0, 1, GY1 - GY0);
  ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
  for (let i = 0; i < 9; i++) ctx.fillRect(GX - 3, GY0 + ((GY1 - GY0) * i) / 8, 7, 1);
  // pegged: the needle slams into the top stop and chatters there
  const peg = f >= T.gaugePeg ? Math.exp(-(f - T.gaugePeg) / 6) * Math.sin((f - T.gaugePeg) * 2.4) * 3 : 0;
  const yy = Math.max(GY0 - 2, GY1 - (GY1 - GY0) * clamp(sAt(f)) + peg);
  if (glow) {
    // a soft glow drawn by hand (no shadowBlur: a shadow on the full-frame canvas is a full-frame blur)
    const ga = ctx.globalAlpha;
    ctx.fillStyle = rgbStr(col, 0.1);
    ctx.fillRect(GX - 13, yy - 5, 27, 10);
    ctx.fillStyle = rgbStr(col, 0.16);
    ctx.fillRect(GX - 11, yy - 3, 23, 6);
    ctx.globalAlpha = ga;
  }
  ctx.fillStyle = rgbStr(col);
  ctx.fillRect(GX - 9, yy - 1, 19, 2);
  ctx.font = F.gaugeS;
  ctx.textAlign = 'left';
  ctx.fillText('S', GX + 16, yy + 9);
}
export function drawGauge(ctx: CanvasRenderingContext2D, f: number) {
  const a = ease.inOutSine(seg(f, 6, 26));
  if (a <= 0.003) return;
  const col = lerpRGB(VOICE, [176, 176, 176], ease.inOutSine(seg(f, 160, 270)));
  if (f < T.gaugeDie[0]) {
    ctx.save();
    ctx.globalAlpha = a;
    gaugeBody(ctx, f, col, true);
    ctx.restore();
    return;
  }
  const m = buildMask('gauge', 40, 530, 80, 860, (x) => gaugeBody(x, T.gaugeDie[0], [255, 255, 255], false));
  const k = seg(f, T.gaugeDie[0], T.gaugeDie[1]);
  drawScattered(ctx, m, 0.5 + 60 * k * k, lerpRGB(col, GREY, ease.inOutSine(k)), 1 - ease.inQuad(k), 777, f);
}

// ───────────── reticles ─────────────
function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, L: number, alpha: number) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    ctx.moveTo(x + sx * s, y + sy * (s - L));
    ctx.lineTo(x + sx * s, y + sy * s);
    ctx.lineTo(x + sx * (s - L), y + sy * s);
  }
  ctx.stroke();
  ctx.restore();
}

/** the last star on screen (highest die-rank), fixed once from the WEB_FINAL framing */
function lastStar() {
  return memo('s05:laststar', () => {
    const ns = webGeometry({ ...WEB_FINAL }, 0).nodes.filter((n) => n.x > 120 && n.x < 960 && n.y > 300 && n.y < 1600);
    ns.sort((a, b) => b.dieRank - a.dieRank);
    return ns[0];
  });
}
/** frame at which the last star goes out */
export function lastStarFrame(): number {
  return memo('s05:laststarf', () => {
    const dr = lastStar().dieRank + 0.03;
    for (let f = 0; f < 200; f += 0.25) if (dieAt(f) >= dr) return f;
    return T.lastStar;
  });
}

export function drawReticles(ctx: CanvasRenderingContext2D, f: number) {
  if (f < 60 || f > 180) return;
  const p = webAt(f);
  const cam = webCamera(p);
  ctx.save();
  ctx.strokeStyle = rgbStr(VOICE);
  // last star
  const ls = lastStar();
  const fd = lastStarFrame();
  if (f > 66 && f < fd + 16) {
    const [x, y] = webToScreen(cam, ls.wx, ls.wy);
    const inK = ease.outCubic(seg(f, 68, 82));
    const out = ease.outCubic(seg(f, fd, fd + 14));
    const s = 26 + 60 * (1 - inK) + 34 * out;
    const blink = f > fd - 2 && f < fd + 4 ? (Math.floor(f) % 2 === 0 ? 1 : 0.35) : 1;
    brackets(ctx, x, y, s, 10, inK * (1 - out) * 0.85 * blink);
  }
  // black holes
  const holes = blackHoles(p);
  const pops = new Map(bhPopFrames().map((b) => [b.key, b]));
  for (const h of holes) {
    const pf = pops.get(h.key);
    if (!pf) continue;
    const big = pf.mass > 0.9;
    const formed = f >= pf.f ? 1 : clamp(h.k);
    const out = ease.outCubic(seg(f, pf.f, pf.f + 12));
    if (f > pf.f + 12) continue;
    const s0 = big ? 34 : 24;
    const s = s0 + 40 * (1 - ease.outCubic(seg(formed, 0.3, 1))) + 36 * out;
    brackets(ctx, h.x, h.y, s, big ? 11 : 8, ease.inOutSine(seg(formed, 0.3, 1)) * (1 - out) * (big ? 0.85 : 0.6));
  }
  ctx.restore();
}
