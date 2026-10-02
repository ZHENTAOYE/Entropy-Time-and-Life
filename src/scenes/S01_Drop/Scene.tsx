// S01 墨滴 / The Drop — cold open (390 f). See timeline.ts for the beat sheet.
// Visual language: MACRO HIGH-SPEED PHOTOGRAPHY through the side of a backlit tank (shared lib/ink renderer):
// subtractive Beer–Lambert ink (how far it has spread is visible as colour), a tape that is first played BACKWARD
// (◀◀, red falling S-gauge, real scan-tears) and then forward in slow motion (slow-motion contact, macro still life of
// the hanging drop, Edgerton strobe of its fall, photographic crown, pull-out reveal of the vortex-ring cascade).
// Hard cut to black: 「为什么？」.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { InkBloom, InkCanvas, InkMotes, InkStage, InkTank, inkImpactShake, INK } from '../../lib/ink';
import { SGauge, Timecode } from '../../lib/hud';
import { COLOR } from '../../lib/handoff';
import { clamp, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { F, state } from './timeline';
import { drawDrop, drawLight, drawMacroBack, drawSplash, drawStrobe, drawTamper, drawVignette, rollAt, swellAt } from './fx';
import { Voice } from './Voice';
import { Question } from './Question';

function speedLabel(mode: string, v: number): string {
  const a = Math.abs(v);
  // the HUD never lies about the tape: slow motion and fast-forward are both labelled
  if (mode === 'rewind') return '×' + (a < 0.95 ? a.toFixed(2) : String(Math.round(a)));
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
  // V-hold roll (cold-open lock-in, tape-stop clunk): the whole picture slips down under a blanking bar — a CSS
  // transform of the stage, so it stays full resolution
  const roll = rollAt(f);
  // HUD / caption wobble while the tape is tampered with
  const wob = rewinding ? (hash01(f, 404) - 0.5) * 4 * st.tamper : 0;
  const gaugeOp = 1 - Math.min(seg(f, 84, 96), 1 - seg(f, 152, 172));
  // the stage's front canvas (above the GL ink) is one more full-frame composite: mount it only while the tape is
  // being tampered with (the tears must cut through the ink); everything else draws into the main canvas
  const tapeFx = st.tamper > 0 && roll === 0 && !dev.noTamper;
  // exposure swell before the cut: the paper brightens AND the ink thins optically (an overexposed negative)
  const swell = swellAt(f);
  const m = st.macro;
  const stageStyle: React.CSSProperties | undefined = shaking
    ? { transform: `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) scale(1.01)` }
    : roll > 0
      ? { transform: `translateY(${roll}px)` }
      : undefined;

  return (
    <AbsoluteFill style={{ background: '#141210' }}>
      <InkStage front={tapeFx ? 0.5 : undefined} style={stageStyle}>
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
        {/* GL density at 0.33 during the fast rewind (motion + RGB split + tears hide it), 0.4 from the slow-motion
            approach on (the switch at f45 happens inside a tear-heavy ×2.3 stretch) */}
        <InkBloom age={st.age} spread={st.spread} rgbSplit={st.rgbSplit} seed={1} res={f < 45 ? 0.33 : 0.4} opacity={1 - 0.42 * swell} {...cam} />
        <InkCanvas z={29} draw={(ctx) => drawStrobe(ctx, f, st)} />
        <InkCanvas z={30} draw={(ctx) => drawDrop(ctx, f, st)} />
        <InkCanvas z={31} draw={(ctx) => drawSplash(ctx, f, st)} />
        {/* out-of-focus foreground bubbles; at macro zoom they would be huge grey smudges */}
        <InkMotes time={st.clock} {...cam} opacity={Math.min(1, 1 / (st.zoom * st.zoom))} front />
        {dev.noFx ? null : <InkCanvas z={35} draw={(ctx) => drawLight(ctx, f)} />}
        {dev.noTamper ? null : <InkCanvas z={100} front draw={(ctx) => drawTamper(ctx, f, st)} />}
        {/* the lens vignette lives under the GL ink: multiply commutes, so the ink is vignetted too */}
        <InkCanvas z={45} draw={(ctx) => drawVignette(ctx, 0.35)} />
      </InkStage>
      {roll > 0 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: roll, background: '#060508', borderBottom: '2px solid rgba(255,250,240,0.55)', boxSizing: 'border-box' }} />
      ) : null}

      {dev.noHud ? null : (
        <>
          {/* entropy needle: red and jittering while the tape runs backward, rising with the bloom */}
          <SGauge value={st.sVal} falling={rewinding} color={INK.text} opacity={0.85 * clamp(gaugeOp)} />
          <Timecode mode={rewinding ? 'rewind' : 'play'} seconds={st.clock} speed={speedLabel(st.mode, st.speed)} color={COLOR.voice} x={90 + wob} opacity={0.92} />
        </>
      )}

      {dev.noText ? null : (
        <>
          {/* card 2 — over the rewind; 倒放 is on the tape (glitch); line 2 enters 0.5 s later. It diffuses while the
              drop hangs in the macro still life (the words drift away as the drop holds still) */}
          <Voice
            text={'这是{倒放}。\n你一眼就知道。'}
            from={F.card2}
            dur={F.card2End - F.card2}
            lineDelay={15}
            stagger={0.8}
            enterLen={12}
            exitLen={13}
            emFx="glitch"
            glitchGain={1}
            glitchBursts={[F.leap - F.card2, F.leap + 1 - F.card2]}
            jitter={wob}
            color={INK.text}
            accent={INK.em}
          />
          {/* card 4 — 聚回来 drifts apart while displayed */}
          <Voice
            text={'现实里，\n没人见过它自己{聚回来}。'}
            from={F.card4}
            dur={F.card4End - F.card4}
            lineDelay={2}
            stagger={0.9}
            enterLen={12}
            exitLen={15}
            emFx="drift"
            color={INK.text}
            accent={INK.em}
          />
        </>
      )}
    </AbsoluteFill>
  );
};
