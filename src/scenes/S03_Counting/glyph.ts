// Beats 11–13. The row of zeros is also the axis of the glass's histogram: its needle (N ≈ 10²⁵) rises out of the
// line and unfolds into the glyph 熵; 熵 → the S of S = k log W, carved and gilded on a stone stele standing on the
// line, W filled with microstates; then the six 2:2 worlds — six arrangements, one look — coarse-grain into one and
// collapse into the single glowing line (S04's arrow).
import { FONT } from '../../lib/fonts';
import { clamp, ease, lerp, memo, seg } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { sampleShape } from '../../lib/points';
import { hash01, mulberry32 } from '../../lib/random';
import { C, P4, BOX, ROW, T } from './constants';
import { drawDot, drawMiniBox } from './count';
import { Ctx, LATIN, MONO, SANS, SERIF, barcode, drawRich, glow, rgbaHex } from './paint';

// ------------------------------------------------------------------ needle → 熵
const NP = 1400;
export const SHANG = { cx: 540, cy: 676, size: 470 } as const;
const NEEDLE_H = 540;

interface Morph {
  sx: Float32Array;
  sy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  d: Float32Array;
}
function shangMorph(): Morph {
  return memo('S03:shangMorph', () => {
    const B = 600;
    const loc = sampleShape('S03:shang', B, B, (g) => {
      g.font = `900 ${SHANG.size}px ${FONT.serif}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('熵', B / 2, B / 2);
    }, { step: 5, jitter: 0.6, seed: 3 });
    const pts = new Float32Array(loc.length);
    for (let i = 0; i < loc.length; i += 2) {
      pts[i] = loc[i] + SHANG.cx - B / 2;
      pts[i + 1] = loc[i + 1] + SHANG.cy - B / 2;
    }
    const m = pts.length / 2;
    const r = mulberry32(99);
    // needle points: x ~ N(0, σ), y uniform under the gaussian
    const ns: Array<[number, number]> = [];
    for (let i = 0; i < NP; i++) {
      const g = Math.sqrt(-2 * Math.log(Math.max(1e-6, r()))) * Math.cos(6.283 * r());
      const h = Math.exp(-g * g / 2);
      ns.push([540 + g * 2.2, ROW.y - r() * h * NEEDLE_H]);
    }
    // targets: an even subset of the glyph points
    const tg: Array<[number, number]> = [];
    for (let i = 0; i < NP; i++) {
      const j = Math.floor((i / NP) * m);
      tg.push([pts[j * 2], pts[j * 2 + 1]]);
    }
    // coherent flow: rank-match by height
    ns.sort((a, b) => a[1] - b[1]);
    tg.sort((a, b) => a[1] - b[1]);
    const M: Morph = { sx: new Float32Array(NP), sy: new Float32Array(NP), tx: new Float32Array(NP), ty: new Float32Array(NP), d: new Float32Array(NP) };
    for (let i = 0; i < NP; i++) {
      M.sx[i] = ns[i][0];
      M.sy[i] = ns[i][1];
      M.tx[i] = tg[i][0];
      M.ty[i] = tg[i][1];
      M.d[i] = r();
    }
    return M;
  });
}

function needleH(f: number) {
  return ease.outExpo(seg(f, T.needle, T.needle + 12));
}

export function drawShang(ctx: Ctx, f: number, ready: boolean) {
  if (f < T.needle || f > T.formula + 26 || !ready) return;
  const M = shangMorph();
  const h = needleH(f);
  // the crisp glyph locks in at glyphLock and breaks back into its particles just before the formula
  const lockA = ease.inOutQuad(seg(f, T.glyphLock - 6, T.glyphLock + 4)) * (1 - ease.inQuad(seg(f, T.formula - 8, T.formula - 2)));
  // particles: bright while forming, dimmed under the crisp glyph, bright again as it breaks up
  const pa = f >= T.formula - 2 ? 0 : Math.max(1 - 0.85 * ease.inOutQuad(seg(f, T.glyphLock - 6, T.glyphLock + 4)), seg(f, T.formula - 10, T.formula - 4));
  if (pa > 0.003) {
    ctx.save();
    const cMove = rgbaHex('#FFFFFF', pa * 0.9);
    const cRest = rgbaHex(C.pale, pa);
    for (let i = 0; i < NP; i++) {
      const s = T.glyph + M.d[i] * 6 + ((M.sy[i] - (ROW.y - NEEDLE_H)) / NEEDLE_H) * 4;
      const k = ease.inOutCubic(seg(f, s, s + 16));
      const sy = ROW.y - (ROW.y - M.sy[i]) * h;
      // bowed path: unfold sideways, the swirl turns the same way for everyone
      const mx = (M.sx[i] + M.tx[i]) / 2 + (M.ty[i] - sy) * 0.25;
      const my = (sy + M.ty[i]) / 2 - (M.tx[i] - M.sx[i]) * 0.18;
      const u = 1 - k;
      const x = u * u * M.sx[i] + 2 * u * k * mx + k * k * M.tx[i];
      const y = u * u * sy + 2 * u * k * my + k * k * M.ty[i];
      const r = 2.4;
      ctx.fillStyle = k > 0.02 && k < 0.98 ? cMove : cRest;
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.restore();
  }
  // the crisp glyph
  if (lockA > 0.003) {
    ctx.save();
    ctx.globalAlpha = lockA;
    ctx.font = `900 ${SHANG.size}px ${FONT.serif}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gr = ctx.createLinearGradient(0, SHANG.cy - SHANG.size / 2, 0, SHANG.cy + SHANG.size / 2);
    gr.addColorStop(0, '#FFF6E2');
    gr.addColorStop(0.55, C.pale);
    gr.addColorStop(1, C.amber);
    ctx.fillStyle = gr;
    ctx.fillText('熵', SHANG.cx, SHANG.cy);
    ctx.restore();
  }
  // needle label (data only: the glass's histogram, N ≈ 10²⁵ — every arrangement sits at 各半)
  const la = seg(f, T.needle + 3, T.needle + 7) * (1 - seg(f, T.glyph + 4, T.glyph + 10));
  if (la > 0.003) {
    drawRich(ctx, [{ t: '一杯水 · N ≈ 10' }, { t: '25', sup: true }], 562, ROW.y - NEEDLE_H * needleH(f) + 18, { font: MONO(28, 400), size: 28, color: C.pale, alpha: 0.9 * la });
  }
}

export function glowShang(ctx: Ctx, f: number) {
  if (f < T.needle || f > T.formula + 26) return;
  const h = needleH(f);
  const lock = seg(f, T.glyphLock - 6, T.glyphLock + 4);
  const flash = Math.exp(-Math.max(0, f - T.glyphLock) / 5) * seg(f, T.glyphLock - 2, T.glyphLock);
  const out = 1 - seg(f, T.formula - 8, T.formula);
  const na = (1 - seg(f, T.glyph, T.glyph + 14)) * h;
  for (let i = 0; i < 8; i++) glow(ctx, C.amber, 540, ROW.y - NEEDLE_H * h * (i / 8), 70, 0.4 * na);
  glow(ctx, C.pale, SHANG.cx, SHANG.cy, 420, (0.22 * lock + 0.5 * flash) * out);
}

// ------------------------------------------------------------------ the stele and the carved formula
export const STELE = { x0: 150, x1: 930, y0: 468, y1: ROW.y - 1, depth: 40 } as const;
const FORM = { size: 160, y: 736 } as const;
const PARTS = ['S', ' = ', 'k', ' log ', 'W'] as const;

interface FormLayout {
  xs: number[]; // left x per part
  ws: number[];
  total: number;
}
function formLayout(): FormLayout {
  return memo('S03:formLayout', () => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const xs: number[] = [];
    const ws: number[] = [];
    let total = 0;
    PARTS.forEach((p, i) => {
      c.font = partFont(i);
      const w = c.measureText(p).width;
      ws.push(w);
      total += w;
    });
    let x = 540 - total / 2;
    for (const w of ws) {
      xs.push(x);
      x += w;
    }
    return { xs, ws, total };
  });
}
/** S, k, W are variables (italic); = and the function name log are upright, as on the tombstone and in print */
function partFont(i: number) {
  return PARTS[i] === ' = ' || PARTS[i] === ' log ' ? LATIN(FORM.size, 600) : LATIN(FORM.size, 600, true);
}

/** stone texture (memo): dark granite — near-neutral grey with mineral grains (salt-and-pepper) and faint veins, so
 * it reads as polished stone under the amber light, not as wood */
function stoneCanvas(): HTMLCanvasElement {
  return memo('S03:stone', () => {
    const W = STELE.x1 - STELE.x0;
    const H = STELE.y1 - STELE.y0;
    const c = document.createElement('canvas');
    c.width = Math.ceil(W / 2);
    c.height = Math.ceil(H / 2);
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const img = g.createImageData(c.width, c.height);
    const N = makeNoise(808);
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const n = N.fbm2(x / 70, y / 70, 3) * 0.55 + N.n2(x / 6, y / 6) * 0.2;
        const vein = Math.exp(-Math.abs(N.fbm2(x / 150 + 3, y / 90 + x / 400, 2) * 7 - 0.3) * 4) * 0.3;
        const h = hash01(x * 7919 + y * 104729, 31);
        const grain = h < 0.05 ? 0.55 : h < 0.12 ? 0.25 : h > 0.95 ? -0.35 : 0;
        const v = Math.max(0, 0.45 + 0.45 * n + vein + grain);
        const o = (y * c.width + x) * 4;
        img.data[o] = 21 + 30 * v;
        img.data[o + 1] = 20 + 27 * v;
        img.data[o + 2] = 19 + 24 * v;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** the carved, gilded formula (memo, needs fonts) */
function formulaSprite(): HTMLCanvasElement {
  return memo('S03:formulaSprite', () => {
    const L = formLayout();
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 360;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const base = 250; // baseline inside the sprite
    const drawParts = (ctx2: CanvasRenderingContext2D, dx: number, dy: number, skipW = false) => {
      ctx2.textBaseline = 'alphabetic';
      PARTS.forEach((p, i) => {
        if (skipW && p === 'W') return;
        ctx2.font = partFont(i);
        ctx2.fillText(p, L.xs[i] + dx, base + dy);
      });
    };
    // gilded letters (gold leaf), W left out (it is drawn from microstates)
    const gold = g.createLinearGradient(0, base - FORM.size * 0.75, 0, base + 20);
    gold.addColorStop(0, '#FFF1C8');
    gold.addColorStop(0.45, C.pale);
    gold.addColorStop(0.8, '#E8A040');
    gold.addColorStop(1, C.goldDeep);
    g.fillStyle = gold;
    drawParts(g, 0, 0, true);
    // incision shading: top-left walls in shadow, bottom-right walls catch the light
    const band = (dx: number, dy: number, color: string) => {
      const t = document.createElement('canvas');
      t.width = c.width;
      t.height = c.height;
      const tg = t.getContext('2d', { willReadFrequently: true })!;
      tg.fillStyle = '#fff';
      drawParts(tg, 0, 0, true);
      tg.globalCompositeOperation = 'destination-out';
      drawParts(tg, dx, dy, true);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = color;
      tg.fillRect(0, 0, t.width, t.height);
      g.drawImage(t, 0, 0);
    };
    band(5, 5, 'rgba(40,20,4,0.85)');
    band(-3, -3, 'rgba(255,248,230,0.65)');
    return c;
  });
}
function wMask(): HTMLCanvasElement {
  return memo('S03:wMask', () => {
    const L = formLayout();
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 360;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.font = partFont(4);
    g.fillStyle = '#fff';
    g.textBaseline = 'alphabetic';
    g.fillText('W', L.xs[4], 250);
    return c;
  });
}
/** W drawn from microstates: rows of tiny 10-bit barcodes, scrolling slowly, clipped to the W */
function drawW(ctx: Ctx, f: number, a: number) {
  const L = formLayout();
  const scratch = memo('S03:wScratch', () => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 360;
    return c;
  });
  const g = scratch.getContext('2d', { willReadFrequently: true })!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, 1080, 360);
  const x0 = L.xs[4] - 10;
  const x1 = L.xs[4] + L.ws[4] + 10;
  const rowH = 4;
  const bw = 30;
  const scroll = (f - T.formula) * 0.6;
  for (let y = 60; y < 280; y += rowH) {
    const row = Math.floor((y + scroll) / rowH);
    for (let x = x0, k = 0; x < x1; x += bw + 2, k++) {
      const code = Math.floor(hash01(row * 37 + k, 515) * 1024);
      barcode(g, x, y - (scroll % rowH), bw, rowH - 1, code, 10, hash01(row + k, 3) > 0.92 ? '#FFFFFF' : C.pale, 1, 0.34);
    }
  }
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(wMask(), 0, 0);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(scratch, 0, FORM.y - 250);
  // a gilded rim so the W reads as a letter made of microstates
  ctx.drawImage(wOutline(), 0, FORM.y - 250);
  ctx.restore();
}
function wOutline(): HTMLCanvasElement {
  return memo('S03:wOutline', () => {
    const L = formLayout();
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 360;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.font = partFont(4);
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,214,140,0.85)';
    g.lineWidth = 2;
    g.strokeText('W', L.xs[4], 250);
    return c;
  });
}

export function steleAlpha(f: number) {
  return ease.inOutQuad(seg(f, T.formula - 4, T.formula + 14)) * (1 - ease.inOutQuad(seg(f, T.c13 - 2, T.c13 + 14)));
}

export function drawStele(ctx: Ctx, f: number, ready: boolean) {
  const a = steleAlpha(f);
  if (a <= 0.003 || !ready) return;
  const sink = ease.inCubic(seg(f, T.c13 - 2, T.c13 + 14)) * 40;
  ctx.save();
  ctx.translate(0, sink);
  // the stele (stands on the line), seen slightly from the right and above: front face, lit top, dark side
  const W = STELE.x1 - STELE.x0;
  const H = STELE.y1 - STELE.y0;
  const D = STELE.depth;
  const rise = (1 - ease.outCubic(seg(f, T.formula - 4, T.formula + 16))) * 60;
  ctx.globalAlpha = a;
  ctx.save();
  ctx.beginPath();
  ctx.rect(STELE.x0 - 20, 0, W + D + 40, STELE.y1);
  ctx.clip();
  ctx.translate(0, rise);
  const stone = stoneCanvas();
  // side face (in shadow)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(STELE.x1, STELE.y0);
  ctx.lineTo(STELE.x1 + D, STELE.y0 - D * 0.62);
  ctx.lineTo(STELE.x1 + D, STELE.y1 - D * 0.62);
  ctx.lineTo(STELE.x1, STELE.y1);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(stone, STELE.x1 - 40, STELE.y0 - D, 120, H + D);
  ctx.fillStyle = 'rgba(4,3,2,0.72)';
  ctx.fillRect(STELE.x1 - 2, STELE.y0 - D, D + 4, H + D);
  ctx.restore();
  // top face (catches the light)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(STELE.x0, STELE.y0);
  ctx.lineTo(STELE.x0 + D, STELE.y0 - D * 0.62);
  ctx.lineTo(STELE.x1 + D, STELE.y0 - D * 0.62);
  ctx.lineTo(STELE.x1, STELE.y0);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(stone, STELE.x0, STELE.y0 - D, W + D, D * 1.2);
  ctx.fillStyle = 'rgba(255,200,130,0.16)';
  ctx.fillRect(STELE.x0, STELE.y0 - D, W + D, D);
  ctx.restore();
  // front face
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(stone, STELE.x0, STELE.y0, W, H);
  const sh = ctx.createLinearGradient(STELE.x0, STELE.y0, STELE.x1, STELE.y1);
  sh.addColorStop(0, 'rgba(255,190,110,0.12)');
  sh.addColorStop(0.45, 'rgba(0,0,0,0.0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = sh;
  ctx.fillRect(STELE.x0, STELE.y0, W, H);
  // edges: lit top-front edge, soft left edge, dark right edge
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgbaHex(C.pale, 0.55);
  ctx.beginPath();
  ctx.moveTo(STELE.x0, STELE.y0);
  ctx.lineTo(STELE.x1, STELE.y0);
  ctx.lineTo(STELE.x1 + D, STELE.y0 - D * 0.62);
  ctx.stroke();
  ctx.strokeStyle = rgbaHex(C.amber, 0.35);
  ctx.beginPath();
  ctx.moveTo(STELE.x0, STELE.y1);
  ctx.lineTo(STELE.x0, STELE.y0);
  ctx.lineTo(STELE.x0 + D, STELE.y0 - D * 0.62);
  ctx.lineTo(STELE.x1 + D, STELE.y0 - D * 0.62);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.moveTo(STELE.x1, STELE.y0);
  ctx.lineTo(STELE.x1, STELE.y1);
  ctx.stroke();
  // an incised border on the front face
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(STELE.x0 + 22, STELE.y0 + 22, W - 44, H - 44);
  ctx.strokeStyle = rgbaHex(C.amber, 0.2);
  ctx.lineWidth = 1;
  ctx.strokeRect(STELE.x0 + 24, STELE.y0 + 24, W - 44, H - 44);
  ctx.restore();
  // the formula: S arrives as the 熵 particles; the rest is revealed by a carving sweep left → right
  const sweep = ease.inOutCubic(seg(f, T.formula + 12, T.formula + 32));
  const L = formLayout();
  const spr = formulaSprite();
  const xs = L.xs[0] + (L.total + 40) * sweep;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FORM.y - 250, xs, 360);
  ctx.clip();
  ctx.drawImage(spr, 0, FORM.y - 250);
  drawW(ctx, f, a);
  ctx.restore();
  // carving spark at the sweep head
  if (sweep > 0 && sweep < 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(xs - 1, FORM.y - FORM.size * 0.72, 2, FORM.size * 0.86);
  }
  // specular sweep (gold leaf catches the light)
  const sp = seg(f, T.formula + 34, T.formula + 66);
  if (sp > 0 && sp < 1) {
    const sx = lerp(L.xs[0] - 200, L.xs[0] + L.total + 200, sp);
    const scratch = memo('S03:specScratch', () => {
      const c = document.createElement('canvas');
      c.width = 1080;
      c.height = 360;
      return c;
    });
    const g = scratch.getContext('2d', { willReadFrequently: true })!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, 1080, 360);
    g.drawImage(spr, 0, 0);
    g.globalCompositeOperation = 'source-in';
    const gr = g.createLinearGradient(sx - 90, 0, sx + 90, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,250,235,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1080, 360);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(scratch, 0, FORM.y - 250);
    ctx.globalCompositeOperation = 'source-over';
  }
  // inscription + note under W
  const ia = a * seg(f, T.formula + 28, T.formula + 38);
  drawRich(ctx, [{ t: 'L. BOLTZMANN  ·  1844 – 1906  ·  WIEN, ZENTRALFRIEDHOF' }], 540, STELE.y1 - 42, { font: MONO(19, 400), size: 19, color: C.pale, align: 'center', alpha: 0.72 * ia, tracking: 1.2 });
  const na = a * seg(f, T.formula + 36, T.formula + 44);
  if (na > 0.003) {
    const wx = L.xs[4] + L.ws[4] * 0.5;
    ctx.strokeStyle = rgbaHex(C.pale, 0.6 * na);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(wx, FORM.y + 22);
    ctx.lineTo(wx, FORM.y + 62);
    ctx.stroke();
    drawRich(ctx, [{ t: '那串零有多长，熵就差多少' }], Math.min(wx + 60, 900), FORM.y + 98, { font: SANS(27, 400), size: 27, color: C.pale, align: 'right', alpha: 0.92 * na });
  }
  ctx.restore();
}

/** 熵 → S: the glyph's particles regroup into the S of the formula */
export function drawShangToS(ctx: Ctx, f: number, ready: boolean) {
  if (!ready || f < T.formula - 2 || f >= T.formula + 26) return;
  const M = shangMorph();
  const L = formLayout();
  const tgt = memo('S03:sPts', () => {
    const B = 260;
    const loc = sampleShape('S03:S', B, B, (g) => {
      g.font = LATIN(FORM.size, 600, true);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('S', B / 2, B / 2);
    }, { step: 4, jitter: 0.6, seed: 4 });
    const out = new Float32Array(loc.length);
    for (let i = 0; i < loc.length; i += 2) {
      out[i] = loc[i] + L.xs[0] + L.ws[0] / 2 - B / 2;
      out[i + 1] = loc[i + 1] + FORM.y - FORM.size * 0.32 - B / 2;
    }
    return out;
  });
  const m = tgt.length / 2;
  const fa = 1 - seg(f, T.formula + 18, T.formula + 26);
  const cMove = rgbaHex('#FFFFFF', 0.9 * fa);
  const cRest = rgbaHex(C.pale, 0.9 * fa);
  ctx.save();
  for (let i = 0; i < NP; i++) {
    const s = T.formula - 2 + M.d[i] * 8;
    const k = ease.inOutCubic(seg(f, s, s + 16));
    const j = i % m;
    const x = lerp(M.tx[i], tgt[j * 2], k);
    const y = lerp(M.ty[i], tgt[j * 2 + 1], k) - Math.sin(k * Math.PI) * 60 * (M.d[i] - 0.3);
    ctx.fillStyle = k < 0.95 ? cMove : cRest;
    ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }
  ctx.restore();
}

export function glowStele(ctx: Ctx, f: number) {
  const a = steleAlpha(f);
  if (a <= 0.003) return;
  const L = memo('S03:formLayoutGlow', () => null);
  void L;
  glow(ctx, C.amber, 540, FORM.y - 60, 460, 0.18 * a);
}

// ------------------------------------------------------------------ card 13: six worlds, one look → the line
/** a uniform fine stipple (tile): the coarse-grained density — identical everywhere, whatever the microstate */
function stipple(): HTMLCanvasElement {
  return memo('S03:stipple', () => {
    const S = 48;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const r = mulberry32(4711);
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 6; i++) {
        const px = i * 8 + 1 + r() * 5;
        const py = j * 8 + 1 + r() * 5;
        g.fillStyle = r() > 0.8 ? 'rgba(255,240,210,0.9)' : 'rgba(255,214,150,0.6)';
        g.fillRect(px, py, 1.6, 1.6);
      }
    }
    return c;
  });
}

const SIX = [3, 5, 6, 9, 10, 12];
const SIXW = 236;
function sixCell(j: number): [number, number] {
  const col = j % 3;
  const row = Math.floor(j / 3);
  return [540 + (col - 1) * 296, 572 + row * 208];
}
export const MERGED = { cx: 540, cy: 690, w: 420 } as const;

export function drawSix(ctx: Ctx, f: number) {
  if (f < T.boxes6 || f > T.c13End + 4) return;
  const merge = ease.inOutCubic(seg(f, T.merge, T.merge + 18));
  const coarse = ease.inOutQuad(seg(f, T.coarse, T.coarse + 16));
  const col = ease.inOutCubic(seg(f, T.collapse, T.collapse + 24));
  // the stack of six → one box → the line
  for (let j = 0; j < 6; j++) {
    const s = T.boxes6 + j * 4;
    const ap = ease.outCubic(seg(f, s, s + 10));
    if (ap <= 0) continue;
    const [gx, gy] = sixCell(j);
    let cx = lerp(gx, MERGED.cx, merge);
    let cy = lerp(gy, MERGED.cy, merge);
    let w = lerp(SIXW, MERGED.w, merge);
    let a = ap * (j === 0 ? 1 : 1 - 0.85 * merge);
    if (col > 0) {
      // flatten onto the line: the box becomes the row (x 90 → 990, y 960)
      cy = lerp(cy, ROW.y, col);
      w = lerp(w, 900, col);
      a *= 1 - seg(f, T.collapse + 14, T.collapse + 26);
    }
    if (a <= 0.003) continue;
    const hScale = 1 - col;
    drawWorld(ctx, SIX[j], cx, cy, w, Math.max(0.0001, hScale), a, coarse, f, j);
  }
  // labels
  const la = seg(f, T.boxes6 + 26, T.boxes6 + 34) * (1 - seg(f, T.collapse - 4, T.collapse + 6));
  if (la > 0.003) {
    drawRich(ctx, [{ t: '左 : 右 = 2 : 2' }], 540, 448 + merge * 40, { font: MONO(26, 400), size: 26, color: C.amber, align: 'center', alpha: 0.8 * la });
  }
  // the payoff: six arrangements, one look → W = 6 (held ~0.8 s before everything flattens into the line)
  const wa = ease.outCubic(seg(f, T.merge + 8, T.merge + 16)) * (1 - seg(f, T.collapse - 2, T.collapse + 6));
  if (wa > 0.003) {
    drawRich(ctx, [{ t: 'W = 6', font: LATIN(76, 600, true) }], MERGED.cx + MERGED.w / 2 + 26, MERGED.cy + 24, { font: LATIN(76, 600, true), size: 76, color: '#FFF1D0', alpha: wa });
  }
}

/** one world, optionally coarse-grained (its particles smear into an even glow on each side) */
function drawWorld(ctx: Ctx, code: number, cx: number, cy: number, w: number, hScale: number, a: number, coarse: number, f: number, j: number) {
  const h = ((w * 4) / 7) * hScale;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const s = w / 700;
  ctx.save();
  ctx.fillStyle = rgbaHex('#140D05', 0.9 * a * hScale);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = rgbaHex(C.amber, 0.9 * a);
  ctx.lineWidth = 1.5;
  if (hScale > 0.02) ctx.strokeRect(x, y, w, h);
  else {
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + w, cy);
    ctx.stroke();
  }
  if (hScale > 0.05) {
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = rgbaHex(C.amber, 0.32 * a);
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(cx, y + h - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // coarse-grained halves: what a macroscopic eye sees — the same even density on each side, in every world
    if (coarse > 0.003) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 3, y + 3, w - 6, h - 6);
      ctx.clip();
      ctx.fillStyle = rgbaHex(C.amber, 0.09 * coarse * a);
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.globalAlpha = 0.75 * coarse * a;
      ctx.fillStyle = ctx.createPattern(stipple(), 'repeat') ?? rgbaHex(C.pale, 0.2);
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.restore();
    }
    // the two particles on each side
    for (let i = 0; i < 4; i++) {
      const left = ((code >> (3 - i)) & 1) === 1;
      const px = x + (P4[i][0] - BOX.x0 + (left ? 0 : 350)) * s;
      const py = y + (P4[i][1] - BOX.y0) * s * hScale;
      const r = Math.max(3, 10 * s * 1.3);
      drawDot(ctx, px, py, r * (1 + coarse * 0.6), a * (1 - coarse));
      if (coarse > 0) glow(ctx, C.amber, px, py, r * (2 + 5 * coarse), 0.3 * Math.sin(Math.PI * coarse) * a);
    }
    // its barcode (the microstate), fading as the eye coarse-grains
    barcode(ctx, cx - w * 0.21, y + h + 10, w * 0.42, Math.max(5, w * 0.04), code, 4, C.pale, a * (1 - coarse), 0.16);
  }
  void f;
  void j;
  ctx.restore();
}

export function glowSix(ctx: Ctx, f: number) {
  if (f < T.boxes6 || f > T.c13End + 4) return;
  const col = seg(f, T.collapse, T.collapse + 24);
  const merge = seg(f, T.merge, T.merge + 18);
  const a = seg(f, T.boxes6, T.boxes6 + 20) * (1 - seg(f, T.collapse + 10, T.collapse + 30));
  glow(ctx, C.amber, MERGED.cx, lerp(lerp(670, MERGED.cy, merge), ROW.y, col), 360, 0.16 * a);
}

/** extra brightness of the line while the box collapses into it (returns 0 on the last frames) */
export function lineBoost(f: number) {
  const k = seg(f, T.collapse + 14, T.collapse + 26);
  return k * (1 - seg(f, T.collapse + 26, T.lineOnly - 2)) * 0.9;
}

export const _unused = { SERIF, clamp };
