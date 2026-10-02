// S07 sound cues (scene-local frames) for scripts/score.py. Every audible event of the picture, frame-exact.
// Derived from the model (census crossings, heartbeats, day counter) — see dev/data-entry.tsx to regenerate.
export interface Cue {
  f: number;
  kind: string;
  description: string;
  intensity?: number;
}

const beats = [396, 426, 456, 486, 516, 546, 576, 606, 636, 666, 696, 726, 812, 842];

export const CUES: Cue[] = [
  { f: 0, kind: 'swell-continue', description: "continuation of S06's spiral: water swirl bed fades in under the gold streams", intensity: 0.5 },
  { f: 6, kind: 'text-in', description: '「1944年，薛定谔问：」 condenses', intensity: 0.2 },
  { f: 20, kind: 'reveal', description: 'book-cover rules draw out, 「生命是什么？」 — a low, warm chord', intensity: 0.6 },
  { f: 34, kind: 'type', description: 'imprint E. SCHRÖDINGER · CAMBRIDGE · 1944 types on (soft keys, to f48)', intensity: 0.15 },
  { f: 40, kind: 'transition', description: "S06's sink becomes the drain's dark eye; whirlpool fully formed", intensity: 0.3 },
  { f: 90, kind: 'text-in', description: '「他写道：生命以“负熵”为食。」', intensity: 0.2 },
  ...[104, 118, 132, 146].map((f) => ({ f, kind: 'pulse', description: 'gold "free-energy" packet races inward along the arms (rising whoosh into the eye)', intensity: 0.45 })),
  { f: 146, kind: 'ping', description: 'tracer (gold particle) enters at the rim — bright pluck; whistle rises in pitch as it spirals in (to f210)', intensity: 0.6 },
  { f: 210, kind: 'drain', description: 'tracer leaves through the eye — gold ring flash, low "glug" + ping; label 停留 2.1 s · 离开', intensity: 0.65 },
  { f: 216, kind: 'sonar', description: 'census tag pulse sweeps eye → rim, every drop turns white', intensity: 0.7 },
  ...[225, 233, 242, 251, 260, 269, 277, 285].map((f) => ({ f, kind: 'tick', description: 'census counter drops 10 % (原来的水)', intensity: 0.25 })),
  { f: 294, kind: 'chime', description: 'census reaches 0 % — not one drop left, the shape unchanged', intensity: 0.55 },
  { f: 296, kind: 'camera-move', description: 'TILT 1 begins: top view → side view (deep whoosh, to f340)', intensity: 0.7 },
  { f: 308, kind: 'impact', description: '「你也是。」 — deep hit', intensity: 0.85 },
  { f: 316, kind: 'rise', description: 'the whirlpool lifts off as a spinning column and settles bottom-up into the figure (shimmer rising, to f384)', intensity: 0.6 },
  { f: 360, kind: 'growth', description: 'vessel tree grows from the mouth (crackling branch sound, to f410)', intensity: 0.35 },
  { f: 380, kind: 'flow-on', description: 'metabolism starts; time-lapse begins (to f458)', intensity: 0.4 },
  ...[403, 411, 418, 424, 431, 437, 444, 451].map((f, k) => ({ f, kind: 'tick', description: `day counter passes 第${(k + 1) * 10}天 (time-lapse)`, intensity: 0.2 })),
  { f: 458, kind: 'settle', description: '第90天 — time-lapse ends, the body is now almost all gold (new atoms)', intensity: 0.35 },
  { f: 462, kind: 'click', description: 'FLIR shutter click; scan line sweeps top → bottom (to f482)', intensity: 0.75 },
  { f: 482, kind: 'hum', description: 'thermal sensor hum; IR wave packets start radiating (low warm drones)', intensity: 0.4 },
  { f: 500, kind: 'breath', description: 'breath pulse in the plume (every 4 s: f500, 620, 740)', intensity: 0.2 },
  { f: 492, kind: 'reveal', description: '≈100 W bulb icon glows', intensity: 0.3 },
  { f: 570, kind: 'mode-switch', description: 'sensor re-maps to W/kg; the Sun limb slides in from the top (huge, low rumble, to f600)', intensity: 0.65 },
  { f: 598, kind: 'count', description: '×7000 counter rolls up (rising ticks to f622)', intensity: 0.5 },
  { f: 622, kind: 'impact', description: '×7000 lands', intensity: 0.75 },
  { f: 650, kind: 'transition', description: 'Sun leaves upward; colour bar becomes the S-gauge', intensity: 0.3 },
  { f: 652, kind: 'text-in', description: '「你不是在对抗熵增——」', intensity: 0.2 },
  { f: 678, kind: 'dissolve', description: '对抗 diffuses (granular scatter) …', intensity: 0.45 },
  { f: 686, kind: 'resolve', description: '… and re-condenses as 借着 (warm resolving chord)', intensity: 0.55 },
  { f: 752, kind: 'silence', description: 'FREEZE ❚❚: flow time stops (tape-stop deceleration f752–760) — ALL MUSIC DROPS OUT', intensity: 0.0 },
  { f: 760, kind: 'silence', description: 'frozen: the heat drains out of the figure (only room tone, a faint cold air sound)', intensity: 0.05 },
  { f: 812, kind: 'impact', description: '▶ restart: first heartbeat — heat floods back from the chest', intensity: 0.9 },
  { f: 814, kind: 'text-in', description: '「你是一个过程。」 — 过程 assembled from a steady particle flow (granular stream to f866)', intensity: 0.45 },
  { f: 846, kind: 'release', description: 'the figure starts to rise away as heat (airy rising whoosh)', intensity: 0.5 },
  { f: 852, kind: 'camera-move', description: 'TILT 2: down to the floor top view (to f896)', intensity: 0.55 },
  { f: 866, kind: 'text-out', description: 'caption diffuses', intensity: 0.2 },
  { f: 884, kind: 'reveal', description: 'residual-heat footprints fully exposed on the cold floor (soft low tone, hold → S08)', intensity: 0.4 },
  ...beats.map((f) => ({ f, kind: 'heartbeat', description: '60 bpm lub (dub at +8 frames)', intensity: f >= 812 ? 0.7 : 0.45 })),
];
