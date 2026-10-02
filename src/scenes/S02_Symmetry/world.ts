// S02 compositor: one sharp main pass (1080x1920) and one bloom pass (drawn at 1/4 scale, additive).
import { clamp, ease, memo, mixHex, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { C, PA, PANEL_H, PANEL_W, PB, Q_DOT, T } from './constants';
import { drawEquation, EqState } from './equation';
import { drawBox, drawBoxGlow, drawSwarm, swarmPlan } from './finale';
import {
  drawCountdown,
  drawEscalationHud,
  drawGutterAxis,
  drawLawHud,
  drawAuditLabel,
  drawPanelHud,
  drawPhysicsArrow,
  drawQStamps,
  drawTitle,
  drawVerdictStamps,
  panelsAlpha,
  revealed,
  revealK,
} from './hud';
import { drawOpening, introOf } from './opening';
import { Ctx, drawPanelChrome, glow, gridCanvas, lightTableSprite, rgbaHex, vignetteSprite } from './paint';
import { drawAudit, drawGas, drawRack, drawTwo, pushInB, Stage, stageAt, Which } from './stages';
import { GAS_DISC } from './sims';

const EQ_SIZE = 84;

// ------------------------------------------------------------------ equation states
function eqState(w: Which, f: number): EqState {
  const write = seg(f, T.eqIn, T.eqIn + 16);
  const alpha = 1 - ease.inOutQuad(seg(f, T.eqOut, T.eqOut + 8));
  const sweep = seg(f, T.invariant, T.invariant + 16);
  if (w === 'A') return { write, subst: 0, twin: 0, fly: 0, collapse: 0, alpha, sweep };
  return {
    write,
    subst: ease.outCubic(seg(f, T.subst, T.subst + 8)),
    twin: seg(f, T.twin, T.twin + 6),
    fly: seg(f, T.twin + 6, T.annihilate),
    collapse: seg(f, T.collapse, T.collapse + 10),
    alpha,
    sweep,
  };
}
const eqVisible = (f: number) => f >= T.eqIn - 1 && f < T.eqOut + 9;

function annihilationFlash(ctx: Ctx, f: number, mx: number, my: number, glowLayer: boolean) {
  const t = seg(f, T.annihilate - 1, T.annihilate + 14);
  if (t <= 0 || t >= 1) return;
  if (glowLayer) {
    glow(ctx, '#FFFFFF', mx, my, 60 + 220 * t, 1.4 * (1 - t) * (1 - t));
    glow(ctx, C.red, mx, my, 120 + 200 * t, 0.6 * (1 - t));
    return;
  }
  const core = 1 - seg(f, T.annihilate - 1, T.annihilate + 4);
  if (core > 0) {
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 46);
    g.addColorStop(0, `rgba(255,255,255,${core})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, 46, 0, Math.PI * 2);
    ctx.fill();
  }
  // sparks
  ctx.strokeStyle = `rgba(255,220,228,${(1 - t) * 0.95})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + hash01(i, 9) * 0.3;
    const r0 = 12 + 70 * ease.outCubic(t);
    const r1 = r0 + 26 * (1 - t) + 8;
    ctx.moveTo(mx + Math.cos(a) * r0, my + Math.sin(a) * r0);
    ctx.lineTo(mx + Math.cos(a) * r1, my + Math.sin(a) * r1);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.8})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx, my, 10 + 140 * ease.outCubic(t), 0, Math.PI * 2);
  ctx.stroke();
}

// ------------------------------------------------------------------ panels
function drawStage(ctx: Ctx, s: Stage, w: Which, f: number, P: { x: number; y: number }, glowLayer: boolean) {
  if (s === 2) drawTwo(ctx, w, f, P.x, P.y, glowLayer, introOf(f));
  else if (s === 10) drawRack(ctx, w, f, P.x, P.y, glowLayer);
  else {
    const fringe = w === 'B' ? revealK(f) * (0.65 + 0.35 * hash01(Math.floor(f / 2), 61)) : 0;
    // once the swarm starts, a ball leaves panel A's gas on its own launch frame (drawSwarm takes it over): until
    // then it keeps the gas look and stays clipped to the panel, under the HUD
    const launch = w === 'A' && f >= T.swarm ? swarmPlan().launch : null;
    drawGas(ctx, w, f, P.x, P.y, glowLayer, 1, fringe, launch ? (i) => f >= launch[i] : undefined);
  }
}

/** Motivated push-in on panel B's condensing drop (content only: the panel frame, grid and HUD stay put). */
function applyZoom(ctx: Ctx, w: Which, f: number) {
  if (w !== 'B') return;
  const z = pushInB(f);
  if (z <= 1.0001) return;
  const cx = PB.x + GAS_DISC.x;
  const cy = PB.y + GAS_DISC.y;
  ctx.translate(cx, cy);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
}

function panelContent(ctx: Ctx, w: Which, f: number, glowLayer: boolean) {
  const P = w === 'A' ? PA : PB;
  const st = stageAt(f);
  if (w === 'A' && f >= T.swarm + 8) return; // every ball has launched: the swarm owns panel A's balls now
  if (glowLayer) {
    ctx.save();
    ctx.globalAlpha = 1;
    applyZoom(ctx, w, f);
    if (st.prev && st.wipe < 1) {
      // same split as the sharp pass: new stage above the scan line, old stage below
      const ys = P.y + PANEL_H * ease.inOutCubic(st.wipe);
      ctx.save();
      ctx.beginPath();
      ctx.rect(P.x - 40, ys, PANEL_W + 80, P.y + PANEL_H + 40 - ys);
      ctx.clip();
      drawStage(ctx, st.prev, w, f, P, true);
      ctx.restore();
      ctx.beginPath();
      ctx.rect(P.x - 40, P.y - 40, PANEL_W + 80, ys - P.y + 40);
      ctx.clip();
      drawStage(ctx, st.cur, w, f, P, true);
    } else drawStage(ctx, st.cur, w, f, P, true);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(P.x, P.y, PANEL_W, PANEL_H);
  ctx.clip();
  applyZoom(ctx, w, f);
  if (st.prev && st.wipe < 1) {
    const ys = P.y + PANEL_H * ease.inOutCubic(st.wipe);
    ctx.save();
    ctx.beginPath();
    ctx.rect(P.x, ys, PANEL_W, P.y + PANEL_H - ys);
    ctx.clip();
    drawStage(ctx, st.prev, w, f, P, false);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(P.x, P.y, PANEL_W, ys - P.y);
    ctx.clip();
    drawStage(ctx, st.cur, w, f, P, false);
    ctx.restore();
    // plotter scan line
    const gr = ctx.createLinearGradient(0, ys - 60, 0, ys);
    gr.addColorStop(0, 'rgba(57,225,255,0)');
    gr.addColorStop(1, 'rgba(57,225,255,0.22)');
    ctx.fillStyle = gr;
    ctx.fillRect(P.x, ys - 60, PANEL_W, 60);
    ctx.fillStyle = rgbaHex(C.core, 0.95);
    ctx.fillRect(P.x, ys - 1, PANEL_W, 2);
  } else drawStage(ctx, st.cur, w, f, P, false);
  ctx.restore();
}

/** B's tape: at the reveal and when it is ejected it tears into horizontal slices (time tampered with). */
function offscreen(): HTMLCanvasElement {
  return memo('S02:offB', () => {
    const c = document.createElement('canvas');
    c.width = PANEL_W + 80;
    c.height = PANEL_H + 80;
    return c;
  });
}
function bGlitchAmount(f: number): number {
  const rev = seg(f, T.verdict2, T.verdict2 + 3) * (1 - seg(f, T.verdict2 + 3, T.verdict2 + 12));
  const out = seg(f, T.panelsOut - 4, T.panelsOut + 16);
  return Math.max(rev, out);
}
function panelBWithGlitch(ctx: Ctx, f: number) {
  const g = bGlitchAmount(f);
  const out = seg(f, T.panelsOut - 4, T.panelsOut + 18);
  if (g <= 0.001) {
    panelContent(ctx, 'B', f, false);
    return;
  }
  if (out >= 1) return;
  const off = offscreen();
  const o = off.getContext('2d', { willReadFrequently: true })!;
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, off.width, off.height);
  o.translate(40 - PB.x, 40 - PB.y);
  panelContent(o, 'B', f, false);
  o.setTransform(1, 0, 0, 1, 0, 0);
  const bands = 14;
  const bh = off.height / bands;
  const fr = Math.floor(f);
  ctx.save();
  ctx.globalAlpha = 1 - ease.inQuad(out);
  for (let b = 0; b < bands; b++) {
    const r = hash01(fr * 31 + b, 77);
    const shift = (r - 0.5) * 90 * g * (r > 0.45 ? 1 : 0.15);
    const sy = b * bh;
    ctx.drawImage(off, 0, sy, off.width, bh, PB.x - 40 + shift, PB.y - 40 + sy, off.width, bh);
  }
  // RGB ghost copies
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 * g * (1 - out);
  ctx.drawImage(off, PB.x - 40 + 7 * g, PB.y - 40);
  ctx.restore();
}

/** While the viewer guesses, both recordings are scanned line by line, in sync (one sweep per countdown tick). */
function scanBeams(ctx: Ctx, f: number) {
  if (f < T.count[0] - 6 || f >= T.qStamp) return;
  const period = T.count[1] - T.count[0];
  const ph = ((f - (T.count[0] - 6)) % period) / period;
  const a = 0.55 * Math.sin(Math.PI * ph);
  for (const P of [PA, PB]) {
    const y = P.y + PANEL_H * ease.inOutQuad(ph);
    const g = ctx.createLinearGradient(0, y - 70, 0, y);
    g.addColorStop(0, 'rgba(57,225,255,0)');
    g.addColorStop(1, `rgba(57,225,255,${(0.12 * a).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(P.x, y - 70, PANEL_W, 70);
    ctx.fillStyle = `rgba(230,252,255,${(0.6 * a).toFixed(3)})`;
    ctx.fillRect(P.x, y - 0.75, PANEL_W, 1.5);
    // edge tick marks riding with the beam
    ctx.fillRect(P.x - 12, y - 1, 10, 2);
    ctx.fillRect(P.x + PANEL_W + 2, y - 1, 10, 2);
  }
}

// ------------------------------------------------------------------ main pass
/** Steady-state backdrop (f 50..421: black->bg done, light table full, grid fully revealed at 100 %). */
function steadyBackdrop(): HTMLCanvasElement {
  return memo('S02:backdrop', () => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1920;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    drawBackdrop(g, 200);
    return c;
  });
}
const STEADY_FROM = 50;
const STEADY_TO = T.panelsOut - 1;

export function drawMain(ctx: Ctx, f: number) {
  if (f >= STEADY_FROM && f <= STEADY_TO) ctx.drawImage(steadyBackdrop(), 0, 0);
  else drawBackdrop(ctx, f);
  drawWorld(ctx, f);
}

function drawBackdrop(ctx: Ctx, f: number) {
  // background
  const bgK = ease.inOutQuad(seg(f, 3, 30));
  ctx.fillStyle = mixHex('#000000', C.bg, bgK);
  ctx.fillRect(0, 0, 1080, 1920);
  const pa = panelsAlpha(f);
  const endFade = 1 - ease.inOutQuad(seg(f, T.evaporate - 6, T.outHold - 4));
  // light-table glow behind the panels (gone on the OUT frame)
  const lt = seg(f, 20, 50) * endFade * (0.35 + 0.65 * pa);
  if (lt > 0) {
    ctx.globalAlpha = lt;
    ctx.drawImage(lightTableSprite([PA, PB].map((P) => [P.x + PANEL_W / 2, P.y + PANEL_H / 2] as [number, number])), 0, 0, 1080, 1920);
    ctx.globalAlpha = 1;
  }
  // grid: revealed by the ping from Q_DOT, fades to 20 % for the OUT frame
  const R = 1500 * ease.outCubic(seg(f, T.ping, T.ping + 40));
  const gridA = 1 - 0.8 * ease.inOutQuad(seg(f, T.evaporate - 6, T.outHold - 2));
  if (R > 1) {
    ctx.save();
    ctx.globalAlpha = gridA;
    if (R < 1500) {
      ctx.beginPath();
      ctx.arc(Q_DOT.x, Q_DOT.y, R, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(gridCanvas(), 0, 0);
    ctx.restore();
    if (R < 1500) {
      const band = 110;
      ctx.save();
      ctx.beginPath();
      ctx.arc(Q_DOT.x, Q_DOT.y, R, 0, Math.PI * 2);
      ctx.arc(Q_DOT.x, Q_DOT.y, Math.max(0, R - band), 0, Math.PI * 2, true);
      ctx.clip('evenodd');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - seg(R, 900, 1500);
      ctx.drawImage(gridCanvas(), 0, 0);
      ctx.drawImage(gridCanvas(), 0, 0);
      ctx.drawImage(gridCanvas(), 0, 0);
      ctx.restore();
    }
  }

}

function drawWorld(ctx: Ctx, f: number) {
  const pa = panelsAlpha(f);
  // panel chrome
  const drawA = seg(f, T.panelsOn, T.panelsOn + 22) * (1 - seg(f, T.panelsOut, T.panelsOut + 16));
  const drawB = seg(f, T.panelsOn + 4, T.panelsOn + 26) * (1 - seg(f, T.panelsOut + 2, T.panelsOut + 18));
  const inner = seg(f, 28, 44);
  drawPanelChrome(ctx, PA.x, PA.y, drawA, 1, C.cyan, inner * pa);
  drawPanelChrome(ctx, PB.x, PB.y, drawB, 1, revealed(f) ? C.red : C.cyan, inner * pa);
  drawGutterAxis(ctx, f);

  // experiments
  if (f >= 26) {
    panelContent(ctx, 'A', f, false);
    panelBWithGlitch(ctx, f);
  }
  scanBeams(ctx, f);
  drawAudit(ctx, 'A', f, false);
  drawAudit(ctx, 'B', f, false);
  // the law
  if (eqVisible(f)) {
    for (const w of ['A', 'B'] as const) {
      const P = w === 'A' ? PA : PB;
      const r = drawEquation(ctx, P.x + PANEL_W / 2, P.y + PANEL_H / 2 + 4, EQ_SIZE, eqState(w, f), false);
      if (w === 'B') annihilationFlash(ctx, f, r.meet.x, r.meet.y, false);
    }
  }
  drawOpening(ctx, f, false);
  // finale swarm: drawn under the (fading) panel HUD, so a ball keeps its layer when it launches out of panel A
  drawSwarm(ctx, f, false);

  // HUD
  drawTitle(ctx, f);
  drawPanelHud(ctx, f);
  drawCountdown(ctx, f, false);
  drawQStamps(ctx, f, false);
  drawAuditLabel(ctx, f);
  drawLawHud(ctx, f, false);
  drawEscalationHud(ctx, f, false);
  drawVerdictStamps(ctx, f, false);
  drawPhysicsArrow(ctx, f, false);

  // finale
  drawBox(ctx, f);
}

// ------------------------------------------------------------------ one-canvas frame: sharp pass + bloom
/** Bloom is rendered at 1/4 resolution into an offscreen canvas and screened onto the main canvas (cheaper than a
 * second full-frame DOM layer with a CSS blend mode). */
function bloomCanvas(): HTMLCanvasElement {
  return memo('S02:bloom', () => {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    return c;
  });
}
export function drawFrame(ctx: Ctx, f: number) {
  drawMain(ctx, f);
  const bc = bloomCanvas();
  const g = bc.getContext('2d', { willReadFrequently: true })!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, bc.width, bc.height);
  g.setTransform(0.25, 0, 0, 0.25, 0, 0);
  drawGlow(g, f);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'screen';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bc, 0, 0, ctx.canvas.width, ctx.canvas.height);
  // vignette (lib/overlays look, strength 0.42). A smooth radial gradient: bilinear upscaling is visually identical
  // to bicubic here and ~3x cheaper (the bloom above keeps 'high' so small glows stay round)
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(vignetteSprite(0.42), 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// ------------------------------------------------------------------ bloom pass
export function drawGlow(ctx: Ctx, f: number) {
  ctx.globalCompositeOperation = 'lighter';
  // the IN dot keeps no glow on frame 0 (exact match with S01's last frame)
  drawOpening(ctx, f, true);
  if (f >= 38) {
    panelContent(ctx, 'A', f, true);
    if (bGlitchAmount(f) < 0.5 || f < T.panelsOut) panelContent(ctx, 'B', f, true);
  }
  if (eqVisible(f)) {
    for (const w of ['A', 'B'] as const) {
      const P = w === 'A' ? PA : PB;
      const r = drawEquation(ctx, P.x + PANEL_W / 2, P.y + PANEL_H / 2 + 4, EQ_SIZE, eqState(w, f), true);
      if (w === 'B') annihilationFlash(ctx, f, r.meet.x, r.meet.y, true);
    }
  }
  drawCountdown(ctx, f, true);
  drawQStamps(ctx, f, true);
  drawAudit(ctx, 'A', f, true);
  drawAudit(ctx, 'B', f, true);
  drawEscalationHud(ctx, f, true);
  drawVerdictStamps(ctx, f, true);
  drawPhysicsArrow(ctx, f, true);
  drawSwarm(ctx, f, true);
  drawBoxGlow(ctx, f);
  ctx.globalCompositeOperation = 'source-over';
}

