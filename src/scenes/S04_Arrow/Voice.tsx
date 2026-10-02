// Local copy of the film's narration voice (lib/Caption.tsx: condense in / diffuse out) with the extras S04 needs:
//   · two emphasis classes: {…} = accent, […] = accent2 (own colour / weight / tracking) — 均匀 (200) vs 抱团 (900)
//   · per-line x offsets (the C1 equation: 熵增的方向 sits exactly above 时间的方向) and per-line enter delays
//   · per-glyph custom motion `fx` (越早 / 越低 sinking baselines, 滚落 rolling down the slope)
//   · `echo` ghost copies (之后 with a motion trail)
//   · `halo` = a custom legibility halo colour (paper-coloured on light backgrounds, dark on dark ones)
//   · faster grammar than the lib default (condense: 0.4 f/char stagger, 12 f; diffuse: 13 f) so every line is fully
//     formed for as long as possible inside the screenplay's card windows
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT } from '../../lib/fonts';
import { useLazyFonts } from './fontGate';
import { hash01, seedOf } from '../../lib/random';
import { clamp, ease, seg } from '../../lib/math';

export interface VGlyph {
  ch: string;
  /** 0 = normal, 1 = {accent}, 2 = [accent2] */
  em: 0 | 1 | 2;
  line: number;
  /** index among all visible glyphs */
  idx: number;
  /** index inside its emphasis run (0 for the first glyph of a run), -1 if not emphasised */
  runIdx: number;
}
export interface GlyphFx {
  dx?: number;
  dy?: number;
  rot?: number;
  sc?: number;
  op?: number;
  blur?: number;
  /** extra tracking after the glyph, px */
  ls?: number;
}
export interface Echo {
  n: number;
  dx: number;
  dy: number;
  alpha: number;
  blur: number;
}

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
  accentWeight?: number;
  accent2?: string;
  accent2Weight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  maxWidth?: number;
  enterLen?: number;
  exitLen?: number;
  stagger?: number;
  /** extra enter delay per line (frames) */
  lineDelay?: number[];
  /** x offset per line (px) */
  lineDx?: number[];
  seed?: number;
  glow?: number;
  /** legibility halo colour (CSS rgba) or undefined — ONE soft elliptical band behind the block (cheap; per-glyph
   *  text-shadows are very expensive in the software compositor) */
  halo?: string;
  haloSize?: number;
  fx?: (g: VGlyph, local: number) => GlyphFx | null;
  echo?: (g: VGlyph, local: number) => Echo | null;
  opacity?: number;
}

function parse(raw: string): { glyphs: VGlyph[]; lines: number } {
  const glyphs: VGlyph[] = [];
  let em: 0 | 1 | 2 = 0;
  let line = 0;
  let idx = 0;
  let run = -1;
  for (const ch of Array.from(raw)) {
    if (ch === '{' || ch === '[') {
      em = ch === '{' ? 1 : 2;
      run = 0;
      continue;
    }
    if (ch === '}' || ch === ']') {
      em = 0;
      run = -1;
      continue;
    }
    if (ch === '\n') {
      line++;
      continue;
    }
    glyphs.push({ ch, em, line, idx: idx++, runIdx: em ? run++ : -1 });
  }
  return { glyphs, lines: line + 1 };
}

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
    color = '#F3EFE6',
    accent = '#FFC94A',
    accentWeight,
    accent2 = accent,
    accent2Weight,
    letterSpacing = 0.08,
    lineHeight = 1.55,
    maxWidth = 960,
    enterLen = 12,
    exitLen = 13,
    stagger = 0.4,
    lineDelay,
    lineDx,
    seed = seedOf(text),
    glow = 0,
    halo,
    haloSize = 0.5,
    fx,
    echo,
    opacity = 1,
  } = p;
  const plain = text.replace(/[{}[\]\n]/g, '');
  const specs: Array<[string, string]> = [[`${weight} ${size}px ${FONT.serif}`, plain]];
  if (accentWeight) specs.push([`${accentWeight} ${size}px ${FONT.serif}`, plain]);
  if (accent2Weight) specs.push([`${accent2Weight} ${size}px ${FONT.serif}`, plain]);
  const local = frame - from;
  useLazyFonts(specs, local >= -20 && local < dur);

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
    let rot = 0;
    let ls = 0;
    // enter: condense out of blur
    const t0 = g.idx * stagger + r1 * stagger * 0.6 + (lineDelay?.[g.line] ?? 0);
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
    const f = fx?.(g, local);
    if (f) {
      dx += f.dx ?? 0;
      dy += f.dy ?? 0;
      rot += f.rot ?? 0;
      sc *= f.sc ?? 1;
      op *= f.op ?? 1;
      blur += f.blur ?? 0;
      ls += f.ls ?? 0;
    }
    // exit: diffuse
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
    const c = g.em === 1 ? accent : g.em === 2 ? accent2 : color;
    const w = g.em === 1 && accentWeight ? accentWeight : g.em === 2 && accent2Weight ? accent2Weight : weight;
    const shadows: string[] = [];
    if (glow > 0) shadows.push(`0 0 ${Math.round(size * 0.35 * glow)}px ${c}`, `0 0 ${Math.round(size * 0.9 * glow)}px ${c}`);
    const ech = echo?.(g, local);
    const o = clamp(op * opacity);
    return (
      <span
        key={g.idx}
        style={{
          display: 'inline-block',
          position: 'relative',
          whiteSpace: 'pre',
          marginRight: ls ? `${ls.toFixed(1)}px` : undefined,
          color: c,
          fontWeight: w,
        }}
      >
        {ech
          ? Array.from({ length: ech.n }, (_, k) => {
              const j = k + 1;
              return (
                <span
                  key={k}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    opacity: clamp(o * ech.alpha * Math.pow(0.62, k)),
                    transform: `translate(${(dx + ech.dx * j).toFixed(1)}px, ${(dy + ech.dy * j).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`,
                    filter: `blur(${(blur + ech.blur * j).toFixed(1)}px)`,
                  }}
                >
                  {g.ch}
                </span>
              );
            })
          : null}
        <span
          style={{
            display: 'inline-block',
            position: 'relative',
            opacity: o,
            transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`,
            filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
            textShadow: shadows.length ? shadows.join(',') : undefined,
          }}
        >
          {g.ch}
        </span>
      </span>
    );
  };

  const bandA = halo ? smoothstepL(0, 14, local) * (1 - smoothstepL(dur - exitLen * 0.7, dur, local)) : 0;
  const bandH = lines * size * lineHeight + size * 2.2 * haloSize;
  const longest = Math.max(...byLine.map((l) => l.length));
  const bandW = Math.min(1080, longest * size * (1 + letterSpacing) + size * 3 * haloSize);
  return (
    <>
    {bandA > 0.003 ? (
      <div
        style={{
          position: 'absolute',
          left: x - bandW / 2,
          top: y - bandH / 2,
          width: bandW,
          height: bandH,
          opacity: bandA,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${halo} 0%, ${halo} 38%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />
    ) : null}
    <div
      style={{
        position: 'absolute',
        left: x - maxWidth / 2,
        top: y,
        width: maxWidth,
        transform: 'translateY(-50%)',
        textAlign: 'center',
        fontFamily: FONT.serif,
        fontSize: size,
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        pointerEvents: 'none',
      }}
    >
      {byLine.map((ln, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap', transform: lineDx?.[i] ? `translateX(${lineDx[i]}px)` : undefined }}>
          {ln.map(renderGlyph)}
        </div>
      ))}
    </div>
    </>
  );
};
const smoothstepL = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
