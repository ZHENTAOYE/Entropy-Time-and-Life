// m · d²x/dt² = F(x), drawn glyph by glyph so panel B can perform t → (−t): the substitution inserts "(−t)",
// the square on the denominator gives birth to a second minus sign, the two minus signs fly together and
// annihilate in a flash, the brackets collapse — and B's law is, glyph for glyph, A's law again.
import { clamp, ease, lerp, memo } from '../../lib/math';
import { C } from './constants';
import { Ctx, glow, latin, rgbaHex } from './paint';

export interface EqState {
  /** 0..1 write-on progress (glyph stagger) */
  write: number;
  /** 0..1 presence of the inserted "(", "−", ")" */
  subst: number;
  /** 0..1 birth of the twin minus out of the square */
  twin: number;
  /** 0..1 flight of the two minus signs toward each other */
  fly: number;
  /** 0..1 after the annihilation: brackets collapse */
  collapse: number;
  /** 0..1 global alpha */
  alpha: number;
  /** 0..1 synchronous highlight sweep (A and B identical) */
  sweep: number;
}

interface Metrics {
  m: number;
  d: number;
  x: number;
  t: number;
  F: number;
  eq: number;
  lp: number;
  rp: number;
  minus: number;
  sq: number;
}

function metrics(ctx: Ctx, S: number): Metrics {
  return memo('S02:eqm:' + S, () => {
    const it = latin(S, true, 600);
    const rm = latin(S, false, 600);
    const sup = latin(S * 0.56, false, 600);
    const w = (font: string, s: string) => {
      ctx.font = font;
      return ctx.measureText(s).width;
    };
    return {
      m: w(it, 'm'),
      d: w(it, 'd'),
      x: w(it, 'x'),
      t: w(it, 't'),
      F: w(it, 'F'),
      eq: w(rm, '='),
      lp: w(rm, '('),
      rp: w(rm, ')'),
      minus: w(rm, '−'),
      sq: w(sup, '2'),
    };
  });
}

type G = { s: string; font: 'it' | 'rm' | 'sup'; x: number; y: number; a: number; col: string; sc?: number };

/** Draws the equation centred at (cx, cy). If glowLayer, only emits glow sprites (for the bloom canvas). */
export interface EqInfo {
  meet: { x: number; y: number };
  barX: number;
  barW: number;
  axis: number;
  total: number;
}
export function drawEquation(ctx: Ctx, cx: number, cy: number, S: number, st: EqState, glowLayer = false): EqInfo {
  if (st.alpha <= 0.003) return { meet: { x: cx, y: cy }, barX: cx, barW: 0, axis: cy, total: 0 };
  const M = metrics(ctx, S);
  const gap = S * 0.16;
  // presence of the inserted brackets (stay until collapse)
  const pb = clamp(st.subst) * (1 - ease.inOutCubic(clamp(st.collapse)));
  const pm = clamp(st.subst) * (1 - ease.inOutCubic(clamp(st.collapse))); // slot of minus #1
  const numW = M.d + M.sq + M.x + S * 0.09;
  const denW = M.d + pb * M.lp + pm * M.minus + M.t + pb * M.rp + M.sq + S * 0.04;
  const barW = Math.max(numW, denW) + S * 0.24;
  const rhsW = M.F + M.lp + M.x + M.rp;
  // while the twin minus exists, "= F(x)" slides right to make room for it
  const room = S * 0.62 * ease.outCubic(clamp(st.twin)) * (1 - ease.inOutCubic(clamp(st.fly)));
  const total = M.m + gap + barW + room + gap + M.eq + gap + rhsW;
  let x = cx - total / 2;
  const base = cy + S * 0.3; // main baseline
  const axis = base - S * 0.26; // fraction bar height
  const numBase = axis - S * 0.2;
  const denBase = axis + S * 0.74;
  const supUp = S * 0.4;

  const white = C.core;
  const glyphs: G[] = [];
  glyphs.push({ s: 'm', font: 'it', x, y: base, a: 1, col: white });
  x += M.m + gap;
  const barX = x;
  // numerator
  let nx = barX + (barW - numW) / 2;
  glyphs.push({ s: 'd', font: 'it', x: nx, y: numBase, a: 1, col: white });
  nx += M.d;
  // the italic d leans right: give its ascender room before the square
  glyphs.push({ s: '2', font: 'sup', x: nx + S * 0.07, y: numBase - supUp, a: 1, col: white });
  nx += M.sq + S * 0.09;
  glyphs.push({ s: 'x', font: 'it', x: nx, y: numBase, a: 1, col: white });
  // denominator
  let dx = barX + (barW - denW) / 2;
  glyphs.push({ s: 'd', font: 'it', x: dx, y: denBase, a: 1, col: white });
  dx += M.d;
  const lpX = dx;
  glyphs.push({ s: '(', font: 'rm', x: lpX, y: denBase, a: pb, col: C.red, sc: pb });
  dx += pb * M.lp;
  const m1Home = { x: dx, y: denBase };
  dx += pm * M.minus;
  glyphs.push({ s: 't', font: 'it', x: dx, y: denBase, a: 1, col: white });
  dx += M.t;
  glyphs.push({ s: ')', font: 'rm', x: dx, y: denBase, a: pb, col: C.red, sc: pb });
  dx += pb * M.rp;
  const sqX = dx + S * 0.03;
  glyphs.push({ s: '2', font: 'sup', x: sqX, y: denBase - supUp, a: 1, col: st.twin > 0 && st.fly < 1 ? lerpCol(st.twin) : white });
  x = barX + barW + room + gap;
  glyphs.push({ s: '=', font: 'rm', x, y: base, a: 1, col: white });
  x += M.eq + gap;
  glyphs.push({ s: 'F', font: 'it', x, y: base, a: 1, col: white });
  x += M.F;
  glyphs.push({ s: '(', font: 'rm', x, y: base, a: 1, col: white });
  x += M.lp;
  glyphs.push({ s: 'x', font: 'it', x, y: base, a: 1, col: white });
  x += M.x;
  glyphs.push({ s: ')', font: 'rm', x, y: base, a: 1, col: white });

  // the two minus signs
  const flyE = ease.inOutCubic(clamp(st.fly));
  const sqC = { x: sqX + M.sq / 2 - M.minus / 2, y: denBase - S * 0.42 };
  const twinOut = { x: sqX + M.sq + S * 0.16, y: denBase - S * 0.42 };
  const tb = ease.outCubic(clamp(st.twin));
  const twinHome = { x: lerp(sqC.x, twinOut.x, tb), y: lerp(sqC.y, twinOut.y, tb) };
  const meet = { x: (m1Home.x + twinOut.x) / 2, y: denBase + S * 0.62 };
  const minusAlive = st.subst > 0 && st.fly < 1;
  const m1 = { x: lerp(m1Home.x, meet.x, flyE), y: lerp(denBase, meet.y, flyE) };
  const m2 = { x: lerp(twinHome.x, meet.x, flyE), y: lerp(twinHome.y, meet.y, flyE) };

  const nG = glyphs.length + 2;
  const glyphAlpha = (i: number) => clamp(st.write * (nG + 4) - i) * st.alpha;

  const info: EqInfo = { meet: { x: meet.x + M.minus / 2, y: meet.y - S * 0.25 }, barX, barW, axis, total };
  const fontOf = (g: G) => (g.font === 'it' ? latin(S, true, 600) : g.font === 'rm' ? latin(S, false, 600) : latin(S * 0.56, false, 600));
  const sweepX = lerp(cx - total / 2 - S * 0.6, cx + total / 2 + S * 0.6, ease.inOutQuad(clamp(st.sweep)));

  if (glowLayer) {
    // glyph-shaped bloom (replaces per-glyph CPU shadowBlur): the glyphs themselves, fattened, drawn into the
    // quarter-res bloom canvas — upscaled, they become a soft cyan halo that follows the letterforms
    glow(ctx, C.cyan, cx, axis, total * 0.62, 0.08 * st.alpha * st.write);
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.lineWidth = S * 0.07;
    glyphs.forEach((g, i) => {
      const a = g.a * glyphAlpha(i);
      if (a <= 0.003) return;
      ctx.font = fontOf(g);
      ctx.fillStyle = rgbaHex(C.cyan, 0.5 * a);
      ctx.strokeStyle = rgbaHex(C.cyan, 0.3 * a);
      ctx.fillText(g.s, g.x, g.y);
      ctx.strokeText(g.s, g.x, g.y);
    });
    ctx.fillStyle = rgbaHex(C.cyan, 0.4 * glyphAlpha(1));
    ctx.fillRect(barX, axis - S * 0.04, barW, S * 0.08);
    if (minusAlive) {
      ctx.font = latin(S, false, 600);
      ctx.lineWidth = S * 0.1;
      ctx.fillStyle = rgbaHex(C.red, 0.9 * st.alpha * clamp(st.subst * 1.5));
      ctx.strokeStyle = rgbaHex(C.red, 0.6 * st.alpha * clamp(st.subst * 1.5));
      ctx.fillText('−', m1.x, m1.y);
      ctx.strokeText('−', m1.x, m1.y);
      glow(ctx, C.red, m1.x + M.minus / 2, m1.y - S * 0.25, S * 0.7, 0.6 * st.subst * st.alpha);
      if (st.twin > 0) {
        const sc = ease.outBack(clamp(st.twin));
        ctx.save();
        ctx.translate(m2.x + M.minus / 2, m2.y - S * 0.25);
        ctx.scale(sc, sc);
        ctx.fillStyle = rgbaHex(C.red, 0.9 * st.alpha * clamp(st.twin * 2));
        ctx.fillText('−', -M.minus / 2, S * 0.25);
        ctx.restore();
        glow(ctx, C.red, m2.x + M.minus / 2, m2.y - S * 0.25, S * 0.7 * st.twin, 0.6 * st.alpha);
      }
    }
    if (st.sweep > 0 && st.sweep < 1) {
      glow(ctx, C.cyan, sweepX, axis, S * 1.1, 0.5 * st.alpha);
      ctx.beginPath();
      ctx.rect(sweepX - S * 0.45, numBase - S * 1.2, S * 0.9, S * 2.8);
      ctx.clip();
      ctx.lineWidth = S * 0.08;
      glyphs.forEach((g, i) => {
        const a = g.a * glyphAlpha(i);
        if (a <= 0.003) return;
        ctx.font = fontOf(g);
        ctx.fillStyle = rgbaHex('#FFFFFF', 0.9 * a);
        ctx.strokeStyle = rgbaHex('#FFFFFF', 0.6 * a);
        ctx.fillText(g.s, g.x, g.y);
        ctx.strokeText(g.s, g.x, g.y);
      });
    }
    ctx.restore();
    return info;
  }

  // settled state (A after its write-on; B after the collapse) is glyph-for-glyph the same law: draw it from a
  // cached raster (one blit) instead of re-shaping the glyphs every frame
  const settled = st.write >= 1 && !minusAlive && (st.subst === 0 || st.collapse >= 1);
  if (settled) {
    const H = Math.ceil(S * 3);
    const top = Math.floor(cy - S * 1.5);
    const cache = memo(`S02:eqcache:${cx}:${top}:${S}`, () => {
      const c = document.createElement('canvas');
      c.width = 1080;
      c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.translate(0, -top);
      paintGlyphs(g, glyphs, () => 1, fontOf, barX, barW, axis, S, white, 1);
      return c;
    });
    ctx.save();
    ctx.globalAlpha = clamp(st.alpha);
    ctx.drawImage(cache, 0, top);
    ctx.restore();
  } else {
    ctx.save();
    paintGlyphs(ctx, glyphs, glyphAlpha, fontOf, barX, barW, axis, S, white, st.write);
    // minus signs (reversal red)
    if (minusAlive) {
      ctx.font = latin(S, false, 600);
      ctx.fillStyle = rgbaHex('#FF8FA3', st.alpha * clamp(st.subst * 1.5));
      ctx.fillText('−', m1.x, m1.y);
      if (st.twin > 0) {
        ctx.save();
        const sc = ease.outBack(clamp(st.twin));
        ctx.translate(m2.x + M.minus / 2, m2.y - S * 0.25);
        ctx.scale(sc, sc);
        ctx.fillStyle = rgbaHex('#FF8FA3', st.alpha * clamp(st.twin * 2));
        ctx.fillText('−', -M.minus / 2, S * 0.25);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  // identical-law sweep: a glint travels across the glyphs (same instant in A and B)
  if (st.sweep > 0 && st.sweep < 1) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.beginPath();
    ctx.rect(sweepX - S * 0.45, numBase - S * 1.2, S * 0.9, S * 2.8);
    ctx.clip();
    glyphs.forEach((g, i) => {
      const a = g.a * glyphAlpha(i);
      if (a <= 0.003) return;
      ctx.font = fontOf(g);
      ctx.fillStyle = rgbaHex('#FFFFFF', a);
      ctx.fillText(g.s, g.x, g.y);
    });
    ctx.fillStyle = rgbaHex('#FFFFFF', 0.9 * st.alpha);
    ctx.fillRect(barX, axis - Math.max(1, S * 0.0175), barW, Math.max(2, S * 0.035));
    ctx.restore();
  }
  return info;
}

/** The main (sharp) glyph pass: fraction bar + every glyph. No shadowBlur: the halo comes from the bloom pass. */
function paintGlyphs(ctx: Ctx, glyphs: G[], glyphAlpha: (i: number) => number, fontOf: (g: G) => string, barX: number, barW: number, axis: number, S: number, white: string, write: number) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.strokeStyle = rgbaHex(white, 0.95 * glyphAlpha(1));
  ctx.lineWidth = Math.max(2, S * 0.035);
  ctx.beginPath();
  const bw = barW * ease.outCubic(clamp(write * 1.6));
  ctx.moveTo(barX + (barW - bw) / 2, axis);
  ctx.lineTo(barX + (barW + bw) / 2, axis);
  ctx.stroke();
  glyphs.forEach((g, i) => {
    const a = g.a * glyphAlpha(i);
    if (a <= 0.003) return;
    ctx.font = fontOf(g);
    ctx.fillStyle = g.col.startsWith('#') ? rgbaHex(g.col, a) : g.col;
    if (g.sc !== undefined && g.sc < 0.999) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(Math.max(0.001, g.sc), 1);
      ctx.fillText(g.s, 0, 0);
      ctx.restore();
    } else ctx.fillText(g.s, g.x, g.y);
  });
}

function lerpCol(t: number) {
  const k = clamp(t);
  const r = Math.round(lerp(230, 255, k));
  const g = Math.round(lerp(252, 143, k));
  const b = Math.round(lerp(255, 163, k));
  return `rgb(${r},${g},${b})`;
}
