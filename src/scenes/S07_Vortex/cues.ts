// S07 sound cues (scene-local frames) for scripts/score.py. Every audible event of the picture, frame-exact.
// Derived from the model (census crossings, heartbeats, day counter) — dev/data-entry.tsx prints them:
//   census 217:90% 224:80% 230:70% 237:60% 243:50% 249:40% 256:30% 262:20% 269:10% 279:0%
//   days   403:10 411:20 418:30 424:40 431:50 437:60 444:70 451:81 458:90   ·  原有原子 100 → 77 (d7) → 44 (d34) → 34 % (d90)
//   beats  396 426 … 726 (60 bpm), 812 842 (restart)
export interface Cue {
  f: number;
  kind: string;
  description: string;
  intensity?: number;
}

export const BEAT_FRAMES = [396, 426, 456, 486, 516, 546, 576, 606, 636, 666, 696, 726, 812, 842];
const CENSUS_TICKS = [217, 224, 230, 237, 243, 249, 256, 262, 269];
const DAY_TICKS = [403, 411, 418, 424, 431, 437, 444, 451];

export const CUES: Cue[] = [
  { f: 0, kind: 'swell-continue', description: "continuation of S06's last chord: the leaf rosette keeps turning, red IR sparks crackle on (to f52)", intensity: 0.5 },
  { f: 6, kind: 'text-in', description: '「1944年，薛定谔问：」 condenses', intensity: 0.2 },
  { f: 10, kind: 'swirl-up', description: "the rosette winds up into the whirlpool (accelerating swirl, f10–46); teal water floods in from the rim; the drain's throat opens", intensity: 0.6 },
  { f: 20, kind: 'reveal', description: 'book-cover rules draw out, 「生命是什么？」 — a low, warm chord', intensity: 0.6 },
  { f: 32, kind: 'type', description: 'imprint E. SCHRÖDINGER · CAMBRIDGE · 1944 types on (soft keys, to f50)', intensity: 0.15 },
  { f: 46, kind: 'settle', description: 'whirlpool fully formed: 7 gold feeder arms, stationary shape (steady water bed)', intensity: 0.3 },
  { f: 98, kind: 'text-in', description: '「他写道：生命以“负熵”为食。」', intensity: 0.2 },
  ...[104, 118, 132, 146].map((f) => ({ f, kind: 'pulse', description: 'gold "free-energy" packet races inward along the arms (rising whoosh into the eye)', intensity: 0.45 })),
  { f: 146, kind: 'ping', description: 'tracer (gold particle) enters at the rim — bright pluck; whistle rises in pitch as it spirals in (to f210)', intensity: 0.6 },
  { f: 210, kind: 'drain', description: 'tracer leaves through the eye — gold ring flash, low "glug" + ping; label 停留 2.1 s · 离开', intensity: 0.65 },
  { f: 210, kind: 'sonar', description: 'census tag pulse sweeps eye → rim (born with the exit flash), every drop inside the rim turns white', intensity: 0.7 },
  ...CENSUS_TICKS.map((f, k) => ({ f, kind: 'tick', description: `census counter 原来的水 drops to ${90 - k * 10} %`, intensity: 0.25 })),
  { f: 279, kind: 'chime', description: 'census reaches 0 % — the last original drop has left; the dashed outline 形状 · 不变 flashes (hold to f306)', intensity: 0.6 },
  { f: 296, kind: 'camera-move', description: 'TILT 1 begins: top view → side view (deep whoosh, to f340)', intensity: 0.7 },
  { f: 312, kind: 'impact', description: '「你也是。」 — deep hit', intensity: 0.85 },
  { f: 316, kind: 'rise', description: 'the whirlpool lifts into a spinning waterspout that settles bottom-up into the figure (shimmer rising, to f384)', intensity: 0.6 },
  { f: 360, kind: 'growth', description: 'vessel tree grows from the mouth (crackling branch sound, to f410)', intensity: 0.35 },
  { f: 376, kind: 'flow-on', description: 'metabolism starts: newcomers stream in at the mouth, replaced atoms leave through the skin', intensity: 0.4 },
  { f: 388, kind: 'time-lapse', description: 'day counter starts 第00天 (time-lapse to f458; fastest early replacement)', intensity: 0.3 },
  ...DAY_TICKS.map((f, k) => ({ f, kind: 'tick', description: `day counter passes 第${(k + 1) * 10}天 (time-lapse)`, intensity: 0.2 })),
  { f: 458, kind: 'settle', description: '第90天 · 原有原子 34 % — new (gold) flesh around the persisting original (cyan) skeleton', intensity: 0.35 },
  { f: 462, kind: 'click', description: 'FLIR shutter click; scan line sweeps top → bottom (to f482)', intensity: 0.75 },
  { f: 482, kind: 'hum', description: 'thermal sensor hum; IR wave packets start radiating (low warm drones)', intensity: 0.4 },
  { f: 492, kind: 'reveal', description: '≈100 W bulb readout glows (lower left); SP1 35.4 °C on the forehead', intensity: 0.3 },
  { f: 500, kind: 'breath', description: 'breath pulse in the plume (every 4 s: f500, 620, 740)', intensity: 0.2 },
  { f: 570, kind: 'mode-switch', description: 'sensor re-maps to W/kg; the Sun limb slides in from the top (huge, low rumble, to f600)', intensity: 0.65 },
  { f: 598, kind: 'count', description: '×7000 counter rolls up (rising ticks to f622)', intensity: 0.5 },
  { f: 622, kind: 'impact', description: '×7000 lands', intensity: 0.75 },
  { f: 650, kind: 'transition', description: 'Sun leaves upward; colour bar becomes the S-gauge', intensity: 0.3 },
  { f: 658, kind: 'text-in', description: '「你不是在对抗熵增——」', intensity: 0.2 },
  { f: 694, kind: 'dissolve', description: '对抗 diffuses (granular scatter) …', intensity: 0.45 },
  { f: 702, kind: 'resolve', description: '… and re-condenses as 借着 (warm resolving chord, lands f721)', intensity: 0.55 },
  { f: 752, kind: 'silence', description: 'FREEZE ❚❚: flow time stops (tape-stop deceleration f752–760) — ALL MUSIC DROPS OUT', intensity: 0.0 },
  { f: 760, kind: 'silence', description: 'frozen: the heat drains out of the figure (only room tone, a faint cold air sound); 「你不是一个东西。」 at f762', intensity: 0.05 },
  { f: 812, kind: 'impact', description: '▶ restart: first heartbeat — heat floods back from the chest', intensity: 0.9 },
  { f: 818, kind: 'text-in', description: '「你是一个过程。」 — 过程 assembled from a steady particle flow (granular stream to f876)', intensity: 0.45 },
  { f: 846, kind: 'release', description: 'the figure starts to rise away as heat (airy rising whoosh)', intensity: 0.5 },
  { f: 852, kind: 'camera-move', description: 'TILT 2: down to the floor top view (to f896)', intensity: 0.55 },
  { f: 876, kind: 'text-out', description: 'caption diffuses', intensity: 0.2 },
  { f: 884, kind: 'reveal', description: 'residual-heat footprints fully exposed on the cold floor (soft low tone, hold → S08)', intensity: 0.4 },
  ...BEAT_FRAMES.map((f) => ({ f, kind: 'heartbeat', description: '60 bpm lub (dub at +8 frames)', intensity: f >= 812 ? 0.7 : 0.45 })),
];
