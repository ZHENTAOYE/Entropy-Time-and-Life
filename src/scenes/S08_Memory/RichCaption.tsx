// S08 — narration with per-line sizes and three emphasis styles, keeping the film's condense-in / diffuse-out grammar.
// Markup: {…} = gold (warm, glowing) · <…> = ghost (cold white, nearly invisible: the unwritten future)
//         […] = echo (gold + two fading echo copies that ripple out, like the delay in the score)
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { clamp, ease, seg } from '../../lib/math';
import { hash01, seedOf } from '../../lib/random';

export interface RichLine {
  text: string;
  size?: number;
  weight?: number;
  opacity?: number;
  letterSpacing?: number;
  /** frames before this line starts condensing (relative to caption start) */
  delay?: number;
  font?: keyof typeof FONT;
  color?: string;
  marginBottom?: number;
}

type Kind = 'n' | 'gold' | 'ghost' | 'echo';
interface G {
  ch: string;
  kind: Kind;
  idx: number;
}

function parseLine(t: string, start: number): G[] {
  const out: G[] = [];
  let kind: Kind = 'n';
  let idx = start;
  for (const ch of Array.from(t)) {
    if (ch === '{') kind = 'gold';
    else if (ch === '<') kind = 'ghost';
    else if (ch === '[') kind = 'echo';
    else if (ch === '}' || ch === '>' || ch === ']') kind = 'n';
    else out.push({ ch, kind, idx: idx++ });
  }
  return out;
}

export const RichCaption: React.FC<{
  lines: RichLine[];
  from: number;
  dur: number;
  y: number;
  x?: number;
  color?: string;
  gold?: string;
  ghost?: string;
  enterLen?: number;
  exitLen?: number;
  stagger?: number;
  lineHeight?: number;
  shadow?: boolean;
  /** local frame at which the echo copies start rippling out */
  echoAt?: number;
  seed?: number;
}> = ({
  lines,
  from,
  dur,
  y,
  x = 540,
  color = '#F3EFE6',
  gold = '#FFC94A',
  ghost = '#DCE7F5',
  enterLen = 18,
  exitLen = 28,
  stagger = 1.6,
  lineHeight = 1.5,
  shadow = true,
  echoAt = 60,
  seed,
}) => {
  const frame = useCurrentFrame();
  const specs: Array<[string, string]> = [];
  for (const l of lines) {
    const plain = l.text.replace(/[{}<>[\]]/g, '');
    specs.push([`${l.weight ?? 600} ${l.size ?? 56}px ${FONT[l.font ?? 'serif']}`, plain]);
  }
  useFontsReady(specs);
  const local = frame - from;
  if (local < 0 || local >= dur) return null;
  const sd = seed ?? seedOf(lines.map((l) => l.text).join('|'));
  const exitStart = dur - exitLen;

  let gi = 0;
  const parsed = lines.map((l) => {
    const g = parseLine(l.text, gi);
    gi += g.length;
    return g;
  });

  const glyph = (g: G, li: number, posInLine: number) => {
    const L = lines[li];
    const r1 = hash01(g.idx, sd);
    const r2 = hash01(g.idx + 1000, sd);
    const r3 = hash01(g.idx + 2000, sd);
    const r4 = hash01(g.idx + 3000, sd);
    let op = 1;
    let dx = 0;
    let dy = 0;
    let blur = 0;
    let sc = 1;
    let rot = 0;
    const t0 = (L.delay ?? 0) + posInLine * stagger + r1 * stagger * 0.6;
    const pe = seg(local, t0, t0 + enterLen);
    {
      const e = ease.outCubic(pe);
      const a = r2 * Math.PI * 2;
      const R = 26 + r3 * 34;
      dx += Math.cos(a) * R * (1 - e);
      dy += Math.sin(a) * R * (1 - e);
      blur += (1 - e) * 14;
      sc *= 1 + (1 - e) * 0.35;
      op *= ease.outQuad(pe);
    }
    if (local >= exitStart) {
      const d0 = exitStart + r4 * exitLen * 0.45;
      const q = seg(local, d0, d0 + exitLen * 0.55);
      const e = ease.inQuad(q);
      const a = r2 * Math.PI * 2 + (r3 - 0.5) * 2;
      const R = 50 + r1 * 110;
      dx += Math.cos(a) * R * e + Math.sin(local * 0.6 + r1 * 20) * 6 * e;
      dy += Math.sin(a) * R * e + Math.cos(local * 0.5 + r2 * 20) * 6 * e - 20 * e;
      blur += e * 16;
      rot += (r3 - 0.5) * 70 * e;
      sc *= 1 + e * 0.25;
      op *= 1 - ease.inCubic(q);
    }
    let c = L.color ?? color;
    const shadows: string[] = [];
    let extraOp = 1;
    if (g.kind === 'gold' || g.kind === 'echo') {
      c = gold;
      shadows.push(`0 0 ${Math.round((L.size ?? 56) * 0.3)}px rgba(255,201,74,0.55)`, `0 0 ${Math.round((L.size ?? 56) * 0.8)}px rgba(255,170,60,0.3)`);
    }
    if (g.kind === 'ghost') {
      // the unwritten future: cold and nearly invisible (opacity only — a permanent blur filter would cost a
      // compositing surface per glyph for the whole card)
      c = ghost;
      extraOp = 0.2 + 0.04 * Math.sin(local * 0.21 + g.idx);
    }
    if (shadow && g.kind !== 'ghost') shadows.push(`0 2px ${Math.round((L.size ?? 56) * 0.5)}px rgba(0,0,0,0.8)`);
    const tf = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    const base: React.CSSProperties = {
      display: 'inline-block',
      whiteSpace: 'pre',
      color: c,
      transform: tf,
      filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
      textShadow: shadows.length ? shadows.join(',') : undefined,
    };
    return (
      <span key={g.idx} style={{ ...base, opacity: clamp(op * extraOp * (L.opacity ?? 1)) }}>
        {g.ch}
      </span>
    );
  };

  /** opacity of a glyph's enter/exit alone (for the echo copies, which follow the word's own life) */
  const lifeOp = (g: G, li: number, posInLine: number) => {
    const L = lines[li];
    const r1 = hash01(g.idx, sd);
    const r4 = hash01(g.idx + 3000, sd);
    const t0 = (L.delay ?? 0) + posInLine * stagger + r1 * stagger * 0.6;
    let op = ease.outQuad(seg(local, t0, t0 + enterLen));
    if (local >= exitStart) {
      const d0 = exitStart + r4 * exitLen * 0.45;
      op *= 1 - ease.inCubic(seg(local, d0, d0 + exitLen * 0.55));
    }
    return op;
  };

  /** an [echo] word: its glyphs + two hollow, expanding, fading repetitions launched from the word's centre on the
   *  score's delay taps (echoAt, echoAt + 7), repeated once, fainter, on the next pulse (echoAt + 30) */
  const echoWord = (gs: Array<[G, number]>, li: number) => {
    const L = lines[li];
    const word = gs.map(([g]) => g.ch).join('');
    const wordOp = Math.min(...gs.map(([g, i]) => lifeOp(g, li, i)));
    const copies: React.ReactNode[] = [];
    for (const [launch, gain] of [
      [echoAt, 1],
      [echoAt + 30, 0.55],
    ] as Array<[number, number]>)
      [1, 2].forEach((k) => {
        const e0 = launch + (k - 1) * 7;
        const q = seg(local, e0, e0 + 26);
        if (q <= 0 || q >= 1) return;
        const e = ease.outCubic(q);
        const sc = 1 + e * (k === 1 ? 0.45 : 0.9);
        const a = (k === 1 ? 0.85 : 0.6) * gain * (1 - ease.inQuad(q)) * Math.min(1, q * 10);
        copies.push(
          <span
            key={`${launch}-${k}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              textAlign: 'center',
              whiteSpace: 'pre',
              color: 'transparent',
              WebkitTextStroke: `${(1.4 - 0.5 * e).toFixed(2)}px ${gold}`,
              opacity: clamp(a * wordOp),
              transform: `scale(${sc.toFixed(3)})`,
              transformOrigin: '50% 55%',
              filter: `blur(${(0.3 + 1.2 * e).toFixed(2)}px) drop-shadow(0 0 6px rgba(255,201,74,0.6))`,
            }}
          >
            {word}
          </span>,
        );
      });
    // hollow copies of the word expand from its centre like the network's pulse rings and fade
    return (
      <span key={'echo' + gs[0][0].idx} style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
        {copies}
        {gs.map(([g, i]) => glyph(g, li, i))}
      </span>
    );
  };

  const renderLine = (gl: G[], li: number) => {
    const out: React.ReactNode[] = [];
    let run: Array<[G, number]> = [];
    gl.forEach((g, i) => {
      if (g.kind === 'echo') {
        run.push([g, i]);
        return;
      }
      if (run.length) {
        out.push(echoWord(run, li));
        run = [];
      }
      out.push(glyph(g, li, i));
    });
    if (run.length) out.push(echoWord(run, li));
    return out;
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 470,
        top: y,
        width: 940,
        transform: 'translateY(-50%)',
        textAlign: 'center',
        lineHeight,
        pointerEvents: 'none',
      }}
    >
      {parsed.map((gl, li) => {
        const L = lines[li];
        return (
          <div
            key={li}
            style={{
              fontFamily: FONT[L.font ?? 'serif'],
              fontSize: L.size ?? 56,
              fontWeight: L.weight ?? 600,
              letterSpacing: `${L.letterSpacing ?? 0.08}em`,
              whiteSpace: 'nowrap',
              marginBottom: L.marginBottom ?? 0,
            }}
          >
            {renderLine(gl, li)}
          </div>
        );
      })}
    </div>
  );
};
