// S08 — the time ruler that rides along the trail: 现在 at the walker, −1 s … −4 s on the prints behind,
// 未来 · ？ over the pristine sand ahead (records only exist behind the present).
import React from 'react';
import { FONT, useFontsReady } from '../../lib/fonts';
import { ease, seg } from '../../lib/math';
import { Cam, centre, toScreen, walkerS } from './trail';

const WARM = '#F6DFB2';
const COLD = '#DCE7F5';
const RX = 150; // ruler x

export const TimeRuler: React.FC<{ f: number; cam: Cam }> = ({ f, cam }) => {
  useFontsReady([
    [`400 28px ${FONT.sans}`, '现在未来·？'],
    [`300 28px ${FONT.sans}`, '未来·？'],
    [`400 24px ${FONT.mono}`, '−1234 s'],
  ]);
  const out = 1 - seg(f, 236, 252);
  const nowA = ease.outCubic(seg(f, 98, 112)) * out;
  if (nowA <= 0.001) return null;
  const present = toScreen(cam, ...centre(walkerS(f)));
  const yP = present[1];
  const futA = ease.outCubic(seg(f, 114, 130)) * out;
  const ticks = [1, 2, 3, 4].map((n) => {
    const a = ease.outCubic(seg(f, 86 + 30 * n + 4, 86 + 30 * n + 16)) * out;
    const [tx, ty] = toScreen(cam, ...centre(walkerS(f - 30 * n)));
    return { n, a, tx, ty };
  });
  const lowest = ticks.filter((t) => t.a > 0.01).reduce((m, t) => Math.max(m, t.ty), yP);
  const line = (x0: number, y0: number, x1: number, y1: number, col: string, a: number, dash?: string, w = 1.5) => (
    <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={col} strokeOpacity={a} strokeWidth={w} strokeDasharray={dash} />
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
        {/* past: solid ruler down the written trail */}
        {line(RX, yP, RX, lowest, WARM, 0.45 * nowA)}
        {/* future: dashed, cold, empty */}
        {line(RX, yP - 18, RX, yP - 330, COLD, 0.35 * futA, '4 9')}
        {/* the present: a hairline across the sand */}
        {line(RX - 14, yP, 960, yP, WARM, 0.5 * nowA, '2 6', 1.2)}
        <polygon points={`${RX},${yP - 7} ${RX + 7},${yP} ${RX},${yP + 7} ${RX - 7},${yP}`} fill={WARM} fillOpacity={0.9 * nowA} />
        {ticks.map((t) =>
          t.a > 0.01 ? (
            <g key={t.n}>
              {line(RX - 10, t.ty, RX + 10, t.ty, WARM, 0.7 * t.a)}
              {line(RX + 96, t.ty, t.tx - 70, t.ty, WARM, 0.32 * t.a, '1 6', 1.2)}
              <circle cx={t.tx - 70} cy={t.ty} r={2.5} fill={WARM} fillOpacity={0.6 * t.a} />
            </g>
          ) : null,
        )}
      </svg>
      <div style={{ position: 'absolute', left: RX + 20, top: yP - 46, fontFamily: FONT.sans, fontSize: 28, letterSpacing: '0.15em', color: WARM, opacity: nowA, whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
        现在
      </div>
      <div style={{ position: 'absolute', left: RX + 20, top: yP - 250, fontFamily: FONT.sans, fontWeight: 300, fontSize: 28, letterSpacing: '0.15em', color: COLD, opacity: 0.55 * futA, whiteSpace: 'nowrap' }}>
        未来 · ？
      </div>
      {ticks.map((t) =>
        t.a > 0.01 ? (
          <div key={t.n} style={{ position: 'absolute', left: RX + 20, top: t.ty - 16, fontFamily: FONT.mono, fontSize: 24, letterSpacing: '0.12em', color: WARM, opacity: 0.8 * t.a, whiteSpace: 'nowrap', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
            −{t.n} s
          </div>
        ) : null,
      )}
    </div>
  );
};
