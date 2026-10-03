// The hook's two ASSERTIONS (screenplay S01 cards 1–2): Noto Serif SC 900, ink colour on the cream water, emphasis in
// seal red. They sit in one lane (centre HEAD_Y) so B replaces A in place.
//   · legibility over ink: every glyph carries a soft cream halo (the backlit water "behind" the letter), and a
//     faint cream scrim sits behind the whole block; both leave with the glyphs.
//   · enter: `enterLen = 0` → fully on screen on its first frame (headline A is the cover frame: no fade-in);
//     otherwise a fast CONDENSE (the film's grammar, assertion speed): out of blur, slightly large, staggered.
//   · exit: DIFFUSE (characters drift apart in random order, blur, rotate) — fast.
//   · `jitter`: horizontal tape wobble of the whole block while the tape is tampered with.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { hash01, seedOf } from '../../lib/random';
import { clamp, ease, seg } from '../../lib/math';

export const HEAD_INK = '#0B0D14';
export const HEAD_SEAL = '#A3161A';
const HALO = '246,240,229';

interface Glyph {
  ch: string;
  em: boolean;
  line: number;
  idx: number;
}

function parse(raw: string): { glyphs: Glyph[]; lines: number } {
  const glyphs: Glyph[] = [];
  let em = false,
    line = 0,
    idx = 0;
  for (const ch of Array.from(raw)) {
    if (ch === '{') em = true;
    else if (ch === '}') em = false;
    else if (ch === '\n') line++;
    else glyphs.push({ ch, em, line, idx: idx++ });
  }
  return { glyphs, lines: line + 1 };
}

export const Headline: React.FC<{
  text: string;
  from: number;
  dur: number;
  enterLen?: number;
  exitLen?: number;
  y: number;
  size?: number;
  jitter?: number;
  seed?: number;
}> = ({ text, from, dur, enterLen = 8, exitLen = 10, y, size = 120, jitter = 0, seed }) => {
  const frame = useCurrentFrame();
  const plain = text.replace(/[{}\n]/g, '');
  useFontsReady([[`900 ${size}px ${FONT.serif}`, plain]]);
  const local = frame - from;
  if (local < 0 || local >= dur) return null;
  const sd = seed ?? seedOf(text);
  const { glyphs, lines } = parse(text);
  const exitStart = dur - exitLen;
  let vis = 0;

  const renderGlyph = (g: Glyph) => {
    const r1 = hash01(g.idx, sd),
      r2 = hash01(g.idx + 1000, sd),
      r3 = hash01(g.idx + 2000, sd),
      r4 = hash01(g.idx + 3000, sd);
    let op = 1,
      dx = 0,
      dy = 0,
      blur = 0,
      sc = 1,
      rot = 0;
    if (enterLen > 0) {
      // CONDENSE (assertion speed): out of a blur, a little large, from a short random offset
      const t0 = g.idx * 0.55 + r1 * 1.2;
      const pe = seg(local, t0, t0 + enterLen);
      const e = ease.outCubic(pe);
      const a = r2 * Math.PI * 2;
      const R = 18 + r3 * 26;
      dx += Math.cos(a) * R * (1 - e);
      dy += Math.sin(a) * R * (1 - e);
      blur += (1 - e) * 16;
      sc *= 1 + (1 - e) * 0.22;
      op *= ease.outQuad(pe);
    }
    if (local >= exitStart) {
      // DIFFUSE: characters leave in random order and drift apart
      const d0 = exitStart + r4 * exitLen * 0.4;
      const q = seg(local, d0, d0 + exitLen * 0.6);
      const e = ease.inQuad(q);
      const a = r2 * Math.PI * 2 + (r3 - 0.5) * 2;
      const R = 60 + r1 * 130;
      dx += Math.cos(a) * R * e;
      dy += Math.sin(a) * R * e - 24 * e;
      blur += e * 20;
      rot += (r3 - 0.5) * 60 * e;
      sc *= 1 + e * 0.2;
      op *= 1 - ease.inCubic(q);
    }
    const alpha = clamp(op);
    vis += alpha;
    const c = g.em ? HEAD_SEAL : HEAD_INK;
    // cream halo: tight (crisp edge against dark ink) + soft (lifts the letter off the cloud); the scrim does the rest
    const halo = `0 0 4px rgba(${HALO},0.95), 0 0 20px rgba(${HALO},0.85)`;
    return (
      <span
        key={g.idx}
        style={{
          display: 'inline-block',
          whiteSpace: 'pre',
          color: c,
          opacity: alpha,
          textShadow: halo,
          transform: dx || dy || rot || sc !== 1 ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})` : undefined,
          filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        {g.ch}
      </span>
    );
  };

  const byLine: Glyph[][] = Array.from({ length: lines }, () => []);
  for (const g of glyphs) byLine[g.line].push(g);
  const rows = byLine.map((ln, i) => (
    <div key={i} style={{ whiteSpace: 'nowrap' }}>
      {ln.map(renderGlyph)}
    </div>
  ));
  const scrim = clamp(vis / Math.max(1, glyphs.length));
  const lh = 1.2;
  const blockH = lines * size * lh;
  return (
    <>
      {/* faint cream scrim behind the block (the light table shows through the ink around the words) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y - blockH / 2 - 120,
          width: 1080,
          height: blockH + 240,
          opacity: scrim,
          background: `radial-gradient(ellipse 52% 50% at 50% 50%, rgba(${HALO},0.62) 0%, rgba(${HALO},0.42) 45%, rgba(${HALO},0) 100%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 60 + jitter,
          top: y,
          width: 960,
          transform: 'translateY(-50%)',
          textAlign: 'center',
          fontFamily: FONT.serif,
          fontSize: size,
          fontWeight: 900,
          lineHeight: lh,
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}
      >
        {rows}
      </div>
    </>
  );
};
