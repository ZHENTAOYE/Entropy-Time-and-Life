// Canvas HUD of the forensic lab: gutter axis, 3·2·1 countdown, "?" stamps, t → −t, the N counter with the
// verdict ? → ! → !!, panel clocks and the final verdict stamps. It is a BLIND test: until the reveal (T.reveal)
// both panels are labelled identically (scrambled clocks, no ▶), so the HUD never gives the answer away.
import { clamp, ease, lerp, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { C, GUTTER_Y, PA, PANEL_H, PANEL_W, PB, T } from './constants';
import { Ctx, glow, latin, mono, outlineText, rgbaHex, ring, sans, trackedText, typed, win } from './paint';
import { checkMark, k400 } from './stages';
import { GAS_DISC, gasDiscRadius, gasRun } from './sims';
import { arrow } from './paint';

export const panelsAlpha = (f: number) => 1 - ease.inOutQuad(seg(f, T.panelsOut, T.panelsOut + 18));
const gutterAlpha = (f: number) => seg(f, 30, 44) * (1 - seg(f, T.panelsOut - 8, T.panelsOut + 6));

// ------------------------------------------------------------------ gutter axis (the t = 0 mirror between A and B)
export function drawGutterAxis(ctx: Ctx, f: number) {
  const a = gutterAlpha(f);
  if (a <= 0) return;
  const L = 430 * ease.inOutCubic(seg(f, 30, 50));
  ctx.strokeStyle = rgbaHex(C.cyan, 0.26 * a);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(540 - L, GUTTER_Y + 0.5);
  ctx.lineTo(540 + L, GUTTER_Y + 0.5);
  for (let x = 140; x <= 940; x += 50) {
    if (Math.abs(x - 540) > L) continue;
    const h = x === 540 ? 10 : 4;
    ctx.moveTo(x + 0.5, GUTTER_Y - h);
    ctx.lineTo(x + 0.5, GUTTER_Y + h);
  }
  ctx.stroke();
}

// ------------------------------------------------------------------ countdown 3·2·1 and the gutter "?"
export function drawCountdown(ctx: Ctx, f: number, glowLayer: boolean) {
  // leaves the gutter centre before the audit label (T.audit + 4) takes it
  const a = win(f, 67, T.audit + 6, 5, 8);
  if (a <= 0) return;
  const cx = 540;
  const cy = GUTTER_Y;
  let idx = -1;
  T.count.forEach((cf, i) => {
    if (f >= cf) idx = i;
  });
  const qOn = f >= T.qStamp;
  const lastTick = qOn ? T.qStamp : idx >= 0 ? T.count[idx] : 64;
  const pop = 1 + 0.35 * (1 - ease.outCubic(seg(f, lastTick, lastTick + 6)));
  if (glowLayer) {
    glow(ctx, qOn ? C.cyan : C.core, cx, cy - 4, 70, 0.35 * a * (2 - pop));
    return;
  }
  // dark plate so the numeral reads over the axis
  ctx.fillStyle = rgbaHex(C.bg, 0.9 * a);
  ctx.fillRect(cx - 62, cy - 52, 124, 104);
  ctx.strokeStyle = rgbaHex(C.cyan, 0.5 * a);
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 62 + 0.5, cy - 52 + 0.5, 124, 104);
  ctx.save();
  ctx.translate(cx, cy - 6);
  ctx.scale(pop, pop);
  ctx.textAlign = 'center';
  if (qOn) {
    ctx.font = latin(84, false, 600);
    ctx.fillStyle = rgbaHex(C.cyan, a);
    ctx.fillText('?', 0, 28);
  } else if (idx >= 0) {
    ctx.font = mono(66, 400);
    ctx.fillStyle = rgbaHex(C.core, a);
    ctx.fillText(String(3 - idx), 0, 24);
  }
  ctx.restore();
  // three dots: each tick extinguishes one
  for (let i = 0; i < 3; i++) {
    const x = cx - 24 + i * 24;
    const y = cy + 38;
    const spent = idx >= i;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    if (!spent) {
      ctx.fillStyle = rgbaHex(C.cyan, a);
      ctx.fill();
    } else {
      ctx.strokeStyle = rgbaHex(C.cyan, 0.6 * a);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  if (idx >= 0) ring(ctx, cx, cy, 50, 130, seg(f, T.count[idx], T.count[idx] + 14), C.core, 0.6 * a, 1.2);
  ring(ctx, cx, cy, 50, 220, seg(f, T.qStamp, T.qStamp + 18), C.cyan, 0.8 * a, 1.5);
}

// ------------------------------------------------------------------ the big "?" stamps in both panels
/** The "?" lands big on both panels (f134), then retreats into the top-right corner as a badge while the
 * conservation audit is drawn at the panel centre (f146-156) — the verdict is still "?" — and leaves with the law. */
export function drawQStamps(ctx: Ctx, f: number, glowLayer: boolean) {
  const a = win(f, T.qStamp, T.eqIn + 2, 5, 12);
  if (a <= 0) return;
  const t = seg(f, T.qStamp, T.qStamp + 7);
  const mv = ease.inOutCubic(seg(f, T.audit, T.audit + 10));
  const sc = lerp(1.7, 1, ease.outBack(t)) * lerp(1, 0.26, mv);
  for (const [P, rot] of [
    [PA, -0.05],
    [PB, 0.05],
  ] as const) {
    const cx = lerp(P.x + PANEL_W / 2, P.x + PANEL_W - 86, mv);
    const cy = lerp(P.y + PANEL_H / 2, P.y + 92, mv);
    if (glowLayer) {
      glow(ctx, C.cyan, cx, cy, lerp(260, 90, mv), 0.32 * a);
      continue;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * (1 - mv));
    ctx.scale(sc, sc);
    ctx.font = latin(330, false, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // as a badge it gets a solid fill (a 330 px outline scaled to 26 % would be a hairline)
    outlineText(ctx, '?', 0, 10, rgbaHex(C.cyan, 0.95 * a * t), rgbaHex(C.cyan, lerp(0.1, 0.85, mv) * a * t), 2.5 / lerp(1, 0.4, mv));
    ctx.restore();
    if (mv > 0) {
      // badge frame
      ctx.strokeStyle = rgbaHex(C.cyan, 0.6 * a * mv);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(Math.round(cx - 44) + 0.5, Math.round(cy - 44) + 0.5, 88, 88);
    }
    ring(ctx, P.x + PANEL_W / 2, P.y + PANEL_H / 2, 120, 330, seg(f, T.qStamp + 2, T.qStamp + 22), C.cyan, 0.7, 1.5);
  }
}

// ------------------------------------------------------------------ audit verdict (both recordings are lawful)
const AUDIT_PARTS: Array<[string, 'A' | 'B' | null]> = [
  ['A · Σp ', null],
  ['', 'A'],
  ['  ΣE ', null],
  ['', 'A'],
  ['   |   B · Σp ', null],
  ['', 'B'],
  ['  ΣE ', null],
  ['', 'B'],
];
export function drawAuditLabel(ctx: Ctx, f: number) {
  const a = win(f, T.audit + 4, T.eqIn, 4, 10);
  if (a <= 0) return;
  ctx.save();
  ctx.font = mono(26, 400);
  const ck = 26; // width reserved for a check mark
  const widths = AUDIT_PARTS.map(([s, slot]) => (slot ? ck : ctx.measureText(s).width));
  const w = widths.reduce((p, q) => p + q, 0);
  const x0 = Math.round(540 - w / 2);
  ctx.fillStyle = rgbaHex(C.bg, 0.9 * a);
  ctx.fillRect(x0 - 24, GUTTER_Y - 27, w + 48, 54);
  const done = f >= T.auditLand;
  ctx.strokeStyle = rgbaHex(done ? '#FFFFFF' : C.cyan, 0.45 * a);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 24 + 0.5, GUTTER_Y - 27 + 0.5, w + 48, 54);
  // types on left to right (the check slots count as one character each)
  let budget = Math.floor((f - T.audit - 4) * 2.5);
  let x = x0;
  ctx.textAlign = 'left';
  AUDIT_PARTS.forEach(([s, slot], i) => {
    if (slot) {
      const land = slot === 'A' ? T.auditLandA : T.auditLand;
      const k = seg(f, land, land + 5);
      if (k > 0) checkMark(ctx, x + ck / 2, GUTTER_Y, 22 * (1 + 0.4 * (1 - ease.outCubic(k))), slot === 'A' || done ? '#FFFFFF' : C.cyan, a, k * 1.4);
      else if (budget > 0) {
        ctx.fillStyle = rgbaHex(C.cyan, 0.45 * a);
        ctx.fillText('·', x + ck / 2 - 7, GUTTER_Y + 9);
      }
      budget -= 1;
    } else if (budget > 0) {
      const ch = Array.from(s);
      const shown = ch.slice(0, Math.max(0, budget)).join('');
      ctx.fillStyle = rgbaHex(C.cyan, 0.95 * a);
      ctx.fillText(shown, x, GUTTER_Y + 9);
      budget -= ch.length;
    }
    x += widths[i];
  });
  ctx.restore();
}

// ------------------------------------------------------------------ t → −t (gutter) during the law
export function drawLawHud(ctx: Ctx, f: number, glowLayer: boolean) {
  // fully shown f244-256 (T.invariant + 8 .. T.eqOut - 2), gone by f266, before the N plate fades in (T.eqOut + 2)
  const a = win(f, T.subst - 6, T.eqOut + 8, 8, 10);
  if (a <= 0 || glowLayer) return;
  const y = GUTTER_Y + 16;
  const k = ease.inOutCubic(seg(f, T.invariant, T.invariant + 8));
  ctx.save();
  const parts: Array<[string, string, string]> = [
    ['t', latin(54, true, 600), C.core],
    ['  →  ', latin(46, false, 600), C.cyan],
    ['−', latin(54, false, 600), '#FF8FA3'],
    ['t', latin(54, true, 600), C.core],
  ];
  const widths = parts.map(([s, font]) => {
    ctx.font = font;
    return ctx.measureText(s).width;
  });
  const total = widths.reduce((p, q) => p + q, 0);
  const x0 = 540 - total / 2;
  // 「：不变 ✓」 layout
  ctx.font = sans(38, 400);
  const colonW = ctx.measureText('：').width;
  const xColon = x0 + total + 4;
  const xWord = xColon + colonW + 2;
  const wordW = ctx.measureText('不').width * 2 + 8;
  const xTick = xWord + wordW + 22;
  const right = lerp(x0 + total + 40, xTick + 58, k);
  ctx.fillStyle = rgbaHex(C.bg, 0.86 * a);
  ctx.fillRect(x0 - 40, GUTTER_Y - 40, right - (x0 - 40), 80);
  let x = x0;
  const shown = clamp((f - T.subst + 6) / 10);
  parts.forEach(([s, font, col], i) => {
    ctx.font = font;
    ctx.fillStyle = rgbaHex(col, a * clamp(shown * 4 - i));
    ctx.textAlign = 'left';
    ctx.fillText(s, x, y);
    x += widths[i];
  });
  if (k > 0) {
    ctx.font = sans(38, 400);
    ctx.fillStyle = rgbaHex(C.cyan, a * k);
    ctx.fillText('：', xColon, y - 2);
    ctx.fillStyle = rgbaHex(C.core, a * k);
    trackedText(ctx, '不变', xWord, y - 2, 8, 'left');
    checkMark(ctx, xTick + 15, y - 13, 30, C.cyan, a, clamp(k * 2 - 1));
  }
  ctx.restore();
}

// ------------------------------------------------------------------ escalation HUD: N counter + 能分辨吗？ + verdict
function nValue(f: number): [string, string, number] {
  // [old, new, roll 0..1]
  if (f < T.wipe10) return ['2', '2', 1];
  if (f < T.wipe400) return ['2', '10', seg(f, T.wipe10, T.wipe10 + 8)];
  return ['10', '400', seg(f, T.wipe400, T.wipe400 + 8)];
}
export function verdictAt(f: number): { glyph: string; col: string; since: number } | null {
  if (f >= T.verdict2) return { glyph: '!!', col: C.red, since: T.verdict2 };
  if (f >= T.verdict1) return { glyph: '!', col: '#FFFFFF', since: T.verdict1 };
  if (f >= T.verdictQ) return { glyph: '?', col: C.cyan, since: T.verdictQ };
  return null;
}
export function drawEscalationHud(ctx: Ctx, f: number, glowLayer: boolean) {
  const a = win(f, T.eqOut + 2, T.panelsOut + 2, 8, 12);
  if (a <= 0) return;
  const y = GUTTER_Y;
  const v = verdictAt(f);
  if (glowLayer) {
    if (v) {
      const pop = 1 - seg(f, v.since, v.since + 16);
      const gc = v.glyph === '!!' ? C.red : C.cyan;
      glow(ctx, gc, 892, y, 70 + 50 * pop, (0.18 + 0.5 * pop) * a);
    }
    return;
  }
  ctx.save();
  ctx.fillStyle = rgbaHex(C.bg, 0.8 * a);
  ctx.fillRect(96, y - 46, 300, 92);
  // N counter with an odometer roll
  const [o, nw, roll] = nValue(f);
  ctx.font = mono(30, 400);
  ctx.fillStyle = rgbaHex(C.cyan, 0.75 * a);
  ctx.textAlign = 'left';
  ctx.fillText('N =', 112, y + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(180, y - 44, 220, 88);
  ctx.clip();
  const e = ease.inOutCubic(roll);
  ctx.font = mono(64, 700);
  if (roll < 1) {
    ctx.fillStyle = rgbaHex(C.core, a * (1 - e));
    ctx.fillText(o, 186, y + 23 - 60 * e);
  }
  ctx.fillStyle = rgbaHex(C.core, a * e);
  ctx.fillText(nw, 186, y + 23 + 60 * (1 - e));
  ctx.restore();
  // label
  const la = seg(f, T.verdictQ - 2, T.verdictQ + 10) * a;
  if (la > 0) {
    // HUD Chinese (Sans 28, palette at 70 %, .15 em): a lab label, not the narration voice
    ctx.font = sans(28, 400);
    ctx.fillStyle = rgbaHex(C.cyan, 0.7 * la);
    const s = typed('能分辨吗？', f - (T.verdictQ - 2), 0.6);
    trackedText(ctx, s, 586, y + 10, 28 * 0.15, 'left');
  }
  // verdict glyph
  if (v) {
    const t = seg(f, v.since - 1, v.since + 6);
    const sc = lerp(1.9, 1, ease.outBack(t));
    ctx.save();
    ctx.translate(892, y);
    ctx.scale(sc, sc);
    ctx.font = latin(118, false, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const jit = v.glyph === '!!' ? (hash01(f, 5) - 0.5) * 4 * (1 - seg(f, v.since, v.since + 20)) : 0;
    ctx.fillStyle = rgbaHex(v.col, a * clamp(t * 2));
    ctx.fillText(v.glyph, jit, 6);
    ctx.restore();
    ring(ctx, 892, y, 36, 118, seg(f, v.since, v.since + 16), v.col, 0.7 * a, 1.4);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ panel labels and clocks
/** "??.??" with the odd digit flickering through: the direction of the recording is unknown */
function scramble(f: number, salt: number) {
  const d = (i: number) => {
    const k = Math.floor(f / 2) * 7 + i;
    return hash01(k, salt + 1) < 0.18 ? String(Math.floor(hash01(k, salt) * 10)) : '?';
  };
  return `${d(1)}${d(2)}.${d(3)}${d(4)}`;
}
/** The answer is given on one frame for everything: clocks, stamps, B's red frame. */
export const revealed = (f: number) => f >= T.reveal;
/** 0..1 ramp of the reveal (chromatic fringe on B's gas). */
export function revealK(f: number) {
  return seg(f, T.reveal - 1, T.reveal + 5);
}
export function drawPanelHud(ctx: Ctx, f: number) {
  const pa = panelsAlpha(f);
  const on = seg(f, 32, 40) * pa;
  if (on <= 0) return;
  const rv = revealed(f);
  for (const w of ['A', 'B'] as const) {
    const P = w === 'A' ? PA : PB;
    const tint = w === 'B' && rv ? C.red : C.cyan;
    // blind test: identical labels in both panels until the reveal (different scramble salts only)
    let s: string;
    if (!rv) s = `?  t = ${scramble(f, w === 'A' ? 9 : 3)} s`;
    else if (w === 'A') s = `▶  t = +${(k400('A', f) / 30).toFixed(2).padStart(5, '0')} s`;
    else s = `◀◀ t = ${(k400('B', f) / 30).toFixed(2).padStart(5, '0')} s`;
    ctx.font = mono(26, 400);
    const tw = ctx.measureText('◀◀ t = +00.00 s').width;
    // near-opaque plate with a hairline: balls passing under it never speckle through the clock
    ctx.fillStyle = rgbaHex(C.bg, 0.94 * on);
    ctx.fillRect(P.x + 10, P.y + 12, 64 + tw + 18, 50);
    ctx.strokeStyle = rgbaHex(tint, 0.5 * on);
    ctx.lineWidth = 1;
    ctx.strokeRect(P.x + 10 + 0.5, P.y + 12 + 0.5, 64 + tw + 17, 49);
    ctx.textAlign = 'left';
    ctx.font = mono(32, 700);
    ctx.fillStyle = rgbaHex(tint, on);
    ctx.fillText(w, P.x + 24, P.y + 49);
    ctx.font = mono(26, 400);
    ctx.fillStyle = rgbaHex(tint, 0.9 * on);
    if (w === 'B' && rv && Math.floor(f / 8) % 2 === 1) ctx.fillStyle = rgbaHex(tint, 0.45 * on);
    ctx.fillText(s, P.x + 64, P.y + 46);
  }
}

// ------------------------------------------------------------------ top title strip (sets up the blind test, then leaves)
export function drawTitle(ctx: Ctx, f: number) {
  const a = seg(f, 34, 42) * (1 - seg(f, 64, 74));
  if (a <= 0) return;
  ctx.font = mono(24, 400);
  ctx.textAlign = 'left';
  ctx.fillStyle = rgbaHex(C.cyan, 0.75 * a);
  trackedText(ctx, typed('FIG.02  TIME-REVERSAL BLIND TEST', f - 34, 2.2), 90, 256, 2, 'left');
}

// ------------------------------------------------------------------ verdict stamps (answer to card 1)
export function drawVerdictStamps(ctx: Ctx, f: number, glowLayer: boolean) {
  const a = seg(f, T.reveal - 1, T.reveal + 2) * panelsAlpha(f);
  if (a <= 0) return;
  const t = seg(f, T.reveal - 1, T.reveal + 6);
  const sc = lerp(1.8, 1, ease.outBack(t));
  const items: Array<[{ x: number; y: number }, string, string, string, number]> = [
    [PA, '▶', '正放', C.cyan, -0.07],
    [PB, '◀◀', '倒放', C.red, -0.07],
  ];
  for (const [P, sym, word, col, rot] of items) {
    const cx = P.x + PANEL_W - 170;
    const cy = P.y + 92;
    if (glowLayer) {
      glow(ctx, col, cx, cy, 170, 0.35 * a);
      continue;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.fillStyle = rgbaHex(C.bg, 0.75 * a);
    ctx.fillRect(-118, -42, 236, 84);
    ctx.strokeStyle = rgbaHex(col, 0.95 * a);
    ctx.lineWidth = 3;
    ctx.strokeRect(-118, -42, 236, 84);
    ctx.lineWidth = 1;
    ctx.strokeRect(-111, -35, 222, 70);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgbaHex(col, a);
    ctx.font = mono(34, 700);
    const sw = ctx.measureText(sym).width;
    ctx.font = sans(44, 700);
    const ww = ctx.measureText(word).width + 8;
    const x0 = -(sw + 16 + ww) / 2;
    ctx.font = mono(34, 700);
    ctx.fillText(sym, x0, 2);
    ctx.font = sans(44, 700);
    trackedText(ctx, word, x0 + sw + 16, 3, 8, 'left');
    ctx.restore();
  }
}


// ------------------------------------------------------------------ the arrow of time, drawn on the physics (panel A)
/** "方向，出现了": a dashed ghost of the initial disc (t = 0, the low-entropy start) and a gold arrow from it into
 * the spread gas — the direction points from the special start toward the many. */
export function drawPhysicsArrow(ctx: Ctx, f: number, glowLayer: boolean) {
  const a = seg(f, T.verdict2 + 6, T.verdict2 + 14) * panelsAlpha(f);
  if (a <= 0) return;
  const cx = PA.x + GAS_DISC.x;
  const cy = PA.y + GAS_DISC.y;
  const R = gasDiscRadius();
  const k = ease.inOutCubic(seg(f, T.verdict2 + 10, T.verdict2 + 28));
  const x0 = cx + R + 14;
  const x1 = lerp(x0, PA.x + PANEL_W - 60, k);
  if (glowLayer) {
    if (k > 0) {
      glow(ctx, C.gold, x1, cy, 70, 0.6 * a);
      // a row of soft sprites along the shaft = the halo the old shadowBlur gave it
      for (let x = x0; x < x1; x += 28) glow(ctx, C.gold, x, cy, 26, 0.22 * a);
    }
    glow(ctx, C.gold, (x0 + x1) / 2, cy, (x1 - x0) * 0.6 + 20, 0.12 * a);
    return;
  }
  ctx.save();
  // the ghost of the t = 0 drop: every ball's starting position, faint gold, inside a dashed outline
  const run = gasRun();
  ctx.fillStyle = rgbaHex(C.gold, 0.32 * a);
  ctx.beginPath();
  for (let i = 0; i < run.n; i++) {
    const x = PA.x + run.pos[i * 2];
    const y = PA.y + run.pos[i * 2 + 1];
    ctx.moveTo(x + 2.2, y);
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = rgbaHex(C.gold, 0.85 * a);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // label under the ghost (above it would collide with the panel clock plate)
  ctx.font = mono(26, 700);
  const lw = ctx.measureText('t = 0').width;
  ctx.fillStyle = rgbaHex(C.bg, 0.8 * a);
  ctx.fillRect(cx - lw / 2 - 12, cy + R + 10, lw + 24, 36);
  ctx.textAlign = 'center';
  ctx.fillStyle = rgbaHex(C.gold, a);
  ctx.fillText('t = 0', cx, cy + R + 37);
  // (its glow comes from the bloom pass — no CPU shadowBlur)
  if (k > 0.01) arrow(ctx, x0, cy, x1, cy, 24, rgbaHex(C.gold, a), 5);
  ctx.restore();
}
