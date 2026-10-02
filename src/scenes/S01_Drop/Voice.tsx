// Local copy of the film's narration voice (lib/Caption.tsx: CONDENSE in / DIFFUSE out), extended with S01's two
// emphasis effects and a per-line entry delay:
//   emFx 'glitch' — 倒放: the word is "on the tape": a fine RGB split, and short bursts (~20 % of 2-frame ticks, plus
//                   forced bursts on tape events: `glitchBursts`) of horizontal scan-slices torn ≤ 12 px sideways.
//                   Between bursts the word stays legible.
//   emFx 'drift'  — 聚回来: while the line is displayed the three characters slowly drift APART (and rotate a hair,
//                   soften a little) — the words that claim re-gathering are themselves spreading.
//   lineDelay     — line n enters n·lineDelay frames later (card 2: line 2 enters 0.6 s after line 1).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { hash01, seedOf } from '../../lib/random';
import { clamp, ease, seg } from '../../lib/math';

export interface VoiceProps {
  text: string;
  from: number;
  dur: number;
  x?: number;
  y?: number;
  size?: number;
  weight?: number;
  color?: string;
  accent?: string;
  letterSpacing?: number;
  lineHeight?: number;
  maxWidth?: number;
  enterLen?: number;
  exitLen?: number;
  stagger?: number;
  lineDelay?: number;
  emFx?: 'glitch' | 'drift';
  /** strength multiplier of the glitch bursts (e.g. louder while the tape is rewinding) */
  glitchGain?: number;
  /** local frames (relative to `from`) on which a glitch burst is forced (tape events: the leap…) */
  glitchBursts?: number[];
  /** horizontal jitter of the whole block in px (tape wobble) */
  jitter?: number;
  seed?: number;
}

interface Glyph {
  ch: string;
  em: boolean;
  line: number;
  idx: number;
  /** index inside its emphasis run (0, 1, 2 …), −1 when not emphasised */
  emIdx: number;
  emLen: number;
}

function parse(raw: string): { glyphs: Glyph[]; lines: number } {
  const text = raw.replace(/\\n/g, '\n');
  const glyphs: Glyph[] = [];
  let em = false,
    line = 0,
    idx = 0,
    run: Glyph[] = [];
  for (const ch of Array.from(text)) {
    if (ch === '{') {
      em = true;
      run = [];
      continue;
    }
    if (ch === '}') {
      em = false;
      for (const g of run) g.emLen = run.length;
      continue;
    }
    if (ch === '\n') {
      line++;
      continue;
    }
    const g: Glyph = { ch, em, line, idx: idx++, emIdx: em ? run.length : -1, emLen: 0 };
    if (em) run.push(g);
    glyphs.push(g);
  }
  return { glyphs, lines: line + 1 };
}

const RED = 'rgba(232,36,72,0.78)';
const CYAN = 'rgba(24,176,232,0.78)';

export const Voice: React.FC<VoiceProps> = (p) => {
  const frame = useCurrentFrame();
  const {
    text,
    from,
    dur,
    x = 540,
    y = 1440,
    size = 56,
    weight = 600,
    color = '#17151C',
    accent = '#2E4A7A',
    letterSpacing = 0.08,
    lineHeight = 1.55,
    maxWidth = 900,
    enterLen = 18,
    exitLen = 26,
    stagger = 2,
    lineDelay = 0,
    emFx,
    glitchGain = 1,
    glitchBursts = [],
    jitter = 0,
    seed = seedOf(text),
  } = p;
  const plain = text.replace(/\\n/g, '').replace(/[{}\n]/g, '');
  useFontsReady([[`${weight} ${size}px ${FONT.serif}`, plain]]);

  const local = frame - from;
  if (local < 0 || local >= dur) return null;
  const { glyphs, lines } = parse(text);
  const exitStart = dur - exitLen;
  const byLine: Glyph[][] = Array.from({ length: lines }, () => []);
  for (const g of glyphs) byLine[g.line].push(g);
  // per-line first index, so a delayed line starts its own stagger from 0
  const lineStart = byLine.map((ln) => (ln.length ? ln[0].idx : 0));
  // the drifting emphasis run of each line: first glyph index, length, and when it starts to drift (once condensed)
  const driftRun = new Map<number, { first: number; len: number; t0: number }>();
  if (emFx === 'drift')
    for (const g of glyphs)
      if (g.em && g.emIdx === 0) {
        const tIn = g.line * lineDelay + (g.idx + g.emLen - 1 - lineStart[g.line]) * stagger + enterLen;
        driftRun.set(g.line, { first: g.idx, len: g.emLen, t0: tIn });
      }

  const renderGlyph = (g: Glyph) => {
    const r1 = hash01(g.idx, seed);
    const r2 = hash01(g.idx + 1000, seed);
    const r3 = hash01(g.idx + 2000, seed);
    const r4 = hash01(g.idx + 3000, seed);
    let op = 1,
      dx = 0,
      dy = 0,
      blur = 0,
      sc = 1,
      rot = 0;
    // ---- enter: CONDENSE out of blur
    const t0 = g.line * lineDelay + (g.idx - lineStart[g.line]) * stagger + r1 * stagger * 0.6;
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
    // ---- emphasis: drift apart while displayed. The run opens to the RIGHT (its left neighbour stays put, the
    // glyphs after it on the line make room), and each glyph wanders a little up/down and turns a hair.
    const drift = driftRun.get(g.line);
    if (drift && emFx === 'drift' && g.idx >= drift.first) {
      const shown = ease.inOutSine(seg(local, drift.t0, exitStart + 6));
      const k = g.em ? g.emIdx : drift.len; // glyphs after the run move with its far end
      dx += k * 9 * shown + (g.em ? (r3 - 0.5) * 4 * shown : 0);
      if (g.em) {
        dy += (r2 - 0.5) * 16 * shown + Math.sin(local * 0.07 + r1 * 6) * 1.2 * shown;
        rot += (r4 - 0.5) * 8 * shown;
        blur += 0.6 * shown;
        op *= 1 - 0.12 * shown;
      }
    }
    // ---- exit: DIFFUSE
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
    const c = g.em ? accent : color;
    const transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    const filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined;
    const alpha = clamp(op);

    if (g.em && emFx === 'glitch') {
      // burst schedule: a 2-frame tick hash, plus a guaranteed burst as the word arrives
      const tick = Math.floor(local / 2);
      const hb = hash01(tick * 7 + g.emIdx, seed + 31);
      const arrive = 1 - seg(local, t0 + enterLen * 0.5, t0 + enterLen + 4);
      const forced = glitchBursts.reduce((acc, b) => Math.max(acc, 1 - Math.abs(local - b) / 1.5), 0);
      const burst = Math.max(hb > 0.8 ? (hb - 0.8) / 0.2 : 0, arrive * 0.9, forced) * glitchGain * pe;
      const base = 0.8 + 0.4 * glitchGain;
      const split = base + 5 * burst;
      const jx = (hash01(frame * 13 + g.emIdx, seed + 5) - 0.5) * 8 * burst;
      const shadow = `${split.toFixed(1)}px 0 ${RED}, ${(-split).toFixed(1)}px 0 ${CYAN}`;
      const slices: React.ReactNode[] = [];
      if (burst > 0.15) {
        for (let k = 0; k < 3; k++) {
          const hs = hash01(tick * 31 + k * 7 + g.emIdx * 3, seed + 77);
          const top = Math.floor(hs * 78);
          const h = 6 + Math.floor(hash01(tick * 17 + k, seed + 3) * 22);
          const off = (hash01(tick * 5 + k * 11 + g.emIdx, seed + 9) - 0.5) * 2 * (4 + 8 * burst);
          slices.push(
            <span
              key={k}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                color: c,
                clipPath: `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`,
                transform: `translateX(${off.toFixed(1)}px)`,
                textShadow: `${(split * 1.6).toFixed(1)}px 0 ${RED}, ${(-split * 1.6).toFixed(1)}px 0 ${CYAN}`,
              }}
            >
              {g.ch}
            </span>,
          );
        }
      }
      return (
        <span
          key={g.idx}
          style={{
            display: 'inline-block',
            position: 'relative',
            whiteSpace: 'pre',
            opacity: alpha,
            transform: `translateX(${jx.toFixed(1)}px) ` + transform,
            filter,
          }}
        >
          <span style={{ color: c, textShadow: shadow }}>{g.ch}</span>
          {slices}
        </span>
      );
    }
    return (
      <span
        key={g.idx}
        style={{ display: 'inline-block', whiteSpace: 'pre', opacity: alpha, color: c, transform, filter }}
      >
        {g.ch}
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x - maxWidth / 2 + jitter,
        top: y,
        width: maxWidth,
        transform: 'translateY(-50%)',
        textAlign: 'center',
        fontFamily: FONT.serif,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        pointerEvents: 'none',
      }}
    >
      {byLine.map((ln, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap' }}>
          {ln.map(renderGlyph)}
        </div>
      ))}
    </div>
  );
};
