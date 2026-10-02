// S09 B1 (f0–209): the powers-of-ten pull-back, drawn into the scene's single canvas.
// Camera: screen = ANCHOR + (world − W)·s, s = 1080 / 10^Z px per metre. W (the world point under the anchor) glides
// from the Earth to the Sun (Z 10.6 → 13.4) and from the Sun to the galactic centre (Z 20.1 → 21.15), so the frame
// recentres on whatever dominates the scale while the gold "you are here" point keeps tracking the person.
import { WEB_FINAL, WebParams, centerOn, webNodes } from '../../lib/cosmos';
import { ease, memo, seg, smoothstep } from '../../lib/math';
import { drawFigureS08 } from '../S08_Memory/figure';
import { drawMotesS08 } from '../S08_Memory/motes';
import { RGB, cheapBlur, fresh, glow, hexA, rgbStr, scratch, vignette } from './canvas';
import { View, drawHighways, drawStreets, metroRaster, METRO_M, sx, sy } from './city';
import { drawEarth } from './earth';
import { F } from './fonts';
import { SUN, drawEarthDot, drawGalaxyField, drawLocalGroup, drawMilkyWay, drawMoon, drawOort, drawSolar, drawStars, drawSunbeam, galCentre } from './space';
import { ANCHOR, CAP, PB_END, S08_T0, Z0, zoomSpeed, zoomZ } from './timing';
import { Cap, VOICE, drawCap } from './voice';
import { DEV } from './dev';
export { DEV };

export interface PCam extends View {
  Z: number;
  speed: number;
}
/** the Milky Way's clock (s) for drawGalaxy; galCentre uses a fixed reference so the galaxy does not orbit the Sun */
export const mwT = (f: number) => 40 + f / 30;

export function pcam(f: number): PCam {
  const Z = zoomZ(f);
  const s = 1080 / Math.pow(10, Z);
  const wSun = ease.inOutSine(smoothstep(10.6, 13.4, Z));
  const wGal = ease.inOutSine(smoothstep(20.1, 21.15, Z));
  const GC = galCentre();
  let wx = SUN[0] * wSun,
    wy = SUN[1] * wSun;
  wx += (GC[0] - wx) * wGal;
  wy += (GC[1] - wy) * wGal;
  return { Z, s, ax: ANCHOR[0], ay: ANCHOR[1], wx, wy, speed: zoomSpeed(f) };
}

// ───────────────────────────── the cosmic web at the end of the pull-back ─────────────────────────────
/** metres per web cell (a void ≈ 30 Mpc) */
export const CELL_M = 1.0e24;
export const webT = (f: number) => WEB_FINAL.t + 30 + f / 30;
/**
 * The heavy cluster the Milky Way belongs to (fixed in comoving coordinates): the most massive cluster near the frame's
 * centre in the WEB_FINAL framing. Its value for the lib's current web (WEB_FINAL.t = 953/30, zoom 0.8) is baked here —
 * the search costs ~30 ms on every cold tab — and recomputed only if WEB_FINAL ever changes.
 */
const HERO_BAKED = { t: 953 / 30, zoom: 0.8, wx: -0.18830161396094863, wy: -1.7023210219762868 };
export function heroNode() {
  return memo('s09:heroNode', () => {
    if (WEB_FINAL.t === HERO_BAKED.t && WEB_FINAL.zoom === HERO_BAKED.zoom && WEB_FINAL.c === 1) return { wx: HERO_BAKED.wx, wy: HERO_BAKED.wy };
    const t = webT(0);
    const ns = webNodes({ ...WEB_FINAL, t, roll: 0 }, { groups: false }).filter((n) => Math.abs(n.x - 540) < 280 && Math.abs(n.y - 900) < 380);
    ns.sort((a, b) => b.mass - a.mass);
    return { wx: ns[0].wx, wy: ns[0].wy };
  });
}
export function webZoomAt(Z: number) {
  return (1080 * CELL_M) / (300 * Math.pow(10, Z));
}
/** CosmicWeb params during the pull-back (web visible from Z ≈ 22.6) */
export function pullbackWeb(f: number): WebParams {
  const Z = zoomZ(f);
  const t = webT(f);
  const h = heroNode();
  return {
    ...WEB_FINAL,
    t,
    zoom: webZoomAt(Z),
    roll: WEB_FINAL.roll * ease.inOutSine(smoothstep(23.0, 24.68, Z)),
    ...centerOn(h.wx, h.wy, t),
    px: ANCHOR[0],
    py: ANCHOR[1],
    sparks: 0.6,
  };
}
export const pullbackWebOn = (f: number) => f < PB_END && zoomZ(f) > 22.55;

// ───────────────────────────── captions ─────────────────────────────
const warm = () => VOICE;
export const C2: Cap = {
  lines: ['宇宙，一路滚向平衡。'],
  from: CAP.c2.at,
  dur: CAP.c2.dur,
  font: F.voice,
  size: 56,
  color: warm,
  stagger: 1.3,
  enterLen: 16,
  exitLen: 22,
  backdrop: 0.9,
};
export const C3: Cap = {
  lines: ['途中，它在一些角落，', '{暂时}织出了结构：'],
  from: CAP.c3.at,
  dur: CAP.c3.dur,
  font: F.voice,
  size: 56,
  color: warm,
  em: () => [255, 201, 74],
  stagger: 1.1,
  enterLen: 16,
  lineDelay: [0, 12],
  exit: 'none',
  backdrop: 0.95,
  glow: 0.12,
};

// ───────────────────────────── HUD: the odometer (rhymes with S03) ─────────────────────────────
const LEVELS: Array<[number, string]> = [
  [-9, '你'],
  [1.55, '街区'],
  [3.4, '城市'],
  [5.55, '地球'],
  [8.2, '地月系'],
  [10.7, '太阳系'],
  [13.9, '奥尔特云'],
  [16.2, '恒星'],
  [20.0, '银河系'],
  [21.9, '本星系群'],
  [23.45, '宇宙网'],
];
function drawOdometer(ctx: CanvasRenderingContext2D, f: number, Z: number) {
  const a = seg(f, 4, 14) * (1 - seg(f, PB_END - 8, PB_END - 1));
  if (a <= 0.003) return;
  const n = Math.max(0, Math.floor(Z + 0.0001));
  const fr = Z - Math.floor(Z);
  const gold: RGB = [255, 201, 74];
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = F.hudZh;
  ctx.fillStyle = rgbStr(VOICE, 0.6 * a);
  ctx.fillText('视野宽度', 90, 1548);
  // 10ⁿ m — the exponent ticks over with a short vertical slide
  ctx.font = F.odo;
  ctx.fillStyle = rgbStr(VOICE, 0.92 * a);
  ctx.fillText('10', 90, 1606);
  const w10 = ctx.measureText('10').width;
  ctx.save();
  ctx.beginPath();
  ctx.rect(90 + w10, 1548, 120, 44);
  ctx.clip();
  ctx.font = F.odoSup;
  const roll = smoothstep(0.86, 1, fr);
  const e0 = String(n);
  const e1 = String(n + 1);
  if (roll < 0.99) {
    ctx.fillStyle = rgbStr(gold, a * (1 - roll));
    ctx.fillText(e0, 90 + w10 + 3, 1584 - roll * 26);
  }
  if (roll > 0.01) {
    ctx.fillStyle = rgbStr(gold, a * roll);
    ctx.fillText(e1, 90 + w10 + 3, 1584 + (1 - roll) * 26);
  }
  ctx.restore();
  ctx.font = F.odoSup;
  const we = ctx.measureText(n >= 9 ? '00' : '0').width;
  ctx.font = F.odo;
  ctx.fillStyle = rgbStr(VOICE, 0.92 * a);
  ctx.fillText('m', 90 + w10 + we + 16, 1606);
  // the scale's name
  let li = 0;
  for (let i = 0; i < LEVELS.length; i++) if (Z >= LEVELS[i][0]) li = i;
  const since = Z - LEVELS[li][0];
  const k = li === 0 ? 1 : smoothstep(0, 0.35, since);
  ctx.font = F.hudZhBig;
  const x0 = 90 + w10 + we + 16 + 50;
  ctx.fillStyle = rgbStr(VOICE, 0.35 * a);
  ctx.fillRect(x0 - 22, 1590, 10, 1.5);
  ctx.fillStyle = rgbStr(gold, a * k);
  ctx.fillText(LEVELS[li][1], x0, 1604 + (1 - k) * 10);
  if (li > 0 && k < 1) {
    ctx.fillStyle = rgbStr(gold, a * (1 - k) * 0.8);
    ctx.fillText(LEVELS[li - 1][1], x0, 1604 - k * 14);
  }
  ctx.restore();
}

/**
 * "you are here": a gold point with a hairline reticle, riding the person's position at every scale. It keeps the
 * echo pulse of S08's memory network (every 30 frames a ring leaves it) — the same heartbeat in every frame.
 */
function drawMarker(ctx: CanvasRenderingContext2D, f: number, cam: PCam) {
  const a = smoothstep(1.1, 1.75, cam.Z) * (1 - seg(f, PB_END - 4, PB_END));
  if (a <= 0.003) return;
  const x = sx(cam, 0),
    y = sy(cam, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, '#FFC94A', x, y, 34, 0.55 * a, 0.9);
  ctx.fillStyle = hexA('#FFF1C8', a);
  ctx.beginPath();
  ctx.arc(x, y, 3.4, 0, Math.PI * 2);
  ctx.fill();
  // echo pulse (S08: PULSE_PERIOD 30, from f418 → S09 f = 570 + f ≡ 18 mod 30)
  const ph = (((S08_T0 + f - 418) % 30) + 30) % 30;
  const pr = 8 + ph * 2.2;
  ctx.strokeStyle = hexA('#FFC94A', 0.5 * a * (1 - ph / 30));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, pr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  const R = 21 + 2 * Math.sin(f * 0.21);
  ctx.strokeStyle = hexA('#FFC94A', 0.85 * a);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let q = 0; q < 4; q++) {
    const a0 = f * 0.02 + (q * Math.PI) / 2 + 0.25;
    ctx.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R);
    ctx.arc(x, y, R, a0, a0 + Math.PI / 2 - 0.5);
  }
  ctx.stroke();
  // at cosmic scales a tiny label: 你
  const la = a * smoothstep(19.4, 20.2, cam.Z);
  if (la > 0.01) {
    ctx.font = F.hudZhBig;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hexA('#FFE1A0', 0.92 * la);
    ctx.fillText('你', x + 30, y - 26);
    ctx.strokeStyle = hexA('#FFC94A', 0.55 * la);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 13);
    ctx.lineTo(x + 26, y - 22);
    ctx.stroke();
  }
  ctx.restore();
}

// ───────────────────────────── post: bloom + radial zoom blur ─────────────────────────────
/** bloom + motion streaks accumulated at quarter resolution, composited with ONE full-frame additive blit */
function bloomAndStreak(ctx: CanvasRenderingContext2D, cam: PCam, bloom: number, streak: number) {
  const q = scratch('pb-q', 270, 480);
  const qx = fresh(q);
  qx.drawImage(ctx.canvas, 0, 0, 270, 480);
  const acc = scratch('pb-acc', 270, 480);
  const ac = fresh(acc);
  ac.globalCompositeOperation = 'lighter';
  if (bloom > 0.003) {
    ac.globalAlpha = Math.min(1, bloom);
    ac.drawImage(cheapBlur('pbBloom', q, 8), 0, 0);
  }
  // pull-back motion: each point was further out a moment ago → streaks run outward from the anchor
  const d = Math.pow(10, Math.max(0, cam.speed) * 0.55) - 1;
  if (d > 0.004 && streak > 0.003) {
    const N = 7;
    const ax = cam.ax / 4,
      ay = cam.ay / 4;
    const k0 = streak * Math.min(1, 0.6 + d * 2.5) * smoothstep(0.004, 0.05, d);
    for (let k = 1; k <= N; k++) {
      const sc = 1 + (d * k) / N;
      ac.globalAlpha = (k0 * 0.85 * (1 - k / (N + 1))) / N;
      ac.drawImage(q, ax - ax * sc, ay - ay * sc, 270 * sc, 480 * sc);
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(acc, 0, 0, 1080, 1920);
  ctx.restore();
}

const on = (k: string) => !DEV.skip.has(k);

// ───────────────────────────── the frame ─────────────────────────────
export function drawPullback(ctx: CanvasRenderingContext2D, f: number, web: HTMLCanvasElement | null, fontsReady: boolean) {
  const cam = pcam(f);
  const Z = cam.Z;
  const t = f / 30;
  // 1. background: S08's warm black → night → deep space
  const bgK = smoothstep(Z0 + 0.2, 2.6, Z);
  const bg = [10 + (3 - 10) * bgK, 7 + (4 - 7) * bgK, 5 + (9 - 5) * bgK];
  ctx.fillStyle = rgbStr(bg);
  ctx.fillRect(0, 0, 1080, 1920);
  // 2. the web (opaque, paints its own space) fades in over the last decades
  const webA = web ? smoothstep(22.6, 23.55, Z) : 0;
  if (webA > 0.003 && web && on('web')) {
    ctx.globalAlpha = webA;
    ctx.drawImage(web, 0, 0, 1080, 1920);
    ctx.globalAlpha = 1;
  }
  DEV.mark?.('web', ctx);
  // 3. costumes, far → near
  const fieldA = smoothstep(21.4, 21.9, Z) * (1 - smoothstep(23.2, 23.9, Z));
  if (on('field')) drawGalaxyField(ctx, cam, mwT(f), fieldA);
  if (on('local')) drawLocalGroup(ctx, cam, mwT(f), smoothstep(21.35, 21.9, Z) * (1 - smoothstep(23.0, 23.6, Z)));
  // inside the disc the galaxy is a faint glow all around; it resolves into the spiral as we pull out
  const mwA = smoothstep(19.9, 20.4, Z) * (1 - 0.65 * smoothstep(23.2, 24.2, Z));
  DEV.mark?.('field+local', ctx);
  if (on('mw')) drawMilkyWay(ctx, cam, mwT(f), mwA);
  DEV.mark?.('mw', ctx);
  drawStars(ctx, cam, t, smoothstep(14.6, 15.6, Z) * (1 - smoothstep(20.45, 21.1, Z)));
  const sunA = smoothstep(10.2, 11.0, Z) * (1 - smoothstep(19.0, 20.4, Z));
  drawSolar(ctx, cam, t, smoothstep(9.3, 10.2, Z) * (1 - smoothstep(14.6, 15.6, Z)), sunA);
  drawOort(ctx, cam, smoothstep(14.1, 14.8, Z) * (1 - smoothstep(15.9, 16.6, Z)));
  drawSunbeam(ctx, cam, smoothstep(8.5, 9.3, Z) * (1 - smoothstep(11.0, 11.9, Z)));
  drawMoon(ctx, cam, t, smoothstep(7.7, 8.3, Z) * (1 - smoothstep(10.2, 10.9, Z)));
  drawEarthDot(ctx, cam, smoothstep(8.6, 9.4, Z) * (1 - smoothstep(11.6, 12.6, Z)));
  const discA = smoothstep(5.9, 6.6, Z) * (1 - smoothstep(9.0, 9.8, Z));
  const lightsA = smoothstep(5.2, 5.9, Z) * (1 - smoothstep(8.6, 9.6, Z));
  const metroA = smoothstep(4.1, 4.45, Z) * (1 - smoothstep(6.0, 6.7, Z));
  DEV.mark?.('stars+solar', ctx);
  drawEarth(ctx, cam, discA, lightsA, metroA);
  DEV.mark?.('earth', ctx);
  if (metroA > 0.003) {
    const img = metroRaster();
    const W = METRO_M * cam.s;
    const x0 = sx(cam, -METRO_M / 2),
      y0 = sy(cam, -METRO_M / 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = metroA;
    // only the visible window of the raster
    const k = img.width / W;
    const a0 = Math.max(0, -x0 * k),
      b0 = Math.max(0, -y0 * k);
    const a1 = Math.min(img.width, (1080 - x0) * k),
      b1 = Math.min(img.height, (1920 - y0) * k);
    if (a1 > a0 && b1 > b0) ctx.drawImage(img, a0, b0, a1 - a0, b1 - b0, x0 + a0 / k, y0 + b0 / k, (a1 - a0) / k, (b1 - b0) / k);
    ctx.restore();
  }
  DEV.mark?.('metro', ctx);
  const streetA = smoothstep(0.55, 1.35, Z) * (1 - smoothstep(5.2, 5.75, Z));
  const resA = 1 - smoothstep(4.1, 4.45, Z);
  if (streetA > 0.003) {
    if (resA > 0.003 || Z < 4.6) drawStreets(ctx, cam, t, streetA, resA);
    else drawHighways(ctx, cam, t, streetA);
  }
  DEV.mark?.('streets', ctx);
  // the person: FIGURE_S08 shrinking in place (k = 1 at f0 reproduces S08's last frame)
  const figA = 1 - smoothstep(1.0, 1.62, Z);
  if (figA > 0.003) {
    const k = Math.pow(10, Z0 - Z);
    ctx.save();
    drawFigureS08(ctx, S08_T0 + f, { scale: k, tx: ANCHOR[0] * (1 - k), ty: ANCHOR[1] * (1 - k), alpha: figA, bloom: k > 0.12 });
    ctx.restore();
  }
  // S08's gold dust drifts off (it was on the lens)
  const moteA = 1 - seg(f, 2, 22);
  if (moteA > 0.003) {
    ctx.save();
    ctx.globalAlpha = moteA;
    drawMotesS08(ctx, S08_T0 + f, Math.pow(10, Z0 - Z));
    ctx.restore();
  }
  DEV.mark?.('figure', ctx);
  // 4. light: bloom + radial streaks while rushing (none at f0: S08's frame already carries its own bloom)
  const bloom = 0.5 * smoothstep(Z0 + 0.35, 1.5, Z) * (1 - 0.6 * smoothstep(22.8, 24, Z));
  const streak = seg(f, 2, 10) * (1 - 0.65 * smoothstep(13, 16, Z));
  if ((bloom > 0.003 || streak > 0.003) && on('post')) bloomAndStreak(ctx, cam, bloom, streak);
  DEV.mark?.('post', ctx);
  // 5. you are here
  if (on('marker')) drawMarker(ctx, f, cam);
  DEV.mark?.('marker', ctx);
  // 6. lens: S08's warm vignette → a neutral one
  const vw = 1 - seg(f, 4, 30);
  if (on('vig')) {
    vignette(ctx, 0.5 * vw, [14, 8, 4]);
    vignette(ctx, 0.42 * (1 - vw), [0, 0, 0]);
  }
  DEV.mark?.('vig', ctx);
  // 7. HUD + narration
  if (!fontsReady) return;
  if (on('hud')) drawOdometer(ctx, f, Z);
  DEV.mark?.('hud', ctx);
  if (on('caps')) {
    drawCap(ctx, C2, f);
    drawCap(ctx, C3, f);
  }
  DEV.mark?.('caps', ctx);
}
