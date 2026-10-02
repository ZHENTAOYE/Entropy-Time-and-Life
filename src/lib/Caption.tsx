import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT } from './fonts';
import { useFontsReady } from './fonts';
import { hash01, seedOf } from './random';
import { clamp, ease, seg } from './math';

/**
 * THE NARRATION VOICE OF THE FILM.
 * Motif: every line *condenses* out of blur (a local, temporary order) and leaves by *diffusing*
 * (its characters drift apart, blur and fade in random order) — entropy applied to language itself.
 *
 * Text markup: `{...}` = emphasis (accent colour / weight), `\n` = explicit line break.
 */
export type EnterMode = 'condense' | 'rise' | 'type' | 'fade' | 'glitch' | 'none';
export type ExitMode = 'diffuse' | 'sink' | 'fade' | 'glitch' | 'none';

export interface CaptionProps {
  text: string;
  /** first visible frame (relative to enclosing Sequence) */
  from: number;
  /** total frames visible, including enter & exit animations */
  dur: number;
  /** centre x in px (default: video centre) */
  x?: number;
  /** vertical centre of the text block in px (default 1440 — lower third, above platform UI) */
  y?: number;
  size?: number;
  font?: keyof typeof FONT;
  weight?: number;
  color?: string;
  accent?: string;
  accentWeight?: number;
  /** em */
  letterSpacing?: number;
  lineHeight?: number;
  maxWidth?: number;
  align?: 'center' | 'left' | 'right';
  enter?: EnterMode;
  exit?: ExitMode;
  enterLen?: number;
  exitLen?: number;
  /** frames between successive characters on enter */
  stagger?: number;
  seed?: number;
  /** 0..1 luminous glow in text colour */
  glow?: number;
  /** soft dark halo behind glyphs for legibility on busy/bright backgrounds */
  shadow?: boolean;
  /** extra opacity multiplier */
  opacity?: number;
  italic?: boolean;
  style?: React.CSSProperties;
}

interface Glyph {
  ch: string;
  em: boolean;
  line: number;
  idx: number; // index among visible glyphs
}

function parse(raw: string): { glyphs: Glyph[]; lines: number } {
  // tolerate a literal backslash-n (e.g. from a JSX attribute string)
  const text = raw.replace(/\\n/g, '\n');
  const glyphs: Glyph[] = [];
  let em = false;
  let line = 0;
  let idx = 0;
  for (const ch of Array.from(text)) {
    if (ch === '{') {
      em = true;
      continue;
    }
    if (ch === '}') {
      em = false;
      continue;
    }
    if (ch === '\n') {
      line++;
      continue;
    }
    glyphs.push({ ch, em, line, idx: idx++ });
  }
  return { glyphs, lines: line + 1 };
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
/** punctuation that must not start a line (attach to previous run) */
const CLOSE = /[，。：；！？、”’）》」』…—,.:;!?)\]%]/;
/** punctuation that must not end a line (attach to next run) */
const OPEN = /[“‘（《「『(\[]/;

/** Group a line's glyphs into unbreakable runs: CJK chars are single runs, Latin/number sequences stay together,
 * closing punctuation sticks to the previous run and opening punctuation to the next (basic kinsoku). */
function runsOf(line: Glyph[]): Glyph[][] {
  const runs: Glyph[][] = [];
  let pendingOpen: Glyph[] = [];
  for (const g of line) {
    const last = runs[runs.length - 1];
    if (OPEN.test(g.ch)) {
      pendingOpen.push(g);
      continue;
    }
    if (CLOSE.test(g.ch) && last && !pendingOpen.length) {
      last.push(g);
      continue;
    }
    const latin = !CJK.test(g.ch) && g.ch !== ' ';
    const lastIsLatin = last && last.length && !CJK.test(last[last.length - 1].ch) && last[last.length - 1].ch !== ' ' && !CLOSE.test(last[last.length - 1].ch);
    if (latin && lastIsLatin && !pendingOpen.length) {
      last.push(g);
      continue;
    }
    runs.push([...pendingOpen, g]);
    pendingOpen = [];
  }
  if (pendingOpen.length) runs.push(pendingOpen);
  return runs;
}

export const Caption: React.FC<CaptionProps> = (p) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const {
    text,
    from,
    dur,
    x = width / 2,
    y = 1440,
    size = 56,
    font = 'serif',
    weight = font === 'serif' ? 600 : 400,
    color = '#F3EFE6',
    accent = '#FFD27A',
    accentWeight,
    letterSpacing = 0.08,
    lineHeight = 1.55,
    maxWidth = 900,
    align = 'center',
    enter = 'condense',
    exit = 'diffuse',
    enterLen = 18,
    exitLen = 26,
    stagger = 2,
    seed = seedOf(text),
    glow = 0,
    shadow = false,
    opacity = 1,
    italic = false,
    style,
  } = p;

  const plain = text.replace(/\\n/g, '').replace(/[{}\n]/g, '');
  const fontSpecs: Array<[string, string]> = [[`${italic ? 'italic ' : ''}${weight} ${size}px ${FONT[font]}`, plain]];
  if (accentWeight) fontSpecs.push([`${italic ? 'italic ' : ''}${accentWeight} ${size}px ${FONT[font]}`, plain]);
  useFontsReady(fontSpecs);

  const local = frame - from;
  if (local < 0 || local >= dur) return null;

  const { glyphs, lines } = parse(text);
  const exitStart = dur - exitLen;

  const byLine: Glyph[][] = Array.from({ length: lines }, () => []);
  for (const g of glyphs) byLine[g.line].push(g);

  const renderGlyph = (g: Glyph) => {
    const r1 = hash01(g.idx, seed);
    const r2 = hash01(g.idx + 1000, seed);
    const r3 = hash01(g.idx + 2000, seed);
    const r4 = hash01(g.idx + 3000, seed);
    let op = 1;
    let dx = 0;
    let dy = 0;
    let blur = 0;
    let sc = 1;
    let rot = 0;
    let skew = 0;
    let rgbSplit = 0;

    // ---- enter
    const t0 = g.idx * stagger + r1 * stagger * 0.6;
    const pe = seg(local, t0, t0 + enterLen);
    if (enter === 'condense') {
      const e = ease.outCubic(pe);
      const a = r2 * Math.PI * 2;
      const R = 26 + r3 * 34;
      dx += Math.cos(a) * R * (1 - e);
      dy += Math.sin(a) * R * (1 - e);
      blur += (1 - e) * 14;
      sc *= 1 + (1 - e) * 0.35;
      op *= ease.outQuad(pe);
    } else if (enter === 'rise') {
      const e = ease.outCubic(pe);
      dy += (1 - e) * size * 0.5;
      op *= pe;
      blur += (1 - e) * 4;
    } else if (enter === 'type') {
      op *= local >= t0 ? 1 : 0;
      if (local >= t0 && local < t0 + 3) sc *= 1.12;
    } else if (enter === 'fade') {
      op *= ease.inOutQuad(seg(local, 0, enterLen));
    } else if (enter === 'glitch') {
      const on = local >= t0;
      op *= on ? 1 : 0;
      const k = clamp(1 - (local - t0) / 10);
      if (on && k > 0) {
        const jit = hash01(g.idx * 131 + Math.floor(local), seed) - 0.5;
        dx += jit * 40 * k;
        rgbSplit = 6 * k;
        skew = jit * 30 * k;
      }
    }

    // ---- exit
    if (local >= exitStart && exit !== 'none') {
      if (exit === 'diffuse') {
        const d0 = exitStart + r4 * exitLen * 0.45;
        const q = seg(local, d0, d0 + exitLen * 0.55);
        const e = ease.inQuad(q);
        const a = r2 * Math.PI * 2 + (r3 - 0.5) * 2;
        const R = 50 + r1 * 110;
        // brownian-looking drift: radial + wobble
        dx += Math.cos(a) * R * e + Math.sin(local * 0.6 + r1 * 20) * 6 * e;
        dy += Math.sin(a) * R * e + Math.cos(local * 0.5 + r2 * 20) * 6 * e - 20 * e;
        blur += e * 16;
        rot += (r3 - 0.5) * 70 * e;
        sc *= 1 + e * 0.25;
        op *= 1 - ease.inCubic(q);
      } else if (exit === 'sink') {
        const d0 = exitStart + r4 * exitLen * 0.4;
        const q = seg(local, d0, d0 + exitLen * 0.6);
        const e = ease.inCubic(q);
        dy += e * (120 + r1 * 120);
        dx += (r2 - 0.5) * 40 * e;
        blur += e * 10;
        op *= 1 - q;
      } else if (exit === 'fade') {
        op *= 1 - ease.inOutQuad(seg(local, exitStart, dur));
      } else if (exit === 'glitch') {
        const q = seg(local, exitStart, dur);
        const jit = hash01(g.idx * 71 + Math.floor(local), seed) - 0.5;
        dx += jit * 60 * q;
        rgbSplit = 8 * q;
        op *= hash01(g.idx * 7 + Math.floor(local / 2), seed + 9) > q ? 1 : 0;
      }
    }

    const c = g.em ? accent : color;
    const shadows: string[] = [];
    if (glow > 0) shadows.push(`0 0 ${Math.round(size * 0.35 * glow)}px ${c}`, `0 0 ${Math.round(size * 0.9 * glow)}px ${c}`);
    if (shadow) shadows.push(`0 2px ${Math.round(size * 0.5)}px rgba(0,0,0,0.85)`, `0 0 ${Math.round(size * 0.2)}px rgba(0,0,0,0.7)`);
    if (rgbSplit > 0) shadows.push(`${rgbSplit}px 0 rgba(255,40,80,0.8)`, `${-rgbSplit}px 0 rgba(40,220,255,0.8)`);

    return (
      <span
        key={g.idx}
        style={{
          display: 'inline-block',
          whiteSpace: 'pre',
          opacity: clamp(op * opacity),
          color: c,
          fontWeight: g.em && accentWeight ? accentWeight : weight,
          transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)}) skewX(${skew.toFixed(1)}deg)`,
          filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
          textShadow: shadows.length ? shadows.join(',') : undefined,
          willChange: 'transform',
        }}
      >
        {g.ch}
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'center' ? x - maxWidth / 2 : align === 'left' ? x : x - maxWidth,
        top: y,
        width: maxWidth,
        transform: 'translateY(-50%)',
        textAlign: align,
        fontFamily: FONT[font],
        fontSize: size,
        fontStyle: italic ? 'italic' : 'normal',
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        fontKerning: 'normal',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {byLine.map((ln, i) => (
        <div key={i} style={{ whiteSpace: 'normal' }}>
          {runsOf(ln).map((run, j) => (
            <span key={j} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
              {run.map(renderGlyph)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export interface TrackItem extends Partial<CaptionProps> {
  text: string;
  /** start frame */
  at: number;
  dur: number;
}

/** Convenience: a list of captions sharing default props. */
export const CaptionTrack: React.FC<{ items: TrackItem[]; defaults?: Partial<CaptionProps> }> = ({ items, defaults }) => (
  <>
    {items.map((it, i) => (
      <Caption key={i} {...defaults} {...it} from={it.at} dur={it.dur} />
    ))}
  </>
);
