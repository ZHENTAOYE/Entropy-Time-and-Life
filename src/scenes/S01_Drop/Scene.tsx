// S01 墨滴 / The Drop — cold open (390 f). See timeline.ts for the beat sheet.
// Visual language: MACRO HIGH-SPEED PHOTOGRAPHY through the side of a backlit tank (shared lib/ink renderer):
// subtractive Beer–Lambert ink (how far it has spread is visible as colour), a tape that is first rewound VIOLENTLY
// (◀◀ ×16–24 OSD in alarm red, radial motion smear, red falling S-gauge, real scan-tears) until the ink leaps out of
// the water as a drop, then played forward in slow motion (macro still life of the hanging drop, Edgerton strobe of
// its fall, photographic crown, pull-out reveal of the vortex-ring cascade). Hard cut to black: 「为什么？」.
// The hook is carried by two assertions in one lane: A 「你永远不会 / 看到这一幕。」 (on screen from frame 0 — the
// cover) and B 「可物理定律， / 并不禁止它。」 (condenses as the drop leaps).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { InkBloom, InkCanvas, InkMotes, InkStage, InkTank, inkImpactShake, INK } from '../../lib/ink';
import { SGauge, Timecode } from '../../lib/hud';
import { COLOR } from '../../lib/handoff';
import { clamp, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { F, HEAD_Y, hudSpeed, state, vholdJump } from './timeline';
import { carriesPicture, drawDrop, drawLight, drawMacroBack, drawSmear, drawSplash, drawStrobe, drawTamper, drawVignette, rollAt, swellAt } from './fx';
import { Voice } from './Voice';
import { Headline } from './Headline';
import { TapeOSD } from './TapeOSD';
import { Question } from './Question';

function playLabel(v: number): string {
  // the HUD never lies about the tape: slow motion and fast-forward are both labelled
  const a = Math.abs(v);
  return '×' + (a < 0.995 ? a.toFixed(2) : a.toFixed(1));
}

/** dev-only switches for perf profiling (dev/perf-entry.tsx); the film mounts <Scene /> with none */
export interface DevFlags {
  noTamper?: boolean;
  noText?: boolean;
  noHud?: boolean;
  noFx?: boolean;
}

export const Scene: React.FC<{ dev?: DevFlags }> = ({ dev = {} }) => {
  const f = useCurrentFrame();
  if (f >= F.cut) {
    // HARD CUT: pure black, the question, and finally only its dot at Q_DOT
    return (
      <AbsoluteFill style={{ background: '#000' }}>
        <Question />
      </AbsoluteFill>
    );
  }
  const st = state(f);
  const cam = { zoom: st.zoom, zoomOrigin: st.origin };
  // camera shake in REAL time after contact (not in the slowed tape time)
  const [sx, sy] = inkImpactShake((f - F.impact) / 30, 5);
  const shaking = sx !== 0 || sy !== 0;
  const rewinding = st.mode === 'rewind';
  // V-hold roll at the tape-stop clunk: the whole picture slips down under a blanking bar — a CSS transform of the
  // stage, so it stays full resolution
  const roll = rollAt(f);
  // tape wobble of the picture, HUD and headline while the tape is tampered with (none on the cover frame)
  const wob = rewinding && f >= 1 ? (hash01(f, 404) - 0.5) * 6 * st.tamper : 0;
  // … and a vertical-hold jump on a few frames of the fast rewind
  const jump = rewinding ? vholdJump(f) : 0;
  const wobY = rewinding && f >= 1 ? (hash01(f, 406) - 0.5) * 5 * st.tamper + jump : 0;
  const gaugeOp = 1 - Math.min(seg(f, 64, 76), 1 - seg(f, 152, 172));
  // the stage's front canvas (above the GL ink) is one more full-frame composite: mount it only while the tape is
  // being tampered with (the tears and the motion smear must cut through the ink). Full resolution on the cover
  // frame (crisp thumbnail); half resolution while the tape races (it then carries the whole, motion-smeared picture)
  const tapeFx = st.tamper > 0 && roll === 0 && !dev.noTamper;
  const frontScale = f < 1 ? 1 : 0.5;
  // while the front canvas carries the whole picture, the GL layer under it is only read back, never seen: keep it out
  // of the compositor (one full-frame layer less)
  const glHidden = tapeFx && carriesPicture(f, st);
  // exposure swell before the cut: the paper brightens AND the ink thins optically (an overexposed negative)
  const swell = swellAt(f);
  const m = st.macro;
  const stageStyle: React.CSSProperties | undefined = shaking
    ? { transform: `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) scale(1.01)` }
    : roll > 0
      ? { transform: `translateY(${roll}px)` }
      : wob !== 0 || wobY !== 0
        ? { transform: `translate(${wob.toFixed(2)}px, ${wobY.toFixed(2)}px) scale(1.012)` }
        : undefined;

  return (
    <AbsoluteFill style={{ background: '#141210' }}>
      <InkStage front={tapeFx ? frontScale : undefined} style={stageStyle}>
        {/* air colour behind everything: the extreme push-in may look above the tank's bleed */}
        <InkCanvas
          z={-5}
          draw={(ctx) => {
            ctx.fillStyle = '#141210';
            ctx.fillRect(0, 0, 1080, 1920);
          }}
        />
        {/* the crown is this scene's own photographic one (fx drawSplash); at macro zoom the lib's bokeh, bubbles and
            hairline hand over to the screen-resolution macro layers */}
        <InkTank time={st.clock} impactAge={st.age} crown={0} air={1 - 0.6 * m} bubbles={1 - 0.9 * m} hairline={1 - 0.85 * m} {...cam} />
        {dev.noFx ? null : <InkCanvas z={1} draw={(ctx) => drawMacroBack(ctx, f, st)} />}
        {/* GL density: crisp on the cover frame, 0.33 under the motion smear, 0.4 from the crown on */}
        <InkBloom
          age={st.age}
          spread={st.spread}
          rgbSplit={st.rgbSplit}
          seed={1}
          res={f < 1 ? 0.75 : f < 44 ? 0.33 : 0.4}
          style={glHidden ? { visibility: 'hidden' } : undefined}
          opacity={st.inkGain * (1 - 0.42 * swell)}
          {...cam}
        />
        <InkCanvas z={29} draw={(ctx) => drawStrobe(ctx, f, st)} />
        <InkCanvas z={30} draw={(ctx) => drawDrop(ctx, f, st)} />
        <InkCanvas z={31} draw={(ctx) => drawSplash(ctx, f, st)} />
        {dev.noFx ? null : <InkCanvas z={35} draw={(ctx) => drawLight(ctx, f)} />}
        {/* the lens vignette lives under the GL ink: multiply commutes, so the ink is vignetted too */}
        <InkCanvas z={45} draw={(ctx) => drawVignette(ctx, 0.35)} />
        {/* radial motion smear of the violent rewind: re-composites the whole picture into the front canvas */}
        {dev.noTamper ? null : <InkCanvas z={50} front draw={(ctx) => drawSmear(ctx, f, st)} />}
        {/* out-of-focus foreground bubbles; at macro zoom they would be huge grey smudges */}
        <InkMotes time={st.clock} {...cam} opacity={Math.min(1, 1 / (st.zoom * st.zoom))} front z={tapeFx ? 60 : 40} />
        {dev.noTamper ? null : <InkCanvas z={100} front draw={(ctx) => drawTamper(ctx, f, st)} />}
      </InkStage>
      {roll > 0 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: roll, background: '#060508', borderBottom: '2px solid rgba(255,250,240,0.55)', boxSizing: 'border-box' }} />
      ) : null}

      {dev.noHud ? null : (
        <>
          {/* entropy needle: red and jittering while the tape runs backward, rising with the bloom */}
          <SGauge value={st.sVal} falling={rewinding} color={INK.text} opacity={0.85 * clamp(gaugeOp)} />
          {rewinding ? (
            <TapeOSD seconds={st.clock} speed={hudSpeed(f)} tamper={st.tamper} />
          ) : (
            <Timecode mode="play" seconds={st.clock} speed={playLabel(st.speed)} color={COLOR.voice} x={90} opacity={0.92} />
          )}
        </>
      )}

      {dev.noText ? null : (
        <>
          {/* headline A — the cover: fully on screen on frame 0, diffuses (fast) as the ink reaches the surface */}
          <Headline text={'你{永远不会}\n看到这一幕。'} from={0} dur={F.headAEnd} enterLen={0} exitLen={F.headAEnd - F.headAOut} y={HEAD_Y} jitter={wob * 0.5} />
          {/* headline B — condenses as the drop leaps out, holds through the macro still life, diffuses as it falls */}
          <Headline text={'可物理定律，\n{并不禁止}它。'} from={F.headB} dur={F.headBEnd - F.headB} enterLen={8} exitLen={12} y={HEAD_Y} jitter={wob * 0.5} />
          {/* card 4 — 散开 drifts apart while displayed */}
          <Voice
            text={'现实里，\n它只会{散开}。'}
            from={F.card4}
            dur={F.card4End - F.card4}
            lineDelay={2}
            stagger={0.9}
            enterLen={12}
            exitLen={15}
            emFx="drift"
            driftStep={14}
            color={INK.text}
            accent={INK.em}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

