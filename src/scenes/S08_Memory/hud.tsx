// S08 — the time ruler that rides along the trail: 现在 at the walker, −1 s … −4 s on the trail behind,
// 未来 · ？ over the pristine sand ahead (records only exist behind the present). Its strokes (axis, leaders, rings
// around the trail points they name, the dark backing strip) are drawn into the scene's CPU canvas
// (drawRulerCanvas); only the text labels are DOM (TimeRuler). Both use the same layout (rulerLayout).
// Also: the rewind-fail stamp (FailStamp) — a non-blinking copy of lib Timecode's fail state.
import React from 'react';
import { Freeze } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { Timecode } from '../../lib/hud';
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { Cam, centre, toScreen, walkerS } from './trail';
import { CAP } from './timing';

const WARM = '#F6DFB2';
const COLD = '#DCE7F5';
const RX = 150; // ruler x
/** the ruler is on screen f98–252 */
export const RULER: readonly [number, number] = [98, 252];

export interface RulerLayout {
  nowA: number;
  futA: number;
  /** the present (walker) on screen */
  px: number;
  yP: number;
  ticks: Array<{ n: number; a: number; tx: number; ty: number }>;
  lowest: number;
  /** 未来 label y (clamped into the safe zone) */
  yFut: number;
}

/** a narration card is on screen (C3 / C4 sit at y ≈ 1440 during the ruler) */
const capLive = (f: number) =>
  Math.max(...[CAP.c3, CAP.c4].map(([a, d]) => seg(f, a - 6, a + 4) * (1 - seg(f, a + d - 10, a + d))));
/** ruler marks give way to the narration lane (y 1330–1560) while a caption is up */
const laneFree = (f: number, y: number) => 1 - capLive(f) * smoothstep(1290, 1350, y) * (1 - smoothstep(1540, 1600, y));

export function rulerLayout(f: number, cam: Cam): RulerLayout {
  const out = 1 - seg(f, 236, 252);
  const nowA = ease.outCubic(seg(f, 98, 112)) * out;
  const [px, yP] = toScreen(cam, ...centre(walkerS(f)));
  const futA = ease.outCubic(seg(f, 114, 130)) * out;
  const ticks = [1, 2, 3, 4].map((n) => {
    const a = ease.outCubic(seg(f, 86 + 30 * n + 4, 86 + 30 * n + 16)) * out;
    const [tx, ty] = toScreen(cam, ...centre(walkerS(f - 30 * n)));
    return { n, a: a * laneFree(f, ty), tx, ty };
  });
  const lowest = ticks.filter((t) => t.ty < 1960 && seg(f, 86 + 30 * t.n + 4, 86 + 30 * t.n + 16) > 0.01).reduce((m, t) => Math.max(m, t.ty), yP);
  return { nowA, futA, px, yP, ticks, lowest, yFut: Math.max(258, yP - 236) };
}

/** soft dark strip down the left edge: backs the ruler (f98–252) and, narrower, the S-gauge (to f362) */
function leftStrip(ctx: CanvasRenderingContext2D, f: number) {
  const ruler = ease.inOutSine(seg(f, 92, 112)) * (1 - ease.inOutSine(seg(f, 238, 262)));
  const gauge = seg(f, 146, 170) * (1 - seg(f, 340, 362));
  const a = Math.max(0.42 * ruler, 0.3 * gauge);
  if (a < 0.003) return;
  const w = 180 + 220 * ruler;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, `rgba(10,7,5,${a})`);
  g.addColorStop(0.45, `rgba(10,7,5,${a * 0.72})`);
  g.addColorStop(1, 'rgba(10,7,5,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, 1920);
}

/** canvas part of the ruler (and the strip behind the S-gauge) */
export function drawRulerCanvas(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  leftStrip(ctx, f);
  if (f < RULER[0] || f >= RULER[1]) return;
  const L = rulerLayout(f, cam);
  if (L.nowA <= 0.001) return;
  ctx.save();
  ctx.lineCap = 'round';
  const seg2 = (x0: number, y0: number, x1: number, y1: number, col: string, a: number, w: number, dash?: number[]) => {
    ctx.setLineDash(dash ?? []);
    // dark underlay first: the hairline reads on lit sand too
    ctx.strokeStyle = 'rgba(12,8,5,1)';
    ctx.globalAlpha = 0.32 * a;
    ctx.lineWidth = w + 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const ring = (x: number, y: number, r: number, col: string, a: number) => {
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(12,8,5,1)';
    ctx.globalAlpha = 0.4 * a;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.globalAlpha = a;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  // past: the solid axis down the written trail
  seg2(RX, L.yP, RX, L.lowest, WARM, 0.75 * L.nowA, 1.5);
  // future: dashed, cold, empty
  seg2(RX, L.yP - 20, RX, Math.max(150, L.yP - 330), COLD, 0.5 * L.futA, 1.5, [4, 9]);
  // the present: diamond on the axis, a leader across to the walker, a ring where the next print will be made
  seg2(RX + 12, L.yP, L.px - 16, L.yP, WARM, 0.6 * L.nowA, 1.5, [2, 6]);
  ring(L.px, L.yP, 9, WARM, 0.9 * L.nowA);
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.95 * L.nowA;
  ctx.fillStyle = WARM;
  ctx.beginPath();
  ctx.moveTo(RX, L.yP - 8);
  ctx.lineTo(RX + 8, L.yP);
  ctx.lineTo(RX, L.yP + 8);
  ctx.lineTo(RX - 8, L.yP);
  ctx.closePath();
  ctx.fill();
  // the past: a tick on the axis, a solid leader to the trail point it names, a 6 px ring there
  for (const t of L.ticks) {
    if (t.a <= 0.01 || t.ty > 1940) continue;
    seg2(RX - 10, t.ty, RX + 10, t.ty, WARM, 0.9 * t.a, 1.5);
    seg2(RX + 100, t.ty, t.tx - 8, t.ty, WARM, 0.6 * t.a, 1.5);
    ring(t.tx, t.ty, 6, WARM, 0.85 * t.a);
  }
  ctx.restore();
}

const halo = '0 0 6px rgba(10,7,5,0.95), 0 1px 14px rgba(10,7,5,0.8)';

/** DOM part of the ruler: the labels */
export const TimeRuler: React.FC<{ f: number; cam: Cam }> = ({ f, cam }) => {
  useFontsReady([
    [`400 28px ${FONT.sans}`, '现在未来·？'],
    [`300 28px ${FONT.sans}`, '未来·？'],
    [`400 24px ${FONT.mono}`, '−1234 s'],
  ]);
  const L = rulerLayout(f, cam);
  if (L.nowA <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: RX + 22, top: L.yP - 48, fontFamily: FONT.sans, fontSize: 28, letterSpacing: '0.15em', color: WARM, opacity: 0.97 * L.nowA, whiteSpace: 'nowrap', textShadow: halo }}>
        现在
      </div>
      <div style={{ position: 'absolute', left: RX + 22, top: L.yFut - 18, fontFamily: FONT.sans, fontWeight: 300, fontSize: 28, letterSpacing: '0.15em', color: COLD, opacity: 0.68 * L.futA, whiteSpace: 'nowrap', textShadow: halo }}>
        未来 · ？
      </div>
      {L.ticks.map((t) =>
        t.a > 0.01 && t.ty < 1900 ? (
          <div key={t.n} style={{ position: 'absolute', left: RX + 22, top: t.ty - 17, fontFamily: FONT.mono, fontSize: 24, letterSpacing: '0.12em', color: WARM, opacity: 0.95 * t.a, whiteSpace: 'nowrap', textShadow: halo }}>
            −{t.n} s
          </div>
        ) : null,
      )}
    </div>
  );
};

/**
 * The fail state of lib Timecode (✕ + 不可逆, alarm red), but held steady: lib Timecode blinks on absolute frames
 * (it would land in its dim phase), so it is frozen on an "on" frame; the stamp-in (scale + glow) uses the real frame.
 */
export const FailStamp: React.FC<{ f: number; t0: number; opacity: number }> = ({ f, t0, opacity }) => {
  const k = clamp((f - t0) / 4);
  const sc = 1 + 0.18 * (1 - ease.outCubic(k));
  const glow = Math.exp(-(f - t0) / 3);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${sc.toFixed(3)})`,
        transformOrigin: '110px 268px',
        filter: glow > 0.05 ? `drop-shadow(0 0 ${(10 * glow).toFixed(1)}px rgba(255,59,92,0.9))` : undefined,
      }}
    >
      <Freeze frame={330}>
        <Timecode size={34} mode="fail" text="不可逆" opacity={opacity} />
      </Freeze>
    </div>
  );
};
