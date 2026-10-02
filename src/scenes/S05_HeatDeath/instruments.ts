// Instruments that READ the dying image:
//  · the temperature histogram (card 4) is measured from the frame itself every frame (brightness = how hot each
//    point is): a wide distribution — dark voids, warm light — collapses into ONE needle at the grey. It rhymes with
//    S03's bell curve becoming a needle: there, almost every arrangement looks the same; here, every point is the same.
//  · the loupe (card 5) magnifies the grey at the gold point's future place: the "dead" grey is a busy gas. A coherent
//    stream (directed flow: something could be driven by it) thermalises — every particle keeps its speed (能量 100 %)
//    but the directions randomise, and the net flow (the arrow = the vector mean) shrinks to nothing.
import { GOLD_POINT } from '../../lib/handoff';
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { F } from './fonts';
import { ctxOf, rgbStr, scratch } from './gfx';
import { RGB, VOICE, lerpRGB } from './text';
import { T } from './timing';

// ───────────── histogram ─────────────
const NBIN = 64;
const HX0 = 220;
const HX1 = 860;
const HAX = 900; // axis y
const HMAX = 190;

function measure(src: CanvasImageSource): Float32Array {
  const c = scratch('hist', 90, 160);
  const x = ctxOf(c);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'copy';
  x.imageSmoothingEnabled = true;
  x.drawImage(src, 0, 0, 90, 160);
  const d = x.getImageData(0, 0, 90, 160).data;
  const h = new Float32Array(NBIN);
  for (let i = 0; i < d.length; i += 4) {
    const L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    h[Math.min(NBIN - 1, Math.floor(L * NBIN))]++;
  }
  return h;
}

export function drawHistogram(ctx: CanvasRenderingContext2D, f: number, src: CanvasImageSource | null) {
  const [a0, a1] = T.hist;
  const vis = Math.min(ease.outCubic(seg(f, a0, a0 + 12)), 1 - ease.inOutSine(seg(f, a1 - 14, a1)));
  if (vis <= 0.003 || !src) return;
  const h = measure(src);
  let mx = 1;
  let N = 0;
  for (let i = 0; i < NBIN; i++) {
    mx = Math.max(mx, h[i]);
    N += h[i];
  }
  const K = 400 / N;
  const norm = Math.log(1 + mx * K);
  const col: RGB = lerpRGB(VOICE, [190, 190, 190], ease.inOutSine(seg(f, a0, a1)));
  const pitch = (HX1 - HX0) / NBIN;
  const grow = ease.outCubic(seg(f, a0 + 2, a0 + 18));
  ctx.save();
  ctx.globalAlpha = vis;
  // bars
  ctx.fillStyle = rgbStr(col);
  let imax = 0;
  for (let i = 0; i < NBIN; i++) {
    if (h[i] > h[imax]) imax = i;
    const v = h[i] > 0 ? Math.log(1 + h[i] * K) / norm : 0;
    const H = HMAX * v * grow;
    if (H < 0.5) continue;
    ctx.globalAlpha = vis * (0.55 + 0.4 * v);
    ctx.fillRect(HX0 + i * pitch + pitch * 0.32, HAX - H, Math.max(1.5, pitch * 0.36), H);
  }
  // needle highlight + a hairline up to the label
  const sharp = clamp((h[imax] / N - 0.25) / 0.5);
  if (sharp > 0.01) {
    const xn = HX0 + (imax + 0.5) * pitch;
    ctx.globalAlpha = vis * sharp;
    ctx.shadowColor = rgbStr(col);
    ctx.shadowBlur = 10;
    ctx.fillRect(xn - 1.5, HAX - HMAX * grow, 3, HMAX * grow);
    ctx.shadowBlur = 0;
  }
  // axis, ticks, the colour bar = what brightness means (cold dark → hot bright)
  ctx.globalAlpha = vis * 0.6;
  ctx.fillRect(HX0, HAX, HX1 - HX0, 1);
  for (let i = 0; i <= 8; i++) ctx.fillRect(HX0 + ((HX1 - HX0) * i) / 8, HAX + 1, 1, 6);
  const g = ctx.createLinearGradient(HX0, 0, HX1, 0);
  g.addColorStop(0, 'rgb(0,0,0)');
  g.addColorStop(1, 'rgb(255,255,255)');
  ctx.globalAlpha = vis * 0.9;
  ctx.fillStyle = g;
  ctx.fillRect(HX0, HAX + 12, HX1 - HX0, 5);
  ctx.fillStyle = rgbStr(col);
  ctx.font = F.zh;
  ctx.globalAlpha = vis * 0.8;
  ctx.textAlign = 'left';
  ctx.fillText('冷', HX0, HAX + 52);
  ctx.textAlign = 'right';
  ctx.fillText('热', HX1, HAX + 52);
  ctx.restore();
}

// ───────────── loupe ─────────────
const LR = 214;
const NP = 128;
const BOX = 2 * LR + 60;
interface P {
  x0: number;
  y0: number;
  v: number;
  t: Float32Array; // event times (t[0] = loupe open)
  a: Float32Array; // direction after each event
  n: number;
}
function particles(): P[] {
  return memo('s05:gas', () => {
    const out: P[] = [];
    for (let i = 0; i < NP; i++) {
      const r = (k: number) => hash01(i * 37 + k, 5150);
      const t: number[] = [T.loupe[0] - 30];
      const a: number[] = [-0.52 + (r(1) - 0.5) * 0.22];
      let tt = 260 + 34 * Math.pow(r(2), 0.9);
      for (let k = 0; k < 12 && tt < T.loupe[1] + 4; k++) {
        t.push(tt);
        a.push(6.2831853 * r(10 + k));
        tt += 7 + 17 * r(30 + k);
      }
      out.push({ x0: r(3) * BOX, y0: r(4) * BOX, v: 2.6 + 2.8 * Math.sqrt(r(5)), t: Float32Array.from(t), a: Float32Array.from(a), n: t.length });
    }
    return out;
  });
}
const wrap = (v: number) => ((v % BOX) + BOX) % BOX;
/** the grey, magnified: 40² blocks of boiling noise (new every frame) */
function grainTile(f: number): HTMLCanvasElement {
  const c = scratch('lgrain', 40, 40);
  const x = ctxOf(c);
  const img = memo('s05:lgrainimg', () => x.createImageData(40, 40));
  for (let i = 0; i < 1600; i++) {
    const v = 92 + (hash01(i + Math.floor(f) * 1601, 808) + hash01(i * 3 + Math.floor(f) * 4801, 809) - 1) * 26;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
function pos(p: P, f: number): [number, number, number] {
  let x = p.x0;
  let y = p.y0;
  let ang = p.a[0];
  for (let k = 0; k < p.n; k++) {
    if (f <= p.t[k]) break;
    const end = k + 1 < p.n ? Math.min(f, p.t[k + 1]) : f;
    const dt = end - p.t[k];
    x += Math.cos(p.a[k]) * p.v * dt;
    y += Math.sin(p.a[k]) * p.v * dt;
    ang = p.a[k];
  }
  return [wrap(x), wrap(y), ang];
}
/** net flow |⟨v⟩| / ⟨|v|⟩ (1 = everything streams one way, 0 = no net direction) */
export function netFlow(f: number): [number, number] {
  let sx = 0;
  let sy = 0;
  let sv = 0;
  for (const p of particles()) {
    const [, , a] = pos(p, f);
    sx += Math.cos(a) * p.v;
    sy += Math.sin(a) * p.v;
    sv += p.v;
  }
  return [sx / sv, sy / sv];
}

export function loupeRadius(f: number): number {
  return LR * (ease.outCubic(seg(f, T.loupe[0], T.loupe[0] + 14)) - ease.inCubic(seg(f, T.loupe[1] - 18, T.loupe[1])));
}

export function drawLoupe(ctx: CanvasRenderingContext2D, f: number) {
  const R = loupeRadius(f);
  if (R < 0.5) return;
  const cx = GOLD_POINT.x;
  const cy = GOLD_POINT.y;
  const k = R / LR;
  const col: RGB = [228, 226, 222];
  ctx.save();
  // closing: the lens fades as it shrinks to the point where the gold will appear
  ctx.globalAlpha = f > T.loupe[1] - 18 ? clamp(k * 1.4) : 1;
  // the lens: the same grey, magnified — big boiling grain — slightly darker so the gas reads
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(grainTile(f), cx - LR * 1.02, cy - LR * 1.02, LR * 2.04, LR * 2.04);
  ctx.imageSmoothingEnabled = true;
  const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  lg.addColorStop(0, 'rgba(14,14,18,0.3)');
  lg.addColorStop(0.82, 'rgba(14,14,18,0.36)');
  lg.addColorStop(1, 'rgba(6,6,10,0.62)');
  ctx.fillStyle = lg;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  // the gas, magnified: trails, then heads (three depth sizes)
  const ox = cx - BOX / 2;
  const oy = cy - BOX / 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgbStr(col, 0.3);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const heads: number[] = [];
  const ps = particles();
  for (const p of ps) {
    const [x, y] = pos(p, f);
    const [x2, y2] = pos(p, f - 3.5);
    heads.push(ox + x, oy + y);
    if (Math.abs(x - x2) < BOX / 2 && Math.abs(y - y2) < BOX / 2) {
      ctx.moveTo(ox + x2, oy + y2);
      ctx.lineTo(ox + x, oy + y);
    }
  }
  ctx.stroke();
  // collisions: each change of direction flashes a tiny ring (this is how the stream forgets its direction)
  ctx.lineWidth = 1.2;
  for (const p of ps) {
    for (let e = 1; e < p.n; e++) {
      const age = f - p.t[e];
      if (age < 0 || age >= 7) continue;
      const [x, y] = pos(p, p.t[e]);
      ctx.strokeStyle = rgbStr(VOICE, 0.55 * (1 - age / 7));
      ctx.beginPath();
      ctx.arc(ox + x, oy + y, 3 + 2.4 * age, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < heads.length; i += 2) {
    const d = hash01(i, 5151);
    const rr = 1.7 + 1.9 * d;
    ctx.fillStyle = rgbStr(col, 0.62 + 0.36 * d);
    ctx.beginPath();
    ctx.arc(heads[i], heads[i + 1], rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // lens rim light: a cool highlight top-left, shadow bottom-right
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgbStr(VOICE, 0.22);
  ctx.beginPath();
  ctx.arc(cx, cy, R - 2, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 2, Math.PI * 0.05, Math.PI * 0.55);
  ctx.stroke();
  // net-flow arrow (vector mean of all velocities)
  const [mx, my] = netFlow(f);
  const L = Math.hypot(mx, my) * 150 * k;
  if (L > 1) {
    const ux = mx / Math.hypot(mx, my);
    const uy = my / Math.hypot(mx, my);
    ctx.strokeStyle = rgbStr(VOICE, 0.95);
    ctx.fillStyle = rgbStr(VOICE, 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + ux * (L - 10), cy + uy * (L - 10));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + ux * L, cy + uy * L);
    ctx.lineTo(cx + ux * (L - 16) - uy * 8, cy + uy * (L - 16) + ux * 8);
    ctx.lineTo(cx + ux * (L - 16) + uy * 8, cy + uy * (L - 16) - ux * 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = rgbStr(VOICE, 0.95);
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  // rim + dial ticks
  ctx.strokeStyle = rgbStr(VOICE, 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgbStr(VOICE, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const l = i % 4 === 0 ? 10 : 5;
    ctx.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
    ctx.lineTo(cx + Math.cos(a) * (R + 4 + l), cy + Math.sin(a) * (R + 4 + l));
  }
  ctx.stroke();
  // readout: energy stays, net flow → 0
  const ra = clamp((k - 0.6) / 0.4) * Math.min(1, seg(f, T.loupe[0] + 8, T.loupe[0] + 20));
  if (ra > 0.01) {
    const net = Math.hypot(mx, my);
    const rows: Array<[string, number, string]> = [
      ['能量', 1, '100%'],
      ['净流', net, net.toFixed(2)],
    ];
    const ga = ctx.globalAlpha;
    rows.forEach(([lab, v, txt], i) => {
      const y = cy + LR + 74 + i * 42;
      ctx.globalAlpha = ra * ga;
      ctx.fillStyle = rgbStr(VOICE, 0.85);
      ctx.font = F.zh;
      ctx.textAlign = 'left';
      ctx.fillText(lab, 372, y);
      ctx.fillStyle = rgbStr(VOICE, 0.2);
      ctx.fillRect(440, y - 11, 210, 4);
      ctx.fillStyle = rgbStr(VOICE, 0.9);
      ctx.fillRect(440, y - 11, 210 * clamp(v), 4);
      ctx.font = F.data;
      ctx.textAlign = 'right';
      ctx.fillText(txt, 712, y);
    });
  }
  ctx.restore();
}
