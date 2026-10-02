/**
 * ink.tsx — the shared "ink drop in water" renderer (S01 cold open / drop / bloom, S04 「像散尽的墨」, S09 ink-wash).
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Files: ink.tsx (components + helpers, this API) · inkModel.ts (closed-form physics, colour law) · inkShader.ts (GL).
 * Preview: node scripts/stills.mjs scratch:src/lib/previews/ink.tsx --comp InkPreview --every 15 --scale 0.33 --sheet
 *          (--comp InkStates: one key state per frame · InkWash: S09 ink-wash human (stroke mode) · InkEnding: S09's
 *          light-off + contracting hairline · InkBaseline: no ink, perf reference). Use --out for the non-default comps.
 *
 * LOOK: a macro shot through the side of a backlit tank. Cream light table below the silver surface hairline
 * (WATER_LINE_Y = 360), dim warm air with soft bokeh above. Ink is rendered by Beer–Lambert absorption, so how far it
 * has spread is visible as COLOUR: thick = near-black #0A0B10, dilute = slate blue-grey (#3E4964 at density 1). The
 * bloom is a vortex-ring cascade. The young primary is a glossy, hard-edged torus (darkest at its two ends, the
 * longest optical path; a translucent hole) under the translucent dome of its vortex bubble, hanging from a thin stem.
 * It descends and brakes, bends N times (Widnall waviness), and breaks into child lobes that swing out and down on
 * curved arms, hanging from it by thin tethers. Then they split again: the "ink chandelier". Dye striations (ribs),
 * peeling wisps and core windings grow in as the ring ages. Children are more dilute than their parent (each split
 * shares the ink), so the cascade fades from black to blue-grey. Domain-warped wisps spread ~√age. The stem, tethers
 * and wisps are streak-line filaments (the dye shed from each ring over its life): one crisp thread with a soft body,
 * tapering in alpha. Ink is slightly denser than water: after the vortices brake everything keeps sinking slowly, so
 * the image never freezes.
 *
 * EVERYTHING IS A PURE FUNCTION OF ITS INPUTS. `age` (seconds since impact) may be any real number and may
 * decrease: evaluating at a decreasing age *is* the rewind (lobes swing back and merge, tethers retract into the
 * primary, the ring rises into a blob, ripples converge). Every prop is continuous: easing spread, rgbSplit, light,
 * hairlineSpan, opacity … never makes a frame jump. No state, no Math.random; precompute is memoised per seed.
 *
 * ── RECOMMENDED SETUP (S01) ───────────────────────────────────────────────────────────────────────────────────────
 *
 *   const age = …;                                  // seconds since impact (rewind: just let it decrease)
 *   const [sx, sy] = inkImpactShake(age);           // optional 2 px shake at impact
 *   <InkStage front={0.5} style={{ transform: `translate(${sx}px,${sy}px)` }}>
 *     <InkTank time={clock} impactAge={age} zoom={z} />                 // light table, air, hairline, ripples, crown
 *     <InkBloom age={age} spread={sp} rgbSplit={split} zoom={z} />     // the ink
 *     <InkDrop {...inkDropFall(age, { fromY: 200 })} zoom={z} />       // the drop, only visible for age < 0
 *     <InkMotes time={clock} zoom={z} front />                          // foreground bubbles IN FRONT of the ink
 *   </InkStage>
 *   …captions / HUD after it.
 *
 * <InkStage front?> (strongly recommended): all 2D work (tank, filaments, drop, motes, InkCanvas) is drawn into ONE
 * CPU canvas. In this SwiftShader renderer every extra full-frame layer costs a full CPU composite. The GL ink
 * density is a single CSS multiply layer above that canvas. Both live in one isolated container that receives the
 * stage's `style` (put shake transforms there). DRAW ORDER is a pure function of each child's `z` (defaults INK_Z:
 * tank 0 · bloom filaments 10 · InkCanvas 20 · drop 30 · motes 40; ties by mount order), so <Sequence>s and
 * conditional mounting cannot reorder layers between render tabs. Pass an explicit `z` to interleave your own
 * <InkCanvas> layers. The ink multiplies onto what the stage draws: put <InkTank> in it. To multiply ink over a
 * scene's own background, use InkBloom standalone, outside a stage.
 *   `front` (opt-in; `true` or a resolution scale, 0.5 recommended) adds a second canvas ABOVE the ink. Children
 *   mounted with `front` (InkMotes / InkDrop / InkCanvas) draw there, source-over, so foreground bubbles are not
 *   darkened by the cloud. It costs one extra composited layer (~empty-layer cost). Without it, `front` children
 *   fall back to the main canvas (under the ink).
 * Without a stage every component renders its own layers (works, slower). Then keep InkTank and InkBloom siblings
 * in one container and never give the bloom alone a stacking context (opacity < 1, transform, filter, isolation):
 * multiply would blend against transparency, and the white of the ink layer would cover the tank. Use the
 * `opacity` / `zoom` props instead.
 *
 * COORDINATES: logical 1080×1920 px. `zoom` (default 1) is a camera push-in about `zoomOrigin` (default [540, 860]);
 * pass the SAME zoom/zoomOrigin to every ink component (S01 push-in 1.00 → 1.06). InkMotes use 1.3× parallax.
 *
 * ── API ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <InkTank time impactAge? impactX? surfaceY? zoom? zoomOrigin? light? airLight? air? bubbles? hairline?
 *          hairlineSpan? hairlineX? crown? rippleAmp? paper? z? />
 *   time       seconds; drives bubble drift / bokeh shimmer (pass the same remapped clock you rewind with)
 *   impactAge  seconds since impact: capillary ripple packets (crests slower than the envelope), crater, crown sheet
 *              with beaded jets + ejected droplets (0–0.3 s), Worthington jet (0.2–0.7 s), entrained bubbles that rise
 *              back (0–2 s). ≤ 0 → perfectly still surface. Decreasing values make the ripples run inward.
 *   impactX    default 540.  surfaceY default WATER_LINE_Y (360); S09 uses 300; −100 for an all-water frame (S04).
 *   light      0..1 light-table power. S09 ending: 1 → 0 fades the cream to black, and the air with it (see airLight).
 *   airLight   0..1 brightness of the air above the surface (gradient, bokeh, warm spill); default = `light`, so the
 *              whole room goes dark with the table. Set it explicitly to dim the air alone.
 *   hairline   0..1 strength of the silver surface line (S09's last frames: → 0 to kill the final point of light).
 *   hairlineSpan 0..1 visible fraction of the hairline, centred on `hairlineX` (default impactX). Its ends fade over
 *              ~90 px and slide inward; below ~2.5 px half-width it becomes a single point of light. S09: ease 1 → 0,
 *              then hairline → 0.
 *   paper      water colour at the centre of the light table (default INK.paper #F4EEE2). S09's inverted world passes
 *              COSMOS.paper #F1EADB, so the inverted web and the tank match. It is a multiply tint, so every channel
 *              must be ≤ INK.paper's.
 *   air 0..1 bokeh amount (1) · bubbles 0..1 (1) · crown 0..1 (1) · rippleAmp (1) · z (INK_Z.tank)
 *
 * <InkBloom age x? surfaceY? spread? haze? rgbSplit? seed? scale? zoom? zoomOrigin? opacity? filaments? res? k? floor? z? />
 *   age       seconds since impact (any real; ≤ 0 and spread 0 → nothing, and the layer is skipped). Beat at scale 1:
 *             dense blob just under the crater (0–0.15 s) → glossy torus under its dome on a thin stem (0.3–1.3 s,
 *             primary at y≈450–650) → Widnall waviness, ribs and wisps grow in (0.9–1.8 s) → split into 4 lobes
 *             (~1.8 s) → each splits into 3 (3.7–4.0 s) → full chandelier (x ≈ 215…910 at 4.2 s; 130…980 at 6.8–8 s;
 *             lowest lobes y ≈ 1040 at 4.2 s, ≈ 1210–1250 at 6.8–8 s, so the caption lane at y = 1440 stays clean).
 *             Exact per-ring positions: inkRingsAt(age) (existing rings only; see below).
 *   x         impact x (default 540).  surfaceY default WATER_LINE_Y.
 *   spread    0..1 extra diffusion. 0 = the cascade. 1 = 「散尽的墨」: an almost uniform blue-grey haze over the whole
 *             water column, with faint residual structure. In between, the structure widens, softens and fades into
 *             the haze. Ring-borne density fades out continuously over spread 0.8 → 0.995, so a ramp to 1 and a hold
 *             there never pops. Filaments fade as (1 − spread)⁴. Cold open: start ≈ 0.3 and rewind to 0 together with
 *             age. S04 card 6: ramp to 1.
 *   haze      optical density of the spread haze (default 0.55 ≈ #707A8E on the light table; 0.12–0.3 = paler).
 *   rgbSplit  px of chromatic split (R right / B left) for TIME TAMPERING only (rewinds), on the GL ink and the
 *             filaments. Continuous: the 3rd warp octave blends out over 0.5–2 px, so easing it in never jumps.
 *   seed      integer; changes the cascade (lobe angles, sizes, wisps). S01 and S09 should share one (default 1).
 *   scale     size multiplier of the whole bloom about the impact point (default 1), e.g. 0.6 for S09's closing drop.
 *   opacity   0..1 multiplies the optical density (fade ink physically; never wrap it in CSS opacity).
 *   filaments default true (stem threads, tethers, wisps, ribs). false = GL body only (cheaper).
 *   res       render scale of the GL density (default 0.4; drops automatically to 0.33 / 0.28 when spread ≥ 0.15 / 0.5:
 *             diffused ink is smooth).
 *   k, floor  absorption law (default INK_K / INK_FLOOR). S09 passes COSMOS_INK_K / COSMOS_INK_FLOOR (lib/cosmosShader)
 *             with paper COSMOS.paper on InkTank, and the same k / floor to drawInkParticles: one colour law across
 *             the inversion dissolve. Arrays can be lerped per frame to ease from one law to the other.
 *
 * <InkDrop y x? r? stretch? vy? opacity? visible? surfaceY? reflection? zoom? zoomOrigin? z? front? />
 *   Near-black ink drop (r 13) with a cream Fresnel rim lit by the light table, hard specular, warm halo against the
 *   dark air, a shutter streak when fast, and its inverted reflection under the hairline rising to meet it.
 *   Usually <InkDrop {...inkDropFall(age, { fromY })} />.
 *
 * inkDropFall(age, { fromY = 200, g = 900 px/s², r = 13, surfaceY, x = 540 }) → { x, y, r, vy, stretch, visible, opacity }
 *   Pure kinematics for age < 0: falls from rest at fromY with t² acceleration, contact (bottom touches the surface)
 *   at age = 0; fall time T = √(2(surfaceY − r − fromY)/g) ≈ 0.57 s for the defaults. For age < −T it hangs at fromY
 *   (S01: "the drop hangs in mid-air above a perfectly still surface"); for age ≥ 0 visible = false. Rewinding through
 *   it makes the drop leap out of the water and decelerate to fromY.
 *
 * <InkMotes time zoom? zoomOrigin? opacity? count? surfaceY? z? front? />   ~26 out-of-focus foreground bubbles
 *   (1.3× parallax). Use `front` inside <InkStage front={0.5}> so they sit in front of the ink.
 *
 * <InkCanvas draw={(ctx, info) => …} scale? z? front? />
 *   A layer to paint ink on with globalCompositeOperation 'multiply' (drawInkParticles does this). Inside a stage your
 *   callback draws straight into the stage at its `z` (default INK_Z.canvas: above the filaments, under the drop).
 *   Standalone it is a white CPU canvas with CSS multiply.
 *
 * drawInkParticles(ctx, points, opts?)  水墨 particles (S09's ink-wash human, the ◀◀-into-ink, ink text)
 *   points = Float32Array | number[] [x0,y0,x1,y1,…] in logical px. Each particle is splatted as OPTICAL DENSITY into
 *   a float buffer (JS; 12.5k stroke dabs ≈ 50–60 ms gathered, ≈ 100–150 ms widely dispersed), with a wet halo (墨晕) and paper grain, then converted once by
 *   Beer–Lambert and multiplied onto ctx. Overlapping dabs ADD ink exactly: dense strokes go near-black, thin washes
 *   stay blue-grey. Two modes:
 *   · DOT mode (no `dir`): soft round dabs (mist, washes, ink text dissolving).
 *   · STROKE mode (`dir`): each point is an elongated wet dab (dense pigment core, feathered edge) laid along its
 *     direction. Neighbours fuse into continuous brush lines. Use with inkStroke() below.
 *   opts: size (dot radius / stroke half-width px, 1.6) · sizeJitter (0.6 dot / 0.35 stroke) · density (ink density
 *     added at a dab's core, InkBloom units, 0.35) · halo (bleed fraction, 0.6) · haloRadius (px, 9) · wet (0..1
 *     unevenness of the bleed, 0.6) · alpha (per-point 0..1) · sizes (per-point size ×; diffusing ink: sizes s ≥ 1
 *     with alpha ∝ 1/s = constant mass, so it gets wider, paler and bluer) · transform ((x, y, i) => [x, y]) ·
 *     dir ([dx,dy,…] px or (i, x, y) => [dx, dy]; length = dab length, e.g. tangent × 8…20 or velocity × shutter) ·
 *     sv (stroke coords [s, v, …] from inkStroke, for 飞白) · dry (0..1 dry-brush 飞白 streaks along the stroke in
 *     dry stretches, 0) · grain (0..1 granulation into the paper tooth, 0.3) · rgbSplit (px) · k / floor (absorption
 *     law, default INK_K / INK_FLOOR) · count · seed
 *
 * inkStroke(key, svgPathD, { x, y, scale, width = 14, spacing = 2.5, rows = 6, pressure = 0.5, seed }) → InkStroke
 *   An SVG path (M L H V C S Q T Z; no arcs) placed at x + scale·px, y + scale·py, as a BRUSH STROKE: `rows` bristle
 *   tracks across `width` (gently wobbling, so dry-brush gaps run along the stroke), one particle every `spacing` px,
 *   and a pressure-modulated width (thick/thin like a 毛笔). Pure JS (no DOM), memoised, a few ms. Returns { n, rows, perRow
 *   (particle i rides track ⌊i / perRow⌋), length, closed, points, tangents, sv, at(s) → [x, y, tx, ty], widthAt(s),
 *   flow(i, ds) → particle i slid ds px along the stroke }. S09 figure (height 1150, feet at 1480):
 *     const k = 1150 / 1344, st = inkStroke('s09-human', HUMAN_PATH, { x: 540 - 300 * k, y: 1480 - 1402 * k,
 *       scale: k, width: 17, pressure: 0.75 });
 *     per frame, per particle: [x, y, tx, ty] = st.flow(i, speed[track] * t); pos = (x, y) + drift · A(w);
 *       dir = tangent × (6 + 12·g)  (g = w / 0.7);  then
 *     drawInkParticles(ctx, pos, { dir, alpha, sizes, sv: st.sv, size: 2.5, density: 0.24, dry: 0.7, halo: 0.5 })
 *   Readability rule (InkWash): at the peak gather (w = 0.7, never 1) keep the drift COHERENT and ≤ 8–10 px; the ink
 *   keeps flowing along the contour (16–40 px/s per track), so it is never a frozen outline nor un-diffusion.
 *
 * Colour law (display space; inkModel.ts):
 *   INK palette (paper #F4EEE2, paperLow #E3D9C6, air #2B2824, core #0A0B10, dilute #3C4A6A, text #17151C, em #2E4A7A)
 *   INK_K = [1.5, 1.3, 0.92] absorption per unit density · INK_FLOOR = transmittance floor (thick ink → INK.core)
 *   inkTransmittance(rho, k?, floor?) → [r,g,b] · inkColor(rho, paper?, alpha?, k?, floor?) → css ·
 *   inkDabRgb(k?) / INK_DAB_RGB (colour for multiply-painting under a law)
 *   Density reference on the light table: 0.1 faint tint · 0.55 haze #707A8E · 1 #3E4964 · 2.5 deep navy #10142A ·
 *   ≥ 5 → #0A0B10.
 *
 * Geometry: inkRipple(x, t, x0?, amp?) → surface displacement px (+ = down) · inkSurfaceY(x, impactAge, impactX?, …)
 *   inkRingsAt(age, { seed }) → the rings that EXIST at that age (vis > 0.01; unborn children are omitted), local px
 *   (origin = impact point, y = depth): { id (stable node id), gen (0 primary · 1 lobes · 2 grand-lobes), x, y, R, e,
 *   bellH, vis 0..1, … }. For framing, or for placing things relative to the lobes. inkImpactShake(age, px = 2) → [dx, dy].
 *
 * PERFORMANCE (SwiftShader, 1080×1920, measured with sequential renders on the 4-CPU box, InkPreview / InkWash):
 *   the empty finishing layers (grain + vignette + screenshot) alone ≈ 180–200 ms/frame. Full frames:
 *   young bell ≈ 300–340 ms · chandelier ≈ 370–410 ms · rewind with RGB split + spread 0.3 ≈ 410–440 ms · spread 1 ≈
 *   330 ms · InkWash (12.5k stroke dabs over the haze) ≈ 330–450 ms. Per-tab precompute (ring tree, ~150 filament drift tables,
 *   noise texture, inkStroke) < 150 ms. The GL density is scissored to the cascade's bounding box while spread = 0;
 *   filaments are bucketed into ~100 stroke calls. scripts/stills.mjs prints higher numbers, because every still
 *   boots a fresh page (≈ 750–900 ms even for the empty baseline).
 */
import React, { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { DrawInfo } from './Canvas';
import { WATER_LINE_Y } from './handoff';
import { clamp, memo, smoothstep } from './math';
import { hash01, mulberry32 } from './random';
import { makeNoise } from './noise';
import {
  DRIFT_DT,
  DRIFT_N,
  INK,
  INK_FLOOR,
  INK_K,
  InkRgb,
  inkDabRgb,
  inkFilaments,
  ringStatesAt,
  inkRipple,
  inkTree,
  parentDrift,
  ringState,
  InkRingState,
} from './inkModel';
import { INK_MAX_RINGS, InkGL, InkGLFrame } from './inkShader';

export { INK, INK_K, INK_FLOOR, INK_DAB_RGB, inkColor, inkDabRgb, inkTransmittance, inkRipple, inkRingsAt } from './inkModel';
export type { InkRingState, InkRgb } from './inkModel';

type Vec2 = [number, number];
const DEFAULT_ORIGIN: Vec2 = [540, 860];

/** Apply the shared camera push-in to a 2D context (draw in world px afterwards). */
function applyZoom(ctx: CanvasRenderingContext2D, zoom: number, o: Vec2) {
  if (zoom === 1) return;
  ctx.translate(o[0], o[1]);
  ctx.scale(zoom, zoom);
  ctx.translate(-o[0], -o[1]);
}

function hexRgb255(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Surface height (px) at x including ripples. */
export function inkSurfaceY(x: number, impactAge: number, impactX = 540, surfaceY = WATER_LINE_Y, amp = 1): number {
  return surfaceY + inkRipple(x, impactAge, impactX, amp);
}

/** 2 px camera shake right after impact (pure in age). */
export function inkImpactShake(age: number, px = 2): Vec2 {
  if (age <= 0 || age > 0.35) return [0, 0];
  const k = Math.exp(-age / 0.09) * px;
  return [Math.sin(age * 97) * k * 0.6, Math.sin(age * 131 + 1) * k];
}

/**
 * Like CanvasLayer, but the 2D context is created with willReadFrequently → CPU (Skia software) raster.
 * In headless SwiftShader rendering, GPU-emulated canvases are 10–30× slower for paths and gradients.
 */
const CpuCanvas: React.FC<{ draw: (ctx: CanvasRenderingContext2D, info: DrawInfo) => void; scale?: number; style?: React.CSSProperties }> = ({ draw, scale = 1, style }) => {
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx, { frame, fps, width: w, height: h, canvas: c });
  });
  return <canvas ref={ref} width={Math.round(w * scale)} height={Math.round(h * scale)} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, ...style }} />;
};

/** Offscreen canvas forced to CPU raster (see CpuCanvas). */
function cpu2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true })!;
}

// ═══════════════════════════════════════════ InkStage ═══════════════════════════════════════════
//
// Every full-frame composited layer costs ~150–200 ms CPU per frame in the SwiftShader compositor, while the
// drawing itself is cheap. <InkStage> gives all ink components ONE shared CPU canvas: children register draw
// callbacks during render and the stage replays them in mount (= JSX) order in its layout effect. The GL ink
// density stays one CSS-multiply layer above that canvas (reading WebGL back into 2D is far slower); filaments,
// InkCanvas particles etc. multiply into the canvas directly — Beer–Lambert is commutative, so the image is the same.

type InkDraw = (ctx: CanvasRenderingContext2D, info: DrawInfo) => void;
interface InkLayer {
  fn: InkDraw;
  z: number;
  front: boolean;
}
interface StageApi {
  id(): number;
  set(id: number, layer: InkLayer | null): void;
}
const StageCtx = React.createContext<StageApi | null>(null);

/** Default stage draw order (`z`): lower first. Ties fall back to mount order. */
export const INK_Z = { tank: 0, bloom: 10, canvas: 20, drop: 30, motes: 40 } as const;

/**
 * One shared CPU canvas for every ink component (+ the GL density as one multiply layer above it).
 * `front` (opt-in; true or a resolution scale such as 0.5) adds a second canvas ABOVE the ink for layers mounted with
 * `front` (foreground motes, a drop falling in front of the cloud): one extra full-frame composite (~the cost of an
 * empty layer). Without it, `front` layers are drawn into the main canvas (under the ink).
 */
export const InkStage: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties; front?: boolean | number }> = ({ children, style, front }) => {
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const fref = useRef<HTMLCanvasElement>(null);
  const reg = useRef<{ n: number; layers: Map<number, InkLayer> }>({ n: 0, layers: new Map() });
  const api = useMemo<StageApi>(
    () => ({
      id: () => reg.current.n++,
      set: (id, layer) => {
        if (layer) reg.current.layers.set(id, layer);
        else reg.current.layers.delete(id);
      },
    }),
    [],
  );
  const fScale = front ? (typeof front === 'number' ? front : 1) : 0;
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = cpu2d(c);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const fc = fref.current;
    const fctx = fc ? cpu2d(fc) : null;
    if (fctx && fc) {
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, fc.width, fc.height);
    }
    // order is a pure function of (z, mount id): deterministic in every render tab
    const ids = [...reg.current.layers.entries()].sort((a, b) => a[1].z - b[1].z || a[0] - b[0]);
    for (const [, layer] of ids) {
      const toFront = layer.front && fctx && fc;
      const tc = toFront ? fctx! : ctx;
      const canvas = toFront ? fc! : c;
      tc.save();
      tc.globalAlpha = 1;
      tc.globalCompositeOperation = 'source-over';
      tc.filter = 'none';
      if (toFront) tc.setTransform(fScale, 0, 0, fScale, 0, 0);
      layer.fn(tc, { frame, fps, width: w, height: h, canvas });
      tc.restore();
    }
  });
  // One isolated container: `style` (e.g. a shake transform) moves the stage canvas and the GL ink layer together,
  // and the ink's multiply only ever sees what the stage drew.
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, isolation: 'isolate', ...style }}>
      <canvas ref={ref} width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />
      <StageCtx.Provider value={api}>{children}</StageCtx.Provider>
      {fScale > 0 ? (
        <canvas
          ref={fref}
          width={Math.round(w * fScale)}
          height={Math.round(h * fScale)}
          style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, pointerEvents: 'none' }}
        />
      ) : null}
    </div>
  );
};

/** Registers `draw` with the enclosing <InkStage>; returns true when staged (the caller then renders nothing). */
function useInkLayer(draw: InkDraw, z: number, front = false): boolean {
  const stage = useContext(StageCtx);
  const id = useRef(-1);
  if (stage && id.current < 0) id.current = stage.id();
  if (stage) stage.set(id.current, { fn: draw, z, front });
  useLayoutEffect(
    () => () => {
      if (stage && id.current >= 0) stage.set(id.current, null);
    },
    [stage],
  );
  return !!stage;
}

// ═══════════════════════════════════════════ InkTank ═══════════════════════════════════════════

export interface InkTankProps {
  time: number;
  impactAge?: number;
  impactX?: number;
  surfaceY?: number;
  zoom?: number;
  zoomOrigin?: Vec2;
  light?: number;
  air?: number;
  bubbles?: number;
  hairline?: number;
  crown?: number;
  rippleAmp?: number;
  /** dim of the air above the surface (gradient + bokeh), default = `light` (the room goes dark with the table) */
  airLight?: number;
  /** 0..1 visible fraction of the hairline, centred on `hairlineX` (S09 ending: contracts to a point of light) */
  hairlineSpan?: number;
  /** centre of the contracting hairline (default impactX) */
  hairlineX?: number;
  /** water colour at the centre of the light table (default INK.paper; S09's inverted world: COSMOS.paper #F1EADB).
   *  Applied as a multiply tint of the light table, so each channel must be ≤ INK.paper's. */
  paper?: string;
  /** stage draw order (default INK_Z.tank) */
  z?: number;
  style?: React.CSSProperties;
}

interface Bokeh {
  x: number;
  y: number;
  r: number;
  a: number;
  c: [number, number, number];
  ph: number;
}
function bokehSet(): Bokeh[] {
  return memo('ink-bokeh', () => {
    const r = mulberry32(9127);
    const out: Bokeh[] = [];
    const warm: Array<[number, number, number]> = [
      [236, 190, 122],
      [244, 214, 168],
      [214, 150, 88],
      [250, 232, 200],
      [170, 182, 204],
    ];
    for (let i = 0; i < 17; i++) {
      out.push({
        x: r() * 1180 - 50,
        y: 30 + r() * 300,
        r: 16 + r() * r() * 58,
        a: 0.05 + r() * 0.13,
        c: warm[Math.floor(r() * (i < 3 ? 5 : 4))],
        ph: r() * 6.28,
      });
    }
    return out;
  });
}

interface Bubble {
  x: number;
  y0: number;
  r: number;
  v: number;
  ph: number;
  wob: number;
}
function bubbleSet(): Bubble[] {
  return memo('ink-bubbles', () => {
    const r = mulberry32(4441);
    const out: Bubble[] = [];
    for (let i = 0; i < 34; i++) {
      const rr = 0.9 + r() * r() * 4.2;
      out.push({ x: 40 + r() * 1000, y0: r() * 1600, r: rr, v: 6 + rr * 5 + r() * 6, ph: r() * 6.28, wob: 1 + r() * 4 });
    }
    return out;
  });
}

/** Static light-table gradients (cached): rows S−40 … H+60, columns −60 … W+60. */
function waterImage(W: number, H: number, S: number): HTMLCanvasElement {
  return memo(`ink-water:${W}:${H}:${S}`, () => {
    const c = document.createElement('canvas');
    c.width = W + 120;
    c.height = Math.max(1, Math.round(H + 100 - S));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.translate(60, 40 - S); // draw in frame coordinates
    const wg = ctx.createLinearGradient(0, S, 0, H);
    wg.addColorStop(0, '#F7F2E8');
    wg.addColorStop(0.3, INK.paper);
    wg.addColorStop(0.7, '#ECE4D4');
    wg.addColorStop(1, INK.paperLow);
    ctx.fillStyle = wg;
    ctx.fillRect(-60, S - 40, W + 120, H + 100 - S);
    // hot spot of the diffuser behind the bloom and gentle falloff to the sides
    const rg = ctx.createRadialGradient(540, S + 520, 40, 540, S + 520, 1150);
    rg.addColorStop(0, 'rgba(255,253,247,0.42)');
    rg.addColorStop(0.5, 'rgba(255,251,242,0.12)');
    rg.addColorStop(1, 'rgba(255,251,242,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(-60, S - 40, W + 120, H + 100 - S);
    const sg = ctx.createLinearGradient(-60, 0, W + 60, 0);
    sg.addColorStop(0, 'rgba(150,128,96,0.16)');
    sg.addColorStop(0.2, 'rgba(150,128,96,0)');
    sg.addColorStop(0.8, 'rgba(150,128,96,0)');
    sg.addColorStop(1, 'rgba(150,128,96,0.16)');
    ctx.fillStyle = sg;
    ctx.fillRect(-60, S - 40, W + 120, H + 100 - S);
    return c;
  });
}

/** Static air gradient (cached): rows −60 … S+30. */
function airImage(W: number, S: number): HTMLCanvasElement {
  return memo(`ink-air:${W}:${S}`, () => {
    const c = document.createElement('canvas');
    c.width = W + 120;
    c.height = Math.max(1, Math.round(S + 90));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const g = ctx.createLinearGradient(0, Math.max(0, S + 60 - 420), 0, S + 60);
    g.addColorStop(0, '#141210');
    g.addColorStop(0.75, '#25221E');
    g.addColorStop(1, '#2F2B26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  });
}

type TankP = Required<Omit<InkTankProps, 'style' | 'z'>>;
function drawTank(ctx: CanvasRenderingContext2D, p: TankP, W: number, H: number) {
  const { time, impactAge, impactX, surfaceY: S, light, air, bubbles, hairline, crown, rippleAmp } = p;
  const AL = clamp(p.airLight);
  ctx.save();
  applyZoom(ctx, p.zoom, p.zoomOrigin);
  // generous bleed so zoom-outs/shake never reveal edges
  const X0 = -60,
    X1 = W + 60,
    Y0 = -60,
    Y1 = H + 60;
  const surf = (x: number) => S + inkRipple(x, impactAge, impactX, rippleAmp);
  const L = clamp(light);

  // ── water (below): backlit light table — static gradients cached once, one blit per frame
  if (S < Y1) {
    ctx.drawImage(waterImage(W, H, S), X0, S - 40);
    if (p.paper.toUpperCase() !== INK.paper) {
      // another paper (e.g. S09's #F1EADB): multiply-tint the light table by paper / INK.paper per channel
      const a = hexRgb255(p.paper),
        b = hexRgb255(INK.paper);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${a.map((v, i) => Math.round(255 * Math.min(1, v / b[i]))).join(',')})`;
      ctx.fillRect(X0, S - 40, X1 - X0, Y1 - S + 40);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (L < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - L})`;
      ctx.fillRect(X0, S - 40, X1 - X0, Y1 - S + 40);
    }
  }

  // ── air (above): dim warm, darker towards the top, bokeh, faint glow just above the waterline
  if (S > Y0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X0, Y0);
    ctx.lineTo(X1, Y0);
    for (let x = X1; x >= X0; x -= 4) ctx.lineTo(x, surf(x));
    ctx.closePath();
    ctx.clip();
    if (AL >= 1) ctx.drawImage(airImage(W, S), X0, Y0);
    else if (AL > 0) {
      // dimmed in ONE pass (a black overlay through the same anti-aliased clip would leave a faint seam at the line)
      const g = ctx.createLinearGradient(0, Math.max(0, S + 60 - 420) + Y0, 0, S + 60 + Y0);
      const dim = (r: number, gg: number, b: number) => `rgb(${Math.round(r * AL)},${Math.round(gg * AL)},${Math.round(b * AL)})`;
      g.addColorStop(0, dim(0x14, 0x12, 0x10));
      g.addColorStop(0.75, dim(0x25, 0x22, 0x1e));
      g.addColorStop(1, dim(0x2f, 0x2b, 0x26));
      ctx.fillStyle = g;
      ctx.fillRect(X0, Y0, X1 - X0, S - Y0 + 30);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(X0, Y0, X1 - X0, S - Y0 + 30);
    }
    if (air * AL > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const b of bokehSet()) {
        const by = S - 360 + b.y + Math.sin(time * 0.21 + b.ph) * 4;
        const bx = b.x + Math.sin(time * 0.13 + b.ph * 2) * 6;
        const a = b.a * air * AL * (0.85 + 0.15 * Math.sin(time * 0.7 + b.ph));
        const [cr, cg, cb] = b.c;
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
        rg.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.55})`);
        rg.addColorStop(0.82, `rgba(${cr},${cg},${cb},${a * 0.7})`);
        rg.addColorStop(0.95, `rgba(${cr},${cg},${cb},${a})`);
        rg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // warm light spilling up from the light table just above the surface
      const gl = ctx.createLinearGradient(0, S - 70, 0, S + 10);
      gl.addColorStop(0, 'rgba(255,226,180,0)');
      gl.addColorStop(1, `rgba(255,226,180,${0.1 * air * L * AL})`);
      ctx.fillStyle = gl;
      ctx.fillRect(X0, S - 70, X1 - X0, 90);
    }
    ctx.restore();
  }

  // ── micro-bubbles (behind the ink): dark rim, bright core — backlit bubbles
  if (bubbles > 0 && L > 0.05) {
    const span = Math.max(200, H - S - 40);
    for (const b of bubbleSet()) {
      const yy = S + 30 + ((((b.y0 - b.v * time) % span) + span) % span);
      const xx = b.x + Math.sin(time * 1.3 + b.ph) * b.wob;
      const fadeTop = smoothstep(S + 30, S + 90, yy) * smoothstep(H + 10, H - 120, yy);
      const a = bubbles * fadeTop * L;
      if (a <= 0.01) continue;
      drawBubble(ctx, xx, yy, b.r, a);
    }
    // bubbles entrained by the impact: they rise back to the surface and pop
    if (impactAge > 0 && impactAge < 2.2) {
      const rr = mulberry32(77);
      for (let i = 0; i < 7; i++) {
        const dx = (rr() - 0.5) * 50;
        const d0 = 14 + rr() * 34;
        const rad = 0.9 + rr() * 2.2;
        const vy = 22 + rad * 18 + rr() * 10;
        const t0 = 0.05 + rr() * 0.12;
        const tt = impactAge - t0;
        if (tt <= 0) continue;
        const depth = d0 * Math.min(1, tt / 0.12) - vy * Math.max(0, tt - 0.12);
        if (depth < 2) continue;
        drawBubble(ctx, impactX + dx + Math.sin(tt * 9 + i) * 1.5, S + depth, rad, bubbles * L * 0.9);
      }
    }
  }

  // ── surface hairline: total-internal-reflection band below, dark meniscus line, bright silver line
  const span = clamp(p.hairlineSpan);
  const hcx = p.hairlineX;
  const hw = span >= 1 ? Infinity : span * (Math.max(hcx - X0, X1 - hcx) + 40);
  if (hairline > 0 && S > Y0 && S < Y1 && hw < 2.5) {
    // contracted to a point of light (S09's last frames)
    const y = surf(hcx);
    const k = hairline * (0.55 + 0.45 * (hw / 2.5));
    const g = ctx.createRadialGradient(hcx, y, 0, hcx, y, 9);
    g.addColorStop(0, `rgba(255,248,232,${0.95 * k})`);
    g.addColorStop(0.25, `rgba(255,240,214,${0.35 * k})`);
    g.addColorStop(1, 'rgba(255,236,206,0)');
    ctx.fillStyle = g;
    ctx.fillRect(hcx - 10, y - 10, 20, 20);
  } else if (hairline > 0 && S > Y0 && S < Y1) {
    const xa = Math.max(X0, hcx - hw),
      xb = Math.min(X1, hcx + hw);
    const pts: number[] = [];
    for (let x = xa; x < xb; x += 3) pts.push(x, surf(x));
    pts.push(xb, surf(xb));
    // contracting line: alpha fades out over its last ~90 px (soft ends that slide inward)
    const ends = Number.isFinite(hw) ? Math.min(90, hw * 0.8) : 0;
    const col = (r: number, g: number, b: number, a: number): string | CanvasGradient => {
      if (!ends) return `rgba(${r},${g},${b},${a})`;
      const gr = ctx.createLinearGradient(xa, 0, xb, 0);
      const e = ends / Math.max(1, xb - xa);
      gr.addColorStop(0, `rgba(${r},${g},${b},0)`);
      gr.addColorStop(Math.min(0.5, e), `rgba(${r},${g},${b},${a})`);
      gr.addColorStop(Math.max(0.5, 1 - e), `rgba(${r},${g},${b},${a})`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      return gr;
    };
    const path = (dy: number) => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        if (i === 0) ctx.moveTo(pts[i], pts[i + 1] + dy);
        else ctx.lineTo(pts[i], pts[i + 1] + dy);
      }
    };
    const hl = hairline;
    // TIR mirror band (underside of the surface seen at grazing angle) — a slightly brighter strip
    const band = ctx.createLinearGradient(0, S, 0, S + 26);
    band.addColorStop(0, `rgba(255,255,252,${0.38 * hl * L})`);
    band.addColorStop(1, 'rgba(255,255,252,0)');
    ctx.fillStyle = band;
    if (ends) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(xa + ends * 0.5, S - 40, Math.max(0, xb - xa - ends), 80);
      ctx.clip();
    }
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(pts[i], pts[i + 1]);
      else ctx.lineTo(pts[i], pts[i + 1]);
    }
    for (let i = pts.length - 2; i >= 0; i -= 2) ctx.lineTo(pts[i], pts[i + 1] + 26);
    ctx.closePath();
    ctx.fill();
    if (ends) ctx.restore();
    // soft glow above the line
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = col(255, 236, 206, 0.07 * hl);
    ctx.lineWidth = 9;
    path(-1);
    ctx.stroke();
    ctx.strokeStyle = col(255, 240, 218, 0.12 * hl);
    ctx.lineWidth = 3.5;
    path(-0.5);
    ctx.stroke();
    // dark meniscus edge
    ctx.strokeStyle = col(52, 46, 40, 0.42 * hl * Math.max(0.3, L));
    ctx.lineWidth = 1.6;
    path(1.8);
    ctx.stroke();
    // the silver hairline itself, with highlights on ripple crests
    ctx.strokeStyle = col(250, 247, 240, 0.92 * hl);
    ctx.lineWidth = 1.15;
    path(0);
    ctx.stroke();
    if (impactAge > 0 && impactAge < 4) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,250,240,${0.5 * hl})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 2; i < pts.length - 2; i += 2) {
        const slope = (pts[i + 3] - pts[i - 1]) / 6;
        if (slope < -0.12) {
          ctx.moveTo(pts[i - 2], pts[i - 1] - 0.4);
          ctx.lineTo(pts[i + 2], pts[i + 3] - 0.4);
        }
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ── crown splash + Worthington jet: thin water sheets lit from below by the light table
  if (crown > 0 && impactAge > 0 && impactAge < 0.9) drawCrown(ctx, impactAge, impactX, S, crown);
  ctx.restore();
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(48,52,64,${0.5 * a})`;
  ctx.lineWidth = Math.min(1.1, 0.35 + r * 0.25);
  ctx.stroke();
  if (r > 1.6) {
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrown(ctx: CanvasRenderingContext2D, t: number, x0: number, S: number, k: number) {
  const g = 900;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // crown sheet: a thin water wall flaring outward, lit from below by the light table. Side view: a faint
  // translucent body, bright edges where we look along the sheet, and a rim breaking into jets tipped by beads.
  const ct = t / 0.32;
  if (ct < 1) {
    const life = Math.sin(Math.PI * Math.pow(ct, 0.75));
    const h = 22 * life * k;
    const w = 9 + 26 * Math.sqrt(ct);
    const top = w * (1.25 + 0.9 * ct); // half-width of the rim: the sheet opens like a tulip
    ctx.lineCap = 'round';
    const wall = (sgn: number) => {
      ctx.moveTo(x0 + sgn * w, S + 1);
      ctx.bezierCurveTo(x0 + sgn * w * 0.98, S - h * 0.45, x0 + sgn * (w + top) * 0.5, S - h * 0.85, x0 + sgn * top, S - h);
    };
    const grd = ctx.createLinearGradient(0, S - h, 0, S);
    grd.addColorStop(0, `rgba(255,250,240,${0.22 * k})`);
    grd.addColorStop(1, 'rgba(255,250,240,0.03)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    wall(-1);
    ctx.lineTo(x0 + top, S - h);
    ctx.bezierCurveTo(x0 + (w + top) * 0.5, S - h * 0.85, x0 + w * 0.98, S - h * 0.45, x0 + w, S + 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255,252,244,${0.8 * k * life})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    wall(-1);
    wall(1);
    ctx.stroke();
    // rim: near half brighter than the far half, broken into short jets with beads
    ctx.strokeStyle = `rgba(255,250,240,${0.28 * k * life})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(x0, S - h, top, Math.max(1, top * 0.14), 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,252,244,${0.55 * k * life})`;
    ctx.beginPath();
    ctx.ellipse(x0, S - h, top, Math.max(1, top * 0.14), 0, 0, Math.PI);
    ctx.stroke();
    const rr = mulberry32(57);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rr() * 0.4;
      const bx = x0 + Math.cos(a) * top;
      const by = S - h + Math.sin(a) * top * 0.14;
      const jl = (2 + rr() * 6) * Math.sin(Math.PI * Math.min(1, ct * 1.3)) * k;
      const lean = Math.cos(a) * 0.5;
      const front = Math.sin(a) > 0 ? 1 : 0.5;
      ctx.strokeStyle = `rgba(255,252,244,${0.6 * front * k})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + lean * jl, by - jl);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,253,248,${0.9 * front * k})`;
      ctx.beginPath();
      ctx.arc(bx + lean * jl, by - jl, 0.9 + rr() * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // ejected droplets (ballistic)
  const rr = mulberry32(31);
  for (let i = 0; i < 8; i++) {
    const t0 = 0.04 + rr() * 0.08;
    const vx = (rr() < 0.5 ? -1 : 1) * (50 + rr() * 110);
    const vy = 150 + rr() * 140;
    const rad = 1.1 + rr() * 1.8;
    const tt = t - t0;
    if (tt <= 0) continue;
    const xx = x0 + Math.sign(vx) * 22 + vx * tt;
    const yy = S - 20 - vy * tt + 0.5 * g * tt * tt;
    if (yy > S) continue;
    ctx.fillStyle = `rgba(250,244,232,${0.9 * k})`;
    ctx.beginPath();
    ctx.arc(xx, yy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(30,32,44,${0.55 * k})`;
    ctx.beginPath();
    ctx.arc(xx + rad * 0.15, yy + rad * 0.2, rad * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Worthington jet after the crater collapses, with a pinched-off droplet
  const jt = (t - 0.2) / 0.5;
  if (jt > 0 && jt < 1) {
    const h = 34 * Math.sin(Math.PI * jt) * k;
    const w = 3.2;
    const grd = ctx.createLinearGradient(0, S - h, 0, S);
    grd.addColorStop(0, 'rgba(244,238,226,0.9)');
    grd.addColorStop(1, 'rgba(244,238,226,0.3)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x0 - w * 2.2, S + 1);
    ctx.quadraticCurveTo(x0 - w, S - h * 0.4, x0 - w * 0.6, S - h);
    ctx.arc(x0, S - h, w * 0.6, Math.PI, 0);
    ctx.quadraticCurveTo(x0 + w, S - h * 0.4, x0 + w * 2.2, S + 1);
    ctx.closePath();
    ctx.fill();
    // tiny ink core in the jet
    ctx.fillStyle = `rgba(20,22,32,${0.5 * k})`;
    ctx.fillRect(x0 - 0.6, S - h * 0.85, 1.2, h * 0.8);
    if (jt > 0.35) {
      const dt = (jt - 0.35) * 0.5;
      const dy = S - h - 6 - 60 * dt + 0.5 * g * dt * dt;
      if (dy < S - 2) {
        ctx.fillStyle = `rgba(250,244,232,${0.95 * k})`;
        ctx.beginPath();
        ctx.arc(x0, dy, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(16,18,26,${0.6 * k})`;
        ctx.beginPath();
        ctx.arc(x0 + 0.3, dy + 0.5, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

export const InkTank: React.FC<InkTankProps> = (props) => {
  const p: TankP = {
    time: props.time,
    impactAge: props.impactAge ?? -1,
    impactX: props.impactX ?? 540,
    surfaceY: props.surfaceY ?? WATER_LINE_Y,
    zoom: props.zoom ?? 1,
    zoomOrigin: props.zoomOrigin ?? DEFAULT_ORIGIN,
    light: props.light ?? 1,
    air: props.air ?? 1,
    bubbles: props.bubbles ?? 1,
    hairline: props.hairline ?? 1,
    crown: props.crown ?? 1,
    rippleAmp: props.rippleAmp ?? 1,
    airLight: props.airLight ?? props.light ?? 1,
    hairlineSpan: props.hairlineSpan ?? 1,
    hairlineX: props.hairlineX ?? props.impactX ?? 540,
    paper: props.paper ?? INK.paper,
  };
  const draw: InkDraw = (ctx, { width, height }) => drawTank(ctx, p, width, height);
  return useInkLayer(draw, props.z ?? INK_Z.tank) ? null : <CpuCanvas style={props.style} draw={draw} />;
};

// ═══════════════════════════════════════════ InkBloom ═══════════════════════════════════════════

export interface InkBloomProps {
  age: number;
  x?: number;
  surfaceY?: number;
  spread?: number;
  haze?: number;
  rgbSplit?: number;
  seed?: number;
  scale?: number;
  zoom?: number;
  zoomOrigin?: Vec2;
  opacity?: number;
  filaments?: boolean;
  res?: number;
  /** absorption law (per-channel optical depth per unit density); default INK_K. S09: COSMOS_INK_K. */
  k?: InkRgb;
  /** transmittance floor; default INK_FLOOR. S09: COSMOS_INK_FLOOR. */
  floor?: InkRgb;
  /** stage draw order of the filaments (default INK_Z.bloom); the GL density is always the multiply layer on top */
  z?: number;
  style?: React.CSSProperties;
}

type BloomP = Required<Omit<InkBloomProps, 'style' | 'z'>>;

/** Cumulative advection (displacement since birth, chained through parents) for the texture frame. */
function advections(seed: number, t: number): Float32Array {
  // adv_i(t) = c_i(t) − c_i(birth) + adv_parent(birth): the texture coordinate q = p − adv is then constant at a
  // ring's centre and continuous across a split, so detail rides with the ink instead of sliding through it.
  const nodes = inkTree({ seed });
  const adv = (id: number, tt: number): Vec2 => {
    const n = nodes[id];
    const now = ringState(n, nodes, tt);
    if (n.gen === 0) return [now.x, now.y];
    const tb = n.tBirth;
    const born = ringState(n, nodes, tb);
    const pa = adv(n.parent, tb);
    return [now.x - born.x + pa[0], now.y - born.y + pa[1]];
  };
  const out = new Float32Array(nodes.length * 2);
  for (const n of nodes) {
    const a = adv(n.id, t);
    out[n.id * 2] = a[0];
    out[n.id * 2 + 1] = a[1];
  }
  return out;
}

function buildFrame(p: BloomP, W: number, H: number): InkGLFrame {
  const age = Math.max(0, p.age);
  const rings = ringStatesAt(age, { seed: p.seed }); // all nodes, indexed by id (unborn ones have vis = 0)
  const adv = advections(p.seed, age);
  const n = Math.min(INK_MAX_RINGS, rings.length);
  const A = new Float32Array(INK_MAX_RINGS * 4);
  const B = new Float32Array(INK_MAX_RINGS * 4);
  const C = new Float32Array(INK_MAX_RINGS * 4);
  const D = new Float32Array(INK_MAX_RINGS * 4);
  const E = new Float32Array(INK_MAX_RINGS * 4);
  const F = new Float32Array(INK_MAX_RINGS * 4);
  for (let i = 0; i < n; i++) {
    const r = rings[i];
    A.set([r.x, r.y, r.R, r.e], i * 4);
    B.set([r.tilt, r.core, r.width, r.cap], i * 4);
    C.set([r.ax, r.ay, r.stemW, r.stemS], i * 4);
    D.set([r.halo, r.haloR, r.lobeAmp, r.lobePhase], i * 4);
    E.set([r.lobeN, r.bound, adv[i * 2], adv[i * 2 + 1]], i * 4);
    F.set([r.bellH, r.bow, r.crisp, 0], i * 4);
  }
  const root = rings[0];
  const sp = clamp(p.spread);
  const haloR = 40 + 62 * Math.sqrt(age);
  const warpA = (4 + 9 * Math.sqrt(age)) * (1 + 4 * sp);
  const warpB = (2 + 2.6 * Math.sqrt(age)) * (1 + sp);
  const haloC = root ? root.y * 0.8 : 0;
  // the sheet-fold texture grows in with age: the young ring is a clean glossy torus under a translucent dome
  const sheetK = (1 - sp) * (0.18 + 0.82 * smoothstep(0.9, 2.6, age));
  // ring-borne density fades out in the shader over spread 0.8 → 0.995 (ringK); only then is the loop skipped
  const ringsLive = p.age > 0 && sp < 0.995;
  // bounding box of everything with visible density (local px, widened by the spread). Outside it the shader only
  // evaluates the haze; with no spread the density pass is also scissored to it (screen px).
  let bbox: [number, number, number, number] | null = null;
  let bb: [number, number, number, number] = [0, 0, 0, 0];
  if (n > 0 && p.age > 0) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    const add = (cx: number, cy: number, rx: number, ry: number) => {
      x0 = Math.min(x0, cx - rx);
      x1 = Math.max(x1, cx + rx);
      y0 = Math.min(y0, cy - ry);
      y1 = Math.max(y1, cy + ry);
    };
    const sw = 1 + 4 * sp;
    const m = warpA * 0.6 + warpB + 6;
    for (let i = 0; i < n; i++) {
      const r = rings[i];
      const rad = Math.max(2.65 * r.haloR, r.bound) * sw + m;
      add(r.x, r.y, rad, rad);
      const pad = r.stemW * 3 * sw + Math.abs(r.bow) + m;
      add(r.x, r.y - r.bellH, pad, pad);
      add(r.ax, r.ay, pad, pad);
    }
    add(0, haloC, 2.2 * haloR * 1.2 + m, 2.2 * haloR + m);
    bb = [x0, Math.max(y0, -4), x1, y1];
    if (sp <= 0.001) {
      const toScr = (lx: number, ly: number): Vec2 => [
        p.zoomOrigin[0] + (p.x + lx * p.scale - p.zoomOrigin[0]) * p.zoom,
        p.zoomOrigin[1] + (p.surfaceY + ly * p.scale - p.zoomOrigin[1]) * p.zoom,
      ];
      const a = toScr(bb[0], bb[1]);
      const b = toScr(bb[2], bb[3]);
      bbox = [a[0], a[1], b[0], b[1]];
    }
  }
  return {
    view: [W, H],
    cam: [p.zoom, p.zoomOrigin[0], p.zoomOrigin[1], Math.max(0, p.rgbSplit)],
    org: [p.x, p.surfaceY, p.scale, (p.seed % 97) + 0.5],
    t: [age, sp, ringsLive ? n : 0, p.haze],
    // the advected texture frame stays alive up to spread = 1 (6 cheap Gaussians) so the haze never jumps
    warp: [warpA, warpB * 0.8, sheetK, p.age > 0 ? Math.min(n, 6, 1 + inkTree({ seed: p.seed }).filter((q) => q.gen === 1).length) : 0],
    halo: [0, haloC, haloR, 0.14 * (1 - Math.exp(-age / 2))],
    bb,
    A,
    B,
    C,
    D,
    E,
    F,
    split: p.rgbSplit / W,
    opacity: p.age > 0 || sp > 0 ? p.opacity : 0,
    k: p.k,
    floor: p.floor,
    bbox: n > 0 || sp > 0 ? bbox : [0, 0, 0, 0],
  };
}

/**
 * Streak-line filaments (full-res, multiply). Each thread is stroked twice: a wide faint "body" (the dye diffusing
 * sideways) and a thin crisp line, both tapering in alpha from the fresh end at the ring to the old end. Tethers
 * keep ONE crisp lead thread; their other threads only add body (no parallel 'cables'). Wisps and windings of the
 * primary grow in after ~1 s (the young ring is a clean torus), and every thread softens and fades as (1 − spread)⁴.
 */
function drawFilaments(ctx: CanvasRenderingContext2D, p: BloomP, info: DrawInfo) {
  const age = p.age;
  const sp = clamp(p.spread);
  const fade = Math.pow(1 - sp, 4) * p.opacity;
  if (age <= 0.02 || fade < 0.004) return;
  const nodes = inkTree({ seed: p.seed });
  const fils = inkFilaments({ seed: p.seed });
  const noise = makeNoise(p.seed + 101);
  // per ring: state history on a uniform grid over its life; threads interpolate into it
  const K = 40;
  type Hist = { t0: number; dt: number; x: Float32Array; y: Float32Array; R: Float32Array; e: Float32Array; now: InkRingState; pd: Vec2 };
  const hist: Array<Hist | null> = nodes.map((n) => {
    const t0 = Math.max(n.tBirth - 0.15, 0.001);
    if (age <= t0) return null;
    const dt = (age - t0) / (K - 1);
    const h: Hist = {
      t0, dt, x: new Float32Array(K), y: new Float32Array(K), R: new Float32Array(K), e: new Float32Array(K),
      now: ringState(n, nodes, age), pd: parentDrift(n, nodes, age),
    };
    for (let j = 0; j < K; j++) {
      const st = ringState(n, nodes, t0 + dt * j);
      h.x[j] = st.x;
      h.y[j] = st.y;
      h.R[j] = st.R;
      h.e[j] = st.e;
    }
    return h;
  });
  // Geometry is appended to Path2D BUCKETS keyed by (alpha level, width key) — alpha quantised in 8 % log steps
  // (imperceptible), so ~100 stroke calls instead of one per thread segment class (canvas call overhead dominates
  // in this renderer) — then stroked in 1 pass (or 3 per-channel passes for the RGB split).
  const buckets = new Map<number, { path: Path2D; a: number; w: number }>();
  const LQ = Math.log(1.08);
  const bucket = (al: number, wKey: number, w: number): Path2D => {
    const lev = Math.round(Math.log(Math.min(1, al)) / LQ);
    const key = lev * 64 + wKey;
    let b = buckets.get(key);
    if (!b) {
      b = { path: new Path2D(), a: Math.exp(lev * LQ), w };
      buckets.set(key, b);
    }
    return b.path;
  };
  const lw = (0.85 / Math.max(0.5, p.scale * p.zoom)) * (1 + 2.5 * sp);
  // alpha / width per [kind][age class]: class 0 = fresh (at the ring) … 3 = oldest
  const CA = [
    [0.4, 0.27, 0.16, 0.08],
    [0.13, 0.08, 0.04, 0.015],
    [0.075, 0.05, 0.03, 0.012],
  ];
  const CW = [1.0, 1.08, 1.22, 1.4];
  const spreadAmp = 1 + 5 * sp;
  const young = smoothstep(0.9, 1.7, age); // primary: wisps / windings / extra ribs grow in after the first second
  const xs = new Float32Array(32),
    ys = new Float32Array(32),
    cs = new Uint8Array(32);
  for (let k = 0; k < fils.length; k++) {
    const f = fils[k];
    const h = hist[f.ring];
    if (!h) continue;
    const node = nodes[f.ring];
    let ta = h.now.vis * f.alpha;
    if (node.gen === 0 && f.kind !== 0) ta *= f.kind === 1 ? young : smoothstep(0.7, 1.6, age);
    // wisps and windings grow out of a ring as it appears (tethers already grow from zero length at birth)
    if (f.kind !== 0) ta *= smoothstep(0.3, 0.6, h.now.vis);
    // tethers of the lobes: one crisp lead thread; the others only widen its body
    const lead = f.kind !== 0 || node.gen === 0 || f.rank === 0;
    if (!lead) ta *= 0.55;
    if (ta * fade < 0.02) continue;
    const tilt = h.now.tilt;
    const ct = Math.cos(tilt),
      snt = Math.sin(tilt);
    const cphi = Math.cos(f.phi),
      sphi = Math.sin(f.phi);
    const rim = (x: number, y: number, R: number, e: number): Vec2 => {
      const RR = R * (1 + f.off);
      const lx = RR * cphi;
      const ly = e * RR * sphi + f.lift * R * (0.62 + 0.5 * e);
      return [x + lx * ct - ly * snt, y + lx * snt + ly * ct];
    };
    const rn = h.now;
    const now = rim(rn.x, rn.y, rn.R, rn.e);
    const tStart = Math.max(h.t0, age - f.win * (f.kind === 0 ? 1 : smoothstep(0.3, 1, h.now.vis)));
    const M = f.kind === 0 ? 30 : 16;
    for (let j = 0; j < M; j++) {
      const u = j / (M - 1);
      const tau = tStart + (age - tStart) * (1 - Math.pow(1 - u, 1.5));
      const s = Math.max(0, age - tau); // seconds since this parcel was shed
      const gi = clamp((tau - h.t0) / h.dt, 0, K - 1.0001);
      const i0 = Math.floor(gi),
        a = gi - i0;
      const L = (arr: Float32Array) => arr[i0] + (arr[i0 + 1] - arr[i0]) * a;
      const shed = rim(L(h.x), L(h.y), L(h.R), L(h.e));
      // captured parcels orbit the core in the ring's cross-section, riding with the ring
      const cap = Math.exp(-s / f.capS);
      const th = f.omega * s + f.phi * 3;
      const orb = f.kind === 0 ? 0 : Math.min(rn.width * f.orbK, 2 + s * 18);
      const ox = orb * Math.cos(th) * cphi;
      const oy = -orb * Math.sin(th) + rn.e * orb * Math.cos(th) * sphi;
      const [dx, dy] = driftAtLocal(f.drift, s);
      let x = shed[0] * (1 - cap) + (now[0] + ox) * cap + dx * spreadAmp;
      let y = shed[1] * (1 - cap) + (now[1] + oy) * cap + dy * spreadAmp;
      if (f.kind === 0) {
        const hh = clamp(s / Math.max(0.05, age - h.t0));
        if (node.gen === 0) x += rn.bow * Math.sin(Math.PI * hh);
        else {
          // the far end of a tether follows the parent's drift since the split
          x += h.pd[0] * hh;
          y += h.pd[1] * hh;
        }
      }
      if (s > 0.8) {
        const am = Math.min(1, (s - 0.8) / 4) * 6 * spreadAmp;
        x += noise.n2(x * 0.008 + f.ring * 3.1, y * 0.008) * am;
        y += noise.n2(y * 0.008 - f.ring * 1.3, x * 0.008) * am * 0.5;
      }
      if (y < 1.5) y = 1.5;
      // wisps thin out (and fade) faster than the stems
      const sAge = f.kind === 0 ? s : s * 2.2;
      xs[j] = x;
      ys[j] = y;
      cs[j] = sAge < 0.5 ? 0 : sAge < 1.4 ? 1 : sAge < 3 ? 2 : 3;
    }
    // stroke per age class: body pass (wide, faint) then the crisp thread
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1 && !lead) break;
      for (let c = 0; c < 4; c++) {
        const al = CA[f.kind][c] * ta * fade * (pass === 0 ? 0.2 : 1);
        if (al < 0.004) continue;
        let open = false;
        const wk = c * 3 + (pass === 0 ? 0 : f.kind === 0 ? 1 : 2);
        const path = bucket(al, wk, lw * CW[c] * (pass === 0 ? 3.6 : f.kind === 0 ? 1 : 0.85));
        for (let j = 1; j < M; j++) {
          if (cs[j] !== c && cs[j - 1] !== c) {
            open = false;
            continue;
          }
          if (!open) path.moveTo(xs[j - 1], ys[j - 1]);
          path.lineTo(xs[j], ys[j]);
          open = true;
        }
      }
    }
  }
  // ribs: meridional dye striations on each bell (the 'jellyfish' look), riding with the ring. The young primary has
  // only a few long smooth meridians (a clean translucent dome); the rest grow in towards the split.
  for (const n of nodes) {
    const h = hist[n.id];
    if (!h) continue;
    const st = h.now;
    const genK = n.gen === 0 ? 1 : n.gen === 1 ? 0.62 : 0.4;
    const k = clamp(st.cap / (0.5 * genK));
    if (k < 0.08) continue;
    const mature = n.gen === 0 ? smoothstep(1.3, 2.5, age) : 1;
    const nR = n.gen === 0 ? 30 : n.gen === 1 ? 15 : 9;
    const baseA = (k > 0.55 ? 0.12 : 0.065) * fade;
    const ct = Math.cos(st.tilt),
      snt = Math.sin(st.tilt);
    const nAmp = 0.6 + (2.5 * (1 + age * 0.2) - 0.6) * mature;
    for (let r = 0; r < nR; r++) {
      const primary = n.gen > 0 || r % 5 === 0 || r % 5 === 2;
      const ra = baseA * (primary ? 0.5 + 0.5 * mature : mature);
      if (ra < 0.004) continue;
      const phi = (Math.PI * 2 * r) / nR + 0.12 * age + (hash01(r, n.id + 40) - 0.5) * 0.25 + n.lobePhase;
      const cphi = Math.cos(phi),
        sphi = Math.sin(phi);
      const len = 1 - (1 - (0.55 + 0.45 * hash01(r, n.id + 90))) * mature;
      const thMax = Math.PI * 0.5 * (1 - mature) + Math.PI * 0.62 * (0.75 + 0.25 * len) * mature;
      const path = bucket(ra, 63, lw * 0.75);
      for (let j = 0; j <= 9; j++) {
        const th = (j / 9) * thMax + (1 - len) * 0.5;
        const rx = st.R * 1.06 * Math.min(1, Math.sin(th) * 1.02);
        let lx = rx * cphi;
        let ly = -st.bellH * Math.cos(th) + st.e * rx * sphi;
        lx += noise.n2(r * 1.7 + j * 0.21, n.id * 3.3 + age * 0.3) * nAmp;
        ly += noise.n2(r * 2.3 - j * 0.17, n.id * 1.9 - age * 0.3) * nAmp * 0.6;
        const x = st.x + lx * ct - ly * snt;
        const y = st.y + lx * snt + ly * ct;
        if (j === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
    }
  }
  // RGB split (time tampering): under multiply a stroke coloured (r, 255, 255) only darkens the red channel, so three
  // offset per-channel passes ARE the split — no offscreen buffer, no full-frame blits; identical to 1 pass at 0 px
  const [dr, dg, db] = inkDabRgb(p.k);
  const split = p.rgbSplit;
  const passes: Array<[number, string]> =
    split > 0.05
      ? [
          [split, `rgb(${dr},255,255)`],
          [0, `rgb(255,${dg},255)`],
          [-split, `rgb(255,255,${db})`],
        ]
      : [[0, `rgb(${dr},${dg},${db})`]];
  for (const [off, colour] of passes) {
    ctx.save();
    ctx.translate(off, 0);
    applyZoom(ctx, p.zoom, p.zoomOrigin);
    ctx.translate(p.x, p.surfaceY);
    ctx.scale(p.scale, p.scale);
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colour;
    for (const b of buckets.values()) {
      ctx.globalAlpha = b.a;
      ctx.lineWidth = b.w;
      ctx.stroke(b.path);
    }
    ctx.restore();
  }
}

function driftAtLocal(d: Float32Array, s: number): Vec2 {
  const u = clamp(s / DRIFT_DT, 0, DRIFT_N - 1.001);
  const i = Math.floor(u);
  const a = u - i;
  return [d[i * 2] * (1 - a) + d[i * 2 + 2] * a, d[i * 2 + 1] * (1 - a) + d[i * 2 + 3] * a];
}

export const InkBloom: React.FC<InkBloomProps> = (props) => {
  const { width: vw, height: vh } = useVideoConfig();
  const p: BloomP = {
    age: props.age,
    x: props.x ?? 540,
    surfaceY: props.surfaceY ?? WATER_LINE_Y,
    spread: props.spread ?? 0,
    haze: props.haze ?? 0.55,
    rgbSplit: props.rgbSplit ?? 0,
    seed: props.seed ?? 1,
    scale: props.scale ?? 1,
    zoom: props.zoom ?? 1,
    zoomOrigin: props.zoomOrigin ?? DEFAULT_ORIGIN,
    opacity: props.opacity ?? 1,
    filaments: props.filaments ?? true,
    res: props.res ?? 0.4,
    k: props.k ?? INK_K,
    floor: props.floor ?? INK_FLOOR,
  };
  // the spread haze is smooth: render it at a lower resolution (cheaper, and invisible)
  const sp = clamp(p.spread);
  const res = sp >= 0.5 ? Math.min(p.res, 0.28) : sp >= 0.15 ? Math.min(p.res, 0.33) : p.res;
  const dw = Math.round(vw * res),
    dh = Math.round(vh * res);
  const ref = useRef<HTMLCanvasElement>(null);
  const gl = useRef<InkGL | null>(null);
  useLayoutEffect(
    () => () => {
      gl.current?.dispose();
      gl.current = null;
    },
    [],
  );
  // Inside an <InkStage> the filaments are drawn into the stage's CPU canvas (no extra layer); the GL density
  // stays its own multiply layer (reading a WebGL canvas back into 2D is far slower than compositing it).
  const staged = useInkLayer((ctx, info) => {
    if (p.filaments) drawFilaments(ctx, p, info);
  }, props.z ?? INK_Z.bloom);
  // nothing to show (before impact, no haze): skip the GL pass and hide the layer (saves a full-frame composite)
  const empty = (p.age <= 0 && sp <= 0) || p.opacity <= 0;
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || empty) return;
    if (!gl.current) gl.current = new InkGL(c);
    gl.current.render(buildFrame(p, vw, vh), c.width, c.height);
  });
  const blend: React.CSSProperties = { mixBlendMode: 'multiply', pointerEvents: 'none' };
  return (
    <>
      <canvas
        ref={ref}
        width={dw}
        height={dh}
        style={{ position: 'absolute', left: 0, top: 0, width: vw, height: vh, ...blend, ...props.style, ...(empty ? { display: 'none' } : null) }}
      />
      {p.filaments && !staged && !empty ? <CpuCanvas style={{ ...blend, ...props.style }} draw={(ctx, info) => drawFilaments(ctx, p, info)} /> : null}
    </>
  );
};

// ═══════════════════════════════════════════ InkDrop ═══════════════════════════════════════════

export interface InkDropState {
  x: number;
  y: number;
  r: number;
  vy: number;
  stretch: number;
  visible: boolean;
  opacity: number;
}

/**
 * Drop kinematics for age < 0 (seconds before contact). Falls from rest at `fromY` with t² acceleration; contact
 * (drop bottom touches the surface) at age = 0. Hangs at fromY for age < −T. Invisible for age ≥ 0.
 */
export function inkDropFall(
  age: number,
  o: { fromY?: number; g?: number; r?: number; surfaceY?: number; x?: number } = {},
): InkDropState {
  const S = o.surfaceY ?? WATER_LINE_Y;
  const r = o.r ?? 13;
  const g = o.g ?? 900;
  const fromY = o.fromY ?? 200;
  const yc = S - r; // centre at contact
  const T = Math.sqrt((2 * Math.max(0, yc - fromY)) / g);
  const x = o.x ?? 540;
  if (age >= 0) return { x, y: yc, r, vy: g * T, stretch: 1, visible: false, opacity: 0 };
  const tt = Math.max(0, age + T);
  const y = fromY + 0.5 * g * tt * tt;
  const vy = g * tt;
  return { x, y, r, vy, stretch: 1 + clamp(vy / 1400) * 0.28, visible: true, opacity: 1 };
}

export interface InkDropProps {
  y: number;
  x?: number;
  r?: number;
  stretch?: number;
  vy?: number;
  opacity?: number;
  visible?: boolean;
  surfaceY?: number;
  reflection?: number;
  zoom?: number;
  zoomOrigin?: Vec2;
  /** stage draw order (default INK_Z.drop) */
  z?: number;
  /** draw on the stage's front canvas (above the ink) — needs <InkStage front> */
  front?: boolean;
  style?: React.CSSProperties;
}

function dropPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stretch: number) {
  // nearly spherical; when fast, slightly elongated with a softened tail (never a cartoon teardrop)
  const ry = r * stretch;
  const tail = r * (stretch - 1) * 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y - ry - tail);
  ctx.bezierCurveTo(x + r * 0.55, y - ry - tail * 0.4, x + r, y - ry * 0.45, x + r, y);
  ctx.bezierCurveTo(x + r, y + ry * 0.56, x + r * 0.56, y + ry, x, y + ry);
  ctx.bezierCurveTo(x - r * 0.56, y + ry, x - r, y + ry * 0.56, x - r, y);
  ctx.bezierCurveTo(x - r, y - ry * 0.45, x - r * 0.55, y - ry - tail * 0.4, x, y - ry - tail);
  ctx.closePath();
}

function drawDropBody(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stretch: number, a: number) {
  const ry = r * stretch;
  // body: near-black ink, a hint of blue where the light table shines through the thin lower edge
  const body = ctx.createRadialGradient(x + r * 0.15, y + ry * 0.55, r * 0.1, x, y, r * 1.25);
  body.addColorStop(0, `rgba(58,72,104,${a})`);
  body.addColorStop(0.45, `rgba(18,20,30,${a})`);
  body.addColorStop(1, `rgba(8,9,13,${a})`);
  dropPath(ctx, x, y, r, stretch);
  ctx.fillStyle = body;
  ctx.fill();
  // Fresnel rim lit from below by the light table
  ctx.save();
  dropPath(ctx, x, y, r, stretch);
  ctx.clip();
  const rim = ctx.createRadialGradient(x, y - ry * 0.25, r * 0.7, x, y - ry * 0.1, r * 1.12);
  rim.addColorStop(0, 'rgba(255,240,215,0)');
  rim.addColorStop(1, `rgba(255,238,210,${0.55 * a})`);
  ctx.fillStyle = rim;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillRect(x - r * 2, y, r * 4, ry * 2);
  ctx.restore();
  // hard specular (key light, upper left) + soft environment glint (lower right)
  ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - ry * 0.42, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,236,205,${0.35 * a})`;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.42, y + ry * 0.48, r * 0.24, r * 0.1, -0.7, 0, Math.PI * 2);
  ctx.fill();
}

export const InkDrop: React.FC<InkDropProps> = (props) => {
  const { y, x = 540, r = 13, stretch = 1, vy = 0, opacity = 1, visible = true, surfaceY = WATER_LINE_Y, reflection = 1, zoom = 1, zoomOrigin = DEFAULT_ORIGIN } = props;
  const draw: InkDraw = (ctx) => {
        if (!visible || opacity <= 0) return;
        ctx.save();
        applyZoom(ctx, zoom, zoomOrigin);
        const S = surfaceY;
        // motion streak (shutter) above the drop when fast
        const L = clamp(vy / 900) * r * 3.2;
        if (L > 2) {
          const sg = ctx.createLinearGradient(0, y - r - L, 0, y);
          sg.addColorStop(0, 'rgba(200,190,170,0)');
          sg.addColorStop(1, `rgba(220,210,190,${0.18 * opacity})`);
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.ellipse(x, y - L * 0.5, r * 0.55, L * 0.5 + r * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // soft warm halo so the dark drop separates from the dark air
        const hg = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.2);
        hg.addColorStop(0, `rgba(255,226,180,${0.1 * opacity})`);
        hg.addColorStop(1, 'rgba(255,226,180,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
        // body (clipped above the surface)
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - r * 4, y - r * 8, r * 8, S - (y - r * 8));
        ctx.clip();
        drawDropBody(ctx, x, y, r, stretch, opacity);
        ctx.restore();
        // inverted reflection just under the hairline, rising to meet the drop
        if (reflection > 0) {
          const gap = S - (y + r * stretch);
          const k = clamp(1 - gap / 220) * reflection * opacity;
          if (k > 0.01) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - r * 4, S + 1, r * 8, 90);
            ctx.clip();
            ctx.translate(x, S);
            ctx.scale(1, -0.72);
            ctx.translate(-x, -S);
            ctx.globalAlpha = 0.28 * k;
            ctx.filter = 'blur(1.6px)';
            drawDropBody(ctx, x, y, r, stretch, 1);
            ctx.filter = 'none';
            ctx.restore();
          }
        }
        ctx.restore();
  };
  return useInkLayer(draw, props.z ?? INK_Z.drop, props.front) ? null : <CpuCanvas style={props.style} draw={draw} />;
};

// ═══════════════════════════════════════════ InkMotes ═══════════════════════════════════════════

export const InkMotes: React.FC<{
  time: number;
  zoom?: number;
  zoomOrigin?: Vec2;
  opacity?: number;
  count?: number;
  surfaceY?: number;
  /** stage draw order (default INK_Z.motes) */
  z?: number;
  /** draw on the stage's front canvas, IN FRONT of the ink (needs <InkStage front>; recommended: front={0.5}) */
  front?: boolean;
}> = ({ time, zoom = 1, zoomOrigin = DEFAULT_ORIGIN, opacity = 1, count = 26, surfaceY = WATER_LINE_Y, z = INK_Z.motes, front = false }) => {
  const draw: InkDraw = (ctx, { height }) => {
    if (opacity <= 0) return;
    ctx.save();
    // 1.3× parallax: foreground motes move more under the push-in
    applyZoom(ctx, 1 + (zoom - 1) * 1.3, zoomOrigin);
    const r = mulberry32(5150);
    for (let i = 0; i < count; i++) {
      const rad = 6 + r() * r() * 26;
      const x = r() * 1080;
      const span = height - surfaceY;
      const v = 4 + r() * 10;
      const y = surfaceY + 40 + ((((r() * span - v * time) % span) + span) % span);
      const a = (0.05 + r() * 0.1) * opacity * smoothstep(surfaceY + 30, surfaceY + 140, y);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(255,255,255,${a * 0.9})`);
      g.addColorStop(0.7, `rgba(235,236,240,${a * 0.6})`);
      g.addColorStop(0.9, `rgba(70,78,98,${a})`);
      g.addColorStop(1, 'rgba(70,78,98,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + Math.sin(time * 0.5 + i) * 3, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  return useInkLayer(draw, z, front) ? null : <CpuCanvas scale={0.5} draw={draw} />;
};

// ═══════════════════════════════════════ ink particles (水墨) ═══════════════════════════════════════
//
// Particles are splatted as OPTICAL DENSITY into a float buffer in JS (no per-dab canvas calls: ~20× cheaper in this
// renderer), the wet halo is a blurred low-res copy of the same density, a paper-fixed grain modulates it, and one
// Beer–Lambert conversion (LUT) turns it into a transmittance image that is multiplied onto the frame. Overlapping
// dabs therefore ADD density exactly (dense strokes go near-black, sparse washes stay blue-grey).

export interface InkParticleOpts {
  /** dot mode: dab radius px (default 1.6). Stroke mode: HALF-WIDTH of a dab (default 1.6; 1.5–3 for brush lines) */
  size?: number;
  /** ± fraction of random size variation per dab (default 0.6 dot mode, 0.35 stroke mode) */
  sizeJitter?: number;
  /** ink density (InkBloom units: 1 = dilute blue-grey #3E4964) added at the core of each dab (default 0.35) */
  density?: number;
  /** wet bloom (墨晕): fraction of each dab's ink that bleeds sideways (default 0.6), radius px (default 9) */
  halo?: number;
  haloRadius?: number;
  /** 0..1 how unevenly the paper is wet: the bleed is stronger in some places than others (default 0.6) */
  wet?: number;
  count?: number;
  seed?: number;
  /** per-point 0..1 alpha (multiplies density and halo) */
  alpha?: Float32Array | number[];
  /**
   * per-point size multiplier (default 1). Diffusing ink should grow AND thin: pass sizes s ≥ 1 with alpha ∝ 1/s
   * (constant ink mass → Beer–Lambert dilution: wider, paler, bluer).
   */
  sizes?: Float32Array | number[];
  /** (x, y, i) → [x, y]: flow / drift applied to dabs and halo */
  transform?: (x: number, y: number, i: number) => Vec2;
  /** px of chromatic split (R right, B left) — only while time is being tampered with */
  rgbSplit?: number;
  /**
   * STROKE MODE. Per-point direction × length, px: [dx0, dy0, dx1, dy1, …] or (i, x, y) => [dx, dy] (x, y after
   * `transform`). Each point becomes an elongated wet dab (dense core, feathered edge) of length max(2·size, |d|)
   * laid along d — pass the stroke tangent × (8…20 px), or velocity × a shutter time — so neighbouring dabs fuse into
   * continuous brush lines.
   */
  dir?: Float32Array | number[] | ((i: number, x: number, y: number) => Vec2);
  /**
   * Stroke coordinates for the dry-brush mask: [s0, v0, s1, v1, …] = arc length (px) along the stroke and −1..1 across
   * it (inkStroke() returns them as `sv`). Without it 飞白 falls back to a per-dab hash.
   */
  sv?: Float32Array | number[];
  /** 0..1 dry brush 飞白: paper-white streaks along the stroke where the brush runs dry (default 0) */
  dry?: number;
  /** 0..1 granulation: pigment settling into the paper's tooth, paper-fixed (default 0.3) */
  grain?: number;
  /** absorption law of the pigment (default INK_K / INK_FLOOR; S09's inverted world: COSMOS_INK_K / _FLOOR) */
  k?: InkRgb;
  floor?: InkRgb;
}

const RHO_LUT_N = 4096;
const RHO_LUT_MAX = 12;
/** Transmittance LUT (0..255 per channel) of density 0 … RHO_LUT_MAX for an absorption law. */
function rhoLut(k: InkRgb, floor: InkRgb): Uint8ClampedArray {
  return memo(`ink-rho-lut:${k.join(',')}:${floor.join(',')}`, () => {
    const out = new Uint8ClampedArray(RHO_LUT_N * 3);
    for (let i = 0; i < RHO_LUT_N; i++) {
      const r = (i / (RHO_LUT_N - 1)) * RHO_LUT_MAX;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(255 * (floor[c] + (1 - floor[c]) * Math.exp(-r * k[c])));
    }
    return out;
  });
}

/** 256² tileable paper tooth (0..1): fine fibrous value noise, stretched horizontally like laid paper. */
function paperTooth(): Float32Array {
  return memo('ink-paper-tooth', () => {
    const S = 256;
    const out = new Float32Array(S * S);
    const lat = (cx: number, cy: number, seed: number) => {
      const r = mulberry32(seed);
      const g = new Float32Array(cx * cy);
      for (let i = 0; i < g.length; i++) g[i] = r();
      return (x: number, y: number) => {
        const fx = (x / S) * cx,
          fy = (y / S) * cy;
        const ix = Math.floor(fx),
          iy = Math.floor(fy);
        const tx = fx - ix,
          ty = fy - iy;
        const at = (a: number, b: number) => g[(((b % cy) + cy) % cy) * cx + (((a % cx) + cx) % cx)];
        const sx = tx * tx * (3 - 2 * tx),
          sy = ty * ty * (3 - 2 * ty);
        const a0 = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
        const a1 = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
        return a0 + (a1 - a0) * sy;
      };
    };
    const n1 = lat(64, 128, 811),
      n2 = lat(128, 256, 823),
      n3 = lat(32, 32, 829);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) out[y * S + x] = clamp((n1(x, y) * 0.45 + n2(x, y) * 0.35 + n3(x, y) * 0.2 - 0.5) * 1.9 + 0.5);
    return out;
  });
}

/** Reusable scratch buffers (grown on demand, never shrunk). */
function scratchF32(key: string, n: number): Float32Array {
  const box = memo(`ink-f32:${key}`, () => ({ a: new Float32Array(1) }));
  if (box.a.length < n) box.a = new Float32Array(n);
  return box.a;
}

/** In-place separable box blur (3 passes ≈ Gaussian) of a w×h float buffer. */
function blur3(a: Float32Array, w: number, h: number, r: number) {
  const tmp = scratchF32('blur-tmp', Math.max(w, h));
  const R = Math.max(1, Math.round(r));
  const inv = 1 / (2 * R + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[x] = acc * inv;
        acc += a[o + Math.min(w - 1, x + R + 1)] - a[o + Math.max(0, x - R)];
      }
      for (let x = 0; x < w; x++) a[o + x] = tmp[x];
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        tmp[y] = acc * inv;
        acc += a[Math.min(h - 1, y + R + 1) * w + x] - a[Math.max(0, y - R) * w + x];
      }
      for (let y = 0; y < h; y++) a[y * w + x] = tmp[y];
    }
  }
}

/**
 * Draw 水墨 ink particles (see the section comment): multiplies onto `ctx` (use an <InkCanvas> so it reaches the tank).
 * Points in logical px; the ctx transform (translate / uniform scale) is respected.
 * Dot mode (no `dir`): soft round dabs (washes, mist). Stroke mode (`dir`): elongated wet dabs — see inkStroke().
 */
export function drawInkParticles(ctx: CanvasRenderingContext2D, points: Float32Array | number[], o: InkParticleOpts = {}) {
  const stroke = !!o.dir;
  const { size = 1.6, density = 0.35, halo = 0.6, haloRadius = 9, wet = 0.6, seed = 1, alpha, transform } = o;
  const sizeJitter = o.sizeJitter ?? (stroke ? 0.35 : 0.6);
  const grain = o.grain ?? 0.3;
  const dry = o.dry ?? 0;
  const n = Math.min(o.count ?? Infinity, Math.floor(points.length / 2));
  if (n <= 0 || density <= 0) return;
  const cw = ctx.canvas.width,
    ch = ctx.canvas.height;
  const m = ctx.getTransform();
  const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; // logical → device px
  const nz = makeNoise(seed + 911);
  const fn = typeof o.dir === 'function' ? o.dir : null;
  const arr = o.dir && !fn ? (o.dir as Float32Array | number[]) : null;
  const sv = o.sv;
  // ── per-dab geometry in device px
  const DX = scratchF32('dx', n),
    DY = scratchF32('dy', n),
    DC = scratchF32('dc', n),
    DS = scratchF32('ds', n),
    DL = scratchF32('dl', n),
    DW = scratchF32('dw', n),
    DA = scratchF32('da', n);
  let bx0 = Infinity,
    by0 = Infinity,
    bx1 = -Infinity,
    by1 = -Infinity;
  for (let i = 0; i < n; i++) {
    let x = points[i * 2],
      y = points[i * 2 + 1];
    if (transform) [x, y] = transform(x, y, i);
    let a = (alpha ? alpha[i] : 1) * density;
    if (dry > 0) {
      // 飞白: the bristles run dry in stretches of the stroke and leave paper-white streaks along it
      const msk = sv
        ? (0.5 + 0.5 * nz.n2(sv[i * 2 + 1] * 2.6 + 11.7, sv[i * 2] * 0.008)) * smoothstep(-0.25, 0.45, nz.n2(sv[i * 2] * 0.0035, 5.1))
        : hash01(i, seed + 5);
      a *= 1 - dry * smoothstep(0.38, 0.7, msk);
    }
    DA[i] = a;
    const hw = Math.max(0.7, size * sc * (1 + (hash01(i, seed) - 0.5) * 2 * sizeJitter) * (o.sizes ? o.sizes[i] : 1));
    let cs = 1,
      sn = 0,
      len = 2 * hw;
    if (stroke) {
      let dx: number, dy: number;
      if (fn) [dx, dy] = fn(i, x, y);
      else {
        dx = arr![i * 2];
        dy = arr![i * 2 + 1];
      }
      const tx = m.a * dx + m.c * dy,
        ty = m.b * dx + m.d * dy;
      const dl = Math.hypot(tx, ty);
      if (dl > 1e-6) {
        cs = tx / dl;
        sn = ty / dl;
      }
      len = Math.max(2 * hw, dl);
    }
    const px = m.a * x + m.c * y + m.e,
      py = m.b * x + m.d * y + m.f;
    DX[i] = px;
    DY[i] = py;
    DC[i] = cs;
    DS[i] = sn;
    DL[i] = len * 0.5 - hw; // half-length of the capsule's spine
    DW[i] = hw;
    if (a > 0.002) {
      const ex = Math.abs(cs) * DL[i] + hw,
        ey = Math.abs(sn) * DL[i] + hw;
      if (px - ex < bx0) bx0 = px - ex;
      if (px + ex > bx1) bx1 = px + ex;
      if (py - ey < by0) by0 = py - ey;
      if (py + ey > by1) by1 = py + ey;
    }
  }
  if (!(bx1 > bx0)) return;
  const hR = haloRadius * sc;
  const split = Math.abs(o.rgbSplit ?? 0) * sc;
  const pad = (halo > 0 ? hR * 2.6 : 0) + split + 2;
  const X0 = Math.max(0, Math.floor(bx0 - pad)),
    Y0 = Math.max(0, Math.floor(by0 - pad));
  const X1 = Math.min(cw, Math.ceil(bx1 + pad)),
    Y1 = Math.min(ch, Math.ceil(by1 + pad));
  const W = X1 - X0,
    H = Y1 - Y0;
  if (W <= 0 || H <= 0) return;
  // ── splat dabs (density, device px)
  const D = scratchF32('rho', W * H);
  D.fill(0, 0, W * H);
  for (let i = 0; i < n; i++) {
    const a = DA[i];
    if (a <= 0.002) continue;
    const cx = DX[i] - X0,
      cy = DY[i] - Y0,
      cs = DC[i],
      sn = DS[i],
      hl = DL[i],
      hw = DW[i];
    const ex = Math.abs(cs) * hl + hw,
      ey = Math.abs(sn) * hl + hw;
    const xa = Math.max(0, Math.floor(cx - ex)),
      xb = Math.min(W - 1, Math.ceil(cx + ex));
    const ya = Math.max(0, Math.floor(cy - ey)),
      yb = Math.min(H - 1, Math.ceil(cy + ey));
    const iw = 1 / hw;
    for (let py = ya; py <= yb; py++) {
      const dy = py + 0.5 - cy;
      const row = py * W;
      for (let px = xa; px <= xb; px++) {
        const dx = px + 0.5 - cx;
        const u = Math.abs(dx * cs + dy * sn) - hl;
        const v = -dx * sn + dy * cs;
        const uu = u > 0 ? u : 0;
        const d2 = (uu * uu + v * v) * iw * iw;
        if (d2 >= 1) continue;
        // dense pigment core + feathered wet edge
        const e = 1 - d2;
        D[row + px] += a * (0.55 * e * e + 0.45 * e * e * e * e * (1 + 1.2 * (1 - d2)));
      }
    }
  }
  // ── wet halo (墨晕): the same ink bled sideways, uneven with the wetness of the paper; quarter resolution
  let Hb: Float32Array | null = null;
  const q = 4;
  const hw4 = Math.ceil(W / q) + 1,
    hh4 = Math.ceil(H / q) + 1;
  if (halo > 0) {
    Hb = scratchF32('halo', hw4 * hh4);
    Hb.fill(0, 0, hw4 * hh4);
    for (let i = 0; i < n; i++) {
      const a = DA[i];
      if (a <= 0.002) continue;
      const lx = (DX[i] - X0) / q,
        ly = (DY[i] - Y0) / q;
      const ix = Math.floor(lx),
        iy = Math.floor(ly);
      if (ix < 0 || iy < 0 || ix >= hw4 - 1 || iy >= hh4 - 1) continue;
      const wk = 1 - wet + wet * 2.2 * clamp(0.5 + 0.75 * nz.n2(DX[i] * 0.0045 / sc, DY[i] * 0.0045 / sc));
      // ink mass of the dab (core area in px²) spread over the halo
      const mass = a * halo * wk * (DL[i] * 2 + DW[i] * 1.6) * DW[i] * 0.9;
      const fx = lx - ix,
        fy = ly - iy;
      const o0 = iy * hw4 + ix;
      Hb[o0] += mass * (1 - fx) * (1 - fy);
      Hb[o0 + 1] += mass * fx * (1 - fy);
      Hb[o0 + hw4] += mass * (1 - fx) * fy;
      Hb[o0 + hw4 + 1] += mass * fx * fy;
    }
    // 3 box passes of radius r ≈ Gaussian σ ≈ r; mass is spread over ~2πσ² (device px²) → density
    const r = Math.max(1, hR / q);
    blur3(Hb, hw4, hh4, r);
    const norm = 1 / (q * q);
    for (let i = 0; i < hw4 * hh4; i++) Hb[i] *= norm;
  }
  // ── Beer–Lambert conversion → transmittance image, multiplied onto the frame
  const lut = rhoLut(o.k ?? INK_K, o.floor ?? INK_FLOOR);
  const tooth = paperTooth();
  const img = memo('ink-part-img', () => ({ c: document.createElement('canvas') }));
  if (img.c.width < W || img.c.height < H) {
    img.c.width = Math.max(img.c.width, W);
    img.c.height = Math.max(img.c.height, H);
  }
  const ictx = cpu2d(img.c);
  const id = ictx.createImageData(W, H);
  const px8 = id.data;
  const lk = (RHO_LUT_N - 1) / RHO_LUT_MAX;
  const sx = Math.round(split);
  const rhoAt = (x: number, y: number, row: number): number => {
    let r = D[row + x];
    if (grain > 0 && r > 0) {
      // granulation: thin ink settles into the tooth (strongest at the feathered edges), dense ink covers it
      const t = tooth[(((y + Y0) & 255) << 8) | ((x + X0) & 255)];
      r *= 1 - grain * (1 - t) * (0.55 + 0.45 / (1 + r * 1.5));
    }
    if (Hb) {
      const hx = x / q,
        hy = y / q;
      const ix = hx | 0,
        iy = hy | 0;
      const fx = hx - ix,
        fy = hy - iy;
      const o0 = iy * hw4 + ix;
      r += (Hb[o0] * (1 - fx) + Hb[o0 + 1] * fx) * (1 - fy) + (Hb[o0 + hw4] * (1 - fx) + Hb[o0 + hw4 + 1] * fx) * fy;
    }
    return r;
  };
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const o4 = (row + x) * 4;
      if (sx) {
        const rr = rhoAt(Math.max(0, x - sx), y, row),
          rg = rhoAt(x, y, row),
          rb = rhoAt(Math.min(W - 1, x + sx), y, row);
        px8[o4] = lut[Math.min(RHO_LUT_N - 1, (rr * lk) | 0) * 3];
        px8[o4 + 1] = lut[Math.min(RHO_LUT_N - 1, (rg * lk) | 0) * 3 + 1];
        px8[o4 + 2] = lut[Math.min(RHO_LUT_N - 1, (rb * lk) | 0) * 3 + 2];
      } else {
        const r = rhoAt(x, y, row);
        const li = Math.min(RHO_LUT_N - 1, (r * lk) | 0) * 3;
        px8[o4] = lut[li];
        px8[o4 + 1] = lut[li + 1];
        px8[o4 + 2] = lut[li + 2];
      }
      px8[o4 + 3] = 255;
    }
  }
  ictx.putImageData(id, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 1;
  ctx.drawImage(img.c, 0, 0, W, H, X0, Y0, W, H);
  ctx.restore();
}

// ─────────────────────────────── inkStroke: brush-stroke particles along an SVG path ───────────────────────────────

/** Flatten SVG path data (M L H V C S Q T Z, absolute and relative; no arcs) into polylines. */
function flattenPath(d: string): Array<{ pts: number[]; closed: boolean }> {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out: Array<{ pts: number[]; closed: boolean }> = [];
  let cur: number[] = [];
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    lcx = 0,
    lcy = 0,
    lqx = 0,
    lqy = 0,
    cmd = '',
    i = 0;
  const num = () => parseFloat(toks[i++]);
  const flush = (closed: boolean) => {
    if (cur.length >= 4) out.push({ pts: cur, closed });
    cur = [];
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const seg = 24;
    for (let k = 1; k <= seg; k++) {
      const t = k / seg,
        u = 1 - t;
      cur.push(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
    lcx = x2;
    lcy = y2;
    x = x3;
    y = y3;
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0,
      oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        flush(false);
        x = num() + ox;
        y = num() + oy;
        sx = x;
        sy = y;
        cur.push(x, y);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L':
        x = num() + ox;
        y = num() + oy;
        cur.push(x, y);
        break;
      case 'H':
        x = num() + ox;
        cur.push(x, y);
        break;
      case 'V':
        y = num() + oy;
        cur.push(x, y);
        break;
      case 'C': {
        const a = num() + ox, b = num() + oy, c = num() + ox, e = num() + oy, f = num() + ox, g = num() + oy;
        cubic(a, b, c, e, f, g);
        break;
      }
      case 'S': {
        const c = num() + ox, e = num() + oy, f = num() + ox, g = num() + oy;
        cubic(2 * x - lcx, 2 * y - lcy, c, e, f, g);
        break;
      }
      case 'Q':
      case 'T': {
        let qx: number, qy: number;
        if (cmd.toUpperCase() === 'Q') {
          qx = num() + ox;
          qy = num() + oy;
        } else {
          qx = 2 * x - lqx;
          qy = 2 * y - lqy;
        }
        const ex = num() + ox,
          ey = num() + oy;
        cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        lqx = qx;
        lqy = qy;
        break;
      }
      case 'Z':
        if (Math.hypot(x - sx, y - sy) > 1e-6) cur.push(sx, sy);
        x = sx;
        y = sy;
        flush(true);
        cur.push(x, y);
        break;
      default:
        i++; // unsupported (arcs): skip
    }
    if (!/[CcSs]/.test(cmd)) {
      lcx = x;
      lcy = y;
    }
    if (!/[QqTt]/.test(cmd)) {
      lqx = x;
      lqy = y;
    }
  }
  flush(false);
  return out;
}

export interface InkStroke {
  /** total arc length (px, after placement) */
  length: number;
  closed: boolean;
  /** number of particles = rows × perRow; particle i rides bristle track floor(i / perRow) */
  n: number;
  rows: number;
  perRow: number;
  points: Float32Array;
  /** unit tangent at each particle [tx0, ty0, …] */
  tangents: Float32Array;
  /** stroke coordinates per particle [s0, v0, …]: arc length (px) and −1..1 across (pass as `sv` for 飞白) */
  sv: Float32Array;
  /** position + unit tangent at arc length s (wraps when closed, clamps otherwise) → [x, y, tx, ty] */
  at(s: number): [number, number, number, number];
  /** local brush half-width at arc length s (pressure varies it along the path) */
  widthAt(s: number): number;
  /** particle i shifted by ds px along the stroke (flowing along the contour) → [x, y, tx, ty] */
  flow(i: number, ds: number): [number, number, number, number];
}

/**
 * Sample an SVG path (e.g. HUMAN_PATH; its longest sub-path) as a BRUSH STROKE for drawInkParticles' stroke mode.
 * Placed at `x + scale·px`, `y + scale·py`, resampled at 1 px. Particles sit on `rows` BRISTLE TRACKS spread across
 * `width` (default 6 tracks; each wobbles gently along the path, so dry-brush gaps run along the stroke instead of
 * hatching it), one every `spacing` px along each track. `pressure` (0..1, default 0.5) swells and thins the brush along
 * the path like a hand-held 毛笔. Use size ≈ width / rows · 0.55 so the tracks fuse. Pure JS (no DOM), memoised by `key`.
 *
 *   const k = 1150 / 1344;   // S09: figure height 1150, feet at 1480
 *   const st = inkStroke('s09-human', HUMAN_PATH, { x: 540 - 300 * k, y: 1480 - 1402 * k, scale: k, width: 15 });
 *   for (let i = 0; i < st.n; i++) {                    // every frame
 *     const [x, y, tx, ty] = st.flow(i, 30 * t);        // ink flows along the contour
 *     pos[2 * i] = x + driftX; pos[2 * i + 1] = y + driftY; dir[2 * i] = tx * 14; dir[2 * i + 1] = ty * 14;
 *   }
 *   drawInkParticles(ctx, pos, { dir, sv: st.sv, size: 2, density: 0.3, dry: 0.45 });
 */
export function inkStroke(
  key: string,
  d: string,
  o: { x?: number; y?: number; scale?: number; width?: number; spacing?: number; rows?: number; pressure?: number; seed?: number } = {},
): InkStroke {
  const { x: ox = 0, y: oy = 0, scale = 1, width = 14, spacing = 2.5, rows = 6, pressure = 0.5, seed = 1 } = o;
  return memo(`ink-stroke:${key}:${ox}:${oy}:${scale}:${width}:${spacing}:${rows}:${pressure}:${seed}`, () => {
    const subs = flattenPath(d);
    let best = subs[0] ?? { pts: [0, 0, 1, 0], closed: false };
    const plen = (p: number[]) => {
      let L = 0;
      for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      return L;
    };
    for (const s of subs) if (plen(s.pts) > plen(best.pts)) best = s;
    const closed = best.closed;
    const fine = best.pts.map((v, i) => (i % 2 ? oy + v * scale : ox + v * scale));
    const cum = [0];
    for (let i = 2; i < fine.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(fine[i] - fine[i - 2], fine[i + 1] - fine[i - 1]));
    const length = Math.max(1e-3, cum[cum.length - 1]);
    const N = Math.max(2, Math.ceil(length));
    const tx = new Float32Array(N + 1),
      ty = new Float32Array(N + 1);
    let k = 0;
    for (let j = 0; j <= N; j++) {
      const s = (j / N) * length;
      while (k < cum.length - 2 && cum[k + 1] < s) k++;
      const a = (s - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
      tx[j] = fine[k * 2] + (fine[k * 2 + 2] - fine[k * 2]) * a;
      ty[j] = fine[k * 2 + 1] + (fine[k * 2 + 3] - fine[k * 2 + 1]) * a;
    }
    const idx = (j: number) => (closed ? ((j % N) + N) % N : Math.max(0, Math.min(N, j)));
    const wrap = (s: number) => (closed ? ((s % length) + length) % length : clamp(s, 0, length));
    const nz = makeNoise(seed * 13 + 5);
    const widthAt = (s: number) => {
      const u = wrap(s);
      // brush pressure: slow swells and thinnings along the path (≈ 0.45 … 1.35 × at pressure 0.5)
      const p = nz.n2(u * 0.0065, 3.7) * 0.75 + nz.n2(u * 0.021, 9.1) * 0.25;
      return (width / 2) * Math.max(0.3, 1 + pressure * 1.1 * p);
    };
    const at = (s: number): [number, number, number, number] => {
      const f = (wrap(s) / length) * N;
      const j = Math.floor(f),
        a = f - j;
      const j0 = idx(j),
        j1 = idx(j + 1);
      // tangent from a ±4 px chord (smooth over the resampling)
      const ja = idx(j - 4),
        jb = idx(j + 5);
      let gx = tx[jb] - tx[ja],
        gy = ty[jb] - ty[ja];
      const gl = Math.hypot(gx, gy) || 1;
      gx /= gl;
      gy /= gl;
      return [tx[j0] + (tx[j1] - tx[j0]) * a, ty[j0] + (ty[j1] - ty[j0]) * a, gx, gy];
    };
    const rnd = mulberry32(seed * 7717 + 1);
    const nAlong = Math.max(1, Math.floor(length / spacing));
    const n = nAlong * rows;
    const points = new Float32Array(n * 2),
      tangents = new Float32Array(n * 2),
      sv = new Float32Array(n * 2);
    for (let r = 0; r < rows; r++)
      for (let j = 0; j < nAlong; j++) {
        const i = r * nAlong + j;
        const s = (j + 0.7 * rnd()) * spacing;
        // bristle track r: evenly spread across, wobbling smoothly along the path (never crossing its neighbours)
        const v = clamp((((r + 0.5) / rows) * 2 - 1) * 0.92 + (0.7 / rows) * nz.n2(s * 0.017, r * 7.31 + 2.2), -1, 1);
        const [x, y, gx, gy] = at(s);
        const hw = widthAt(s);
        points[i * 2] = x - gy * v * hw;
        points[i * 2 + 1] = y + gx * v * hw;
        tangents[i * 2] = gx;
        tangents[i * 2 + 1] = gy;
        sv[i * 2] = s;
        sv[i * 2 + 1] = v;
      }
    const flow = (i: number, ds: number): [number, number, number, number] => {
      const s = sv[i * 2] + ds;
      const [x, y, gx, gy] = at(s);
      const v = sv[i * 2 + 1] * widthAt(s);
      return [x - gy * v, y + gx * v, gx, gy];
    };
    return { length, closed, n, rows, perRow: nAlong, points, tangents, sv, at, widthAt, flow };
  });
}

/**
 * A layer to paint ink on (see drawInkParticles). Inside an <InkStage> your callback draws straight into the stage
 * (multiply onto the tank and the bloom); standalone it is a white-filled CPU canvas with CSS multiply.
 */
export const InkCanvas: React.FC<{ draw: (ctx: CanvasRenderingContext2D, info: DrawInfo) => void; scale?: number; z?: number; front?: boolean }> = ({
  draw,
  scale = 1,
  z = INK_Z.canvas,
  front = false,
}) => {
  const staged = useInkLayer(draw, z, front);
  if (staged) return null;
  return (
    <CpuCanvas
      scale={scale}
      style={{ mixBlendMode: 'multiply', pointerEvents: 'none' }}
      draw={(ctx, info) => {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, info.width, info.height);
        ctx.restore();
        draw(ctx, info);
      }}
    />
  );
};

/** Convenience: current frame → seconds. */
export const useInkTime = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps;
};
