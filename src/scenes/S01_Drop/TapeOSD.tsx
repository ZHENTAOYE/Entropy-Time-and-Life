// The deck's on-screen display while the tape is rewound (f0 → the clunk): a big VHS-style `◀◀ ×16` in alarm red with
// a dark keyline (it must read over cream water AND black ink), the tape clock under it, chroma split (time is being
// tampered with) and tape wobble. At the clunk the scene hands over to the film's small Timecode (▶).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { COLOR } from '../../lib/handoff';
import { hash01 } from '../../lib/random';

function clockText(s: number): string {
  const t = Math.max(0, s);
  const hh = Math.floor(t / 3600),
    mm = Math.floor((t % 3600) / 60),
    ss = Math.floor(t % 60),
    ff = Math.floor((t % 1) * 30);
  return [hh, mm, ss, ff].map((v) => String(v).padStart(2, '0')).join(':');
}

export function speedText(v: number): string {
  const a = Math.abs(v);
  return '×' + (a < 0.95 ? a.toFixed(2) : String(Math.round(a)));
}

const GLYPHS = '◀▶×0123456789.:';

export const TapeOSD: React.FC<{ seconds: number; speed: number; tamper: number; x?: number; y?: number }> = ({
  seconds,
  speed,
  tamper,
  x = 90,
  y = 226,
}) => {
  const frame = useCurrentFrame();
  useFontsReady([
    [`700 64px ${FONT.mono}`, GLYPHS],
    [`700 30px ${FONT.mono}`, GLYPHS],
  ]);
  // chroma split: small on the cover frame, louder with the tamper; a hash-jittered tape wobble from f1
  const split = frame < 1 ? 2.5 : 2 + 4 * tamper * hash01(frame, 77);
  const jx = frame < 1 ? 0 : (hash01(frame, 404) - 0.5) * 7 * tamper;
  const jy = frame < 1 ? 0 : (hash01(frame, 405) - 0.5) * 3 * tamper;
  const key = 'rgba(8,6,10,0.9)';
  const keyline = `0 0 2px ${key}, 1.5px 1.5px 0 ${key}, -1px -1px 0 rgba(8,6,10,0.55), 0 0 14px rgba(8,6,10,0.35)`;
  const chroma = `${split.toFixed(1)}px 0 rgba(255,40,80,0.8), ${(-split).toFixed(1)}px 0 rgba(40,220,255,0.7)`;
  return (
    <div
      style={{
        position: 'absolute',
        left: x + jx,
        top: y + jy,
        fontFamily: FONT.mono,
        fontWeight: 700,
        color: COLOR.alarmRed,
        whiteSpace: 'pre',
        fontVariantNumeric: 'tabular-nums',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 64, lineHeight: 1, letterSpacing: '0.06em', textShadow: `${chroma}, ${keyline}` }}>
        {'◀◀ ' + speedText(speed)}
      </div>
      <div style={{ fontSize: 30, lineHeight: 1, marginTop: 14, letterSpacing: '0.14em', opacity: 0.92, textShadow: `${(split * 0.6).toFixed(1)}px 0 rgba(255,40,80,0.7), ${keyline}` }}>
        {clockText(seconds)}
      </div>
    </div>
  );
};
