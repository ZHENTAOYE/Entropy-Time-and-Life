// S04 sound cues (scene-local frames) for scripts/audio/score.py — frame-accurate against timing.ts.
// Ignition / un-ignition cues are DERIVED from the same cosmic-web nodes the renderer lights (webTrack.ts params →
// lib/cosmosWeb nodeState): a cue lands on the frame where an on-screen cluster crosses lit = ½, so they stay exact
// when the timing moves. Odometer unit changes are solved from the counter's clock (hud.tsx lookback()).
// kind keywords follow score.py's cue_sound(): tick/type/click → tick, counter-roll → whirr, crackle, impact/slam,
// stamp/settle, whoosh/sweep/dive, glitch, rewind / 'rewind swell' / 'spark reversed', tape-stop, spark/shimmer,
// reveal/chime, ignition, glissando, swell/rumble; drone/muffle/water/silence dip/release/hold = bed-owned (silent).
// Pure module: imported only by scripts/export-cues.mjs, never by Scene.tsx.
import { invertFront, fullParams, webNodes } from '../../lib/cosmosWeb';
import { CAP, T } from './timing';
import { webParams } from './webTrack';

export interface Cue {
  frame: number;
  kind: string;
  description: string;
  intensity: number;
}

const DAY_LOG = Math.log10(1 / 365.25);
/** frame at which the counter's log ramp (inOutSine over T.counterLog) reaches log10(years) = L */
function counterFrameAt(L: number): number {
  const [a, b] = T.counterLog;
  const s = (L - DAY_LOG) / (8 - DAY_LOG); // inOutSine(u) = s
  const u = Math.acos(1 - 2 * s) / Math.PI;
  return Math.round(a + u * (b - a));
}

/** frames where on-screen clusters (tier 0) cross lit = ½ between f0 and f1 (inclusive), with summed mass */
function litCrossings(f0: number, f1: number, rising: boolean, visible: (f: number, x: number, y: number) => boolean): Array<{ frame: number; mass: number; n: number; x: number; y: number }> {
  const prev = new Map<string, number>();
  const out: Array<{ frame: number; mass: number; n: number; x: number; y: number }> = [];
  for (let f = f0 - 1; f <= f1; f++) {
    const nodes = webNodes(webParams(f), { margin: 0, groups: false });
    let mass = 0,
      n = 0,
      bx = 0,
      by = 0,
      best = -1;
    for (const nd of nodes) {
      const was = prev.get(nd.key);
      prev.set(nd.key, nd.lit);
      if (was === undefined || f < f0) continue;
      const crossed = rising ? was < 0.5 && nd.lit >= 0.5 : was >= 0.5 && nd.lit < 0.5;
      if (!crossed || !visible(f, nd.x, nd.y)) continue;
      mass += nd.mass;
      n++;
      if (nd.mass > best) {
        best = nd.mass;
        bx = nd.x;
        by = nd.y;
      }
    }
    if (n > 0) out.push({ frame: f, mass, n, x: bx, y: by });
  }
  return out;
}
const where = (x: number, y: number) => `${y < 700 ? 'top' : y > 1300 ? 'bottom' : 'centre'}${x < 400 ? '-left' : x > 680 ? '-right' : ''}`;
/** keep the strongest events at least `gap` frames apart (a cascade reads as a rhythm, not a smear) */
function thin<T extends { frame: number; mass: number }>(ev: T[], gap: number, max: number): T[] {
  const picked: T[] = [];
  for (const e of [...ev].sort((a, b) => b.mass - a.mass)) {
    if (picked.length >= max) break;
    if (picked.every((p) => Math.abs(p.frame - e.frame) >= gap)) picked.push(e);
  }
  return picked.sort((a, b) => a.frame - b.frame);
}

function ignitionCues(): Cue[] {
  // forward: the front has passed (the light side of the inversion) and the node is on screen
  const lightSide = (f: number, x: number, y: number) => {
    const p = fullParams(webParams(f));
    return x >= 0 && x <= 1080 && y >= 0 && y <= 1920 && (p.invert <= 0.0005 || invertFront(p, x, y) < -60);
  };
  const ev = thin(litCrossings(T.ignite[0], T.ignite[1], true, lightSide), 3, 9);
  const top = Math.max(...ev.map((e) => e.mass), 1e-6);
  return ev.map((e, i) => ({
    frame: e.frame,
    kind: 'ignition',
    description: `${i === 0 ? 'first cluster ignites' : 'ignition cascade'} (${e.n} cluster${e.n > 1 ? 's' : ''}, heaviest ${where(e.x, e.y)}): flash + shock ring + spikes`,
    intensity: +(0.45 + 0.35 * (e.mass / top)).toFixed(2),
  }));
}
function unIgnitionCues(): Cue[] {
  const onScreen = (_f: number, x: number, y: number) => x >= 0 && x <= 1080 && y >= 0 && y <= 1920;
  const ev = thin(litCrossings(T.unIgnite[0], T.unIgnite[1], false, onScreen), 4, 5);
  const top = Math.max(...ev.map((e) => e.mass), 1e-6);
  return ev.map((e, i, a) => ({
    frame: e.frame,
    kind: 'spark reversed',
    description: `${i === 0 ? 'first stars un-light' : i === a.length - 1 ? 'the last stars go out' : 'un-ignition cluster'} (${e.n} cluster${e.n > 1 ? 's' : ''}, ${where(e.x, e.y)}) — reversed plink`,
    intensity: +(0.3 + 0.12 * (e.mass / top)).toFixed(2),
  }));
}

function buildCues(): Cue[] {
  const yr = counterFrameAt(0);
  const wan = counterFrameAt(4);
  const cues: Cue[] = [
    // ── A · the line becomes the arrow
    { frame: 0, kind: 'drone', description: 'IN: S03’s amber zero-line hum continues (same line, same tone)', intensity: 0.3 },
    { frame: T.headGrow[0], kind: 'shimmer', description: 'an arrowhead grows on the right end of the line', intensity: 0.3 },
    { frame: T.rotate[0], kind: 'whoosh', description: 'the line swings up −90° to vertical: future is UP (peak of the swing ~f34)', intensity: 0.5 },
    { frame: T.plume0 + 16, kind: 'crackle', description: 'gold dust starts streaming out of the tail point (granular stream, rising until f104)', intensity: 0.45 },
    { frame: 54, kind: 'tick', description: 'width bracket 1 measures the plume', intensity: 0.25 },
    { frame: 58, kind: 'tick', description: 'width bracket 2', intensity: 0.25 },
    { frame: 67, kind: 'tick', description: 'width bracket 3', intensity: 0.25 },
    { frame: 76, kind: 'tick', description: 'width bracket 4 (widest, near the arrowhead)', intensity: 0.25 },
    // ── B · reversal + dive
    { frame: T.stall, kind: 'tape-stop', description: 'the flow clock stalls (the dust stops at ~f110, then runs backward)', intensity: 0.5 },
    { frame: T.rewindHud, kind: 'glitch', description: '◀◀ appears top-left, chromatic split on the dust', intensity: 0.45 },
    { frame: T.stallEnd, kind: 'rewind swell', description: 'the dust runs backward and narrows into the tail (reversed granular stream)', intensity: 0.5 },
    { frame: T.dive[0], kind: 'dive', description: 'the camera dives into the tail point (accelerating rush until f188)', intensity: 0.6 },
    { frame: 143, kind: 'impact', description: 'the last dust is swallowed by the tail point — soft gathered thump, the point flares', intensity: 0.5 },
    { frame: T.iris[0], kind: 'reveal', description: 'the tail point opens (iris with a gold rim) onto the present-day cosmos', intensity: 0.6 },
    // ── C · cosmic rewind (locked to the counter)
    { frame: 150, kind: 'rewind', description: 'falling Shepard tone starts: cosmic rewind (until the slam)', intensity: 0.6 },
    { frame: T.counterOn, kind: 'tick', description: 'monumental look-back counter appears (top): 1 天', intensity: 0.35 },
    { frame: T.counterLog[0], kind: 'counter-roll', description: 'odometer whirr 1天 → 年 → 万年 → 亿年', intensity: 0.4 },
    { frame: yr, kind: 'tick', description: 'unit flips to 年', intensity: 0.3 },
    { frame: wan, kind: 'tick', description: 'unit flips to 万年', intensity: 0.3 },
    { frame: T.counterLog[1], kind: 'stamp', description: 'unit flips to 亿年 — from here the cosmos itself starts to change', intensity: 0.4 },
    { frame: T.merger[0], kind: 'rumble', description: 'space contracts: field galaxies converge, the merger remnant un-merges (low rumble until f240)', intensity: 0.4 },
    { frame: 212, kind: 'counter-roll', description: '亿年 digits whirr toward 136 (until f258)', intensity: 0.35 },
    ...unIgnitionCues(),
    { frame: 258, kind: 'silence dip', description: 'the dark ages (136 → 137亿年): everything dims for a beat', intensity: 0.2 },
    { frame: 262, kind: 'swell', description: 'the heat surge (137 → 138亿年): red → orange → white-hot plasma, roar builds to the slam', intensity: 0.7 },
    { frame: T.slam, kind: 'slam', description: 'SLAM — the floor of time: counter lands on 138亿年, flash, shock ring, camera shake', intensity: 1.0 },
    { frame: T.counterFly[0], kind: 'whoosh', description: 'the counter flies into the HUD (◀◀ 138亿年)', intensity: 0.3 },
    { frame: T.slam + 6, kind: 'drone', description: 'boiling plasma bed (sustained until the darkness at f370)', intensity: 0.35 },
    { frame: 300, kind: 'type', description: 'HUD types 涨落 ×10⁵ 放大', intensity: 0.15 },
    // ── E · Penrose
    { frame: T.overlayIn[0], kind: 'muffle', description: 'darkness falls over the plasma (low-pass); the base “10” emerges as a window of plasma', intensity: 0.4 },
    { frame: T.base10, kind: 'impact', description: 'the base “10” lands, bursting out of frame (kick, flash, shake)', intensity: 0.9 },
    { frame: T.exp10, kind: 'impact', description: 'exponent “10” pops (higher pitch)', intensity: 0.7 },
    { frame: T.exp123, kind: 'impact', description: 'exponent “123” pops (higher still)', intensity: 0.6 },
    { frame: T.exp123 + 4, kind: 'type', description: 'note 彭罗斯估算 types in', intensity: 0.2 },
    { frame: T.pullBack[0], kind: 'whoosh', description: 'camera pulls back to the whole fraction', intensity: 0.4 },
    { frame: T.fraction[0], kind: 'sweep', description: 'the fraction bar draws, 1 and 概率 ≈ appear', intensity: 0.3 },
    { frame: T.zeros[0], kind: 'counter-roll', description: 'the wall of zeros types in, accelerating into a whirr (until f494)', intensity: 0.5 },
    { frame: T.overlayOut[0], kind: 'swell', description: 'the darkness lifts: the uniform plasma returns', intensity: 0.5 },
    // ── F · uniform like spent ink
    { frame: T.probe[0], kind: 'sweep', description: 'the temperature probe draws its flat trace (thin, steady = uniform)', intensity: 0.25 },
    { frame: T.whiteOut[0], kind: 'swell', description: 'whiteout of the plasma', intensity: 0.5 },
    { frame: T.inkIn[0] + 10, kind: 'water', description: 'dissolve into S01’s spent ink: underwater hush, cream light table', intensity: 0.4 },
    { frame: T.inkTick[0], kind: 'chime', description: 'S墨 appears at the TOP of the gauge, S宇宙 at the bottom — the contradiction', intensity: 0.45 },
    // ── G · gravity
    { frame: T.boxesIn[0], kind: 'pen', description: 'the two thought-experiment boxes draw on in ink', intensity: 0.3 },
    { frame: T.boxRun, kind: 'crackle', description: 'the gas in both boxes jiggles (soft)', intensity: 0.2 },
    { frame: T.collapse[0], kind: 'whoosh', description: 'gravity on: the right box’s gas falls together', intensity: 0.45 },
    { frame: T.sparks[0], kind: 'spark', description: 'first light sparks leave the heated clump (sparks continue to ~f700)', intensity: 0.5 },
    { frame: T.boxesOut[0], kind: 'whoosh', description: 'left box slides away, right box swells to fill the frame and dissolves', intensity: 0.45 },
    { frame: T.clump[0], kind: 'swell', description: 'the whole spent-ink universe starts to gather into filaments (deep swell until f790)', intensity: 0.5 },
    { frame: T.collapse[1], kind: 'settle', description: 'the clump settles (soft thud); its S tick has climbed', intensity: 0.45 },
    { frame: T.clump[0] + 6, kind: 'tick', description: '▶ 38万年', intensity: 0.3 },
    // ── H · ink becomes light, ignition
    { frame: T.flip[0], kind: 'sweep', description: `the paper goes dark from the bottom up: ink becomes light (sub drop, until f${T.flip[1]})`, intensity: 0.7 },
    { frame: T.sparksUp[0], kind: 'swell', description: 'deep swell of the ignition era (until f808)', intensity: 0.8 },
    { frame: T.ignite[0], kind: 'tick', description: '▶ 2亿年', intensity: 0.3 },
    ...ignitionCues(),
    { frame: 770, kind: 'spark', description: 'groups ignite (second, finer wave of sparkles until ~f800)', intensity: 0.4 },
    { frame: CAP.c9[0] + 24, kind: 'glissando', description: `滚落 slides down the slope (second glyph f${CAP.c9[0] + 29})`, intensity: 0.35 },
    { frame: 776, kind: 'tick', description: '▶ 10亿年', intensity: 0.3 },
    { frame: 808, kind: 'tick', description: '▶ 50亿年', intensity: 0.3 },
    { frame: CAP.c10[0] + 14, kind: 'shimmer', description: '之后 rises with its trail', intensity: 0.3 },
    { frame: 842, kind: 'tick', description: '▶ 138亿年', intensity: 0.3 },
    { frame: 868, kind: 'tick', description: '▶ 现在', intensity: 0.4 },
    { frame: T.hudOut[0], kind: 'release', description: 'HUD and gauge fade out', intensity: 0.15 },
    { frame: T.still, kind: 'hold', description: '0.6 s still on the lit web: sustained chord, no new events; the cut is continuous into S05', intensity: 0.3 },
  ];
  return cues.sort((a, b) => a.frame - b.frame);
}

export const CUES: Cue[] = buildCues();
