// S01 effect layers, all drawn INTO the shared <InkStage> canvases (no extra full-frame layers; the stage's front
// canvas is mounted only while the tape is tampered with). Geometry is in world px (the ink renderer's frame) mapped
// through the scene camera; line widths and fine detail are in SCREEN px, so the macro shots stay photographic
// instead of thickening into vector strokes.
//   drawMacroBack  main canvas, over the tank: the macro still life's depth of field — a warm backdrop glow behind
//                  the drop, layered out-of-focus bokeh (onion-ring rims), soft bubbles in the water, and the
//                  perfectly still surface re-drawn crisp at screen resolution (TIR band, meniscus, silver line).
//   drawStrobe     main canvas (under the drop): Edgerton multi-flash exposures of the drop in flight. Equal time steps
//                  → t² spacing (ghosts closer than 2.4 r to the last one are skipped so the spacing stays readable).
//   drawDrop       the hero drop: a black-glass ink sphere — Beer–Lambert navy translucency at the thin lower edge, the
//                  light table seen upside-down through it (refraction), the still surface and lit water mirrored in
//                  its lower half (reflection), Fresnel rim, soft-box specular — with true shutter motion blur. At
//                  contact it sinks into the closing crater (never an empty frame; reversed: it emerges from it).
//   drawSplash     the impact as high-speed photography: a translucent light-guiding crown sheet (glowing rim, darker
//                  refracting band, beaded jets with glints), ballistic micro-spray with shutter streaks, the
//                  Worthington jet with an ink core and its pinched-off droplet. Pure in age, so the rewind plays it
//                  backward (the crown closes, the jet retracts).
//   drawLight      main canvas (under the GL ink, additive): impact flash + anamorphic streak (and the same flash
//                  played backward, imploding into the crater, as the drop leaps out), the exposure swell.
//   drawSmear      front canvas, the violent rewind: re-composites the frame (stage canvas × GL ink) and darkens it
//                  with radially displaced copies about the impact point — the ink is sucked back to where it went
//                  in, trailing streaks behind it. Off on the cover frame (crisp) and from the crown on.
//   drawTamper     front canvas: time-tamper artefacts of the rewind — real horizontal scan-tears (slices of the
//                  composited frame shifted sideways and wrapped), a rolling tracking band, chroma fringes, dropout
//                  dashes, scanlines. The cover frame gets exactly two clean tears. Tears never cut through the
//                  subject while the drop leaps. (The clunk roll is a CSS transform of the stage: see rollAt.)
//   drawVignette   main canvas, under the GL ink (multiply commutes): warm lens vignette ("70,52,30" at .35).
import { clamp, ease, memo, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { inkDropFall, inkRipple } from '../../lib/ink';
import { WATER_LINE_Y } from '../../lib/handoff';
import { DROP_R, F, FROM_Y, LEAP_AT, S01State, T_FALL, ageAt, camAt, toScreen } from './timeline';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const S = WATER_LINE_Y;
const X0 = 540;

/** scene camera at frame f: world → screen */
interface View {
  z: number;
  X: (x: number) => number;
  Y: (y: number) => number;
}
function view(f: number): View {
  const { zoom: z, ty } = camAt(f);
  return { z, X: (x) => X0 + (x - X0) * z, Y: (y) => z * y + ty };
}

/** physical shutter (s of tape time) for a 180° real-time shutter at frame f */
const shutter = (st: S01State) => (0.5 / 30) * Math.abs(st.speed);

/** V-hold roll (px) of the whole picture at the tape-stop clunk (the cover frame opens clean, mid-rewind). */
export function rollAt(f: number): number {
  if (f >= F.stop && f < F.stop + 4) return [44, 18, 6, 2][f - F.stop];
  return 0;
}

// ═══════════════════════════════════════ the drop ═══════════════════════════════════════

/** after contact the drop sinks into the crater and is gone into the ink by SINK_T (s) */
const SINK_T = 0.055;
const SINK_D = 40;
const STRETCH_C = 1 + clamp((900 * T_FALL) / 1400) * 0.28; // the falling drop's elongation at contact

interface DropW {
  vis: boolean;
  y: number;
  rx: number;
  ry: number;
  /** 0 = free, 1 = merged into the water */
  m: number;
}
function dropWorld(age: number): DropW {
  if (age >= SINK_T) return { vis: false, y: 0, rx: 0, ry: 0, m: 1 };
  if (age < 0) {
    const d = inkDropFall(age, { fromY: FROM_Y });
    return { vis: true, y: d.y, rx: d.r, ry: d.r * d.stretch, m: 0 };
  }
  const m = smoothstep(0, SINK_T, age);
  return {
    vis: true,
    y: S - DROP_R + SINK_D * ease.inQuad(m) + 9 * m,
    rx: DROP_R * (1 + 0.14 * m),
    ry: DROP_R * (STRETCH_C * (1 - m) + 0.8 * m),
    m,
  };
}

interface Paint {
  body: number;
  detail: number;
  spec: number;
  rim: number;
  halo: number;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A black-glass ink sphere at screen (X, Y), radii rx / ry (screen px). */
function paintDrop(ctx: Ctx, X: number, Y: number, rx: number, ry: number, p: Paint) {
  const R = rx;
  if (p.halo > 0) {
    // warm halo: separates the dark drop from the dark air (light scattered by the out-of-focus room)
    const hg = ctx.createRadialGradient(X, Y, R * 0.9, X, Y, R * 3.4);
    hg.addColorStop(0, `rgba(255,222,176,${0.11 * p.halo})`);
    hg.addColorStop(1, 'rgba(255,222,176,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hg;
    ctx.fillRect(X - R * 3.4, Y - R * 3.4, R * 6.8, R * 6.8);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (p.body > 0) {
    // ink body: near-black, translucent navy where the backlight crosses the thin lower edge (Beer–Lambert)
    const g = ctx.createRadialGradient(X + R * 0.1, Y + ry * 0.55, R * 0.05, X, Y + ry * 0.1, R * 1.18);
    g.addColorStop(0, `rgba(62,78,116,${p.body})`);
    g.addColorStop(0.42, `rgba(17,20,31,${p.body})`);
    g.addColorStop(1, `rgba(6,7,11,${p.body})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(X, Y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }
  const d = p.detail;
  if (d > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(X, Y, rx, ry, 0, 0, TAU);
    ctx.clip();
    const U = (u: number) => X + u * rx;
    const V = (v: number) => Y + v * ry;
    const lw = Math.max(0.7, R * 0.022);
    // REFRACTION — the sphere is a lens: the lit water below appears UPSIDE DOWN in its upper half, dimmed and
    // blued by the ink; the inverted surface line is a frown-shaped arc
    const frown = (u: number) => -0.14 + 0.32 * u * u;
    ctx.beginPath();
    ctx.moveTo(U(-1.1), V(frown(-1.1)));
    for (let u = -1.0; u <= 1.1001; u += 0.1) ctx.lineTo(U(u), V(frown(u)));
    ctx.lineTo(U(1.1), V(-1.2));
    ctx.lineTo(U(-1.1), V(-1.2));
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, V(-1), 0, V(frown(0)));
    rg.addColorStop(0, `rgba(110,128,176,${0.05 * d})`);
    rg.addColorStop(0.6, `rgba(132,150,198,${0.15 * d})`);
    rg.addColorStop(1, `rgba(170,186,226,${0.27 * d})`);
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = `rgba(214,226,248,${0.42 * d})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let u = -1.0; u <= 1.0001; u += 0.1) (u === -1.0 ? ctx.moveTo : ctx.lineTo).call(ctx, U(u), V(frown(u)));
    ctx.stroke();
    // REFLECTION — a convex mirror: the bright water and the perfectly still surface line, upright and bent along
    // the sphere into a smile in its lower half (Fresnel: strongest toward the rim)
    const smile = (u: number) => 0.4 - 0.34 * u * u;
    ctx.beginPath();
    ctx.moveTo(U(-1.1), V(smile(-1.1)));
    for (let u = -1.0; u <= 1.1001; u += 0.1) ctx.lineTo(U(u), V(smile(u)));
    ctx.lineTo(U(1.1), V(1.2));
    ctx.lineTo(U(-1.1), V(1.2));
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, V(0.05), 0, V(1));
    fg.addColorStop(0, `rgba(255,230,196,${0.08 * d})`);
    fg.addColorStop(0.55, `rgba(255,236,208,${0.22 * d})`);
    fg.addColorStop(1, `rgba(255,242,220,${0.46 * d})`);
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,251,242,${0.78 * d})`;
    ctx.lineWidth = lw * 1.1;
    ctx.beginPath();
    for (let u = -1.0; u <= 1.0001; u += 0.1) (u === -1.0 ? ctx.moveTo : ctx.lineTo).call(ctx, U(u), V(smile(u)));
    ctx.stroke();
    // the warm air just above the surface, mirrored between the equator and the smile
    ctx.fillStyle = `rgba(255,214,160,${0.05 * d})`;
    ctx.fillRect(U(-1), V(0.02), 2 * rx, (smile(0) - 0.02) * ry);
    // the room's out-of-focus lights, reflected as tiny specks in the dark upper half
    ctx.fillStyle = `rgba(255,216,168,${0.6 * d})`;
    for (const [u, v, s] of [
      [0.3, -0.64, 0.03],
      [0.5, -0.4, 0.024],
      [-0.06, -0.76, 0.022],
      [0.14, -0.55, 0.018],
      [0.62, -0.18, 0.02],
    ]) {
      ctx.beginPath();
      ctx.arc(U(u), V(v), Math.max(0.5, R * s), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  if (p.rim > 0) {
    // Fresnel rim: grazing reflection of the bright water, strongest along the lower edge
    const lw = Math.max(0.9, R * 0.05);
    const gg = ctx.createLinearGradient(0, Y - ry, 0, Y + ry);
    gg.addColorStop(0, `rgba(255,238,210,${0.06 * p.rim})`);
    gg.addColorStop(0.6, `rgba(255,238,210,${0.3 * p.rim})`);
    gg.addColorStop(1, `rgba(255,240,214,${0.72 * p.rim})`);
    ctx.strokeStyle = gg;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(X, Y, Math.max(0.5, rx - lw / 2), Math.max(0.5, ry - lw / 2), 0, 0, TAU);
    ctx.stroke();
  }
  if (p.spec > 0) {
    // soft-box key light, upper left (with a bloom), a fill glint upper right, a warm environment glint lower right
    ctx.save();
    ctx.translate(X - R * 0.38, Y - ry * 0.46);
    ctx.rotate(-0.6);
    if (R > 10) {
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
      sg.addColorStop(0, `rgba(255,255,255,${0.32 * p.spec})`);
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-R * 0.42, -R * 0.42, R * 0.84, R * 0.84);
    }
    ctx.fillStyle = `rgba(255,255,255,${0.95 * p.spec})`;
    if (R > 24) roundRect(ctx, -R * 0.19, -R * 0.105, R * 0.38, R * 0.21, R * 0.075);
    else {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.22, R * 0.13, 0, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${0.75 * p.spec})`;
    ctx.beginPath();
    ctx.arc(X + R * 0.52, Y - ry * 0.24, Math.max(0.5, R * 0.045), 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255,236,205,${0.32 * p.spec})`;
    ctx.beginPath();
    ctx.ellipse(X + R * 0.42, Y + ry * 0.5, R * 0.22, R * 0.08, -0.7, 0, TAU);
    ctx.fill();
  }
}

/** screen geometry of the drop at a (fractional) frame */
function dropScreen(f: number): { vis: boolean; X: number; Y: number; rx: number; ry: number; m: number; clipY: number; age: number } {
  const age = ageAt(f);
  const w = dropWorld(age);
  const V = view(f);
  // while it merges, everything below the crater floor is the ink in the water (the GL bloom draws it)
  const floor = S + Math.max(0, inkRipple(X0, age));
  return { vis: w.vis, X: V.X(X0), Y: V.Y(w.y), rx: w.rx * V.z, ry: w.ry * V.z, m: w.m, clipY: V.Y(floor), age };
}

export function drawDrop(ctx: Ctx, f: number, _st: S01State) {
  if (f >= F.cut) return;
  // 180° shutter: sub-frame samples over [f − ¼, f + ¼] (tape speed × velocity AND the camera move blur it)
  const a = dropScreen(f - 0.25),
    b = dropScreen(f + 0.25),
    c = dropScreen(f);
  if (!a.vis && !b.vis && !c.vis) return;
  const L = Math.hypot(b.Y - a.Y, b.ry - a.ry);
  const N = c.vis ? Math.min(7, Math.max(1, Math.ceil(L / Math.max(2, 0.22 * c.rx)))) : 3;
  const detail = smoothstep(16, 48, c.rx);
  for (let k = 0; k < N; k++) {
    const s = N === 1 ? c : dropScreen(f - 0.25 + (0.5 * (k + 0.5)) / N);
    if (!s.vis) continue;
    const fade = 1 - 0.15 * s.m; // the last trace of the drop is ink in the crater
    ctx.save();
    if (s.m > 0) {
      ctx.beginPath();
      ctx.rect(s.X - s.rx * 3, s.Y - s.ry * 4, s.rx * 6, s.clipY - (s.Y - s.ry * 4));
      ctx.clip();
    }
    const share = N === 1 ? 1 : Math.min(1, 1.5 / N);
    paintDrop(ctx, s.X, s.Y, s.rx, s.ry, {
      body: share * fade,
      detail: N === 1 ? detail * fade : 0,
      spec: share * fade,
      rim: share * fade,
      halo: (1 / N) * fade * (1 - s.m),
    });
    ctx.restore();
  }
  // a blurred drop still shows its reflections faintly (averaged over the exposure)
  if (N > 1 && c.vis && detail > 0.01) {
    ctx.save();
    if (c.m > 0) {
      ctx.beginPath();
      ctx.rect(c.X - c.rx * 3, c.Y - c.ry * 4, c.rx * 6, c.clipY - (c.Y - c.ry * 4));
      ctx.clip();
    }
    paintDrop(ctx, c.X, c.Y, c.rx, c.ry, { body: 0, detail: detail / Math.sqrt(N), spec: 0, rim: 0, halo: 0 });
    ctx.restore();
  }
}

// ───────────────────────────── strobe ghosts ─────────────────────────────
const DT = 0.065; // physical seconds between "flashes"
const KMAX = 5;

function ghostAt(ctx: Ctx, V: View, age: number, w: number) {
  const d = inkDropFall(age, { fromY: FROM_Y });
  if (!d.visible || w < 0.01) return;
  if (d.y + d.r * d.stretch > S - 1) return;
  // a strobe flash freezes only what is lit: a faint body, the cream Fresnel rim, the specular
  paintDrop(ctx, V.X(d.x), V.Y(d.y), d.r * V.z, d.r * d.stretch * V.z, { body: 0.25 * w, detail: 0, spec: 0.8 * w, rim: 0.55 * w, halo: 0.5 * w });
}

export function drawStrobe(ctx: Ctx, f: number, st: S01State) {
  if (f < F.leap || f > F.impact + 8) return;
  const V = view(f);
  const minGap = 2.4 * DROP_R;
  const yOf = (age: number) => inkDropFall(age, { fromY: FROM_Y }).y;
  if (f < F.stop + 14) {
    // leap (played backward): the frames the viewer has already seen lie closer to the surface (ages → 0)
    const a = f < F.stop ? Math.min(st.age, -1e-4) : -T_FALL;
    const fade = 1 - ease.inQuad(seg(f, F.stop, F.stop + 14));
    let last = yOf(a);
    for (let k = 1; k <= KMAX; k++) {
      const ak = a + k * DT;
      if (ak >= 0) break;
      const y = yOf(ak);
      if (Math.abs(y - last) < minGap) continue;
      last = y;
      ghostAt(ctx, V, ak, fade * Math.pow(1 - k / (KMAX + 1), 1.2));
    }
  }
  if (f >= F.stop) {
    // the fall: ghosts at earlier physical times, back up to the apex
    const fade = f < F.impact ? smoothstep(F.stop + 6, F.stop + 22, f) : 1 - seg(f, F.impact, F.impact + 8);
    const aNow = f < F.impact ? Math.min(st.age, -1e-4) : -1e-4;
    let last = yOf(aNow);
    for (let k = 1; k <= KMAX; k++) {
      const ak = aNow - k * DT;
      if (ak < -T_FALL) break;
      const y = yOf(ak);
      if (Math.abs(y - last) < minGap) continue;
      last = y;
      ghostAt(ctx, V, ak, fade * Math.pow(1 - k / (KMAX + 1), 1.2));
    }
  }
}

// ═══════════════════════════════════════ the splash ═══════════════════════════════════════

const CROWN_T = 0.34;
const RIM_E = 0.13; // rim ellipse minor/major (seen almost edge-on)

interface Crown {
  ct: number;
  life: number;
  H: number;
  b: number;
  rr: number;
}
function crownAt(t: number): Crown {
  const ct = clamp(t / CROWN_T);
  const life = Math.sin(Math.PI * Math.pow(ct, 0.7));
  const b = 11 + 26 * Math.sqrt(ct);
  return { ct, life, H: 34 * life, b, rr: b * (1.2 + 0.6 * ct) };
}

interface Jet {
  a: number;
  len: number;
  bead: number;
  lean: number;
}
function jets(): Jet[] {
  return memo('s01-crown-jets', () => {
    const out: Jet[] = [];
    for (let i = 0; i < 16; i++) {
      const h = (k: number) => hash01(i * 5 + k, 7311);
      out.push({ a: ((i + 0.38 * (h(0) - 0.5)) / 16) * TAU, len: 3 + 10 * h(1) * h(1) + 3 * h(2), bead: 0.9 + 1.4 * h(3), lean: 0.3 + 0.25 * h(4) });
    }
    return out;
  });
}

/** world tip of jet j at crown state c */
function jetTip(c: Crown, j: Jet): { bx: number; by: number; tx: number; ty: number; L: number } {
  const bx = X0 + c.rr * Math.cos(j.a);
  const by = S - c.H + c.rr * RIM_E * Math.sin(j.a);
  const L = j.len * smoothstep(0.08, 0.45, c.ct) * (1 - 0.35 * smoothstep(0.7, 1, c.ct));
  const dx = Math.cos(j.a) * (j.lean + 0.35 * c.ct),
    dy = -1;
  const n = Math.hypot(dx, dy);
  return { bx, by, tx: bx + (dx / n) * L, ty: by + (dy / n) * L, L };
}

/** a liquid bead lit by the light table: bright body, dark refracting core, specular point */
function bead(ctx: Ctx, x: number, y: number, r: number, a: number) {
  ctx.fillStyle = `rgba(252,246,234,${0.92 * a})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  if (r > 1.2) {
    ctx.fillStyle = `rgba(22,24,34,${0.5 * a})`;
    ctx.beginPath();
    ctx.arc(x + r * 0.15, y + r * 0.22, r * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
    ctx.beginPath();
    ctx.arc(x - r * 0.34, y - r * 0.34, Math.max(0.45, r * 0.24), 0, TAU);
    ctx.fill();
  }
}

function drawCrown(ctx: Ctx, f: number, V: View, t: number, sh: number, k: number) {
  const c = crownAt(t);
  if (c.ct >= 1 || c.life <= 0.01) return;
  const z = V.z;
  const H = c.H;
  const yb = S + 1.5;
  const wall = (sgn: number, up: boolean) => {
    const p0 = [V.X(X0 + sgn * c.b), V.Y(yb)];
    const p1 = [V.X(X0 + sgn * c.b * 0.99), V.Y(S - 0.42 * H)];
    const p2 = [V.X(X0 + sgn * (0.5 * (c.b + c.rr) + 0.06 * c.rr)), V.Y(S - 0.86 * H)];
    const p3 = [V.X(X0 + sgn * c.rr), V.Y(S - H)];
    if (up) ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    else ctx.bezierCurveTo(p2[0], p2[1], p1[0], p1[1], p0[0], p0[1]);
    return { p0, p3 };
  };
  const rimX = V.X(X0),
    rimY = V.Y(S - H),
    rimRx = c.rr * z,
    rimRy = Math.max(0.6, c.rr * RIM_E * z);
  const topY = rimY - rimRy,
    baseY = V.Y(yb);
  const sheet = () => {
    ctx.beginPath();
    ctx.moveTo(V.X(X0 - c.b), V.Y(yb));
    wall(-1, true);
    ctx.ellipse(rimX, rimY, rimRx, rimRy, 0, Math.PI, TAU, false);
    wall(1, false);
    ctx.closePath();
  };
  ctx.save();
  // 1) the sheet: thin water lit from inside — it guides the light table's glow up to its rim (additive)
  ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createLinearGradient(0, topY, 0, baseY);
  bg.addColorStop(0, `rgba(255,247,232,${0.22 * k})`);
  bg.addColorStop(0.22, `rgba(255,247,232,${0.09 * k})`);
  bg.addColorStop(0.7, `rgba(255,244,226,${0.06 * k})`);
  bg.addColorStop(1, `rgba(255,240,214,${0.2 * k})`);
  sheet();
  ctx.fillStyle = bg;
  ctx.fill();
  // 2) a darker band below the rim: the out-curving sheet refracts the dark air behind it
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  sheet();
  ctx.clip();
  const db = ctx.createLinearGradient(0, rimY, 0, V.Y(S - 0.62 * H));
  db.addColorStop(0, 'rgba(8,8,12,0)');
  db.addColorStop(0.35, `rgba(8,8,12,${0.26 * k})`);
  db.addColorStop(1, 'rgba(8,8,12,0)');
  ctx.fillStyle = db;
  ctx.fillRect(rimX - rimRx - 4, rimY, rimRx * 2 + 8, V.Y(S - 0.62 * H) - rimY);
  ctx.restore();
  // 3) silhouettes: where we look along the sheet it is brightest (soft bloom + a crisp edge)
  const eg = (a0: number, a1: number, a2: number) => {
    const g = ctx.createLinearGradient(0, rimY, 0, baseY);
    g.addColorStop(0, `rgba(255,250,240,${a0 * k})`);
    g.addColorStop(0.5, `rgba(255,248,236,${a1 * k})`);
    g.addColorStop(1, `rgba(255,244,226,${a2 * k})`);
    return g;
  };
  ctx.lineCap = 'round';
  for (const [lw, g, op] of [
    [Math.max(2.4, 2.6 * z), eg(0.14, 0.06, 0.16), 'lighter'],
    [Math.max(0.9, 0.55 * z), eg(0.78, 0.36, 0.7), 'source-over'],
  ] as Array<[number, CanvasGradient, GlobalCompositeOperation]>) {
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = g;
    ctx.lineWidth = lw;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(V.X(X0 + sgn * c.b), V.Y(yb));
      wall(sgn, true);
      ctx.stroke();
    }
  }
  // 4) the rim: far half faint, near half a thick glowing torus with a dark refracting underline
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = `rgba(255,248,236,${0.32 * k})`;
  ctx.lineWidth = Math.max(0.8, 0.45 * z);
  ctx.beginPath();
  ctx.ellipse(rimX, rimY, rimRx, rimRy, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = `rgba(16,16,22,${0.32 * k})`;
  ctx.lineWidth = Math.max(0.8, 0.4 * z);
  ctx.beginPath();
  ctx.ellipse(rimX, rimY + Math.max(1, 0.9 * z), rimRx, rimRy, 0, 0.12, Math.PI - 0.12);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,240,214,${0.16 * k})`;
  ctx.lineWidth = Math.max(3, 3 * z);
  ctx.beginPath();
  ctx.ellipse(rimX, rimY, rimRx, rimRy, 0, 0, Math.PI);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = `rgba(255,252,244,${0.85 * k})`;
  ctx.lineWidth = Math.max(1.1, 0.75 * z);
  ctx.beginPath();
  ctx.ellipse(rimX, rimY, rimRx, rimRy, 0, 0, Math.PI);
  ctx.stroke();
  // 5) jets: tapered liquid fingers leaning out, each ending in a bead (shutter-streaked while they shoot up)
  const cPrev = crownAt(Math.max(0, t - sh));
  const flash = f >= F.impact ? Math.exp(-(f - F.impact) / 3.2) : 0;
  const glint: Array<[number, number, number]> = [];
  jets().forEach((j, i) => {
    const tip = jetTip(c, j);
    const front = 0.55 + 0.45 * Math.max(0, Math.sin(j.a));
    const B = [V.X(tip.bx), V.Y(tip.by)],
      T = [V.X(tip.tx), V.Y(tip.ty)];
    const rb = j.bead * z * smoothstep(0.1, 0.4, c.ct) * (0.6 + 0.4 * c.life);
    if (tip.L > 0.5) {
      const dx = T[0] - B[0],
        dy = T[1] - B[1];
      const n = Math.hypot(dx, dy) || 1;
      const nx = -dy / n,
        ny = dx / n;
      const wb = Math.max(0.8, 1.4 * z) / 2,
        wt = Math.max(0.5, 0.55 * z) / 2;
      const jg = ctx.createLinearGradient(B[0], B[1], T[0], T[1]);
      jg.addColorStop(0, `rgba(255,247,234,${0.5 * front * k})`);
      jg.addColorStop(1, `rgba(255,250,240,${0.78 * front * k})`);
      ctx.fillStyle = jg;
      ctx.beginPath();
      ctx.moveTo(B[0] + nx * wb, B[1] + ny * wb);
      ctx.lineTo(T[0] + nx * wt, T[1] + ny * wt);
      ctx.lineTo(T[0] - nx * wt, T[1] - ny * wt);
      ctx.lineTo(B[0] - nx * wb, B[1] - ny * wb);
      ctx.closePath();
      ctx.fill();
    }
    if (rb > 0.35) {
      const pt = jetTip(cPrev, j);
      const P = [V.X(pt.tx), V.Y(pt.ty)];
      if (Math.hypot(T[0] - P[0], T[1] - P[1]) > 1.5) {
        ctx.strokeStyle = `rgba(250,244,232,${0.3 * front * k})`;
        ctx.lineWidth = rb * 1.1;
        ctx.beginPath();
        ctx.moveTo(P[0], P[1]);
        ctx.lineTo(T[0], T[1]);
        ctx.stroke();
      }
      bead(ctx, T[0], T[1], rb, front * k);
      if (Math.sin(j.a) > 0.35 && i % 3 === 0) glint.push([T[0], T[1], rb]);
    }
  });
  // 6) glints: the key light / impact flash catching the front beads (tiny anamorphic stars)
  const gk = (0.3 + 0.9 * flash) * c.life * k;
  if (gk > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r] of glint) {
      const L = (5 + 4 * r) * (0.7 + 0.6 * flash);
      const hg = ctx.createLinearGradient(x - L, 0, x + L, 0);
      hg.addColorStop(0, 'rgba(255,250,240,0)');
      hg.addColorStop(0.5, `rgba(255,250,240,${0.6 * gk})`);
      hg.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(x - L, y - 0.6, 2 * L, 1.2);
      const vg = ctx.createLinearGradient(0, y - L * 0.55, 0, y + L * 0.55);
      vg.addColorStop(0, 'rgba(255,250,240,0)');
      vg.addColorStop(0.5, `rgba(255,250,240,${0.45 * gk})`);
      vg.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = vg;
      ctx.fillRect(x - 0.5, y - L * 0.55, 1, L * 1.1);
    }
  }
  // 7) where the sheet leaves the surface the light enters it: a warm caustic along the base
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(V.X(X0), V.Y(S + 0.5));
  ctx.scale(1, 0.2);
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, c.b * z * 1.45);
  cg.addColorStop(0, `rgba(255,238,206,${0.3 * c.life * k})`);
  cg.addColorStop(0.7, `rgba(255,238,206,${0.12 * c.life * k})`);
  cg.addColorStop(1, 'rgba(255,238,206,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(-c.b * z * 1.5, -c.b * z * 1.5, c.b * z * 3, c.b * z * 3);
  ctx.restore();
  ctx.restore();
}

// fine droplets thrown off the crown rim (ballistic in physical time, so the slow motion holds them in the air)
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
        x0: X0 + side * (12 + 20 * h(2)),
        y0: S - 10 - 12 * h(3),
        vx: side * (25 + 190 * h(4) * h(4)),
        vy: 150 + 260 * h(5),
        r: 0.45 + 1.5 * h(6) * h(6),
      });
    }
    return out;
  });
}

function drawSpray(ctx: Ctx, V: View, t: number, sh: number) {
  const g = 900;
  const pos = (d: Drip, tt: number): [number, number] => [d.x0 + d.vx * tt, d.y0 - d.vy * tt + 0.5 * g * tt * tt];
  ctx.lineCap = 'round';
  for (const d of spraySet()) {
    const tt = t - d.t0;
    if (tt <= 0) continue;
    const [x, y] = pos(d, tt);
    if (y > S - d.r) continue;
    const r = Math.max(0.6, d.r * V.z);
    const X = V.X(x),
      Y = V.Y(y);
    const [px, py] = pos(d, Math.max(0, tt - sh));
    const PX = V.X(px),
      PY = V.Y(py);
    if (Math.hypot(X - PX, Y - PY) > 1) {
      ctx.strokeStyle = 'rgba(250,244,232,0.32)';
      ctx.lineWidth = r * 1.2;
      ctx.beginPath();
      ctx.moveTo(PX, PY);
      ctx.lineTo(X, Y);
      ctx.stroke();
    }
    bead(ctx, X, Y, r, 1);
  }
}

function drawWorthington(ctx: Ctx, V: View, t: number) {
  const jt = (t - 0.2) / 0.56;
  if (jt <= 0 || jt >= 1) return;
  const z = V.z;
  const H = 44 * Math.pow(Math.sin(Math.PI * jt), 0.85);
  const k = smoothstep(0, 0.08, jt) * (1 - smoothstep(0.88, 1, jt));
  const wn = 2.4,
    wt = 3.3,
    sk = 9;
  const pts: Array<[number, number]> = [];
  // left profile from the surface skirt up to the bulb, then mirrored
  const prof = (s: number) => {
    // s: 0 (surface) → 1 (top); half-width in world px
    const skirt = sk * Math.exp(-s / 0.09);
    return Math.max(wn, skirt) + (wt - wn) * smoothstep(0.82, 0.97, s);
  };
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    pts.push([X0 - prof(s), S + 1 - s * (H - wt)]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(V.X(pts[0][0]), V.Y(pts[0][1]));
  for (const [x, y] of pts) ctx.lineTo(V.X(x), V.Y(y));
  ctx.arc(V.X(X0), V.Y(S + 1 - (H - wt)), wt * z, Math.PI, TAU);
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(V.X(2 * X0 - pts[i][0]), V.Y(pts[i][1]));
  ctx.closePath();
  // a glass rod lit from inside: bright edges, translucent core
  const hw = wt * z * 1.05;
  const g = ctx.createLinearGradient(V.X(X0) - hw, 0, V.X(X0) + hw, 0);
  g.addColorStop(0, `rgba(255,247,232,${0.8 * k})`);
  g.addColorStop(0.3, `rgba(255,247,232,${0.2 * k})`);
  g.addColorStop(0.5, `rgba(255,247,232,${0.12 * k})`);
  g.addColorStop(0.7, `rgba(255,247,232,${0.2 * k})`);
  g.addColorStop(1, `rgba(255,247,232,${0.8 * k})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,236,206,${0.1 * k})`;
  ctx.lineWidth = Math.max(2.5, 3 * z);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // the ink the jet pulls up from the crater: a dark thread in its core
  ctx.strokeStyle = `rgba(26,34,58,${0.5 * k})`;
  ctx.lineWidth = Math.max(0.8, 0.9 * z);
  ctx.beginPath();
  ctx.moveTo(V.X(X0), V.Y(S + 1));
  ctx.lineTo(V.X(X0), V.Y(S - 0.72 * H));
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`;
  ctx.beginPath();
  ctx.arc(V.X(X0 - wt * 0.35), V.Y(S + 1 - H + wt * 0.6), Math.max(0.5, 0.7 * z), 0, TAU);
  ctx.fill();
  ctx.restore();
  // the pinched-off droplet: rises a little further, falls back
  if (jt > 0.45) {
    const H0 = 44 * Math.pow(Math.sin(Math.PI * 0.45), 0.85);
    const dt = (jt - 0.45) * 0.56;
    const y = S - H0 - 5 - 70 * dt + 450 * dt * dt;
    if (y < S - 3) bead(ctx, V.X(X0), V.Y(y), 2.6 * z, 1);
  }
}

export function drawSplash(ctx: Ctx, f: number, st: S01State) {
  const t = st.age;
  if (t <= 0 || t > 0.8 || f >= F.cut) return;
  const V = view(f);
  const sh = shutter(st);
  ctx.save();
  drawWorthington(ctx, V, t);
  drawCrown(ctx, f, V, t, sh, 1);
  drawSpray(ctx, V, t, sh);
  ctx.restore();
}

// ═══════════════════════════════════════ macro still life ═══════════════════════════════════════

interface Bk {
  x: number;
  y: number;
  r: number;
  a: number;
  c: number;
  ring: boolean;
}
const BK_COL: Array<[number, number, number]> = [
  [238, 176, 104],
  [246, 220, 178],
  [252, 238, 214],
  [226, 160, 126],
  [160, 176, 204],
];
/** out-of-focus lights of the room behind the tank, laid out in the macro frame (drop at 540, 532) */
function macroBokeh(): Bk[] {
  return memo('s01-macro-bokeh', () => {
    const out: Bk[] = [];
    const H = (i: number, k: number) => hash01(i * 11 + k, 9001);
    // a few huge, very soft discs; medium onion-ring discs; small crisp ones (layered depth of field)
    const tiers: Array<[number, number, number, number, number, boolean]> = [
      // count, rMin, rMax, aMin, aMax, ring
      [4, 170, 280, 0.05, 0.08, false],
      [7, 60, 125, 0.07, 0.13, true],
      [9, 14, 38, 0.1, 0.2, true],
    ];
    let i = 0;
    for (const [n, r0, r1, a0, a1, ring] of tiers)
      for (let k = 0; k < n; k++, i++) {
        let x = -80 + H(i, 0) * 1240;
        let y = -120 + H(i, 1) * 1250;
        // keep the drop clean: push discs out of its neighbourhood
        const dx = x - 540,
          dy = y - 532;
        const dd = Math.hypot(dx, dy);
        const keep = ring ? 170 + r0 : 120;
        if (dd < keep) {
          x = 540 + (dx / (dd || 1)) * keep;
          y = 532 + (dy / (dd || 1)) * keep;
        }
        out.push({ x, y, r: r0 + (r1 - r0) * H(i, 2), a: a0 + (a1 - a0) * H(i, 3), c: Math.floor(H(i, 4) * (i % 4 === 0 ? 5 : 4)), ring });
      }
    return out;
  });
}
function bokehSprite(c: number, ring: boolean): HTMLCanvasElement {
  return memo(`s01-bk-sprite:${c}:${ring}`, () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const x = cv.getContext('2d')!;
    const [r, g, b] = BK_COL[c];
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 63);
    if (ring) {
      gr.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
      gr.addColorStop(0.72, `rgba(${r},${g},${b},0.6)`);
      gr.addColorStop(0.88, `rgba(${r},${g},${b},0.95)`);
      gr.addColorStop(0.95, `rgba(${r},${g},${b},0.75)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    } else {
      gr.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
      gr.addColorStop(0.45, `rgba(${r},${g},${b},0.55)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    }
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    return cv;
  });
}

/** soft out-of-focus micro-bubbles in the water, in front of the light table (macro frame coordinates) */
const WATER_BOKEH: Array<[number, number, number, number]> = [
  [150, 1660, 26, 0.2],
  [930, 1735, 18, 0.18],
  [318, 1858, 12, 0.22],
  [842, 1600, 34, 0.14],
  [612, 1890, 22, 0.12],
];

export function drawMacroBack(ctx: Ctx, f: number, st: S01State) {
  const m = st.macro;
  if (m <= 0.002 || f >= F.cut) return;
  const V = view(f);
  const ys = V.Y(S);
  const yd = V.Y(FROM_Y);
  // background lights scale less than the subject under the push (they are far behind the focal plane)
  const s = Math.pow(V.z / 4.5, 0.45);
  ctx.save();
  // ── air: clip above the (perfectly still) surface
  ctx.save();
  ctx.beginPath();
  ctx.rect(-10, -10, 1100, ys + 10);
  ctx.clip();
  // depth: the top of the frame falls off into shadow (also seats the HUD)
  const tg = ctx.createLinearGradient(0, 0, 0, Math.min(ys, 520));
  tg.addColorStop(0, `rgba(8,6,4,${0.4 * m})`);
  tg.addColorStop(1, 'rgba(8,6,4,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, 1080, Math.min(ys, 520));
  ctx.globalCompositeOperation = 'lighter';
  // a warm lamp far behind the drop: backlights the air and gives the black sphere something to stand against
  const gl = ctx.createRadialGradient(540, yd + 40, 20, 540, yd + 40, 700 * s);
  gl.addColorStop(0, `rgba(255,206,150,${0.13 * m})`);
  gl.addColorStop(0.45, `rgba(255,200,140,${0.05 * m})`);
  gl.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, 1080, ys);
  // light rising off the lit water into the air (stronger at macro: we are right at the surface)
  const wg = ctx.createLinearGradient(0, ys - 260, 0, ys);
  wg.addColorStop(0, 'rgba(255,226,182,0)');
  wg.addColorStop(1, `rgba(255,226,182,${0.12 * m})`);
  ctx.fillStyle = wg;
  ctx.fillRect(0, ys - 260, 1080, 260);
  for (const b of macroBokeh()) {
    const x = 540 + (b.x - 540) * s;
    const y = yd + (b.y - 532) * s;
    const r = b.r * s;
    if (y - r > ys) continue;
    ctx.globalAlpha = b.a * m;
    ctx.drawImage(bokehSprite(b.c, b.ring), x - r, y - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // ── water: a few out-of-focus micro-bubbles in front of the light table (bright core, soft refracting rim)
  for (const [bx, by, br, ba] of WATER_BOKEH) {
    const x = 540 + (bx - 540) * s;
    const y = ys + (by - 1252) * s;
    const r = br * s;
    if (y + r < ys + 20) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.5 * ba * m})`);
    g.addColorStop(0.72, `rgba(250,250,252,${0.35 * ba * m})`);
    g.addColorStop(0.9, `rgba(84,90,108,${0.55 * ba * m})`);
    g.addColorStop(1, 'rgba(84,90,108,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // ── the perfectly still surface, at screen resolution (the lib's hairline is dimmed while macro)
  // TIR: the underside of the surface mirrors the lit water — a bright strip just below the line
  const band = ctx.createLinearGradient(0, ys, 0, ys + 50);
  band.addColorStop(0, `rgba(255,255,253,${0.34 * m})`);
  band.addColorStop(1, 'rgba(255,255,253,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, ys, 1080, 50);
  // the parts of the surface nearer / further than the focal plane: a soft glow around the crisp line
  ctx.globalCompositeOperation = 'lighter';
  const gw = ctx.createLinearGradient(0, ys - 18, 0, ys + 18);
  gw.addColorStop(0, 'rgba(255,236,206,0)');
  gw.addColorStop(0.5, `rgba(255,236,206,${0.12 * m})`);
  gw.addColorStop(1, 'rgba(255,236,206,0)');
  ctx.fillStyle = gw;
  ctx.fillRect(0, ys - 18, 1080, 36);
  ctx.globalCompositeOperation = 'source-over';
  if (st.age > 0) {
    // the rewound ripples run INWARD along the crisp line (the lib's hairline carries them at low zoom)
    const line = (off: number, lw: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let X = -6; X <= 1086; X += 6) {
        const Y = V.Y(S + inkRipple(X0 + (X - X0) / V.z, st.age)) + off;
        if (X === -6) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    };
    line(1.75, 1.3, `rgba(48,42,36,${0.42 * m})`);
    line(0, 1.5, `rgba(252,249,242,${0.95 * m})`);
  } else {
    ctx.fillStyle = `rgba(48,42,36,${0.42 * m})`;
    ctx.fillRect(0, ys + 1.1, 1080, 1.3);
    ctx.fillStyle = `rgba(252,249,242,${0.95 * m})`;
    ctx.fillRect(0, ys - 0.75, 1080, 1.5);
  }
  // the key light glancing off the line right under the drop
  const kg = ctx.createLinearGradient(240, 0, 840, 0);
  kg.addColorStop(0, 'rgba(255,255,255,0)');
  kg.addColorStop(0.5, `rgba(255,255,255,${0.6 * m})`);
  kg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = kg;
  ctx.fillRect(240, ys - 1, 600, 2);
  ctx.restore();
}

// ───────────────────────────── light ─────────────────────────────
/** 0..1 exposure swell over the last ~2 s before the hard cut */
export const swellAt = (f: number) => ease.inCubic(seg(f, 268, F.cut));

export function drawLight(ctx: Ctx, f: number) {
  // impact flash: the strobe/key light catching the crown, with an anamorphic streak (macro lens)
  const t = f - F.impact;
  if (t >= 0 && t < 16) flash(ctx, f, t, Math.exp(-t / 3.2) * (t < 1 ? 0.7 + 0.3 * t : 1));
  // the same flash played BACKWARD: it gathers into the crater and snaps off as the drop leaps out
  const tl = LEAP_AT - f;
  if (tl > 0 && tl < 12) flash(ctx, f, tl, 0.85 * Math.exp(-(tl - 0.5) / 2.8));
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

/** the strobe flash at the impact point: radial glow + anamorphic streak; `t` = frames from the event, `k` strength */
function flash(ctx: Ctx, f: number, t: number, k: number) {
  {
    const [ix, iy] = toScreen(f, 540, WATER_LINE_Y - 6);
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
}

// ───────────────────────────── tamper ─────────────────────────────
function scratch(key: string): { c: HTMLCanvasElement; x: Ctx } {
  return memo(key, () => {
    const c = document.createElement('canvas');
    return { c, x: c.getContext('2d', { willReadFrequently: true })! };
  });
}

interface Comp {
  /** the composited frame (stage canvas × GL ink) at the front canvas's resolution */
  c: HTMLCanvasElement;
  /** its resolution relative to the logical 1080×1920 frame */
  s: number;
}
let compFrame = -1;

/** Darkroom grade of the rewound chandelier (printed on a hard paper grade): per channel, transmittance relative to
 *  the light table t = v / paper goes through an S-curve pivoting at .42 — dense ink sinks to a deep black core, the
 *  thin halo lifts toward the paper, the paper itself is untouched. `g` 0..1 blends from identity. */
const PAPER_RGB = [244, 238, 226];
function gradeLut(g: number): Uint8ClampedArray {
  const q = Math.round(clamp(g) * 24);
  return memo(`s01-grade:${q}`, () => {
    const w = q / 24;
    const lut = new Uint8ClampedArray(768);
    const P = 0.42;
    for (let c = 0; c < 3; c++)
      for (let v = 0; v < 256; v++) {
        const pc = PAPER_RGB[c];
        const t = Math.min(1, v / pc);
        const s = t <= P ? P * Math.pow(t / P, 1.75) : 1 - (1 - P) * Math.pow((1 - t) / (1 - P), 1.45);
        const out = v > pc ? v : pc * (t + (s - t) * w);
        lut[c * 256 + v] = Math.round(out);
      }
    return lut;
  });
}
function applyGrade(x: Ctx, w: number, h: number, g: number) {
  const lut = gradeLut(g);
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0, n = d.length; i < n; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[256 + d[i + 1]];
    d[i + 2] = lut[512 + d[i + 2]];
  }
  x.putImageData(img, 0, 0);
}

/** The picture as the viewer sees it under the front canvas: the stage's main CPU canvas with the GL ink density
 *  multiplied on top, at the front canvas's resolution. Built by drawSmear and reused by drawTamper in the same
 *  stage pass (`reuse`); a pure function of the frame either way. */
function composite(front: HTMLCanvasElement, f: number, reuse: boolean, grade = 0): Comp | null {
  const stage = front.parentElement;
  if (!stage) return null;
  const all = Array.from(stage.querySelectorAll('canvas')) as HTMLCanvasElement[];
  const main = all[0];
  if (!main || main === front) return null;
  const cp = scratch('s01-composite');
  const w = front.width,
    h = front.height;
  const s = w / 1080;
  if (reuse && compFrame === f && cp.c.width === w && cp.c.height === h) return { c: cp.c, s };
  if (cp.c.width !== w || cp.c.height !== h) {
    cp.c.width = w;
    cp.c.height = h;
  }
  const x = cp.x;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'copy';
  x.drawImage(main, 0, 0, w, h);
  const glc = all.find((c) => c !== main && c !== front && c.style.mixBlendMode === 'multiply' && c.style.display !== 'none');
  if (glc) {
    x.globalCompositeOperation = 'multiply';
    x.drawImage(glc, 0, 0, w, h);
  }
  x.globalCompositeOperation = 'source-over';
  if (grade > 0.02) applyGrade(x, w, h, grade);
  compFrame = f;
  return { c: cp.c, s };
}

/** copy the composited band [y, y+h) shifted by dx (wrapping around the frame edge) */
function tear(ctx: Ctx, cm: Comp, y: number, h: number, dx: number) {
  const W = 1080;
  y = Math.max(0, Math.min(1920 - 1, y));
  h = Math.max(1, Math.min(1920 - y, h));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'source-over';
  const s = cm.s;
  for (const ox of [dx, dx > 0 ? dx - W : dx + W]) ctx.drawImage(cm.c, 0, y * s, W * s, h * s, ox, y, W, h);
  ctx.restore();
}

/** a tear with the chroma fringes a time-base error leaves at its edges */
function fringedTear(ctx: Ctx, cm: Comp, y: number, h: number, dx: number, k: number) {
  tear(ctx, cm, y, h, dx);
  ctx.fillStyle = `rgba(255,40,90,${0.32 * k})`;
  ctx.fillRect(dx > 0 ? dx : 0, y, Math.min(1080, 1080 - Math.abs(dx)), 1.5);
  ctx.fillStyle = `rgba(30,200,255,${0.32 * k})`;
  ctx.fillRect(0, y + h - 1.5, 1080, 1.5);
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

function scanlines(ctx: Ctx, f: number, a: number) {
  const pat = scanPattern(ctx);
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = pat;
  ctx.translate(0, ((f * 2) % 3) * 2);
  ctx.fillRect(0, -6, 1080, 1932);
  ctx.restore();
}

/** head-switching noise at the very bottom of the frame */
function headSwitch(ctx: Ctx, cm: Comp, f: number, k: number) {
  tear(ctx, cm, 1888, 32, 18 + 30 * hash01(f, 91));
  ctx.fillStyle = `rgba(250,246,238,${0.25 * k})`;
  for (let i = 0; i < 18; i++) ctx.fillRect(hash01(f * 3 + i, 93) * 1080, 1890 + hash01(f * 5 + i, 94) * 28, 30 + 90 * hash01(i, f), 2);
}

/** screen band [y0, y1] that tears must not cross while the drop re-forms and leaps (the hook's key image) */
function protectBand(f: number): [number, number] | null {
  if (f < 40 || f >= F.stop) return null;
  const V = view(f);
  const ys = V.Y(S);
  const age = ageAt(f);
  const dy = age < 0 ? V.Y(inkDropFall(age, { fromY: FROM_Y }).y) : ys;
  return [Math.min(dy, ys) - 30 * V.z - 40, Math.max(dy + 30 * V.z, f < LEAP_AT + 6 ? ys + 150 : dy + 30 * V.z) + 30];
}

/** strength of the darkroom grade: follows the ink gain of the rewound chandelier (gone once it is one ring) */
export const gradeOf = (st: S01State) => clamp((st.inkGain - 1) / 2.6);

/** the front canvas carries the whole (graded / smeared) picture: on the cover frame and while it smears */
export const carriesPicture = (f: number, st: S01State) => f < F.stop && st.tamper > 0 && (f < 1 || st.smear > 0.01);

export function drawSmear(ctx: Ctx, f: number, st: S01State) {
  const k = st.smear;
  if (!carriesPicture(f, st)) return;
  const cm = composite(ctx.canvas, f, false, gradeOf(st));
  if (!cm) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(cm.c, 0, 0, 1080, 1920);
  // everything converges on the impact point: the copies are pushed AWAY from it (where the ink just was) and only
  // darken — dark streaks trail the ink, the cream never washes it out
  // (VHS field echoes rather than a soft blur: the picture stays crisp, the ink leaves stroboscopic dark trails)
  const [px, py] = toScreen(f, 540, S);
  const N = k > 0.01 ? 4 : 0;
  const step = 0.026 * k;
  ctx.globalCompositeOperation = 'darken';
  for (let i = 1; i <= N; i++) {
    const sc = 1 + step * i;
    ctx.globalAlpha = 0.62 * k * Math.pow(1 - i / (N + 1), 1.1);
    ctx.drawImage(cm.c, px - px * sc, py - py * sc, 1080 * sc, 1920 * sc);
  }
  ctx.restore();
}

export function drawTamper(ctx: Ctx, f: number, st: S01State) {
  const k = st.tamper;
  if (k <= 0 || rollAt(f) > 0) return;
  const pic = carriesPicture(f, st);
  const cm = composite(ctx.canvas, f, pic, pic ? gradeOf(st) : 0);
  if (!cm) return;
  if (f < 1) {
    // THE COVER: exactly two clean scan tears through the ink (one through the black lobes, one through the stem),
    // chroma-fringed; faint scanlines
    fringedTear(ctx, cm, 952, 20, 70, 1);
    fringedTear(ctx, cm, 418, 9, -44, 1);
    headSwitch(ctx, cm, f, k);
    scanlines(ctx, f, 0.05);
    return;
  }
  const pb = protectBand(f);
  const clear = (y: number, h: number) => !pb || y + h < pb[0] || y > pb[1];
  // 1) tracking band: rolls UP the frame (time runs backward), a stack of thin skewed tears
  const bandH = 70 + 60 * k;
  const yb = 1920 + 200 - ((f * 47) % 2500);
  const lines = Math.round(6 + 10 * k);
  for (let i = 0; i < lines; i++) {
    const h = 3 + Math.floor(hash01(f * 31 + i, 5) * 9);
    const y = yb + (i / lines) * bandH;
    const skew = Math.sin(i * 0.9 + f * 0.7) * (6 + 28 * k) * (0.5 + hash01(f * 7 + i, 9));
    if (clear(y, h)) tear(ctx, cm, y, h, skew);
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
    if (!clear(y, h)) continue;
    fringedTear(ctx, cm, y, h, dx, k);
  }
  // 2b) tracking skew on some frames of the fast rewind: a tall band of the picture bends sideways (time-base error)
  if (f < 38 && hash01(f, 47) > 0.62) {
    const y0 = 260 + hash01(f, 48) * 1100;
    const H = 180 + hash01(f, 49) * 320;
    const amp = (hash01(f, 50) < 0.5 ? -1 : 1) * (30 + 70 * k);
    for (let y = y0; y < y0 + H; y += 6) {
      const u = (y - y0) / H;
      if (clear(y, 6)) tear(ctx, cm, y, 6, amp * u * u);
    }
    ctx.fillStyle = `rgba(255,40,90,${0.28 * k})`;
    ctx.fillRect(0, y0 + H - 2, 1080, 2);
  }
  // 3) dropout dashes inside the tracking band
  for (let i = 0; i < 26 * k; i++) {
    const h1 = hash01(f * 53 + i, 81),
      h2 = hash01(f * 59 + i, 82),
      h3 = hash01(f * 61 + i, 83);
    const y = yb + h1 * bandH;
    if (!clear(y, 2)) continue;
    const x = h2 * 1080;
    const w = 12 + h3 * h3 * 220;
    ctx.fillStyle = h3 > 0.5 ? `rgba(255,253,248,${0.55 * k})` : `rgba(14,12,18,${0.35 * k})`;
    ctx.fillRect(x, y, w, 2);
  }
  // 4) head-switching noise at the very bottom of the frame
  headSwitch(ctx, cm, f, k);
  // 5) faint scanlines over everything while the tape is being tampered with
  scanlines(ctx, f, 0.07 * k);
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
