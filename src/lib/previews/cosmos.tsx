// Preview of the shared cosmos module (src/lib/cosmos.tsx). Every state the scenes need, in one composition:
//   A   0–119  S04 collapse: boiling white-hot plasma → mottling grows → glowing filaments cool through the dark ages
//              → the web; nodes ignite with flashes + shock rings (igniteRate given) → frame 110 is exactly WEB_FINAL
//   B 120–179  S05 heat death from WEB_FINAL: stars burn out, black holes swallow the heaviest clusters and
//              evaporate, the image random-walks into grey noise
//   C 180–239  S04 a merging pair of spiral galaxies (restricted N-body) over a parallax starfield
//   D 240–269  S04 rewind: a spiral un-lights into glowing gas knots while the web melts back towards plasma
//   E 270–314  S03 amber Milky Way sitting on the row of zeros
//   F 315–389  S09 powers-of-ten pull-back out of a galaxy on a massive cluster (zoom 16 → 0.8), then the web turns
//              to ink: its light drains into ink-dark, which thins out to reveal the inked web on cream
// Also: "CosmosGallery" (galaxy / merger stills) and "CosmosBench" (fixed states for timing with stills.mjs).
// Render: node scripts/stills.mjs scratch:src/lib/previews/cosmos.tsx --comp CosmosPreview --every 15 --scale 0.33 --sheet
import React from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { SceneFrame } from '../SceneFrame';
import { CanvasLayer } from '../Canvas';
import { CosmicWeb, WEB_FINAL, WebParams, centerOn, drawGalaxy, drawMerger, drawStarfield, webNodes } from '../cosmos';
import { ease, lerp, prog, seg, smoothstep } from '../math';
import { FONT } from '../fonts';

const Label: React.FC<{ text: string; color?: string }> = ({ text, color = 'rgba(214,230,255,0.75)' }) => (
  <div style={{ position: 'absolute', left: 90, top: 240, fontFamily: FONT.mono, fontSize: 26, letterSpacing: '0.12em', color, whiteSpace: 'pre' }}>{text}</div>
);
const fx = (v: number) => v.toFixed(2);

const Collapse: React.FC<{ f: number }> = ({ f }) => {
  const k = prog(f, 22, 84, ease.inOutSine);
  const P: WebParams = {
    c: k,
    heat: 1 - prog(f, 18, 78, ease.inOutCubic),
    ignite: prog(f, 66, 106, ease.inOutSine),
    // the ignition ramp is ~40 frames → ≈ 0.75 ignite/s: flashes and shock rings last ~0.6 s whatever the ramp speed
    igniteRate: 0.75,
    sparks: prog(f, 50, 104, ease.inOutSine),
    zoom: lerp(1, WEB_FINAL.zoom, prog(f, 22, 110, ease.inOutCubic)),
    roll: WEB_FINAL.roll * prog(f, 22, 110, ease.inOutCubic),
    t: WEB_FINAL.t + (f - 110) / 30,
  };
  return (
    <>
      <CosmicWeb {...P} />
      <Label text={f === 110 ? 'A · WEB_FINAL' : `A · COLLAPSE  c ${fx(P.c)}  heat ${fx(P.heat)}  ignite ${fx(P.ignite)}`} />
    </>
  );
};

const HeatDeath: React.FC<{ f: number }> = ({ f }) => {
  const P: WebParams = {
    ...WEB_FINAL,
    t: WEB_FINAL.t + (f - 110) / 30,
    die: prog(f, 121, 152, ease.inOutSine),
    sparks: 1 - prog(f, 121, 145),
    bh: prog(f, 126, 166, ease.linear),
    eq: prog(f, 148, 179, ease.inOutSine),
  };
  return (
    <>
      <CosmicWeb {...P} />
      <Label text={`B · HEAT DEATH  die ${fx(P.die!)}  bh ${fx(P.bh!)}  eq ${fx(P.eq!)}`} color="rgba(200,200,200,0.7)" />
    </>
  );
};

const Merger: React.FC<{ f: number }> = ({ f }) => {
  const p = prog(f, 180, 238, ease.inOutSine);
  return (
    <AbsoluteFill style={{ background: '#02030A' }}>
      <CanvasLayer
        draw={(ctx) => {
          drawStarfield(ctx, { seed: 4, t: f / 30, x: (f - 180) * 1.2, y: (f - 180) * 0.6, alpha: 0.8 });
          drawMerger(ctx, { cx: 540, cy: 900, scale: 165, p, tilt: 0.55, angle: 0.4, t: f / 30 });
        }}
      />
      <Label text={`C · MERGER  p ${fx(p)}`} />
    </AbsoluteFill>
  );
};

const Dissolve: React.FC<{ f: number }> = ({ f }) => {
  const d = prog(f, 242, 268, ease.inOutSine);
  const P: WebParams = { c: lerp(1, 0.35, d), heat: lerp(0, 0.6, prog(f, 248, 269)), ignite: 1 - prog(f, 240, 258), zoom: 1.1, roll: 0.05, t: f / 30, sparks: 0.3 };
  return (
    <>
      <CosmicWeb
        {...P}
        draw={(ctx) => {
          drawStarfield(ctx, { seed: 5, t: f / 30, streak: 0.5 * Math.sin(Math.PI * seg(f, 240, 270)), cx: 540, cy: 860, alpha: 0.7 * (1 - d) });
          drawGalaxy(ctx, { cx: 540, cy: 860, radius: 360, tilt: 0.6, angle: -0.5, arms: 2, bar: 0.3, seed: 7, t: f / 30, dissolve: d, palette: 'natural' });
        }}
      />
      <Label text={`D · REWIND  dissolve ${fx(d)}  c ${fx(P.c)}`} />
    </>
  );
};

const MilkyWay: React.FC<{ f: number }> = ({ f }) => {
  const a = seg(f, 270, 278);
  return (
    <AbsoluteFill style={{ background: '#070604' }}>
      <CanvasLayer
        draw={(ctx) => {
          ctx.globalAlpha = a;
          drawStarfield(ctx, { seed: 9, t: f / 30, palette: 'amber', density: 0.6, alpha: 0.5 * a });
          // the row of zeros (ZERO_LINE)
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(0, 948, 0, 972);
          g.addColorStop(0, 'rgba(255,159,46,0)');
          g.addColorStop(0.5, 'rgba(255,159,46,0.45)');
          g.addColorStop(1, 'rgba(255,159,46,0)');
          ctx.fillStyle = g;
          ctx.fillRect(90, 948, 900, 24);
          ctx.fillStyle = 'rgba(255,190,110,0.95)';
          ctx.fillRect(90, 959, 900, 2);
          drawGalaxy(ctx, { cx: 540, cy: 960, radius: 190, tilt: 1.05, angle: 0, arms: 2, bar: 0.6, pitch: 0.22, seed: 11, t: (f - 270) / 30 + 3, palette: 'amber', alpha: a });
        }}
      />
      <Label text="E · MILKY WAY (amber, barred)" color="rgba(255,159,46,0.8)" />
    </AbsoluteFill>
  );
};

// S09: powers-of-ten pull-back out of a galaxy that sits on a massive cluster, then the inversion into ink
const S09_T0 = WEB_FINAL.t + 10;
const heroNode = () =>
  webNodes({ ...WEB_FINAL, t: S09_T0 }, { groups: false })
    .filter((n) => Math.abs(n.x - 540) < 260 && Math.abs(n.y - 960) < 360)
    .sort((a, b) => b.mass - a.mass)[0];
const Invert: React.FC<{ f: number }> = ({ f }) => {
  const t = S09_T0 + (f - 315) / 30;
  const n = heroNode();
  const z = Math.exp(lerp(Math.log(16), Math.log(0.8), prog(f, 315, 350, ease.inOutCubic)));
  const inv = prog(f, 350, 389, ease.inOutSine);
  const P: WebParams = { ...WEB_FINAL, t, zoom: z, ...centerOn(n.wx, n.wy, t), invert: inv, sparks: 0.6 };
  const gal = 1 - smoothstep(1.2, 3.5, -Math.log(z / 16));
  return (
    <>
      <CosmicWeb
        {...P}
        flares={{ spikes: 1 / Math.max(1, z / 2), size: 1 / Math.max(1, Math.sqrt(z / 2)) }}
        draw={(ctx) => {
          // the galaxy is ~0.07 cells across: at zoom 16 it fills the frame, at 0.8 it is the cluster's core
          drawGalaxy(ctx, { cx: 540, cy: 960, radius: 0.07 * 300 * z, tilt: 0.6, angle: 0.8, bar: 0.4, seed: 21, t, palette: 'cool', alpha: gal });
        }}
      />
      <Label text={inv > 0 ? `F · INVERT  ${fx(inv)}` : `F · S09 PULL-BACK  zoom ${z.toFixed(2)}`} color={inv > 0.5 ? 'rgba(23,21,28,0.75)' : 'rgba(214,230,255,0.75)'} />
    </>
  );
};

const Preview: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <SceneFrame>
      {f < 120 ? <Collapse f={f} /> : f < 180 ? <HeatDeath f={f} /> : f < 240 ? <Merger f={f} /> : f < 270 ? <Dissolve f={f} /> : f < 315 ? <MilkyWay f={f} /> : <Invert f={f} />}
    </SceneFrame>
  );
};

// ── gallery: one galaxy / merger state per frame ──
const GALLERY: Array<[string, (ctx: CanvasRenderingContext2D) => void]> = [
  ['natural R380', (ctx) => drawGalaxy(ctx, { cx: 540, cy: 900, radius: 380, tilt: 0.45, angle: -0.4, arms: 2, bar: 0.2, seed: 7, t: 3, palette: 'natural' })],
  ['cool R340 (S09 hero)', (ctx) => drawGalaxy(ctx, { cx: 540, cy: 960, radius: 340, tilt: 0.6, angle: 0.8, bar: 0.4, seed: 21, t: 3, palette: 'cool' })],
  ['amber R190 (S03)', (ctx) => drawGalaxy(ctx, { cx: 540, cy: 960, radius: 190, tilt: 1.05, angle: 0, arms: 2, bar: 0.6, pitch: 0.22, seed: 11, t: 3, palette: 'amber' })],
  ['dissolve .5', (ctx) => drawGalaxy(ctx, { cx: 540, cy: 900, radius: 360, tilt: 0.75, angle: -0.5, arms: 2, bar: 0.3, seed: 7, t: 3, dissolve: 0.5, palette: 'natural' })],
  ['merger .15', (ctx) => drawMerger(ctx, { cx: 540, cy: 900, scale: 150, p: 0.15, tilt: 0.55, angle: 0.4, t: 3 })],
  ['merger .12 big', (ctx) => drawMerger(ctx, { cx: 540, cy: 900, scale: 210, p: 0.12, tilt: 0.2, angle: 0.4, t: 3 })],
  ['merger .45', (ctx) => drawMerger(ctx, { cx: 540, cy: 900, scale: 150, p: 0.45, tilt: 0.55, angle: 0.4, t: 3 })],
  ['merger .65', (ctx) => drawMerger(ctx, { cx: 540, cy: 900, scale: 150, p: 0.65, tilt: 0.55, angle: 0.4, t: 3 })],
  ['merger .9', (ctx) => drawMerger(ctx, { cx: 540, cy: 900, scale: 150, p: 0.9, tilt: 0.55, angle: 0.4, t: 3 })],
];
const Gallery: React.FC = () => {
  const f = useCurrentFrame();
  const [label, fn] = GALLERY[f % GALLERY.length];
  return (
    <SceneFrame>
      <AbsoluteFill style={{ background: '#02030A' }}>
        <CanvasLayer draw={(ctx) => fn(ctx)} />
      </AbsoluteFill>
      <Label text={label} />
    </SceneFrame>
  );
};

// ── bench: fixed states, one per frame (time them with stills.mjs --comp CosmosBench --frames …) ──
const BENCH: Array<() => React.ReactNode> = [
  () => <AbsoluteFill style={{ background: '#02030A' }} />, // 0 blank baseline
  () => <CosmicWeb {...WEB_FINAL} />, // 1 WEB_FINAL
  () => <CosmicWeb {...WEB_FINAL} t={WEB_FINAL.t + 4} die={0.8} bh={0.5} sparks={0.2} eq={0.5} />, // 2 heat death mid
  () => <CosmicWeb {...WEB_FINAL} invert={0.6} />, // 3 inversion mid
  () => <CosmicWeb {...WEB_FINAL} draw={(ctx) => drawGalaxy(ctx, { cx: 540, cy: 900, radius: 330, tilt: 0.7, angle: -0.4, seed: 7, t: 3, palette: 'natural' })} />, // 4 web + hero galaxy
  () => <CosmicWeb c={0} heat={1} ignite={0} zoom={1} roll={0} t={2} />, // 5 plasma
  () => <CosmicWeb c={0.5} heat={0.35} ignite={0} zoom={0.9} roll={0.05} t={2} sparks={0.3} />, // 6 mid collapse
  () => <CosmicWeb c={0.1} heat={0.75} ignite={0} zoom={1} roll={0} t={4} />, // 7 heat .75
  () => <CosmicWeb c={0.25} heat={0.55} ignite={0} zoom={1} roll={0} t={4} />, // 8 heat .55
  () => <CosmicWeb c={0.6} heat={0.3} ignite={0} zoom={0.95} roll={0} t={4} />, // 9 heat .3
  () => <CosmicWeb {...WEB_FINAL} bh={0.03} />, // 10 black hole forming on a still-lit star
  () => <CosmicWeb {...WEB_FINAL} bh={0.037} />, // 11 (should differ from 10 only slightly)
  () => <CosmicWeb {...WEB_FINAL} bh={0.1} />, // 12 hole formed, host star gone
];
const Bench: React.FC = () => {
  const f = useCurrentFrame();
  return <SceneFrame>{BENCH[f % BENCH.length]()}</SceneFrame>;
};

registerRoot(() => (
  <>
    <Composition id="CosmosPreview" component={Preview} durationInFrames={390} fps={30} width={1080} height={1920} />
    <Composition id="CosmosGallery" component={Gallery} durationInFrames={GALLERY.length} fps={30} width={1080} height={1920} />
    <Composition id="CosmosBench" component={Bench} durationInFrames={BENCH.length} fps={30} width={1080} height={1920} />
  </>
));
