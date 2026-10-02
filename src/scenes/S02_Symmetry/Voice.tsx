// Local copy of the film's narration voice (lib/Caption.tsx: condense in / diffuse out), extended with the
// special text effects S02 needs: a continuous RGB-split/scan-slice glitch on 倒放, per-glyph custom motion
// (the mirrored 正放 | 倒放), per-line animated tracking (时间之箭 wide-tracked) and inline graphics (the → after 方向).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT } from '../../lib/fonts';
import { useFontsWindowed } from './fonts';
import { hash01, seedOf } from '../../lib/random';
import { clamp, ease, seg } from '../../lib/math';

export interface VGlyph {
  ch: string;
  /** 0 = normal, 1 = {accent}, 2 = [accent2] */
  em: 0 | 1 | 2;
  line: number;
  idx: number;
}
export interface GlyphFx {
  dx?: number;
  dy?: number;
  sx?: number;
  sy?: number;
  op?: number;
  blur?: number;
  rot?: number;
  /** skip the built-in enter animation for this glyph (the fx provides its own) */
  replaceEnter?: boolean;
}

export interface VoiceProps {
  text: string;
  from: number;
  dur: number;
  x?: number;
  y?: number;
  size?: number;
  font?: keyof typeof FONT;
  weight?: number;
  emWeight?: number;
  color?: string;
  accent?: string;
  accent2?: string;
  letterSpacing?: number;
  lineHeight?: number;
  maxWidth?: number;
  align?: 'center' | 'left' | 'right';
  enter?: 'condense' | 'type' | 'fade' | 'none';
  exit?: 'diffuse' | 'fade' | 'none';
  enterLen?: number;
  exitLen?: number;
  /** diffuse upward only (glyphs drift into the upper half-plane) */
  exitUp?: boolean;
  stagger?: number;
  seed?: number;
  glow?: number;
  shadow?: boolean;
  /** continuous glitch on accent glyphs (RGB split + horizontal scan slices) */
  emGlitch?: boolean;
  /** per-line letter-spacing (em) as a function of the caption-local frame */
  lineTracking?: (line: number, local: number) => number | undefined;
  /** per-line horizontal shift in px */
  lineShift?: (line: number) => number;
  /** per-glyph letter-spacing override (em): the space *after* that glyph (e.g. keep a comma out of a tracked run) */
  glyphTracking?: (g: VGlyph, local: number) => number | undefined;
  /** extra per-glyph transform, evaluated every frame */
  glyphFx?: (g: VGlyph, local: number) => GlyphFx | undefined;
  /** inline node rendered right after glyph idx */
  after?: Record<number, (local: number) => React.ReactNode>;
}

function parse(raw: string): { glyphs: VGlyph[]; lines: number } {
  const text = raw.replace(/\\n/g, '\n');
  const glyphs: VGlyph[] = [];
  let em: 0 | 1 | 2 = 0;
  let line = 0;
  let idx = 0;
  for (const ch of Array.from(text)) {
    if (ch === '{') {
      em = 1;
      continue;
    }
    if (ch === '[') {
      em = 2;
      continue;
    }
    if (ch === '}' || ch === ']') {
      em = 0;
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

const CJK = /[㐀-鿿豈-﫿]/;
const CLOSE = /[，。：；！？、”’）》」』…—,.:;!?)\]%]/;
const OPEN = /[“‘（《「『(\[]/;
function runsOf(line: VGlyph[]): VGlyph[][] {
  const runs: VGlyph[][] = [];
  let pendingOpen: VGlyph[] = [];
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
    const lc = last && last.length ? last[last.length - 1].ch : '';
    const lastIsLatin = !!lc && !CJK.test(lc) && lc !== ' ' && !CLOSE.test(lc);
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

export const plainOf = (text: string) => text.replace(/\\n/g, '').replace(/[{}[\]\n]/g, '');

export const Voice: React.FC<VoiceProps> = (p) => {
  const frame = useCurrentFrame();
  const {
    text,
    from,
    dur,
    x = 540,
    y = 1440,
    size = 56,
    font = 'serif',
    weight = font === 'serif' ? 600 : 400,
    emWeight,
    color = '#F3EFE6',
    accent = '#39E1FF',
    accent2 = '#FFC94A',
    letterSpacing = 0.08,
    lineHeight = 1.55,
    maxWidth = 900,
    align = 'center',
    enter = 'condense',
    exit = 'diffuse',
    enterLen = 18,
    exitLen = 26,
    exitUp = false,
    stagger = 2,
    seed = seedOf(text),
    glow = 0,
    shadow = false,
    emGlitch = false,
    lineTracking,
    lineShift,
    glyphTracking,
    glyphFx,
    after,
  } = p;

  const plain = plainOf(text);
  const specs: Array<[string, string]> = [[`${weight} ${size}px ${FONT[font]}`, plain]];
  if (emWeight) specs.push([`${emWeight} ${size}px ${FONT[font]}`, plain]);
  // request the font slices only while this caption is (about to be) on screen
  const inWindow = frame >= from - 2 && frame < from + dur;
  useFontsWindowed(inWindow ? specs : []);

  const local = frame - from;
  if (local < 0 || local >= dur) return null;

  const { glyphs, lines } = parse(text);
  const exitStart = dur - exitLen;
  const byLine: VGlyph[][] = Array.from({ length: lines }, () => []);
  for (const g of glyphs) byLine[g.line].push(g);

  const renderGlyph = (g: VGlyph) => {
    const r1 = hash01(g.idx, seed);
    const r2 = hash01(g.idx + 1000, seed);
    const r3 = hash01(g.idx + 2000, seed);
    const r4 = hash01(g.idx + 3000, seed);
    let op = 1;
    let dx = 0;
    let dy = 0;
    let blur = 0;
    let sc = 1;
    let sx = 1;
    let sy = 1;
    let rot = 0;

    const fx = glyphFx?.(g, local);
    const t0 = g.idx * stagger + r1 * stagger * 0.6;
    const pe = seg(local, t0, t0 + enterLen);
    if (fx?.replaceEnter) {
      // custom entrance supplied by glyphFx
    } else if (enter === 'condense') {
      const e = ease.outCubic(pe);
      const a = r2 * Math.PI * 2;
      const R = 26 + r3 * 34;
      dx += Math.cos(a) * R * (1 - e);
      dy += Math.sin(a) * R * (1 - e);
      blur += (1 - e) * 14;
      sc *= 1 + (1 - e) * 0.35;
      op *= ease.outQuad(pe);
    } else if (enter === 'type') {
      op *= local >= t0 ? 1 : 0;
      if (local >= t0 && local < t0 + 3) sc *= 1.12;
    } else if (enter === 'fade') {
      op *= ease.inOutQuad(seg(local, 0, enterLen));
    }

    if (local >= exitStart && exit !== 'none') {
      if (exit === 'diffuse') {
        const d0 = exitStart + r4 * exitLen * 0.45;
        const q = seg(local, d0, d0 + exitLen * 0.55);
        const e = ease.inQuad(q);
        const a = exitUp ? Math.PI * (1.1 + 0.8 * r2) : r2 * Math.PI * 2 + (r3 - 0.5) * 2;
        const R = 50 + r1 * 110;
        dx += Math.cos(a) * R * e + Math.sin(local * 0.6 + r1 * 20) * 6 * e;
        dy += Math.sin(a) * R * e + Math.cos(local * 0.5 + r2 * 20) * 6 * e - 20 * e;
        blur += e * 16;
        rot += (r3 - 0.5) * 70 * e;
        sc *= 1 + e * 0.25;
        op *= 1 - ease.inCubic(q);
      } else if (exit === 'fade') {
        op *= 1 - ease.inOutQuad(seg(local, exitStart, dur));
      }
    }

    if (fx) {
      dx += fx.dx ?? 0;
      dy += fx.dy ?? 0;
      sx *= fx.sx ?? 1;
      sy *= fx.sy ?? 1;
      op *= fx.op ?? 1;
      blur += fx.blur ?? 0;
      rot += fx.rot ?? 0;
    }

    const c = g.em === 1 ? accent : g.em === 2 ? accent2 : color;
    const shadows: string[] = [];
    if (glow > 0) shadows.push(`0 0 ${Math.round(size * 0.35 * glow)}px ${c}`, `0 0 ${Math.round(size * 0.9 * glow)}px ${c}`);
    if (shadow) shadows.push(`0 2px ${Math.round(size * 0.5)}px rgba(0,0,0,0.85)`, `0 0 ${Math.round(size * 0.2)}px rgba(0,0,0,0.7)`);

    // continuous glitch for the accent word (time is being tampered with). Kept legible: ~70 % of frames show a
    // clean word with a hairline 1.5 px split; bursts (3-frame blocks, p = 0.3) use the film-wide Timecode split
    // (2 + 2·hash px, see lib/hud.tsx) plus one scan slice per glyph, offset ≤ ±10 px.
    let slices: React.ReactNode = null;
    if (emGlitch && g.em === 1 && op > 0.02) {
      const fr = Math.floor(local);
      const burst = hash01(Math.floor(local / 3), seed + 17) < 0.3;
      const sp = burst ? 2 + 2 * hash01(fr * 7 + g.idx, seed + 3) : 1.5;
      shadows.push(`${sp.toFixed(1)}px 0 rgba(255,59,92,0.9)`, `${(-sp).toFixed(1)}px 0 rgba(57,225,255,0.9)`);
      if (burst) {
        dx += (hash01(fr * 13 + g.idx, seed + 5) - 0.5) * 4;
        const bands: React.ReactNode[] = [];
        for (let b = 0; b < 1; b++) {
          const top = Math.floor(hash01(fr * 31 + b * 7 + g.idx, seed + 11) * 80);
          const h = 6 + Math.floor(hash01(fr * 17 + b * 3 + g.idx, seed + 13) * 18);
          const off = (hash01(fr * 19 + b * 5 + g.idx, seed + 19) - 0.5) * 20;
          bands.push(
            <span
              key={b}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                color: b === 0 ? '#FF3B5C' : '#E6FCFF',
                clipPath: `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`,
                transform: `translateX(${off.toFixed(1)}px)`,
                opacity: 0.9,
              }}
            >
              {g.ch}
            </span>,
          );
        }
        slices = bands;
      }
    }

    const gls = glyphTracking?.(g, local);
    return (
      <span
        key={g.idx}
        style={{
          display: 'inline-block',
          position: 'relative',
          whiteSpace: 'pre',
          letterSpacing: gls !== undefined ? `${gls}em` : undefined,
          opacity: clamp(op),
          color: c,
          fontWeight: g.em && emWeight ? emWeight : weight,
          transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${(sc * sx).toFixed(3)}, ${(sc * sy).toFixed(3)})`,
          filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
          textShadow: shadows.length ? shadows.join(',') : undefined,
        }}
      >
        {g.ch}
        {slices}
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
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        pointerEvents: 'none',
      }}
    >
      {byLine.map((ln, i) => {
        const ls = lineTracking?.(i, local);
        const sh = lineShift?.(i) ?? 0;
        // trailing tracking after the last glyph would push centred text left: compensate with its own spacing
        const lastG = ln[ln.length - 1];
        const lastLs = (lastG && glyphTracking?.(lastG, local)) ?? ls ?? letterSpacing;
        return (
          <div
            key={i}
            style={{
              whiteSpace: 'nowrap',
              letterSpacing: ls !== undefined ? `${ls}em` : undefined,
              transform: sh ? `translateX(${sh}px)` : undefined,
              marginRight: `${-lastLs}em`,
            }}
          >
            {runsOf(ln).map((run, j) => (
              <span key={j} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                {run.map((g) => (
                  <React.Fragment key={g.idx}>
                    {renderGlyph(g)}
                    {after?.[g.idx]?.(local)}
                  </React.Fragment>
                ))}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};
