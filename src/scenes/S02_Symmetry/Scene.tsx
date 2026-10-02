// S02 对称 / Symmetry — 522 frames (17.4 s). "A forensic blueprint lab where the viewer is the judge."
//
// Beat sheet (scene-local frames; see constants.ts `T` for the exact clock):
//   0      IN  black + the warm-white dot of S01's 「？」 at Q_DOT.
//   2-46   the dot turns law-cyan and pings: the ping wavefront reveals the blueprint grid; panels A/B draw on.
//   10-38  cell division 1 -> 2 (one daughter rises into A, one sinks into B) -> 4 (two balls per panel).
//   24-114 C1 「哪一段，是倒放？」 condenses as the panels draw (倒放 glitches in short bursts — time tampered with);
//          it stays up through the 3·2 ticks and leaves before "1".
//   36-128 the 2-ball elastic collision, stroboscopic exposure + vectors. A = forward, B = the same recording
//          backward. Both panels touch at f82. It is a BLIND test: both clocks read "?  t = ??.?? s" until f392.
//          72/93/114 countdown 3·2·1.
//   134    "?" stamps on both panels; C3 「分不出来。」 (cyan) 130-180 (crisp ~142-164). The "?" retreats into corner
//          badges (144-154) and leaves as B's substitution begins (164-174).
//   150-262 the law: m d²x/dt² = F(x) writes on in both panels while C3 is still up (the picture leads, the text
//          confirms); in B t -> (−t) (f166), the square gives birth to a twin minus (f174), the two minus signs
//          annihilate (f188) and B's law is A's law again (collapse 192-202, glint 204-220). The gutter plate
//          「t → −t：不变 ✓」 completes f204-212 and is held fully opaque to f252.
//          C4 「运动定律，/ 不分正放倒放。」 176-268 with 正放 | 倒放 mirrored about the 放|倒 seam (the dashed mirror
//          axis shows only during the flip, 186-222).
//   260-314 N = 10: a 9-ball diamond rack broken by a cue ball (A, f278); B re-racks itself (f305) -> 「!」 (f306).
//   314-390 N = 400: a dense, amorphous hot drop spreads (A) — slowly enough to evolve through the whole window; in
//          B the spread gas gathers into the drop (f390) -> 「!!」. A density-glow layer makes the drop a luminous
//          blob that blooms out in A and gathers and brightens in B; B pushes in 1.00 -> 1.06 (f366-390), released
//          by the !! shake. S-gauges: A rising, B falling red (from f323).
//   392    THE ANSWER on one frame: clocks ▶ +02.33 s / ◀◀ 00.00 s (B's with the film-wide ◀◀ RGB split), stamps
//          ▶ 正放 / ◀◀ 倒放, B's frame turns red. The gutter clears (N plate + 能分辨吗？ 396-404, !! 404-412) and the
//          clocks step back to 60 %, so the eye goes t = 0 ghost -> gold arrow -> 方向→.
//   390-450 C6 「方向，出现了。」 (crisp ~412-436; 方向 900, the rest 600) with a gold arrow out of 方向; in panel A the
//          gold ghost of the t = 0 drop and a gold arrow from it into the spread gas (398-418).
//   422-436 B's tape is pulled out of its panel to the right in torn slices; the panels retract (426-444); A's 400
//          balls launch 426-433 and fly (20 f, bows biased downward) into the word 很多 (complete ~f453) inside
//          C7 「时间之箭，/ 藏在“很多”之中。」 (from f442, after the swarm has crossed line 1; line 1 gold, tracking
//          0.08 -> 0.5 em; line 2 parts from 442 / 446). The full sentence holds ~464-498.
//   496-516 "many" evaporates with the sentence (diffuses 498-512); four balls survive and glide to P4 (496-512);
//          the S03 box closes symmetrically out of the top/bottom centre (500-514), divider (506-516); grid -> 20 %.
//   516-521 OUT hold: BOX + divider + 4 cyan dots at P4 on #03070C with a faint grid.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONT } from '../../lib/fonts';
import { useFontsWindowed } from './fonts';
import { SGauge } from '../../lib/hud';
import { clamp, ease, mixHex, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { C, LANE_Y, PA, PANEL_H, PB, T } from './constants';
import { C7, card7Layout } from './finale';
import { gasRun } from './sims';
import { k400, RUN400_LEN } from './stages';
import { SoftCanvas } from './SoftCanvas';
import { Voice, VGlyph } from './Voice';
import { drawFrame } from './world';

// ------------------------------------------------------------------ camera shake (impacts only, zero at the OUT)
const IMPACTS: Array<[number, number]> = [
  [T.collide2, 1.5],
  [T.qStamp, 4],
  [T.annihilate, 3],
  [T.run10 + 10, 5],
  [T.run10End - 10, 2.5],
  [T.run400, 4],
  [T.verdict2, 7],
];
function shake(f: number): [number, number] {
  let x = 0;
  let y = 0;
  for (const [fi, amp] of IMPACTS) {
    if (f < fi || f > fi + 14) continue;
    const k = amp * Math.exp(-(f - fi) / 3.5);
    x += (hash01(f * 3 + fi, 11) - 0.5) * 2 * k;
    y += (hash01(f * 5 + fi, 12) - 0.5) * 2 * k;
  }
  // whole pixels only: sub-pixel offsets would resample the 1 px blueprint grid and make it flicker
  return [Math.round(x), Math.round(y)];
}

// ------------------------------------------------------------------ S gauge mapping (real coarse-grained entropy)
/** 0.1 = the t = 0 drop, 0.9 = the maximum possible coarse-grained entropy (gas uniform over all cells): a fixed
 * physical scale, so A's needle keeps climbing after f390 (S = 0.97 by its last recorded frame) */
const gaugeOf = (S: number) => {
  const lo = gasRun(0).S[0];
  return 0.1 + 0.8 * clamp((S - lo) / (1 - lo));
};
const sAt = (k: number) => gasRun(k).S[Math.round(k)];

// ------------------------------------------------------------------ captions
/** advance of one 56 px glyph with 0.08 em tracking */
const MIRROR_W = 56 * 1.08;
/** Card 4 line 2 「不分正放倒放。」 is centred normally; the 放|倒 seam (the mirror axis) then sits half a glyph right of
 * the frame centre: 3.5 advances left of the seam, 3 advances + the 。's ink right of it. */
const AXIS_X = 540 + MIRROR_W / 2;
/** Card 4: 正放 slides out of the axis to the left, 倒放 slides out to the right flipping from its mirror image. */
const mirrorFx = (g: VGlyph, local: number) => {
  if (g.idx < 7 || g.idx > 10) return undefined;
  const e = ease.inOutCubic(seg(local, 14, 34));
  const d = (g.idx === 7 || g.idx === 10 ? 1.5 : 0.5) * MIRROR_W;
  const side = g.idx <= 8 ? 1 : -1; // left glyphs start displaced to the right (at the axis)
  return {
    replaceEnter: true,
    dx: side * d * (1 - e),
    op: ease.outQuad(seg(local, 14, 22)),
    sx: g.idx >= 9 ? -1 + 2 * e : 1,
    blur: (1 - e) * 6,
  };
};

/** 方向，出现了。 — 13.0-15.0 s: the last glyph has condensed by ~f412 and the line is fully crisp until f436 (0.8 s
 * static hold), then it diffuses (14 f) while card 7 condenses — a cross-fade, never two crisp narration lines.
 * Narration grammar: 600 / 60 px; only 方向 is 900 (the assertion) */
const C6 = { from: 390, dur: 60, exitLen: 14, enterLen: 12, stagger: 1.5, size: 60 };
/** card 7: the whole sentence holds until T.c7Exit, then diffuses over C7_EXIT frames (gone before the box closes) */
const C7_EXIT = 14;
/** card 4 「运动定律，/ 不分正放倒放。」 — 5.9-8.9 s, decoupled from the equation clock: it condenses as C3 diffuses
 * (C3 130-180) and leaves as the N = 10 stage wipes in */
const C4_FROM = 176;
const C4_DUR = 92;
const C7_END = T.c7Exit + C7_EXIT;
/** the → after 方向: short, and pulled in by −0.25 em so the comma tucks under its head (no 「方向——→，」 gap) */
const ArrowAfter: React.FC<{ local: number }> = ({ local }) => {
  const k = ease.inOutCubic(seg(local, 8, 20));
  const W = 84;
  // leaves with the caption's diffusion: drifts on along its own direction, blurs and fades
  const out = ease.inQuad(seg(local, C6.dur - C6.exitLen, C6.dur - 2));
  const op = seg(local, 6, 10) * (1 - out);
  return (
    <span style={{ display: 'inline-block', width: W, height: '0.9em', marginRight: '-0.25em', verticalAlign: '-0.05em', position: 'relative', opacity: op, transform: `translateX(${(out * 60).toFixed(1)}px)`, filter: out > 0.02 ? `blur(${(out * 10).toFixed(1)}px)` : undefined }}>
      <svg width={W} height={60} viewBox={`0 0 ${W} 60`} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', overflow: 'visible', filter: `drop-shadow(0 0 10px ${C.gold})` }}>
        <line x1={8} y1={30} x2={8 + (W - 26) * k} y2={30} stroke={C.gold} strokeWidth={6} strokeLinecap="round" />
        {k > 0.02 ? <path d={`M ${8 + (W - 26) * k - 4} 15 L ${8 + (W - 26) * k + 16} 30 L ${8 + (W - 26) * k - 4} 45 Z`} fill={C.gold} /> : null}
      </svg>
    </span>
  );
};

/** The mirror of card 4: a dashed hairline confined to line 2's glyph height, with a small ◁ ▷ pair under it, shown
 * only while 正放 | 倒放 unfold out of it (caption-local 10-36), then gone — never a caret parked in the text. */
const MirrorAxis: React.FC<{ f: number }> = ({ f }) => {
  const local = f - C4_FROM;
  const a = Math.min(seg(local, 10, 16), 1 - seg(local, 34, 46));
  if (a <= 0) return null;
  const h = 72 * ease.outCubic(seg(local, 10, 20));
  const yc = LANE_Y + 6 + 49;
  const tk = ease.outCubic(seg(local, 14, 26));
  return (
    <>
      <div style={{ position: 'absolute', left: AXIS_X - 0.75, top: yc - h / 2, width: 1.5, height: h, opacity: a * 0.9, background: `repeating-linear-gradient(to bottom, ${C.cyan} 0px, ${C.cyan} 6px, rgba(57,225,255,0) 6px, rgba(57,225,255,0) 10px)`, boxShadow: `0 0 6px rgba(57,225,255,0.6)` }} />
      <svg width={40} height={12} viewBox="0 0 40 12" style={{ position: 'absolute', left: AXIS_X - 20, top: yc + 40, opacity: a * 0.85, overflow: 'visible' }}>
        <path d={`M ${17 - 6 * tk} 6 L ${17 - 6 * tk + 8} 1.5 L ${17 - 6 * tk + 8} 10.5 Z`} fill="none" stroke={C.cyan} strokeWidth={1.2} />
        <path d={`M ${23 + 6 * tk} 6 L ${23 + 6 * tk - 8} 1.5 L ${23 + 6 * tk - 8} 10.5 Z`} fill="none" stroke={C.cyan} strokeWidth={1.2} />
      </svg>
    </>
  );
};

export const Scene: React.FC = () => {
  const f = useCurrentFrame();
  // canvas fonts, requested only for the frames that draw them (see fonts.ts)
  const specs: Array<[string, string]> = [];
  if (f >= 30 && f < 446) {
    specs.push([`400 21px ${FONT.mono}`, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789=+-.·:/▶◀?Δ%NΣ| ']);
    specs.push([`700 32px ${FONT.mono}`, 'AB0123456789▶◀t=. ']);
  }
  if (f >= 30 && f < 430) {
    specs.push([`italic 600 84px ${FONT.latin}`, 'mdxtFvpE']);
    specs.push([`600 84px ${FONT.latin}`, '=()−2?!12→Σ']);
  }
  // 「：不变」 lands at T.invariant (f204), 能分辨吗？ at f272
  if (f >= T.subst - 8 && f < 430) specs.push([`400 28px ${FONT.sans}`, '能分辨吗？：不变']);
  if (f >= 385 && f < 446) specs.push([`700 44px ${FONT.sans}`, '正放倒放']);
  if (f >= 400) {
    specs.push([`900 ${C7.big}px ${FONT.serif}`, '很多']);
    specs.push([`600 ${C7.size}px ${FONT.serif}`, '藏在“”之中。']);
  }
  const ready = useFontsWindowed(specs);
  const [sx, sy] = shake(f);
  const gA = Math.min(seg(f, T.run400 - 6, T.run400 + 4), 1 - seg(f, T.panelsOut - 4, T.panelsOut + 8));
  const L = ready && f >= 400 ? card7Layout() : null;

  return (
    // the page behind the (shaken) canvas matches its background, so impact frames show no black strip at the edge
    <AbsoluteFill style={{ backgroundColor: mixHex('#000000', C.bg, ease.inOutQuad(seg(f, 3, 30))) }}>
      <AbsoluteFill style={sx || sy ? { transform: `translate(${sx}px, ${sy}px)` } : undefined}>
        <SoftCanvas draw={(ctx, { frame }) => (ready ? drawFrame(ctx, frame) : undefined)} />
      </AbsoluteFill>

      {gA > 0 ? (
        <>
          <SGauge value={gaugeOf(sAt(k400('A', f)))} x={56} y0={PA.y + 12} y1={PA.y + PANEL_H - 12} color={C.cyan} opacity={gA} />
          <SGauge value={gaugeOf(sAt(k400('B', f)))} falling={k400('B', f) < RUN400_LEN} x={56} y0={PB.y + 12} y1={PB.y + PANEL_H - 12} color={C.cyan} opacity={gA} />
        </>
      ) : null}

      {/* C1 */}
      {/* stays up through the "3" and "2" ticks (the viewer is answering it) and leaves before "1" (f114) */}
      <Voice text={'哪一段，是{倒放}？'} from={24} dur={90} stagger={1} enterLen={12} exitLen={16} y={LANE_Y} accent="#FF6B85" emGlitch />
      {/* C3 */}
      <Voice text={'{分不出来。}'} from={130} dur={50} stagger={1} enterLen={10} exitLen={16} y={LANE_Y} accent={C.cyan} glow={0.35} />
      {/* C4 */}
      <MirrorAxis f={f} />
      <Voice text={'运动定律，\n不分{正放倒放}。'} from={C4_FROM} dur={C4_DUR} stagger={1.5} enterLen={16} exitLen={22} y={LANE_Y + 6} accent={C.cyan} glyphFx={mirrorFx} />
      {/* C6 */}
      {/* the full-width comma's empty right half is taken back (−0.3 em after it), so 「→，出现了」 closes up */}
      <Voice text={'{方向}，出现了。'} from={C6.from} dur={C6.dur} enterLen={C6.enterLen} exitLen={C6.exitLen} stagger={C6.stagger} y={LANE_Y} size={C6.size} weight={600} emWeight={900} accent={C.gold} glyphTracking={(g) => (g.idx === 2 ? -0.3 : undefined)} after={{ 1: (local) => <ArrowAfter local={local} /> }} />
      {/* C7 (centre statement; 很多 is drawn by the 400 balls in the canvas) */}
      {/* 时间之箭 is wide-tracked (0.08 -> 0.5 em) but the comma is not: it stays 0.08 em after 箭; the line is shifted
          0.3 em right so the ink (not the comma's empty em box) is centred */}
      <Voice
        text={'[时间之箭]，'}
        from={T.c7Line1}
        dur={C7_END - T.c7Line1}
        exitLen={C7_EXIT}
        exitUp
        stagger={1.5}
        enterLen={14}
        y={C7.line1Y}
        size={66}
        accent2={C.gold}
        lineTracking={(_, local) => 0.08 + 0.42 * ease.outCubic(seg(local, 4, 36))}
        glyphTracking={(g) => (g.idx >= 3 ? 0.08 : undefined)}
        lineShift={() => 66 * 0.3}
        glow={0.15}
        shadow
      />
      {L ? (
        <>
          <Voice text={'藏在“'} from={T.c7Line1} dur={C7_END - T.c7Line1} enterLen={14} exitLen={C7_EXIT} stagger={1} x={L.leftRight} y={C7.line2Y} size={C7.size} align="right" maxWidth={400} />
          <Voice text={'”之中。'} from={T.c7Line1 + 4} dur={C7_END - T.c7Line1 - 4} enterLen={14} exitLen={C7_EXIT} stagger={1} x={L.rightLeft} y={C7.line2Y} size={C7.size} align="left" maxWidth={400} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
