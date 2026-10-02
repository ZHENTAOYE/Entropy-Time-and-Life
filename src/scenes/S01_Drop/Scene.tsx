// S01 墨滴 / The Drop — cold open (390 f). See timeline.ts for the beat sheet.
// Visual language: MACRO HIGH-SPEED PHOTOGRAPHY through the side of a backlit tank (shared lib/ink renderer):
// subtractive Beer–Lambert ink (how far it has spread is visible as colour), a tape that is first played BACKWARD
// (◀◀, red falling S-gauge, real scan-tears) and then forward in slow motion (Edgerton strobe of the falling drop,
// impact flash, macro push-in on the crown, pull-out reveal of the vortex-ring cascade). Hard cut to black: 「为什么？」.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { InkBloom, InkCanvas, InkDrop, InkMotes, InkStage, InkTank, inkDropFall, inkImpactShake, INK } from '../../lib/ink';
import { SGauge, Timecode } from '../../lib/hud';
import { COLOR } from '../../lib/handoff';
import { clamp, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { F, FROM_Y, state } from './timeline';
import { drawLight, drawSpray, drawStrobe, drawTamper, drawVignette, swellAt } from './fx';
import { Voice } from './Voice';
import { Question } from './Question';

function speedLabel(mode: string, v: number): string {
  const a = Math.abs(v);
  if (mode === 'rewind') return '×' + Math.max(1, Math.round(a));
  if (a < 0.95) return '×' + a.toFixed(2);
  return '';
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
  const drop = inkDropFall(st.age, { fromY: FROM_Y });
  // camera shake in REAL time after contact (not in the slowed tape time)
  const [sx, sy] = inkImpactShake((f - F.impact) / 30, 5);
  const shaking = sx !== 0 || sy !== 0;
  const rewinding = st.mode === 'rewind';
  // HUD / caption wobble while the tape is tampered with
  const wob = rewinding ? (hash01(f, 404) - 0.5) * 4 * st.tamper : 0;
  const gaugeOp = 1 - Math.min(seg(f, 84, 96), 1 - seg(f, 152, 172));
  // the stage's front canvas (above the GL ink) is one more full-frame composite: mount it only while the tape is
  // being tampered with (the tears must cut through the ink); everything else draws into the main canvas
  const tapeFx = f < F.stop + 4 && !dev.noTamper;
  // exposure swell before the cut: the paper brightens AND the ink thins optically (an overexposed negative)
  const swell = swellAt(f);

  return (
    <AbsoluteFill style={{ background: '#141210' }}>
      <InkStage front={tapeFx ? 0.5 : undefined} style={shaking ? { transform: `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) scale(1.01)` } : undefined}>
        {/* air colour behind everything: the extreme push-in may look above the tank's bleed */}
        <InkCanvas
          z={-5}
          draw={(ctx) => {
            ctx.fillStyle = '#141210';
            ctx.fillRect(0, 0, 1080, 1920);
          }}
        />
        <InkTank time={st.clock} impactAge={st.age} {...cam} />
        {/* GL density at 0.33 during the rewind (motion + RGB split + tears hide it); the switch at f72 is invisible: the
            ink is a drop in flight, the GL layer is empty until the impact */}
        <InkBloom age={st.age} spread={st.spread} rgbSplit={st.rgbSplit} seed={1} res={f < F.leap ? 0.33 : 0.4} opacity={1 - 0.42 * swell} {...cam} />
        <InkCanvas z={29} draw={(ctx) => drawStrobe(ctx, f, st)} />
        <InkDrop {...drop} {...cam} />
        <InkCanvas z={31} draw={(ctx) => drawSpray(ctx, f, st)} />
        {/* out-of-focus foreground bubbles; at macro zoom they would be huge grey smudges */}
        <InkMotes time={st.clock} {...cam} opacity={Math.min(1, 1 / (st.zoom * st.zoom))} front />
        {dev.noFx ? null : <InkCanvas z={35} draw={(ctx) => drawLight(ctx, f)} />}
        {dev.noTamper ? null : <InkCanvas z={100} front draw={(ctx) => drawTamper(ctx, f, st)} />}
        {/* the lens vignette lives under the GL ink: multiply commutes, so the ink is vignetted too */}
        <InkCanvas z={45} draw={(ctx) => drawVignette(ctx, 0.35)} />
      </InkStage>

      {dev.noHud ? null : (
        <>
          {/* entropy needle: red and jittering while the tape runs backward, rising with the bloom */}
          <SGauge value={st.sVal} falling={rewinding} color={INK.text} opacity={0.85 * clamp(gaugeOp)} />
          <Timecode mode={rewinding ? 'rewind' : 'play'} seconds={st.clock} speed={speedLabel(st.mode, st.speed)} color={COLOR.voice} x={90 + wob} opacity={0.92} />
        </>
      )}

      {dev.noText ? null : (
        <>
      {/* card 2 — over the rewind; 倒放 is on the tape (glitch); line 2 enters 0.6 s later */}
      <Voice text={'这是{倒放}。\n你一眼就知道。'} from={F.card2} dur={83} lineDelay={18} stagger={1.6} enterLen={16} exitLen={20} emFx="glitch" glitchGain={1} jitter={wob} color={INK.text} accent={INK.em} />
      {/* card 4 — 聚回来 drifts apart while displayed */}
      <Voice text={'现实里，\n没人见过它自己{聚回来}。'} from={F.card4} dur={F.card4End - F.card4} lineDelay={8} stagger={2} emFx="drift" color={INK.text} accent={INK.em} />
        </>
      )}
    </AbsoluteFill>
  );
};
