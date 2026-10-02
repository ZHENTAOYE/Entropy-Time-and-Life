// S01 effect layers, all drawn INTO the shared <InkStage> canvases (no extra full-frame layers; the stage's front
// canvas is mounted only while the tape is tampered with):
//   drawStrobe   main canvas (under the drop): Edgerton-style multi-flash exposures of the drop in flight. The spacing
//                of the ghosts IS the physics: equal time steps, t² spacing. The leap (rewind) and the fall leave the
//                same pattern mirrored — a single drop's flight is time-symmetric; only the ink is not.
//   drawLight    main canvas (under the GL ink, additive): impact flash + anamorphic streak, the exposure swell.
//   drawTamper   front canvas: time-tamper artefacts of the rewind — real horizontal scan-tears (slices of the
//                composited frame — stage canvas + GL ink re-multiplied — shifted sideways and wrapped), a rolling
//                tracking band, chroma fringes, dropout dashes, scanlines; at the tape-stop clunk a vertical roll.
//   drawVignette main canvas, under the GL ink (multiply commutes): warm lens vignette ("70,52,30" at .35).
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { inkDropFall } from '../../lib/ink';
import { WATER_LINE_Y } from '../../lib/handoff';
import { F, FROM_Y, S01State, T_FALL, camAt, toScreen } from './timeline';

type Ctx = CanvasRenderingContext2D;

function applyCam(ctx: Ctx, f: number) {
  const { zoom, origin } = camAt(f);
  ctx.translate(origin[0], origin[1]);
  ctx.scale(zoom, zoom);
  ctx.translate(-origin[0], -origin[1]);
}

// ───────────────────────────── strobe ghosts ─────────────────────────────
const DT = 0.042; // physical seconds between "flashes"
const KMAX = 7;

function ghost(ctx: Ctx, age: number, w: number) {
  const d = inkDropFall(age, { fromY: FROM_Y });
  if (!d.visible || w < 0.01) return;
  const { x, y, r, stretch } = d;
  const ry = r * stretch;
  if (y + ry > WATER_LINE_Y - 1) return;
  // a strobe flash freezes only what is lit: the cream Fresnel rim (light table below), the hard specular, a warm halo
  const hg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
  hg.addColorStop(0, `rgba(255,226,180,${0.07 * w})`);
  hg.addColorStop(1, 'rgba(255,226,180,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
  ctx.fillStyle = `rgba(10,11,16,${0.16 * w})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  const rim = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  rim.addColorStop(0, `rgba(255,236,206,${0.04 * w})`);
  rim.addColorStop(1, `rgba(255,236,206,${0.3 * w})`);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.97, ry * 0.97, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.8 * w})`;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - ry * 0.42, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawStrobe(ctx: Ctx, f: number, st: S01State) {
  if (f < F.leap || f > F.impact + 8) return;
  ctx.save();
  applyCam(ctx, f);
  if (f < F.stop + 14) {
    // leap (played backward): the frames the viewer has already seen lie closer to the surface (ages → 0)
    const a = f < F.stop ? st.age : -T_FALL;
    const fade = 1 - ease.inQuad(seg(f, F.stop, F.stop + 14));
    for (let k = 1; k <= KMAX; k++) {
      const ak = a + k * DT;
      if (ak >= 0) break;
      ghost(ctx, ak, fade * Math.pow(1 - k / (KMAX + 1), 1.3));
    }
  }
  if (f >= F.stop) {
    // the fall: ghosts at earlier physical times, back up to the apex
    const a = Math.min(st.age, -1e-4);
    const fade = f < F.impact ? 1 : 1 - seg(f, F.impact, F.impact + 8);
    const aNow = f < F.impact ? a : -1e-4;
    for (let k = 1; k <= KMAX; k++) {
      const ak = aNow - k * DT;
      if (ak < -T_FALL) break;
      ghost(ctx, ak, fade * Math.pow(1 - k / (KMAX + 1), 1.3));
    }
  }
  ctx.restore();
}

// ───────────────────────────── impact micro-spray ─────────────────────────────
// Fine droplets thrown off the crown rim (ballistic in physical time, so the slow motion holds them in the air):
// beads lit from below with a dark refracting core and a short shutter streak along their velocity.
interface Drip {
  t0: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  r: number;
}
function spraySet(): Drip[] {
  return memo('s01-spray', () => {
    const out: Drip[] = [];
    for (let i = 0; i < 26; i++) {
      const h = (k: number) => hash01(i * 7 + k, 4242);
      const side = h(0) < 0.5 ? -1 : 1;
      out.push({
        t0: 0.012 + h(1) * 0.07,
        x0: 540 + side * (12 + 20 * h(2)),
        y0: WATER_LINE_Y - 10 - 12 * h(3),
        vx: side * (25 + 190 * h(4) * h(4)),
        vy: 150 + 260 * h(5),
        r: 0.45 + 1.5 * h(6) * h(6),
      });
    }
    return out;
  });
}

export function drawSpray(ctx: Ctx, f: number, st: S01State) {
  const age = st.age;
  if (f < F.impact || age > 0.75) return;
  ctx.save();
  applyCam(ctx, f);
  const g = 900;
  for (const d of spraySet()) {
    const t = age - d.t0;
    if (t <= 0) continue;
    const x = d.x0 + d.vx * t;
    const y = d.y0 - d.vy * t + 0.5 * g * t * t;
    if (y > WATER_LINE_Y - d.r) continue;
    const vy = -d.vy + g * t;
    const sh = 0.006; // shutter
    ctx.strokeStyle = 'rgba(250,244,232,0.35)';
    ctx.lineWidth = d.r * 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - d.vx * sh, y - vy * sh);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(252,247,236,0.92)';
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
    if (d.r > 0.8) {
      ctx.fillStyle = 'rgba(24,26,36,0.5)';
      ctx.beginPath();
      ctx.arc(x + d.r * 0.15, y + d.r * 0.22, d.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ───────────────────────────── light ─────────────────────────────
/** 0..1 exposure swell over the last ~2 s before the hard cut */
export const swellAt = (f: number) => ease.inCubic(seg(f, 268, F.cut));

export function drawLight(ctx: Ctx, f: number) {
  // impact flash: the strobe/key light catching the crown, with an anamorphic streak (macro lens)
  const t = f - F.impact;
  if (t >= 0 && t < 16) {
    const [ix, iy] = toScreen(f, 540, WATER_LINE_Y - 6);
    const k = Math.exp(-t / 3.2) * (t < 1 ? 0.7 + 0.3 * t : 1);
    const R = 260;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(ix, iy, 0, ix, iy, R);
    g.addColorStop(0, `rgba(255,252,244,${0.85 * k})`);
    g.addColorStop(0.12, `rgba(255,244,222,${0.42 * k})`);
    g.addColorStop(0.45, `rgba(255,232,196,${0.12 * k})`);
    g.addColorStop(1, 'rgba(255,232,196,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ix - R, iy - R, R * 2, R * 2);
    const sw = 1080 * (0.6 + 0.4 * ease.outCubic(clamp(t / 6)));
    const sg = ctx.createLinearGradient(ix - sw / 2, 0, ix + sw / 2, 0);
    sg.addColorStop(0, 'rgba(190,214,255,0)');
    sg.addColorStop(0.5, `rgba(226,238,255,${0.55 * k})`);
    sg.addColorStop(1, 'rgba(190,214,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(ix - sw / 2, iy - 2.2, sw, 4.4);
    ctx.fillStyle = sg;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(ix - sw / 2, iy - 9, sw, 18);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // exposure swell while the bloom breathes alone: the light table blooms up into the cut (drawn on the paper, under
  // the GL ink; the ink itself is thinned optically by the caller). The air catches a halation above the line.
  const sw = swellAt(f);
  if (sw > 0) {
    const sy = toScreen(f, 540, WATER_LINE_Y)[1];
    const [cx, cy] = toScreen(f, 540, 940);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 60, cx, cy, 1300);
    g.addColorStop(0, `rgba(255,252,246,${0.26 * sw})`);
    g.addColorStop(0.45, `rgba(255,249,238,${0.16 * sw})`);
    g.addColorStop(1, `rgba(255,244,228,${0.05 * sw})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, sy, 1080, 1920 - sy);
    const h = ctx.createLinearGradient(0, sy - 160, 0, sy);
    h.addColorStop(0, 'rgba(255,236,206,0)');
    h.addColorStop(1, `rgba(255,236,206,${0.2 * sw})`);
    ctx.fillStyle = h;
    ctx.fillRect(0, sy - 160, 1080, 160);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ───────────────────────────── tamper ─────────────────────────────
function glCopy(): { c: HTMLCanvasElement; x: Ctx } {
  return memo('s01-glcopy', () => {
    const c = document.createElement('canvas');
    return { c, x: c.getContext('2d', { willReadFrequently: true })! };
  });
}

interface Sources {
  main: HTMLCanvasElement;
  gl: HTMLCanvasElement | null;
  glScale: number;
}
/** The stage's main CPU canvas and the GL ink layer (read back once into a 2D copy). */
function sources(front: HTMLCanvasElement): Sources | null {
  const stage = front.parentElement;
  if (!stage) return null;
  const all = Array.from(stage.querySelectorAll('canvas')) as HTMLCanvasElement[];
  const main = all[0];
  if (!main || main === front) return null;
  const glc = all.find((c) => c !== main && c !== front && c.style.mixBlendMode === 'multiply' && c.style.display !== 'none') ?? null;
  if (!glc) return { main, gl: null, glScale: 1 };
  const cp = glCopy();
  if (cp.c.width !== glc.width || cp.c.height !== glc.height) {
    cp.c.width = glc.width;
    cp.c.height = glc.height;
  }
  cp.x.globalCompositeOperation = 'copy';
  cp.x.drawImage(glc, 0, 0);
  return { main, gl: cp.c, glScale: glc.height / 1920 };
}

/** copy the composited band [y, y+h) shifted by dx (wrapping around the frame edge) */
function tear(ctx: Ctx, s: Sources, y: number, h: number, dx: number) {
  const W = 1080;
  y = Math.max(0, Math.min(1920 - 1, y));
  h = Math.max(1, Math.min(1920 - y, h));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'source-over';
  const parts: Array<[number, number]> = [[dx, 0]];
  parts.push(dx > 0 ? [dx - W, 0] : [dx + W, 0]);
  for (const [ox] of parts) ctx.drawImage(s.main, 0, y, W, h, ox, y, W, h);
  if (s.gl) {
    ctx.globalCompositeOperation = 'multiply';
    const gs = s.glScale;
    for (const [ox] of parts) ctx.drawImage(s.gl, 0, y * gs, W * gs, h * gs, ox, y, W, h);
  }
  ctx.restore();
}

function scanPattern(ctx: Ctx): CanvasPattern | null {
  const tile = memo('s01-scan-tile', () => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 6;
    const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(10,8,14,1)';
    x.fillRect(0, 0, 4, 2);
    return c;
  });
  return ctx.createPattern(tile, 'repeat');
}

export function drawTamper(ctx: Ctx, f: number, st: S01State) {
  const k = st.tamper;
  // vertical roll: the tape engaging on the very first frames (the cold open locks in), and the tape-stop clunk
  const roll = f < 5 ? [110, 52, 20, 7, 2][f] : f >= F.stop && f < F.stop + 4 ? [44, 18, 6, 2][f - F.stop] : 0;
  if (k <= 0 && roll <= 0) return;
  const s = sources(ctx.canvas);
  if (!s) return;
  if (roll > 0) {
    // the whole picture slips down: black vertical-blanking bar with a bright head line
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(s.main, 0, 0, 1080, 1920 - roll, 0, roll, 1080, 1920 - roll);
    if (s.gl) {
      ctx.globalCompositeOperation = 'multiply';
      const gs = s.glScale;
      ctx.drawImage(s.gl, 0, 0, 1080 * gs, (1920 - roll) * gs, 0, roll, 1080, 1920 - roll);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#060508';
    ctx.fillRect(0, 0, 1080, roll);
    ctx.fillStyle = 'rgba(255,250,240,0.55)';
    ctx.fillRect(0, roll - 2, 1080, 2);
    ctx.restore();
    return;
  }
  // 1) tracking band: rolls UP the frame (time runs backward), a stack of thin skewed tears
  const bandH = 70 + 60 * k;
  const yb = 1920 + 200 - ((f * 47) % 2500);
  const lines = Math.round(6 + 10 * k);
  for (let i = 0; i < lines; i++) {
    const h = 3 + Math.floor(hash01(f * 31 + i, 5) * 9);
    const y = yb + (i / lines) * bandH;
    const skew = Math.sin(i * 0.9 + f * 0.7) * (6 + 28 * k) * (0.5 + hash01(f * 7 + i, 9));
    tear(ctx, s, y, h, skew);
  }
  // 2) random tears anywhere (the stronger the rewind, the more and the wider)
  const n = 1 + Math.floor(hash01(f, 41) * (1 + 4 * k));
  for (let i = 0; i < n; i++) {
    const h1 = hash01(f * 13 + i, 71),
      h2 = hash01(f * 17 + i, 72),
      h3 = hash01(f * 19 + i, 73);
    const y = 120 + h1 * 1700;
    const h = 2 + h2 * h2 * (16 + 40 * k);
    const dx = (h3 - 0.5) * 2 * (10 + 70 * k);
    tear(ctx, s, y, h, dx);
    // chroma fringes at the tear's edges
    ctx.fillStyle = `rgba(255,40,90,${0.32 * k})`;
    ctx.fillRect(dx > 0 ? dx : 0, y, Math.min(1080, 1080 - Math.abs(dx)), 1.5);
    ctx.fillStyle = `rgba(30,200,255,${0.32 * k})`;
    ctx.fillRect(0, y + h - 1.5, 1080, 1.5);
  }
  // 3) dropout dashes inside the tracking band
  for (let i = 0; i < 26 * k; i++) {
    const h1 = hash01(f * 53 + i, 81),
      h2 = hash01(f * 59 + i, 82),
      h3 = hash01(f * 61 + i, 83);
    const y = yb + h1 * bandH;
    const x = h2 * 1080;
    const w = 12 + h3 * h3 * 220;
    ctx.fillStyle = h3 > 0.5 ? `rgba(255,253,248,${0.55 * k})` : `rgba(14,12,18,${0.35 * k})`;
    ctx.fillRect(x, y, w, 2);
  }
  // 4) head-switching noise at the very bottom of the frame
  tear(ctx, s, 1888, 32, 18 + 30 * hash01(f, 91));
  ctx.fillStyle = `rgba(250,246,238,${0.25 * k})`;
  for (let i = 0; i < 18; i++) ctx.fillRect(hash01(f * 3 + i, 93) * 1080, 1890 + hash01(f * 5 + i, 94) * 28, 30 + 90 * hash01(i, f), 2);
  // 5) faint scanlines over everything while the tape is being tampered with
  const pat = scanPattern(ctx);
  if (pat) {
    ctx.save();
    ctx.globalAlpha = 0.07 * k;
    ctx.fillStyle = pat;
    ctx.translate(0, ((f * 2) % 3) * 2);
    ctx.fillRect(0, -6, 1080, 1932);
    ctx.restore();
  }
}

// ───────────────────────────── vignette ─────────────────────────────
export function drawVignette(ctx: Ctx, strength = 0.35) {
  // the lib Vignette (ellipse 75 % × 62 % of the frame, clear to 55 %, warm 70,52,30 at the edge), rendered once at
  // quarter resolution and upscaled (a smooth gradient: the upscale is invisible, the per-frame cost is one blit)
  const img = memo(`s01-vignette:${strength}`, () => {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    const x = c.getContext('2d')!;
    x.scale(0.25, 0.25);
    x.translate(540, 960);
    x.scale(1080 * 0.75, 1920 * 0.62);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(70,52,30,0)');
    g.addColorStop(0.55, 'rgba(70,52,30,0)');
    g.addColorStop(0.8, `rgba(70,52,30,${strength * 0.45})`);
    g.addColorStop(1, `rgba(70,52,30,${strength})`);
    x.fillStyle = g;
    x.fillRect(-1, -1, 2, 2);
    return c;
  });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, 1080, 1920);
}

