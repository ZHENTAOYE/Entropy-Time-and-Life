// S05 sound cues (scene-local frames) — every audible event of the picture, derived from the same data the picture
// uses (star death frames, black-hole pops, exponent ticks, gas collisions), so they cannot drift.
// Score idea: the universe's sound dies the way its picture does. ▶▶ whir + a field of tiny ember plucks (one per
// dying star) → sub-bass gravity + pin-prick pops → the music's tones random-walk into pink, then white, then flat
// noise → the only true silence of the film → one warm sine: the gold point.
import { memo } from '../../lib/math';
import { webToScreen, webCamera } from '../../lib/cosmos';
import { T, webAt } from './timing';
import { shells, bhPopFrames } from './shells';
import { expoTicks } from './lockup';
import { lastStarFrame } from './hud';
import { goldOn } from './gold';

export interface Cue {
  f: number;
  kind: string;
  description: string;
  intensity?: number;
}

export const cues = (): Cue[] =>
  memo('s05:cues', () => {
    const out: Cue[] = [];
    const add = (f: number, kind: string, description: string, intensity: number) => out.push({ f: Math.round(f), kind, description, intensity });
    add(0, 'continue', "S04's swell / lit-web shimmer carries over (frame 0 = S04's last frame)", 0.5);
    add(T.ffOn, 'transport', '▶▶ engages: tape-transport clunk + a short overexposed kick of the highlights', 0.8);
    add(T.ffOn + 1, 'ff-whir', 'fast-forward whir starts and keeps rising in pitch (Shepard-like riser) until ~f170', 0.5);
    add(T.c1.at, 'text', '「滚到最后呢？」 condenses (soft breath)', 0.2);
    // star deaths: individual plucks for the visible clusters, then a granular cascade
    const cam0 = webCamera(webAt(60));
    const vis = shells()
      .filter((s) => s.kind === 0)
      .map((s) => ({ s, p: webToScreen(cam0, s.wx, s.wy) }))
      .filter(({ p }) => p[0] > 0 && p[0] < 1080 && p[1] > 0 && p[1] < 1920)
      .sort((a, b) => a.s.f0 - b.s.f0);
    vis.slice(0, 6).forEach(({ s }, i) => add(s.f0, 'ember-pluck', `star ${i + 1} burns out: soft warm pluck + a short exhale of air (its light shell leaves)`, 0.35));
    add(60, 'ember-cascade', 'cascade of tiny ember plucks thickens (one per dying star, ~3 per frame at the peak f74–96), panned by screen x; a warm dusk pad swells as the light haze fills the voids', 0.45);
    vis.slice(-5, -1).forEach(({ s }) => add(s.f0, 'ember-pluck', 'one of the very last stars goes out', 0.3));
    add(lastStarFrame(), 'last-star', 'THE LAST STAR goes out (reticle blinks): a single high glassy tink, then the cascade stops', 0.7);
    for (const t of expoTicks()) {
      if (t.n <= 14) add(t.f, 'odometer-tick', `year exponent rolls to 10^${t.n}${t.n === 14 ? ' — lands (heavier tick)' : ''}`, t.n === 14 ? 0.55 : 0.4);
    }
    add(88, 'gravity-swell', 'six black holes form on the heaviest clusters: sub-bass swell under everything until ~f176', 0.5);
    add(T.roll2[0], 'odometer-whirr', 'the exponent whirrs 14 → 100 (accelerating mechanical spin, peak speed ~f152)', 0.5);
    const pops = [...bhPopFrames()].sort((a, b) => a.f - b.f);
    pops.forEach((p, i) => {
      const last = i === pops.length - 1;
      add(p.f - (last ? 12 : 6), 'hawking-rise', `${last ? 'the LARGEST' : 'a'} black hole shrinks and heats up: a rising crackle of quanta`, last ? 0.4 : 0.2);
      add(p.f, last ? 'last-pop' : 'bh-pop', last ? 'the largest black hole evaporates: pin-prick flash, the sub-bass cuts out, a faint wide wavefront rolls across the frame' : 'black hole evaporates: faint pin-prick pop (high, short)', last ? 0.65 : 0.35);
    });
    add(T.roll2[1], 'odometer-land', 'the exponent lands on 10^100 (thunk), the numerals start losing contrast', 0.45);
    add(T.eq0, 'dissolve', 'THE IMAGE DIFFUSES: every tone of the score starts to random-walk (pitch scatter) and smear into pink noise', 0.5);
    add(T.c4.at, 'text', '「温度处处相同。」', 0.15);
    add(T.hist[0], 'instrument', 'histogram instrument appears: dry data ticks; its bars collapse into one needle by ~f240 (a narrowing filter sweep on the noise)', 0.25);
    add(T.hudLose[0], 'detune', '▶▶ loses its direction: the ff-whir wobbles, detunes and stops meaning anything', 0.35);
    add(230, 'noise-white', 'pink noise → white noise: no more pitch anywhere', 0.45);
    add(T.c5.at, 'loupe-open', 'loupe opens (glass tick); the magnified gas: a granular crackle whose density follows the collisions', 0.3);
    add(262, 'collisions', 'collision crackle peaks (the stream thermalises f262–300); afterwards a steady, directionless crackle', 0.3);
    add(T.gaugePeg, 'gauge-peg', 'the S-gauge slams into its top stop and chatters (small metallic clack)', 0.35);
    add(T.hudDie[0], 'hud-dissolve', 'the timecode dissolves into the noise (its whir is gone)', 0.2);
    add(T.loupe[1] - 18, 'loupe-close', 'loupe shrinks to the point (soft reverse tick)', 0.2);
    add(T.c6.at, 'text', '「这叫——」', 0.15);
    add(T.c6.at + 12, 'name', '「热寂。」 appears: a low breath under the flat noise', 0.3);
    add(T.c6.at + 30, 'collapse', 'NOISE-DEATH: the sound collapses into flat, featureless noise (no spectral shape) and fades with the word', 0.4);
    add(T.silence[0], 'silence', 'TRUE SILENCE (the film\'s only one): digital zero / at most −40 dB room tone until the gold point', 0);
    // the gold point stutters alive
    let lastOn = 0;
    for (let f = T.gold; f < T.gold + 16; f++) {
      const on = goldOn(f) > 0.5 ? 1 : 0;
      if (on && !lastOn) add(f, f === T.gold ? 'gold-ignite' : 'gold-flicker', f === T.gold ? 'the GOLD POINT ignites: one warm, pure high sine (the first tone after the silence)' : 'the point flickers back on (tiny glassy tick)', f === T.gold ? 0.5 : 0.2);
      lastOn = on;
    }
    add(T.c8.at, 'warm-pad', '「但在滚落的路上——」 condenses in warm white: a low warm pad swells under the sine, rising toward S06\'s sun', 0.4);
    add(521, 'handoff', 'last frame: grey + gold point; sine + pad continue into S06 (the point swells into the Sun)', 0.4);
    return out.sort((a, b) => a.f - b.f);
  });
