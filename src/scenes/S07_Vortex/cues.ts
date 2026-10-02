// S07 sound cues (scene-local frames) for scripts/score.py. Every audible event of the picture, frame-exact.
// Derived from the model (census crossings, heartbeats, day counter, breaths, spout) — dev/data-entry.tsx prints them:
//   census 217:90% 224:80% 230:70% 237:60% 243:50% 249:40% 256:30% 262:20% 269:10% 279:0%
//   spout  start 298 · seated 10% 327 · 50% 340 · 90% 351 · 100% 358
//   days   380:0 403:10 411:20 418:30 424:40 431:50 437:60 444:70 451:81 458:90 · 原有原子 100 → 77 (d7) → 44 (d34) → 34 % (d90)
//   beats  396 426 … 726 (60 bpm), 822 852 (restart) · exhales 422 (time-lapse) 489 609 729
export interface Cue {
  f: number;
  kind: string;
  description: string;
  intensity?: number;
}

export const BEAT_FRAMES = [396, 426, 456, 486, 516, 546, 576, 606, 636, 666, 696, 726, 822, 852];
export const EXHALE_FRAMES = [422, 489, 609, 729];
const CENSUS_TICKS = [217, 224, 230, 237, 243, 249, 256, 262, 269];
const DAY_TICKS = [403, 411, 418, 424, 431, 437, 444, 451];

export const CUES: Cue[] = [
  { f: 0, kind: 'swell-continue', description: "continuation of S06's last chord: S06's whirlpool of light keeps turning, red IR sparks crackle on (die out by f46)", intensity: 0.5 },
  { f: 4, kind: 'text-in', description: '「1944年，薛定谔问：」 condenses', intensity: 0.2 },
  { f: 4, kind: 'transform', description: "S06's light hands over to water (f4–40): teal floods in from the rim, 7 gold feeder arms crystallise, the white sink closes into the drain's dark eye; the flow settles from S06's speed to the whirlpool's", intensity: 0.55 },
  { f: 20, kind: 'reveal', description: 'book-cover rules draw out, 「生命是什么？」 — a low, warm chord', intensity: 0.6 },
  { f: 32, kind: 'type', description: 'imprint E. SCHRÖDINGER · CAMBRIDGE · 1944 types on (soft keys, to f50)', intensity: 0.15 },
  { f: 40, kind: 'settle', description: 'whirlpool fully formed: 7 gold feeder arms on deep teal water, a stationary shape', intensity: 0.3 },
  { f: 98, kind: 'text-in', description: '「他写道：生命以“负熵”为食。」', intensity: 0.2 },
  ...[104, 118, 132, 146].map((f) => ({ f, kind: 'pulse', description: 'gold "free-energy" packet races inward along the arms (rising whoosh into the eye)', intensity: 0.45 })),
  { f: 146, kind: 'ping', description: 'tracer (gold particle) enters at the rim — bright pluck; whistle rises in pitch as it spirals in (to f210)', intensity: 0.6 },
  { f: 210, kind: 'drain', description: 'tracer leaves through the eye — gold ring flash, low "glug" + ping; label 停留 2.1 s · 离开', intensity: 0.65 },
  { f: 210, kind: 'sonar', description: 'census tag pulse sweeps eye → rim (born with the exit flash), every drop inside the rim turns white', intensity: 0.7 },
  ...CENSUS_TICKS.map((f, k) => ({ f, kind: 'tick', description: `census counter 原来的水 drops to ${90 - k * 10} %`, intensity: 0.25 })),
  { f: 279, kind: 'chime', description: 'census reaches 0 % — the last original drop has left; the dashed outline 形状 · 不变 flashes (hold to f306)', intensity: 0.6 },
  { f: 296, kind: 'camera-move', description: 'TILT 1 begins: top view → side view (deep whoosh, to f340)', intensity: 0.7 },
  { f: 298, kind: 'rise', description: 'the WATERSPOUT: the inner whirlpool stops draining, spirals ever faster into the eye and rises as a spinning column (rising swirl, f298–352); its leading tip climbs ~46 px/frame', intensity: 0.7 },
  { f: 318, kind: 'impact', description: '「你也是。」 — deep hit (the legs have already formed under the spout)', intensity: 0.85 },
  { f: 327, kind: 'shimmer', description: 'the person fills in from the feet up as drops peel off the column into their seats (10 % f327 → 50 % f340 → 90 % f351 → complete f358): granular sparkle rising in pitch', intensity: 0.45 },
  { f: 358, kind: 'settle', description: 'the figure is complete; the spout has gone, the leftover pool has faded', intensity: 0.3 },
  { f: 360, kind: 'growth', description: 'a gold line runs from the mouth down the throat to the heart, then the vessel tree grows out of the heart (crackling branch sound, to f410)', intensity: 0.35 },
  { f: 372, kind: 'text-in', description: '「你的大部分原子，几个月前还不在这里。」', intensity: 0.2 },
  { f: 376, kind: 'flow-on', description: 'metabolism starts: the gold intake thread streams into the mouth from the left; replaced atoms leave the skin as rising red heat', intensity: 0.4 },
  { f: 380, kind: 'time-lapse', description: 'day counter starts 第00天 (time-lapse to f458; fastest early replacement)', intensity: 0.3 },
  ...DAY_TICKS.map((f, k) => ({ f, kind: 'tick', description: `day counter passes 第${(k + 1) * 10}天 (time-lapse)`, intensity: 0.2 })),
  { f: 458, kind: 'settle', description: '第90天 · 原有原子 34 % — new (gold) flesh around the persisting original (cyan) skeleton', intensity: 0.35 },
  { f: 462, kind: 'click', description: 'FLIR shutter click; scan line sweeps top → bottom (to f482)', intensity: 0.75 },
  { f: 468, kind: 'text-in', description: '「此刻，你像一只100瓦的灯泡，向宇宙散热。」', intensity: 0.2 },
  { f: 482, kind: 'hum', description: 'thermal sensor hum; IR wave packets start radiating (low warm drones); slow camera push-in on the chest (to f568)', intensity: 0.4 },
  { f: 492, kind: 'reveal', description: '≈100 W bulb readout glows (top left); SP1 35.4 °C on the forehead', intensity: 0.3 },
  { f: 568, kind: 'camera-move', description: 'camera pulls back (to f604) as the sensor re-maps to W/kg', intensity: 0.4 },
  { f: 570, kind: 'mode-switch', description: 'sensor re-maps to W/kg; the Sun limb slides in from the top (huge, low rumble, to f600)', intensity: 0.65 },
  { f: 574, kind: 'text-in', description: '「按每公斤算，你发的热是太阳的约7000倍。」', intensity: 0.2 },
  { f: 598, kind: 'count', description: '×7000 counter rolls up (rising ticks to f622)', intensity: 0.5 },
  { f: 622, kind: 'impact', description: '×7000 lands', intensity: 0.75 },
  { f: 650, kind: 'transition', description: 'Sun leaves upward; colour bar becomes the S-gauge; camera drifts in again', intensity: 0.3 },
  { f: 656, kind: 'text-in', description: '「你不是在对抗熵增——」 (held complete f678–714)', intensity: 0.2 },
  { f: 714, kind: 'strike', description: 'a 2 px line scratches across 对抗 (dry scratch, f714–720)', intensity: 0.45 },
  { f: 720, kind: 'dissolve', description: '对抗 fades to a ghost under the strike; its copy diffuses and drifts down (granular scatter, to f738)', intensity: 0.4 },
  { f: 726, kind: 'resolve', description: '… and re-condenses as 借着 in 「你借着它，活着。」 (warm resolving chord, lands f742)', intensity: 0.55 },
  { f: 758, kind: 'silence', description: 'FREEZE ❚❚: flow time stops (tape-stop deceleration f758–766) — ALL MUSIC DROPS OUT; the camera stops', intensity: 0.0 },
  { f: 766, kind: 'silence', description: 'frozen: the heat drains out of the figure into a cold violet constellation (only room tone, a faint cold air sound)', intensity: 0.05 },
  { f: 772, kind: 'text-in', description: '「你不是一个东西。」 (in the silence)', intensity: 0.15 },
  { f: 822, kind: 'impact', description: '▶ restart: first heartbeat — heat floods back from the chest outward', intensity: 0.9 },
  { f: 826, kind: 'text-in', description: '「你是一个过程。」 — 过程 drawn by a steady particle flow (granular stream to f876)', intensity: 0.45 },
  { f: 850, kind: 'release', description: 'the figure starts to rise away as heat, head first (airy rising whoosh)', intensity: 0.5 },
  { f: 854, kind: 'camera-move', description: 'TILT 2: down to the floor top view (to f896)', intensity: 0.55 },
  { f: 876, kind: 'text-out', description: 'caption diffuses', intensity: 0.2 },
  { f: 888, kind: 'reveal', description: 'residual-heat footprints fully exposed on the cold floor (soft low tone, hold → S08)', intensity: 0.4 },
  ...EXHALE_FRAMES.map((f) => ({ f, kind: 'breath', description: 'exhale: CO₂ · H₂O leave the mouth as a warm puff (soft breath noise, ~1.5 s; the one at f422 is time-lapsed, faster)', intensity: f < 460 ? 0.15 : 0.25 })),
  ...BEAT_FRAMES.map((f) => ({ f, kind: 'heartbeat', description: '60 bpm lub (dub at +8 frames)', intensity: f >= 822 ? 0.7 : 0.45 })),
];
