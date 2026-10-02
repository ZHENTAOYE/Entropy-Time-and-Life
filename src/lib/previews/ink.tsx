// Preview of the shared ink renderer (src/lib/ink.tsx).
//   node scripts/stills.mjs scratch:src/lib/previews/ink.tsx --comp InkPreview --every 15 --scale 0.33 --sheet
// Compositions:
//   InkPreview  (390 f) the S01-style sequence below
//   InkStates   (12 f)  one key state per frame: ages 0.12 … 8.5 s, then spread 0.5 and 1
//   InkWash     (180 f) S09: drawInkParticles STROKE MODE — the ink-wash human flowing along its contour over S09's cream
//                       (cosmos absorption law), gathering to w = 0.7 (never 1) and letting go
//   InkEnding   (80 f)  S09's last beat: a small new drop, the light table switches off, the hairline contracts to a point
//   InkBaseline (30 f)  the finishing layers with no ink (overhead reference for perf measurements)
// InkPreview, 390 frames:
//   f0–66    REWIND: a spread cloud (age 8 → 0, spread .3 → 0) rolls back, RGB split ∝ speed, ripples converge
//   f66–84   the drop leaps out of the water and decelerates to y = 200 (age 0 → −T)
//   f84–100  it hangs above a perfectly still surface
//   f100–117 it falls (t² acceleration); IMPACT at f117 (crown, jet, ripples, shake)
//   f117–317 the bloom, age 0 → 8 s (×1.2): ring, Widnall split (~f180), second split (~f240), chandelier
//   f317–375 spread 0 → 1: 「像散尽的墨」 haze; hold to f389
// Foreground bubbles are on the stage's front canvas (in front of the ink): <InkStage front={0.5}> + <InkMotes front />.
import React from 'react';
import { Composition, registerRoot, useCurrentFrame } from 'remotion';
import { SceneFrame } from '../SceneFrame';
import { Vignette } from '../overlays';
import { SGauge, Timecode } from '../hud';
import { clamp, ease, seg } from '../math';
import { hash01 } from '../random';
import {
  InkBloom,
  InkCanvas,
  InkDrop,
  InkMotes,
  InkStage,
  InkTank,
  drawInkParticles,
  inkDropFall,
  inkImpactShake,
  inkStroke,
} from '../ink';
import type { InkRgb } from '../ink';
import { HUMAN_PATH } from '../human';
import { FONT } from '../fonts';

const FROM_Y = 200;
const T_FALL = Math.sqrt((2 * (360 - 13 - FROM_Y)) / 900);

function timeline(f: number) {
  let age: number;
  let split = 0;
  let spread = 0;
  let mode: 'rewind' | 'pause' | 'play' = 'play';
  let zoom = 1;
  if (f < 66) {
    const u = f / 66;
    age = 8 * (1 - ease.inOutSine(u));
    split = 6 * Math.sin(Math.PI * clamp(u * 1.1));
    spread = 0.32 * (1 - ease.outCubic(clamp(u * 1.6)));
    mode = 'rewind';
  } else if (f < 84) {
    // decelerating leap: age 0 → −T in real time (time-reversed fall)
    age = -Math.min(T_FALL, (f - 66) / 30);
    split = 2 * (1 - seg(f, 66, 84));
    mode = 'rewind';
  } else if (f < 100) {
    age = -T_FALL - 0.001;
    mode = 'pause';
  } else if (f < 117) {
    age = -T_FALL + (f - 100) / 30;
    age = Math.min(age, -0.0001);
  } else if (f < 317) {
    age = ((f - 117) / 200) * 8;
    zoom = 1 + 0.06 * ease.inOutSine(seg(f, 117, 317));
  } else {
    age = 8 + ((f - 317) / 73) * 2;
    spread = ease.inOutCubic(seg(f, 317, 375));
    zoom = 1.06 - 0.06 * ease.inOutSine(seg(f, 317, 375));
  }
  return { age, split, spread, mode, zoom };
}

const Label: React.FC<{ children: string; color?: string }> = ({ children, color = 'rgba(23,21,28,0.55)' }) => (
  <div style={{ position: 'absolute', left: 90, top: 1835, fontFamily: FONT.mono, fontSize: 22, letterSpacing: '0.12em', color, whiteSpace: 'pre' }}>{children}</div>
);

const InkPreview: React.FC = () => {
  const f = useCurrentFrame();
  const { age, split, spread, mode, zoom } = timeline(f);
  const drop = inkDropFall(age, { fromY: FROM_Y });
  const clock = 20 + Math.max(age, -T_FALL);
  const [sx, sy] = inkImpactShake(age);
  // entropy needle follows the (rewound) state: rising normally, red while time runs backward
  const sVal = clamp(0.12 + 0.55 * Math.sqrt(Math.max(0, age) / 8) + 0.3 * spread);
  return (
    <SceneFrame>
      <InkStage front={0.5} style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <InkTank time={clock} impactAge={age} zoom={zoom} />
        <InkBloom age={age} spread={spread} rgbSplit={split} zoom={zoom} seed={1} />
        <InkDrop {...drop} zoom={zoom} />
        <InkMotes time={clock} zoom={zoom} front />
      </InkStage>
      <Vignette strength={0.35} color="70,52,30" />
      <SGauge value={sVal} falling={mode === 'rewind'} color="#17151C" opacity={f > 84 && f < 117 ? 0.4 : 0.85} />
      <Timecode mode={mode} seconds={Math.max(0, age) + 4.2} speed={mode === 'rewind' ? '×' + Math.max(1, Math.round(1 + split * 2)) : ''} color="#F3EFE6" />
      <Label>{`age ${age.toFixed(2).padStart(6)} s · spread ${spread.toFixed(3)} · split ${split.toFixed(1)}px · zoom ${zoom.toFixed(3)}`}</Label>
    </SceneFrame>
  );
};

// Key states, one per frame (for stills): ages through the cascade, then spread levels.
const STATES: Array<[number, number]> = [
  [0.12, 0], [0.4, 0], [0.9, 0], [1.5, 0], [2.1, 0], [3, 0], [4.2, 0], [5.5, 0], [7, 0], [8.5, 0], [10, 0.5], [12, 1],
];
const InkStates: React.FC<{ res?: number }> = ({ res = 0.4 }) => {
  const f = useCurrentFrame();
  const [age, spread] = STATES[Math.min(STATES.length - 1, f)];
  return (
    <SceneFrame>
      <InkStage front={0.5}>
        <InkTank time={20 + age} impactAge={age} />
        <InkBloom age={age} spread={spread} seed={1} res={res} />
        <InkMotes time={20 + age} front />
      </InkStage>
      <Vignette strength={0.35} color="70,52,30" />
      <Label>{`age ${age.toFixed(2)} s · spread ${spread.toFixed(2)}`}</Label>
    </SceneFrame>
  );
};

// ─────────────────────────────── InkWash: the S09 ink-wash human (stroke mode) ───────────────────────────────
// S09's inverted world: COSMOS.paper / COSMOS_INK_K / COSMOS_INK_FLOOR of lib/cosmosShader.ts (copied here so this
// preview does not depend on the cosmos module). The ink module takes them as props, so the inverted web and the tank
// share one colour law across the dissolve.
const S09_PAPER = '#F1EADB';
const S09_K: InkRgb = [1.413, 1.193, 0.794];
const S09_FLOOR: InkRgb = [0.0456, 0.0556, 0.0912];
const S09_SURFACE = 300;
// figure: height 1150, head at 330, feet at 1480 (visual-direction S09)
const FIG_S = 1150 / 1344;

/** Smooth divergence-free displacement field (sum of 4 stream-function modes), ~unit amplitude, coherent over ~400 px. */
function flowField(x: number, y: number, t: number): [number, number] {
  const M: Array<[number, number, number, number]> = [
    // kx, ky (rad/px), ω (rad/s), phase
    [0.0061, 0.0042, 0.31, 0.4],
    [-0.0035, 0.0078, 0.23, 2.1],
    [0.0093, -0.0051, 0.41, 4.4],
    [0.0022, 0.0105, 0.37, 5.3],
  ];
  let vx = 0,
    vy = 0;
  for (const [kx, ky, w, ph] of M) {
    const c = Math.cos(kx * x + ky * y + w * t + ph);
    const kk = Math.hypot(kx, ky);
    vx += (c * ky) / kk;
    vy -= (c * kx) / kk;
  }
  return [vx * 0.5, vy * 0.5];
}

/** Gather weight of the figure: rises to 0.7 (never 1), holds briefly, lets go. */
const gatherW = (t: number) => 0.7 * ease.inOutSine(clamp(t / 2.4)) * (1 - 0.8 * ease.inOutSine(clamp((t - 3.4) / 2.6)));

const InkWash: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const st = inkStroke('preview-human', HUMAN_PATH, { x: 540 - 300 * FIG_S, y: 1480 - 1402 * FIG_S, scale: FIG_S, width: 17, spacing: 2.5, rows: 6, pressure: 0.75 });
  const w = gatherW(t);
  const g = w / 0.7; // 0 … 1 at the peak gather
  // displacement amplitude: ~150 px of coherent drift while diffuse, 8 px at the peak (the figure must read)
  const A = 8 + 142 * (1 - g) * (1 - g);
  const n = st.n;
  const pos = new Float32Array(n * 2);
  const dir = new Float32Array(n * 2);
  const alpha = new Float32Array(n);
  const sizes = new Float32Array(n);
  // diffusing ink grows and thins at constant mass (dilution): 2.6× wider and 1/2.6 as dense when fully dispersed
  const grow = 1 + 1.6 * (1 - g) * (1 - g);
  for (let i = 0; i < n; i++) {
    const h = hash01(i, 71);
    // the ink keeps FLOWING along the contour, each bristle track at its own pace (16–40 px/s), even at the peak
    const track = Math.floor(i / st.perRow);
    const [x, y, tx, ty] = st.flow(i, (16 + 24 * hash01(track, 5) + 3 * h) * t);
    const [fx, fy] = flowField(x + 37 * h, y, t * 0.6 + h * 0.4);
    const sink = (26 * t + 0.45 * A) * (1 - g); // diffuse ink hangs lower and sinks slowly
    pos[i * 2] = x + fx * A;
    pos[i * 2 + 1] = Math.max(S09_SURFACE + 6, y + fy * A + sink);
    sizes[i] = grow;
    // dabs lie along the contour when gathered, along the drift when diffuse
    const L = 6 + 12 * g;
    const dx = tx * g + fx * (1 - g),
      dy = ty * g + fy * (1 - g);
    const dl = Math.hypot(dx, dy) || 1;
    dir[i * 2] = (dx / dl) * L;
    dir[i * 2 + 1] = (dy / dl) * L;
    // diluting while dispersed (Beer–Lambert: paler and bluer), with a slowly travelling pulse of fresh ink
    // tone along the stroke: 焦墨 where the brush was reloaded … 淡墨 where it ran thin (travels with the ink)
    const s0 = st.sv[i * 2];
    const tone = 0.5 + 0.5 * Math.sin(s0 * 0.0041 + 1.3) * Math.sin(s0 * 0.0017 + 0.4);
    alpha[i] = ((0.6 + 0.4 * g) / grow) * (0.45 + 0.55 * tone) * (0.85 + 0.15 * Math.sin(s0 * 0.01 - t * 1.3));
  }
  return (
    <SceneFrame>
      <InkStage front={0.5}>
        <InkTank time={20 + t} impactAge={-1} surfaceY={S09_SURFACE} paper={S09_PAPER} />
        <InkBloom age={12 + t} spread={1} haze={0.12} seed={1} surfaceY={S09_SURFACE} k={S09_K} floor={S09_FLOOR} />
        <InkCanvas
          draw={(ctx) =>
            drawInkParticles(ctx, pos, {
              dir,
              alpha,
              sizes,
              sv: st.sv,
              size: 2.5,
              density: 0.24,
              halo: 0.5,
              haloRadius: 10,
              dry: 0.7,
              grain: 0.12 + 0.28 * g, // granulation shows where the stroke has settled; a dispersing wash is smooth
              k: S09_K,
              floor: S09_FLOOR,
            })
          }
        />
        <InkMotes time={20 + t} surfaceY={S09_SURFACE} front />
      </InkStage>
      <Vignette strength={0.35} color="70,52,30" />
      <SGauge value={clamp(0.62 + 0.05 * t)} color="#17151C" opacity={0.85} />
      <Label>{`stroke mode · gather w ${w.toFixed(2)} · drift ${A.toFixed(0)} px · ${n} dabs`}</Label>
    </SceneFrame>
  );
};

// ─────────────────────────────── InkEnding: S09's last beat ───────────────────────────────
const InkEnding: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  // a small new drop falls through the surface at f20 and blooms at scale 0.6
  const age = (f - 20) / 30;
  const drop = inkDropFall(age, { fromY: 170, surfaceY: S09_SURFACE, r: 9 });
  const light = 1 - ease.inOutSine(seg(f, 34, 58));
  const span = 1 - ease.inOutCubic(seg(f, 50, 74));
  const hairline = 1 - seg(f, 73, 79);
  return (
    <SceneFrame>
      <InkStage>
        <InkTank time={20 + t} impactAge={age} surfaceY={S09_SURFACE} paper={S09_PAPER} light={light} hairlineSpan={span} hairline={hairline} rippleAmp={0.6} crown={0.6} />
        <InkBloom age={14 + t} spread={1} haze={0.3} seed={1} surfaceY={S09_SURFACE} k={S09_K} floor={S09_FLOOR} opacity={light} />
        <InkBloom age={age} scale={0.6} seed={2} surfaceY={S09_SURFACE} k={S09_K} floor={S09_FLOOR} opacity={light} />
        <InkDrop {...drop} surfaceY={S09_SURFACE} opacity={light} />
      </InkStage>
      <Label color="rgba(243,239,230,0.45)">{`light ${light.toFixed(2)} · hairlineSpan ${span.toFixed(3)} · hairline ${hairline.toFixed(2)}`}</Label>
    </SceneFrame>
  );
};

// Overhead reference for perf measurements: the same finishing layers with no ink.
const InkBaseline: React.FC = () => (
  <SceneFrame>
    <div style={{ position: 'absolute', inset: 0, background: '#F4EEE2' }} />
    <Vignette strength={0.35} color="70,52,30" />
  </SceneFrame>
);

registerRoot(() => (
  <>
    <Composition id="InkPreview" component={InkPreview} durationInFrames={390} fps={30} width={1080} height={1920} />
    <Composition id="InkStates" component={InkStates} durationInFrames={STATES.length} fps={30} width={1080} height={1920} />
    <Composition id="InkWash" component={InkWash} durationInFrames={180} fps={30} width={1080} height={1920} />
    <Composition id="InkEnding" component={InkEnding} durationInFrames={80} fps={30} width={1080} height={1920} />
    <Composition id="InkBaseline" component={InkBaseline} durationInFrames={30} fps={30} width={1080} height={1920} />
  </>
));
