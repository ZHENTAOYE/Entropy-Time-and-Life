// IN: the dot of S01's 「？」 at Q_DOT. It turns from warm white to law-cyan, pings (the ping reveals the blueprint
// grid), divides like a cell — one daughter rises into panel A, one sinks into panel B — and each daughter divides
// again into the two balls of its panel: 1 -> 2 -> 4.
import { clamp, ease, lerp, mixHex, seg } from '../../lib/math';
import { C, PA, PB, Q_DOT, T } from './constants';
import { Ctx, glow, rgbaHex, ring } from './paint';
import { tau2, Which } from './stages';
import { TWO, twoPos } from './sims';

const SPLIT2_END = 38;

function ballWorld(w: Which, i: 0 | 1, f: number): [number, number] {
  const P = w === 'A' ? PA : PB;
  const p = twoPos(i, tau2(w, f));
  return [P.x + p[0], P.y + p[1]];
}
function daughterTarget(w: Which): [number, number] {
  const a = ballWorld(w, 0, T.arrive);
  const b = ballWorld(w, 1, T.arrive);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
function daughterPos(w: Which, f: number): [number, number] {
  const tgt = daughterTarget(w);
  const t = ease.inOutCubic(seg(f, T.pinch, T.arrive));
  const sgn = w === 'A' ? -1 : 1;
  // quadratic bezier with a sideways bow
  const c: [number, number] = [(Q_DOT.x + tgt[0]) / 2 + 90 * sgn, (Q_DOT.y + tgt[1]) / 2];
  const u = 1 - t;
  return [u * u * Q_DOT.x + 2 * u * t * c[0] + t * t * tgt[0], u * u * (Q_DOT.y + sgn * 13) + 2 * u * t * c[1] + t * t * tgt[1]];
}

export const openingBallsVisible = (f: number) => f < SPLIT2_END;
export const introOf = (f: number) => seg(f, T.mitosis2, SPLIT2_END);

export function dotColor(f: number) {
  return mixHex(C.voice, C.core, ease.inOutQuad(seg(f, 2, 12)));
}

export function drawOpening(ctx: Ctx, f: number, glowLayer: boolean) {
  if (f >= SPLIT2_END + 2) return;
  const col = dotColor(f);
  const cyanK = seg(f, 2, 12);
  // ping rings (they also drive the grid reveal, see world.ts)
  if (!glowLayer) {
    ring(ctx, Q_DOT.x, Q_DOT.y, 12, 1500, seg(f, T.ping, T.ping + 40), C.cyan, 0.75, 2.2);
    ring(ctx, Q_DOT.x, Q_DOT.y, 12, 900, seg(f, T.ping + 4, T.ping + 40), C.core, 0.35, 1);
  }
  if (f < T.pinch) {
    // one dot, stretching into a dumbbell
    const s = 13 * ease.inQuad(seg(f, T.mitosis1, T.pinch));
    const r = Q_DOT.r * (1 + 0.15 * ease.outQuad(seg(f, 2, 10))) * (1 - 0.12 * seg(f, T.mitosis1, T.pinch));
    if (glowLayer) {
      glow(ctx, C.cyan, Q_DOT.x, Q_DOT.y, 70 + 30 * cyanK, 0.75 * cyanK);
      return;
    }
    const neck = r * Math.pow(1 - seg(f, T.mitosis1 + 2, T.pinch), 0.8);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(Q_DOT.x, Q_DOT.y - s, r, 0, Math.PI * 2);
    ctx.arc(Q_DOT.x, Q_DOT.y + s, r, 0, Math.PI * 2);
    ctx.fill();
    if (s > 0.5) {
      ctx.beginPath();
      ctx.moveTo(Q_DOT.x - r * 0.98, Q_DOT.y - s);
      ctx.quadraticCurveTo(Q_DOT.x - neck, Q_DOT.y, Q_DOT.x - r * 0.98, Q_DOT.y + s);
      ctx.lineTo(Q_DOT.x + r * 0.98, Q_DOT.y + s);
      ctx.quadraticCurveTo(Q_DOT.x + neck, Q_DOT.y, Q_DOT.x + r * 0.98, Q_DOT.y - s);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // pinch flash
  const fl = seg(f, T.pinch, T.pinch + 8);
  if (glowLayer) {
    if (fl < 1) glow(ctx, C.cyan, Q_DOT.x, Q_DOT.y, 90 * (0.5 + fl), 0.9 * (1 - fl));
  } else ring(ctx, Q_DOT.x, Q_DOT.y, 4, 60, fl, C.core, 0.9, 1.5);

  for (const w of ['A', 'B'] as const) {
    const d = daughterPos(w, f);
    if (f < T.mitosis2) {
      // flying daughter with a comet streak back toward Q_DOT
      if (glowLayer) {
        glow(ctx, C.cyan, d[0], d[1], 60, 0.7);
        continue;
      }
      const back = daughterPos(w, f - 3);
      const gr = ctx.createLinearGradient(back[0], back[1], d[0], d[1]);
      gr.addColorStop(0, 'rgba(57,225,255,0)');
      gr.addColorStop(1, 'rgba(57,225,255,0.8)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(back[0], back[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(d[0], d[1], 9, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // second division: the daughter splits into the panel's two balls, which slide to their recorded positions
    const k = ease.inOutCubic(introOf(f));
    const pts = ([0, 1] as const).map((i) => {
      const tgt = ballWorld(w, i, f);
      return [lerp(d[0], tgt[0], k), lerp(d[1], tgt[1], k), lerp(9, TWO.R[i], k)] as [number, number, number];
    });
    if (glowLayer) {
      for (const [x, y, r] of pts) glow(ctx, C.cyan, x, y, r * 3.6, 0.6);
      continue;
    }
    // stretched membrane between the halves while they separate
    const neckA = clamp(1 - k * 3);
    if (neckA > 0) {
      ctx.strokeStyle = rgbaHex(C.core, 0.8 * neckA);
      ctx.lineWidth = 8 * neckA + 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    // motion streaks
    for (const i of [0, 1] as const) {
      const [x, y, r] = pts[i];
      const kb = ease.inOutCubic(introOf(f - 2));
      const tb = ballWorld(w, i, f - 2);
      const bx = lerp(d[0], tb[0], kb);
      const by = lerp(d[1], tb[1], kb);
      ctx.strokeStyle = rgbaHex(C.cyan, 0.45);
      ctx.lineWidth = r * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    for (const [x, y, r] of pts) {
      const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
      gr.addColorStop(0, rgbaHex(C.core, 0.95));
      gr.addColorStop(lerp(0.9, 0.3, k), rgbaHex(C.cyan, lerp(0.9, 0.16, k)));
      gr.addColorStop(1, rgbaHex(C.cyan, lerp(0.95, 0.42, k)));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
