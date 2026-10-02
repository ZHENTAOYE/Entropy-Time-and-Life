// S04 时间之箭 / The Arrow — 954 frames (31.8 s). "Fly the arrow backward."
//
// Visual language: EMISSIVE COSMIC VOLUME (light you look INTO): the gold arrow of time, a plume of spreading dust,
// the shared cosmic web / plasma renderer, type cut as windows into the primordial plasma, and — for the gravity
// twist — the ink-on-paper world of S01 turned into a lab plate, then flipped back into light.
//
// Beat sheet (scene-local frames; see timing.ts):
//   0       IN = S03's OUT: #070604 + the 2 px amber ZERO_LINE (90→990, y 960).
//   4–66    the line grows an arrowhead, rotates −90° about its centre (future = UP), extends to y 340→1290, warms to
//           Order Gold; ruler ticks; the space background fades in.
//   38–104  a plume of gold dust leaves the tail point and rises along the arrow, spreading as it ages (σ ∝ age^0.78);
//           four width brackets measure the spread — the arrow points the way the spreading goes. S-gauge rises.
//           C1 「熵增的方向，/ 就是时间的方向。」 typeset as an equation (熵增的方向 exactly above 时间的方向).
//   98–144  the flow clock stalls and runs backward (◀◀ f106, chromatic split): the plume narrows and falls back into
//           the tail point, which brightens; S-gauge falls red. C2 「往回追：/ 越早，熵越低。」 (越早/越低 sink).
//   134–186 the camera dives into the tail point; it opens (iris, gold rim) onto the present-day cosmos.
//   150–290 COSMIC REWIND: a merger remnant un-merges and un-lights into gas knots, field galaxies converge as space
//           contracts (zoom 1 → 0.55), stars un-ignite, filaments thicken and smooth, everything warms into plasma.
//           Monumental rolling counter 1天 → … → 138亿年 (f172–286), ◀◀ ×10ⁿ HUD, gauge falling red.
//   288     SLAM — the floor of time: counter lands, shock ring, flash, shake. Counter flies into the HUD.
//   296–390 C4 「宇宙的起点，/ 熵低得不可思议：」 over boiling white-hot plasma (ink-dark type).
//   376–524 PENROSE: the frame goes dark, the number is cut out of the darkness (plasma shows only through it): the
//           base 10 bursts out of frame (f390), exponent 10 (f405), 123 (f419), pull back to 概率 ≈ 1 / 10^10^123;
//           a wall of zeros pours in and accelerates into a blur. C5 「1后面，跟着 10¹²³ 个零」, note 彭罗斯估算.
//   516–622 C6 「怪的是：它几乎完全均匀，/ 像散尽的墨。」 — a temperature probe draws a flat trace; the plasma whitens
//           into the cream light table and becomes S01's fully spread ink (shared ink renderer, spread → 1). The gauge
//           shows the contradiction: S宇宙 at the bottom, S墨 at the top.
//   602–722 the thought experiment in ink: 「无引力」 vs 「有引力」 — same uniform gas; with gravity it clumps, heats,
//           sprays light and its S tick CLIMBS. The right box swells to fill the frame…
//   626–746 …and the whole spent-ink universe gathers into filaments (inverted web, c ↑) — the gathering S01 said
//           never happens, but here the gauge RISES. C7 「但对引力来说：/ 均匀是低熵，抱团才是熵增。」 (均匀 thin &
//           spaced, 抱团 heavy & tight). f704–746 the paper goes dark from the bottom up: ink becomes light.
//   728–802 ignition: stars light at the nodes (flashes, shock rings, spikes, gold sparks). ▶ forward clock.
//   754–830 C9 「宇宙，从那里一路滚落。」 (滚落 slides down the slope).
//   828–935 C10 「你经历的每一个“之后”，/ 都是这场滚落。」 (之后 rises, trail below).  640–935 camera 1.45 → 0.8, roll → 6°.
//   935–953 still. OUT = CosmicWeb(WEB_FINAL), no caption, no HUD, no vignette (== S05 frame 0).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CanvasLayer } from '../../lib/Canvas';
import { CosmicWeb, COSMOS, COSMOS_INK_FLOOR, COSMOS_INK_K, fullParams, invertFront } from '../../lib/cosmos';
import { InkBloom, InkStage, InkTank } from '../../lib/ink';
import { useFontsReady } from '../../lib/fonts';
import { COLOR } from '../../lib/handoff';
import { Timecode } from '../../lib/hud';
import { Flash, Vignette } from '../../lib/overlays';
import { clamp, ease, lerp, mixHex, prog, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { drawArrow, flowFalling, gaugeAB } from './arrow';
import { BOX_FONTS, drawBoxes } from './boxes';
import { drawCosmosExtras, webParams } from './cosmosTrack';
import { Counter, Gauge, Label, RewindHud, Sup, Tick, compressionLog } from './hud';
import { PenroseLayer, penroseDark } from './Penrose';
import { drawProbe } from './probe';
import { CAP, T } from './timing';
import { Voice, VGlyph } from './Voice';

const INK = COLOR.inkText;
const VOICE = COLOR.voice;
const GOLD = COLOR.orderGold;

// ───────────────────────── camera shake (impacts only; zero at the OUT) ─────────────────────────
const IMPACTS: Array<[number, number]> = [
  [T.slam, 10],
  [T.base10, 6],
  [T.exp10, 3],
  [T.exp123, 2],
];
function shake(f: number): [number, number] {
  let x = 0,
    y = 0;
  for (const [fi, amp] of IMPACTS) {
    if (f < fi || f > fi + 16) continue;
    const k = amp * Math.exp(-(f - fi) / 3.5);
    x += (hash01(f * 3 + fi, 11) - 0.5) * 2 * k;
    y += (hash01(f * 5 + fi, 12) - 0.5) * 2 * k;
  }
  return [Math.round(x), Math.round(y)];
}

// ───────────────────────── light ↔ dark world (text / HUD colour) ─────────────────────────
/** 1 where the frame behind (x, y) is light (plasma / paper), 0 where it is dark space */
function lightness(f: number, x: number, y: number): number {
  if (f < 250) return 0;
  if (f < T.overlayIn[0]) return smoothstep(250, 282, f);
  if (f < T.overlayOut[1]) return 1 - penroseDark(f) / 0.93;
  if (f < T.flip[0]) return 1;
  if (f >= T.flip[1] + 4) return 0;
  // the inversion front (same function the shader uses): > 0 = still ink on paper
  const F = invertFront(fullParams(webParams(f)), x, y);
  const k = smoothstep(-110, 110, F);
  return smoothstep(0.42, 0.75, k);
}

// ───────────────────────── S-gauge schedule ─────────────────────────
function gauge(f: number): { ticks: Tick[]; color: string; opacity: number } {
  const light = lightness(f, 64, 1100);
  const color = mixHex(VOICE, INK, light);
  let opacity = smoothstep(44, 64, f) * (1 - smoothstep(T.boxesIn[0] - 4, T.boxesIn[0] + 10, f));
  opacity = Math.max(opacity, smoothstep(T.boxesOut[0] + 6, T.boxesOut[0] + 26, f) * (1 - smoothstep(T.hudOut[0], T.hudOut[1], f)));
  let v: number;
  let falling = false;
  if (f < 150) {
    v = gaugeAB(f);
    falling = flowFalling(f);
  } else if (f < T.slam) {
    v = lerp(gaugeAB(150), 0.04, ease.inOutSine(seg(f, 150, T.slam - 2)));
    falling = f < T.slam - 3;
  } else if (f < T.boxesOut[0]) v = 0.04;
  else v = lerp(0.04, 0.62, ease.inOutSine(seg(f, T.clump[0] + 50, 900)));
  const kInk = smoothstep(T.inkTick[0], T.inkTick[1], f);
  const subK = smoothstep(T.inkTick[0] - 10, T.inkTick[1] - 10, f) * (f < T.boxesOut[0] ? 1 : 0);
  const ticks: Tick[] = [{ value: v, falling, sub: subK > 0.5 ? '宇宙' : undefined, color: kInk > 0 && f < T.boxesOut[0] ? '#B8651A' : undefined }];
  if (kInk > 0 && f < T.boxesOut[0]) ticks.push({ value: 0.95, sub: '墨', color: '#2E4A7A', opacity: kInk });
  return { ticks, color, opacity };
}

// ───────────────────────── caption effects ─────────────────────────
/** C2: 越早 / 越低 — the baselines sink char by char once the glyph has condensed */
const sinkFx = (g: VGlyph, local: number) => {
  if (!g.em) return null;
  const t0 = g.idx + 14;
  const k = ease.inOutCubic(seg(local, t0, t0 + 20));
  return { dy: (g.runIdx + 1) * 15 * k, op: 1 - 0.18 * k * (g.runIdx + 1) };
};
/** C6: 均匀 evenly spaced */
const evenFx = (g: VGlyph) => (g.em === 1 && g.runIdx === 0 ? { ls: 10 } : null);
/** C7: 均匀 thin + spread out, 抱团 heavy + pulled together */
const gravFx = (g: VGlyph, local: number) => {
  if (g.em === 1) return { ls: g.runIdx === 0 ? 13 * ease.outCubic(seg(local, 28, 60)) : 0 };
  if (g.em === 2) {
    const k = ease.inOutCubic(seg(local, 36, 58));
    return { ls: g.runIdx === 0 ? -3 * k : 0, sc: 1 + 0.06 * k };
  }
  return null;
};
/** C9: 滚落 slides down the slope */
const rollFx = (g: VGlyph, local: number) => {
  if (!g.em) return null;
  const t0 = 30 + g.runIdx * 5;
  const k = ease.inOutCubic(seg(local, t0, t0 + 24));
  const d = 46 * k;
  const lean = Math.sin(Math.PI * k) * 9;
  return { dx: d * 0.9, dy: d * 0.55, rot: lean + 8 * k };
};
/** C10: 之后 drifts forward with a motion trail */
const afterFx = (g: VGlyph, local: number) => (g.em ? { dy: -12 * ease.outCubic(seg(local, 18, 70)) } : null);
const afterEcho = (g: VGlyph, local: number) => (g.em ? { n: 4, dx: 0, dy: 5 + 4 * ease.outCubic(seg(local, 18, 70)), alpha: 0.5 * smoothstep(12, 34, local), blur: 1.4 } : null);

export const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const fontsOK = useFontsReady(BOX_FONTS);
  const [sx, sy] = shake(f);

  const cosmosOn = (f >= T.cosmosOn && f < T.cosmosOff) || f >= T.cosmosBack;
  const P = webParams(f);
  const inkOn = f >= T.inkIn[0] && f < T.inkOff;
  const inkOp = ease.inOutSine(seg(f, T.inkIn[0], T.inkIn[1])) * (1 - ease.inOutSine(seg(f, T.inkOut[0], T.inkOut[1])));
  const spread = lerp(0.94, 1, ease.inOutSine(seg(f, T.inkIn[0], 610)));
  const arrowOn = f < T.iris[1] + 2;
  const gfxOn = fontsOK && f >= T.probe[0] && f <= T.boxesOut[1];

  // world light/dark at the caption lane → caption colours
  const capLight = lightness(f, 540, 1440);
  const capInk = mixHex(VOICE, INK, capLight);
  const haloLight = `rgba(246,238,222,${(0.55 * capLight).toFixed(3)})`;
  const haloDark = `rgba(2,3,10,${(0.6 * (1 - capLight)).toFixed(3)})`;
  const halo = capLight > 0.5 ? haloLight : haloDark;

  // vignette by phase
  const kPl = smoothstep(250, 290, f) * (1 - smoothstep(T.inkIn[0], T.inkIn[1], f));
  const kInk = smoothstep(T.inkIn[0], T.inkIn[1], f) * (1 - smoothstep(T.flip[0], T.flip[1], f));
  // S05 opens on the bare WEB_FINAL (no vignette): ours breathes out during the final still
  const vigStrength = (0.45 + 0.1 * kPl - 0.2 * kInk) * (1 - ease.inOutSine(seg(f, 888, T.still))) * ease.inOutSine(seg(f, 0, 30));
  const vigCol = kPl > 0.5 ? '60,18,4' : kInk > 0.5 ? '70,52,30' : '0,0,0';

  const G = gauge(f);
  // rewind HUD
  const rwOp = smoothstep(T.rewindHud, T.rewindHud + 6, f) * (1 - smoothstep(360, 380, f));
  const rwText = f >= T.counterFly[0] + 12 ? '138亿年' : undefined;
  const rwExp = f >= T.counterOn && f < T.slam ? Math.floor(compressionLog(f)) : null;
  const hudLight = lightness(f, 200, 260);
  // forward clock
  const FWD: Array<[number, string]> = [
    [708, '38万年'],
    [734, '2亿年'],
    [772, '10亿年'],
    [806, '50亿年'],
    [840, '138亿年'],
    [866, '现在'],
  ];
  let fwd = '';
  for (const [fr, s] of FWD) if (f >= fr) fwd = s;
  const fwdOp = smoothstep(706, 714, f) * (1 - smoothstep(T.hudOut[0], T.hudOut[1], f));

  return (
    <AbsoluteFill style={{ background: '#02030A' }}>
      <AbsoluteFill style={sx || sy ? { transform: `translate(${sx}px, ${sy}px) scale(1.012)` } : undefined}>
        {cosmosOn ? <CosmicWeb {...P} scale={f >= 268 && f < T.cosmosOff ? 0.4 : 0.5} draw={f < T.still ? (ctx, info) => drawCosmosExtras(ctx, info.frame, P) : undefined} /> : null}
        {inkOn ? (
          <InkStage style={{ opacity: inkOp }}>
            <InkTank time={f / 30} impactAge={-1} surfaceY={-100} paper={COSMOS.paper} />
            <InkBloom age={20 + f / 30} spread={spread} haze={0.38} seed={1} surfaceY={-100} k={COSMOS_INK_K as [number, number, number]} floor={COSMOS_INK_FLOOR as [number, number, number]} />
          </InkStage>
        ) : null}
        {arrowOn ? <CanvasLayer draw={(ctx, { frame }) => drawArrow(ctx, frame)} /> : null}
        <PenroseLayer f={f} />
        {gfxOn ? (
          <CanvasLayer
            draw={(ctx, { frame }) => {
              drawProbe(ctx, frame, INK);
              drawBoxes(ctx, frame, INK);
            }}
          />
        ) : null}
      </AbsoluteFill>
      <Vignette strength={vigStrength} color={vigCol} />

      {/* ── HUD */}
      <Gauge ticks={G.ticks} color={G.color} opacity={G.opacity} />
      <Label text="未来" x={580} y={318} opacity={0.7 * smoothstep(60, 76, f) * (1 - smoothstep(T.dive[0], T.dive[0] + 12, f))} color={GOLD} size={26} />
      <Label text="过去" x={580} y={1262} opacity={0.7 * smoothstep(64, 80, f) * (1 - smoothstep(T.dive[0], T.dive[0] + 8, f))} color={GOLD} size={26} />
      <RewindHud opacity={rwOp * (f > T.counterFly[1] ? 0.65 + 0.35 * Math.cos(f * 0.21) : 1)} speedExp={rwExp} text={rwText} tamper={f < T.slam} color={mixHex(VOICE, '#2A1408', hudLight)} />
      <Counter f={f} dark={smoothstep(244, 276, f)} />
      <Label text="涨落 ×10⁵ 放大" raw="涨落×10⁵放大" x={90} y={290} opacity={0.75 * smoothstep(312, 326, f) * (1 - smoothstep(366, 380, f))} color="#2A1408" size={24} />
      <Label text="彭罗斯估算" x={90} y={244} opacity={0.8 * smoothstep(424, 436, f) * (1 - smoothstep(T.overlayOut[0], T.overlayOut[0] + 12, f))} color={GOLD} size={28} />
      <Label
        text={
          <span>
            ΔT / T ≈ 10
            <Sup e="−5" />
          </span>
        }
        raw="ΔT/≈10−5"
        font="mono"
        x={990}
        y={1118}
        align="right"
        size={28}
        spacing={0.06}
        opacity={0.8 * smoothstep(T.probe[0] + 14, T.probe[0] + 26, f) * (1 - smoothstep(T.inkIn[0] + 4, T.inkIn[0] + 18, f))}
        color={INK}
      />
      <Timecode mode="play" text={fwd} opacity={fwdOp} color={mixHex(VOICE, INK, hudLight)} />

      {/* ── narration */}
      <Voice text={'{熵增}的方向，\n就是{时间}的方向。'} from={CAP.c1[0]} dur={CAP.c1[1]} accent={GOLD} accentWeight={900} lineDx={[30, -30]} exitLen={22} />
      <Voice text={'往回追：\n{越早}，熵{越低}。'} from={CAP.c2[0]} dur={CAP.c2[1]} accent={GOLD} fx={sinkFx} exitLen={22} />
      <Voice text={'宇宙的起点，\n熵低得{不可思议}：'} from={CAP.c4[0]} dur={CAP.c4[1]} color={INK} accent="#7A1A0C" accentWeight={900} halo={haloLight} haloSize={0.7} />
      <Voice text={'1后面，跟着 {10¹²³} 个零'} from={CAP.c5[0]} dur={CAP.c5[1]} accent={GOLD} halo="rgba(5,2,1,0.75)" />
      <Voice text={'怪的是：它几乎完全{均匀}，\n像散尽的墨。'} from={CAP.c6[0]} dur={CAP.c6[1]} color={INK} accent="#2E4A7A" lineDelay={[0, 30]} fx={evenFx} halo={haloLight} haloSize={0.7} />
      <Voice
        text={'但对引力来说：\n{均匀}是低熵，[抱团]才是熵增。'}
        from={CAP.c7[0]}
        dur={CAP.c7[1]}
        color={capInk}
        accent={mixHex('#2E4A7A', '#AFC4FF', 1 - capLight)}
        accentWeight={200}
        accent2={mixHex('#17151C', '#FFFFFF', 1 - capLight)}
        accent2Weight={900}
        fx={gravFx}
        halo={halo}
        haloSize={0.7}
      />
      <Voice text={'宇宙，从那里一路{滚落}。'} from={CAP.c9[0]} dur={CAP.c9[1]} accent={GOLD} fx={rollFx} halo="rgba(2,3,10,0.62)" />
      <Voice text={'你经历的每一个“{之后}”，\n都是这场滚落。'} from={CAP.c10[0]} dur={CAP.c10[1]} accent={GOLD} fx={afterFx} echo={afterEcho} halo="rgba(2,3,10,0.62)" />

      <Flash opacity={0.55 * Math.exp(-Math.max(0, f - T.slam) / 3) * (f >= T.slam ? 1 : 0)} color="#FFF6E2" />
      <Flash opacity={0.25 * Math.exp(-Math.max(0, f - T.base10) / 2.5) * (f >= T.base10 ? 1 : 0)} color="#FFD08A" />
    </AbsoluteFill>
  );
};
