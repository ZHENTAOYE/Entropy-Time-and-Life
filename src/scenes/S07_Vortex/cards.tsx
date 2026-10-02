// Special narration cards of S07 (book-title card, thermal-gradient card, 对抗→借着 morph, 过程 flow word).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { clamp, ease, seg } from '../../lib/math';
import { seedOf } from '../../lib/random';
import { Glyph, glyphXform, GlyphXform, layoutLine } from './glyphs';
import { hash01 } from '../../lib/random';
import { memo } from '../../lib/math';

const VOICE = '#F3EFE6';
const GOLD = '#FFC94A';

const serif = (w: number, s: number) => `${w} ${s}px ${FONT.serif}`;

// ------------------------------------------------------------------ C1: 「1944年，薛定谔问：/ 生命是什么？」
// The question is typeset like the cover of Schrödinger's 1944 book: hairline rules, wide tracking, imprint.
export const BookTitle: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  const frame = useCurrentFrame();
  const L1 = '1944年，薛定谔问：';
  const L2 = '生命是什么？';
  const s1 = 50;
  const s2 = 94;
  const ready = useFontsReady([
    [serif(600, s1), L1],
    [serif(900, s2), L2],
    [`italic 600 34px ${FONT.latin}`, 'WHAT IS LIFE?'],
    [`400 18px ${FONT.mono}`, 'E. SCHRÖDINGER · CAMBRIDGE · 1944'],
  ]);
  const local = frame - from;
  if (!ready || local < 0 || local >= dur) return null;
  const y1 = 1368;
  const y2 = 1484;
  const exitStart = dur - 16;
  const a = layoutLine(L1, serif(600, s1), s1, 0.08, 540);
  const b = layoutLine(L2, serif(900, s2), s2, 0.2, 540);
  const seed = seedOf(L1 + L2);
  const rules = ease.inOutCubic(seg(local, 16, 38));
  const out = 1 - ease.inCubic(seg(local, exitStart, dur - 2));
  const ruleW = 640 * rules;
  const imprint = seg(local, 28, 46);
  const sub = 'WHAT IS LIFE?';
  const imp = 'E. SCHRÖDINGER · CAMBRIDGE · 1944';
  const nType = Math.floor(imprint * imp.length);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {a.map((g, i) => (
        <Glyph key={'a' + i} ch={g.ch} x={g.x} y={y1} size={s1} weight={600} color={VOICE}
          xf={glyphXform({ local, t0: i * 1.0, exitStart, exitLen: 16, seed, idx: i })} />
      ))}
      {b.map((g, i) => (
        <Glyph key={'b' + i} ch={g.ch} x={g.x} y={y2} size={s2} weight={900} color="#FBF3E2" glow={0.18}
          xf={glyphXform({ local, t0: 8 + i * 2, enterLen: 16, exitStart, exitLen: 16, seed, idx: 40 + i })} />
      ))}
      {/* cover rules */}
      {[y2 - 78, y2 + 70].map((yy, i) => (
        <div key={'r' + i} style={{ position: 'absolute', left: 540 - ruleW / 2, top: yy, width: ruleW, height: i === 0 ? 1.5 : 1, background: GOLD, opacity: 0.75 * out, boxShadow: `0 0 8px ${GOLD}` }} />
      ))}
      {[y2 - 72].map((yy, i) => (
        <div key={'r2' + i} style={{ position: 'absolute', left: 540 - ruleW * 0.42, top: yy, width: ruleW * 0.84, height: 1, background: GOLD, opacity: 0.35 * out }} />
      ))}
      <div style={{ position: 'absolute', left: 0, width: 1080, top: y2 + 82, textAlign: 'center', fontFamily: FONT.latin, fontStyle: 'italic', fontWeight: 600, fontSize: 34, letterSpacing: '0.12em', color: GOLD, opacity: 0.85 * imprint * out, filter: `blur(${((1 - imprint) * 6).toFixed(1)}px)` }}>
        {sub}
      </div>
      <div style={{ position: 'absolute', left: 0, width: 1080, top: y2 + 126, textAlign: 'center', fontFamily: FONT.mono, fontSize: 18, letterSpacing: '0.28em', color: VOICE, opacity: 0.55 * out, whiteSpace: 'pre' }}>
        {imp.slice(0, nType)}
        <span style={{ opacity: imprint > 0 && nType < imp.length && Math.floor(local / 4) % 2 === 0 ? 1 : 0 }}>▍</span>
      </div>
    </div>
  );
};


// ------------------------------------------------------------------ C7: 「此刻，你像一只100瓦的灯泡，/ 向宇宙散热。」
// 100瓦 is painted with the thermal (inferno) ramp itself.
const INFERNO_TEXT: React.CSSProperties = {
  backgroundImage: 'linear-gradient(to top, #CF4446 0%, #ED6925 28%, #FB9B06 52%, #F7D13D 74%, #FCFFA4 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

export const BulbCard: React.FC<{ from: number; dur: number; y?: number }> = ({ from, dur, y = 1488 }) => {
  const frame = useCurrentFrame();
  const L1 = '此刻，你像一只100瓦的灯泡，';
  const L2 = '向宇宙散热。';
  const size = 56;
  const ready = useFontsReady([[serif(600, size), L1 + L2]]);
  const local = frame - from;
  if (!ready || local < 0 || local >= dur) return null;
  const a = layoutLine(L1, serif(600, size), size, 0.08, 540);
  const b = layoutLine(L2, serif(600, size), size, 0.08, 540);
  const seed = seedOf(L1 + L2);
  const exitStart = dur - 20;
  const lh = size * 1.55;
  const hot = new Set([7, 8, 9, 10]); // 1 0 0 瓦
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {a.map((g, i) => {
        const xf = glyphXform({ local, t0: i * 1.1, exitStart, exitLen: 20, seed, idx: i });
        const isHot = hot.has(i);
        return (
          <Glyph key={'a' + i} ch={g.ch} x={g.x} y={y - lh / 2} size={size} weight={isHot ? 900 : 600} color={VOICE} xf={xf}
            style={isHot ? { ...INFERNO_TEXT, filter: `${xf.blur > 0.15 ? `blur(${xf.blur.toFixed(2)}px) ` : ''}drop-shadow(0 0 10px rgba(251,155,6,0.55))` } : undefined} />
        );
      })}
      {b.map((g, i) => (
        <Glyph key={'b' + i} ch={g.ch} x={g.x} y={y + lh / 2} size={size} weight={600} color={VOICE}
          xf={glyphXform({ local, t0: 14 + i * 1.6, exitStart, exitLen: 20, seed, idx: 40 + i })} />
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ C9: 「你不是在对抗熵增——/ 你借着它，活着。」
// 对抗 appears, then DIFFUSES; its cloud drifts down and re-condenses as 借着 (entropy is the means, not the enemy).
export const BorrowCard: React.FC<{ from: number; dur: number; y?: number }> = ({ from, dur, y = 1488 }) => {
  const frame = useCurrentFrame();
  const LA = '你不是在对抗熵增——';
  const LB = '你借着它，活着。';
  const size = 56;
  const ready = useFontsReady([[serif(600, size), LA + LB], [serif(900, size), '对抗借着']]);
  const local = frame - from;
  if (!ready || local < 0 || local >= dur) return null;
  const A = layoutLine(LA, serif(600, size), size, 0.08, 540);
  const B = layoutLine(LB, serif(600, size), size, 0.08, 540);
  const seed = seedOf(LA + LB);
  const lh = size * 1.55;
  const yA = y - lh / 2;
  const yB = y + lh / 2;
  const exitStart = dur - 18;
  const EX = 18;
  // line 1 fully formed at ~25; 对抗 is read for ~0.5 s, then diffuses (36–55) and its cloud re-condenses as 借着
  const D0 = 36; // 对抗 starts to dissolve
  const D1 = 52;
  const R0 = 44; // 借着 condenses from the cloud
  const R1 = 60;
  const els: React.ReactNode[] = [];
  A.forEach((g, i) => {
    const fight = i === 4 || i === 5;
    let xf: GlyphXform = glyphXform({ local, t0: i * 1.0, enterLen: 16, exitStart: fight ? 1e9 : exitStart, exitLen: EX, seed, idx: i });
    if (fight) {
      const q = seg(local, D0 + (i - 4) * 3, D1 + (i - 4) * 3);
      const e = ease.inOutCubic(q);
      const tgt = B[i - 3];
      xf = {
        ...xf,
        dx: xf.dx + (tgt.x - g.x) * e * 0.9 + Math.sin(local * 0.7 + i) * 8 * Math.sin(q * Math.PI),
        dy: xf.dy + (yB - yA) * e * 0.9 + Math.sin(q * Math.PI) * 26,
        blur: xf.blur + 16 * Math.sin(Math.min(1, q * 1.4) * Math.PI * 0.5),
        sc: xf.sc * (1 + 0.5 * Math.sin(q * Math.PI)),
        rot: xf.rot + (i === 4 ? -40 : 35) * e,
        op: xf.op * (1 - ease.inQuad(q)),
      };
    }
    els.push(<Glyph key={'A' + i} ch={g.ch} x={g.x} y={yA} size={size} weight={fight ? 900 : 600} color={fight ? '#FF6A4D' : VOICE} xf={xf} />);
  });
  B.forEach((g, i) => {
    const borrow = i === 1 || i === 2;
    let xf: GlyphXform;
    if (borrow) {
      const src = A[i + 3];
      const t0 = R0 + (i - 1) * 3;
      const q = seg(local, t0, R1 + (i - 1) * 3);
      const e = ease.outCubic(q);
      const base = glyphXform({ local, t0: 0, enterLen: 1, exitStart, exitLen: EX, seed, idx: 60 + i });
      xf = {
        ...base,
        dx: base.dx + (src.x - g.x) * 0.12 * (1 - e),
        dy: base.dy + (yA - yB) * 0.12 * (1 - e),
        blur: base.blur + 16 * (1 - e),
        sc: base.sc * (1 + 0.45 * (1 - e)),
        op: base.op * ease.outQuad(q),
      };
    } else xf = glyphXform({ local, t0: R0 - 4 + i * 0.8, enterLen: 16, exitStart, exitLen: EX, seed, idx: 60 + i });
    els.push(<Glyph key={'B' + i} ch={g.ch} x={g.x} y={yB} size={size} weight={borrow ? 900 : 600} color={borrow ? GOLD : VOICE} glow={borrow ? 0.35 : 0} xf={xf} />);
  });
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{els}</div>;
};

// ------------------------------------------------------------------ C11: 「你是一个过程。」
// 过程 is a STEADY FLOW: gold particles stream left → right through the glyph block and slow down inside the
// strokes (v = v0·(1 − 0.9·mask)), so by continuity their density draws the glyphs — the shape persists while every
// particle keeps passing through (the vortex again, in typography).
const PSIZE = 84;
const PROW = 1.5; // px between flow rows
const V0 = 10; // px/frame outside the strokes
const EMIT = 1.7; // frames between particles in a row

interface FlowGlyph {
  w: number;
  h: number;
  x0: number; // canvas left in frame px
  y0: number;
  rows: Array<{ y: number; xs: Float32Array; inside: Uint8Array }>; // x(τ) per integer frame τ
}

function flowGlyph(x0: number, x1: number, yC: number): FlowGlyph {
  return memo(`s07:flowglyph:${x0}:${x1}:${yC}`, () => {
    const pad = 70;
    const w = Math.ceil(x1 - x0 + pad * 2);
    const h = Math.ceil(PSIZE * 1.5);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.font = serif(900, PSIZE);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    const L = layoutLine('你是一个过程。', serif(600, PSIZE), PSIZE, 0.1, 540);
    for (const k of [4, 5]) ctx.fillText(L[k].ch, L[k].x - (x0 - pad), h / 2 + PSIZE * 0.04);
    const data = ctx.getImageData(0, 0, w, h).data;
    const rows: FlowGlyph['rows'] = [];
    for (let yy = 1; yy < h - 1; yy += PROW) {
      const iy = Math.round(yy);
      // time to traverse each pixel
      const xs: number[] = [0];
      const ins: number[] = [0];
      let x = 0;
      let tAcc = 0;
      let nextT = 1;
      while (x < w) {
        const m = data[(iy * w + Math.min(w - 1, Math.floor(x))) * 4 + 3] / 255;
        const v = V0 * (1 - 0.92 * m);
        const dt = 1 / v; // per px
        tAcc += dt;
        x += 1;
        while (tAcc >= nextT) {
          xs.push(x);
          ins.push(m > 0.5 ? 1 : 0);
          nextT += 1;
        }
      }
      rows.push({ y: yy, xs: new Float32Array(xs), inside: new Uint8Array(ins) });
    }
    return { w, h, x0: x0 - pad, y0: yC - h / 2, rows };
  });
}

const FlowWord: React.FC<{ local: number; dur: number; x0: number; x1: number; yC: number; enterAt: number; exitAt: number }> = ({ local, dur, x0, x1, yC, enterAt, exitAt }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const FG = flowGlyph(x0, x1, yC);
  React.useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const t = local + 400; // steady state: the flow has been running long before we see it
    const inA = ease.outCubic(seg(local, enterAt, enterAt + 18));
    const outQ = seg(local, exitAt, dur);
    const outE = ease.inQuad(outQ);
    ctx.globalCompositeOperation = 'lighter';
    const inside = new Path2D();
    const outside = new Path2D();
    const hot = new Path2D();
    for (let r = 0; r < FG.rows.length; r++) {
      const row = FG.rows[r];
      const n = row.xs.length;
      const ph = hash01(r, 501) * EMIT;
      // particle j entered at time j*EMIT + ph; age τ = t − that
      const jMax = Math.floor((t - ph) / EMIT);
      const jMin = Math.ceil((t - ph - (n - 1)) / EMIT);
      for (let j = Math.max(0, jMin); j <= jMax; j++) {
        const tau = t - (j * EMIT + ph);
        const k = Math.floor(tau);
        if (k < 0 || k >= n - 1) continue;
        const u = tau - k;
        let x = row.xs[k] + (row.xs[k + 1] - row.xs[k]) * u;
        let y = row.y + Math.sin(j * 1.7 + r) * 0.5;
        const ins = row.inside[k];
        // diffuse out: particles scatter like the narration's diffuse exit
        if (outE > 0) {
          const a = hash01(j * 31 + r, 502) * Math.PI * 2;
          const R = (20 + 70 * hash01(j * 17 + r, 503)) * outE;
          x += Math.cos(a) * R;
          y += Math.sin(a) * R - 14 * outE;
        }
        if (ins) {
          if (hash01(j * 7 + r, 504) < 0.18) hot.rect(x - 1, y - 1, 2.2, 2.2);
          else inside.rect(x - 0.9, y - 0.9, 1.8, 1.8);
        } else outside.rect(x - 0.6, y - 0.6, 1.2, 1.2);
      }
    }
    const A = inA * (1 - ease.inCubic(outQ));
    ctx.fillStyle = `rgba(255,201,74,${0.16 * A})`;
    ctx.fill(outside);
    ctx.fillStyle = `rgba(255,214,120,${0.55 * A})`;
    ctx.fill(inside);
    ctx.fillStyle = `rgba(255,246,222,${0.9 * A})`;
    ctx.fill(hot);
  });
  return <canvas ref={ref} width={FG.w} height={FG.h} style={{ position: 'absolute', left: FG.x0, top: FG.y0, width: FG.w, height: FG.h, filter: 'drop-shadow(0 0 6px rgba(255,190,80,0.55))' }} />;
};

export const ProcessCard: React.FC<{ from: number; dur: number; y?: number }> = ({ from, dur, y = 1500 }) => {
  const frame = useCurrentFrame();
  const L = '你是一个过程。';
  const ready = useFontsReady([[serif(600, PSIZE), L], [serif(900, PSIZE), '过程']]);
  const local = frame - from;
  if (!ready || local < 0 || local >= dur) return null;
  const G = layoutLine(L, serif(600, PSIZE), PSIZE, 0.1, 540);
  const seed = seedOf(L);
  const exitStart = dur - 16;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {G.map((g, i) =>
        i === 4 || i === 5 ? null : (
          <Glyph key={i} ch={g.ch} x={g.x} y={y} size={PSIZE} weight={600} color={VOICE}
            xf={glyphXform({ local, t0: i < 4 ? i * 2.2 : 16, exitStart, exitLen: 16, seed, idx: i })} />
        ),
      )}
      <FlowWord local={local} dur={dur} x0={G[4].x} x1={G[5].x + G[5].w} yC={y} enterAt={6} exitAt={exitStart} />
    </div>
  );
};
