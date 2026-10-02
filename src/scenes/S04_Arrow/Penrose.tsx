// Beat E — Penrose's estimate as a power tower 1 / 10^10^123, written IN the primordial plasma. A dark layer is
// MULTIPLIED over the frame; its glyphs are white, so the number is a set of windows cut into the darkness and the
// boiling plasma shows only through it (the soft white halo of each glyph lets its light bleed out). The camera
// starts so close that the base “10” bursts out of the frame, climbs the tower (exponent 10, then 123) and pulls
// back to the whole fraction; then a wall of zeros (“1 followed by 10¹²³ zeros”) pours in and scrolls into a blur.
// The base “10” is a window from the first frame of the darkness, so it EMERGES as the plasma around it goes dark
// (no empty frame); its arrival is punctuated by a scale kick + flash + shake at T.base10.
// DOM (not canvas) so the numerals can use Cormorant Garamond's LINING figures.
import React from 'react';
import { FONT } from '../../lib/fonts';
import { useLazyFonts } from './fontGate';
import { clamp, ease, lerp, seg, smoothstep } from '../../lib/math';
import { T } from './timing';

const BS = 380,
  ES = 196,
  TS = 100;
const DW = 0.52; // digit cell (em)
const G1 = 6,
  G2 = 6;
const wB = 2 * DW * BS,
  wE = 2 * DW * ES,
  wT = 3 * DW * TS;
const XB = 540 - (wB + G1 + wE + G2 + wT) / 2;
const YB = 904; // top of the base line box (lineHeight 1); baseline ≈ top + 0.819 em
const BASE = { x: XB, y: YB };
const EXP = { x: XB + wB + G1, y: YB + 0.819 * BS - 0.56 * BS - 0.819 * ES };
const TOP = { x: EXP.x + wE + G2, y: EXP.y + 0.819 * ES - 0.56 * ES - 0.819 * TS };
const NUM_Y = 566; // top of the numerator line box (200 px)
const BAR_Y = 772;

/** camera keyframes in formula space: [frame, cx, cy, scale] */
const KEYS: Array<[number, number, number, number]> = [
  [T.base10, BASE.x + wB / 2, BASE.y + 0.5 * BS, 2.7],
  [T.exp10 + 6, EXP.x + wE * 0.5, EXP.y + 0.5 * ES, 2.0],
  [T.pullBack[0], TOP.x + wT * 0.35, TOP.y + 0.55 * TS, 1.75],
  [T.pullBack[1], 540, 880, 1.0],
  [T.overlayOut[1], 540, 880, 0.95],
];
function camera(f: number): [number, number, number] {
  if (f <= KEYS[0][0]) return [KEYS[0][1], KEYS[0][2], KEYS[0][3]];
  for (let i = 1; i < KEYS.length; i++) {
    const [f1, x1, y1, s1] = KEYS[i];
    const [f0, x0, y0, s0] = KEYS[i - 1];
    if (f <= f1) {
      const u = (f - f0) / (f1 - f0);
      const e = i === KEYS.length - 1 ? u : ease.inOutCubic(u);
      return [lerp(x0, x1, e), lerp(y0, y1, e), Math.exp(lerp(Math.log(s0), Math.log(s1), e))];
    }
  }
  const k = KEYS[KEYS.length - 1];
  return [k[1], k[2], k[3]];
}

/** Overlay strength (0..1). */
export const penroseDark = (f: number) => 0.93 * ease.inOutSine(seg(f, T.overlayIn[0], T.overlayIn[1])) * (1 - ease.inOutSine(seg(f, T.overlayOut[0], T.overlayOut[1])));

const pop = (f: number, f0: number) => {
  const k = seg(f, f0, f0 + 12);
  return { a: smoothstep(0, 0.35, k), s: 1 + 0.22 * (1 - ease.outBack(k)) };
};
/** the base: present (as a window) from the start of the darkness; a smooth scale kick when it "lands" */
const emerge = (f: number) => ({ a: smoothstep(T.overlayIn[0], T.overlayIn[0] + 6, f), s: 1 + 0.07 * Math.sin(Math.PI * seg(f, T.base10, T.base10 + 9)) });

const Num: React.FC<{ txt: string; size: number; x: number; y: number; f0: number; f: number; rim: boolean; base?: boolean; glow: number; glowR: number }> = ({ txt, size, x, y, f0, f, rim, base, glow, glowR }) => {
  const p = base ? emerge(f) : pop(f, f0);
  if (p.a <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        height: size,
        lineHeight: 1,
        fontFamily: FONT.latin,
        fontWeight: 600,
        fontSize: size,
        fontVariantNumeric: 'lining-nums tabular-nums',
        whiteSpace: 'nowrap',
        opacity: p.a,
        transform: `scale(${p.s.toFixed(4)})`,
        transformOrigin: '50% 55%',
        display: 'flex',
        ...(rim
          ? { color: 'transparent', WebkitTextStroke: `${(1.6 * (380 / size) ** 0.3).toFixed(2)}px rgba(255,201,74,0.55)` }
          : { color: '#FFFFFF', textShadow: glow > 0.02 ? `0 0 ${Math.round(size * 0.12 * glowR)}px rgba(255,255,255,${(0.62 * glow).toFixed(3)})` : 'none' }),
      }}
    >
      {Array.from(txt).map((ch, i) => (
        <span key={i} style={{ display: 'inline-block', width: `${DW}em`, textAlign: 'center' }}>
          {ch}
        </span>
      ))}
    </div>
  );
};

const Formula: React.FC<{ f: number; rim: boolean }> = ({ f, rim }) => {
  const [cx, cy, s] = camera(f);
  // the halo is blurred in screen space: while the camera is right up against the glyphs (they fill the frame) the
  // halo is invisible anyway and costly (a ~1000 px glyph blurred twice) — it fades in during the pull back
  const glow = clamp((2.2 - s) / 0.8); // halo strength
  const glowR = 1 / Math.max(1, s * 0.6); // halo radius factor (bounded on screen)
  const kf = seg(f, T.fraction[0], T.fraction[1]);
  const kl = seg(f, T.fraction[0] + 6, T.fraction[1] + 10);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `translate(${(540 - cx * s).toFixed(2)}px, ${(960 - cy * s).toFixed(2)}px) scale(${s.toFixed(4)})`, transformOrigin: '0 0' }}>
      <Num txt="10" size={BS} x={BASE.x} y={BASE.y} f0={T.base10} f={f} rim={rim} base glow={glow} glowR={glowR} />
      <Num txt="10" size={ES} x={EXP.x} y={EXP.y} f0={T.exp10} f={f} rim={rim} glow={glow} glowR={glowR} />
      <Num txt="123" size={TS} x={TOP.x} y={TOP.y} f0={T.exp123} f={f} rim={rim} glow={glow} glowR={glowR} />
      {kf > 0 ? (
        <>
          <div style={{ position: 'absolute', left: 0, width: 1080, top: NUM_Y, textAlign: 'center', fontFamily: FONT.latin, fontWeight: 600, fontSize: 200, lineHeight: 1, fontVariantNumeric: 'lining-nums', opacity: ease.outCubic(kf), ...(rim ? { color: 'transparent', WebkitTextStroke: '1.4px rgba(255,201,74,0.5)' } : { color: '#fff', textShadow: '0 0 24px rgba(255,255,255,0.62)' }) }}>
            1
          </div>
          {!rim ? <div style={{ position: 'absolute', left: 540 - 330 * ease.inOutCubic(kf), width: 660 * ease.inOutCubic(kf), top: BAR_Y - 3, height: 6, background: '#fff', boxShadow: '0 0 16px rgba(255,255,255,0.7)' }} /> : null}
        </>
      ) : null}
      {kl > 0 && !rim ? (
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 430, textAlign: 'center', fontFamily: FONT.serif, fontWeight: 600, fontSize: 70, lineHeight: 1, letterSpacing: '0.08em', color: '#fff', opacity: 0.92 * ease.outCubic(kl), textShadow: '0 0 14px rgba(255,255,255,0.5)' }}>
          概率 ≈
        </div>
      ) : null}
    </div>
  );
};

const ZROW = '0'.repeat(46);
/** the wall of zeros: rows typed in top → bottom, then the whole wall scrolls up, accelerating into a blur */
const Zeros: React.FC<{ f: number }> = ({ f }) => {
  const kz = seg(f, T.zeros[0], T.zeros[1]);
  if (kz <= 0) return null;
  const rows = 48;
  const rowH = 42;
  const fill = clamp((f - T.zeros[0]) / 24);
  const tS = Math.max(0, Math.min(34, f - (T.zeros[0] + 16)));
  const scroll = 26 * (Math.exp(tS / 11) - 1) + Math.max(0, f - (T.zeros[0] + 50)) * 40;
  const speed = (26 * Math.exp(tS / 11)) / 11;
  const fade = 1 - smoothstep(T.overlayOut[0] - 4, T.overlayOut[1], f);
  const copies = speed > 14 ? 3 : 1;
  const out: React.ReactNode[] = [];
  for (let r = -1; r < rows + 1; r++) {
    const absRow = r + Math.floor(scroll / rowH);
    const yy = 120 + r * rowH - (scroll % rowH);
    const rowOn = clamp(fill * rows * 1.08 - absRow);
    if (rowOn <= 0) continue;
    const lane = 1 - 0.8 * smoothstep(120, 10, Math.abs(yy + 21 - 1440));
    const al = 0.17 * lane * fade;
    if (al < 0.004) continue;
    const shift = (absRow * 37) % 24;
    for (let k = 0; k < copies; k++) {
      const oy = copies > 1 ? (k - 1) * Math.min(14, speed * 0.35) : 0;
      out.push(
        <div key={`${r}_${k}`} style={{ position: 'absolute', left: absRow === 0 ? 60 : 60 - shift, top: yy + oy, width: 1080 * rowOn, overflow: 'hidden', height: rowH, whiteSpace: 'pre', fontFamily: FONT.mono, fontSize: 30, letterSpacing: '6px', lineHeight: `${rowH}px`, color: `rgba(255,255,255,${(al / copies).toFixed(3)})` }}>
          {absRow === 0 ? '1' + ZROW : ZROW}
        </div>,
      );
    }
  }
  return <>{out}</>;
};

export const PenroseLayer: React.FC<{ f: number }> = ({ f }) => {
  useLazyFonts(
    [
      [`600 380px ${FONT.latin}`, '0123'],
      [`600 70px ${FONT.serif}`, '概率≈'],
      [`400 30px ${FONT.mono}`, '01'],
    ],
    f >= T.overlayIn[0] - 10 && f < T.overlayOut[1],
  );
  const A = penroseDark(f);
  if (A <= 0.002) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, background: '#0B0503', opacity: A, mixBlendMode: 'multiply', overflow: 'hidden' }}>
        <Zeros f={f} />
        <Formula f={f} rim={false} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: A, overflow: 'hidden', pointerEvents: 'none' }}>
        <Formula f={f} rim />
      </div>
    </>
  );
};
