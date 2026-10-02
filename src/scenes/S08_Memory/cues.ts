// S08 — sound cues for the score (scene-local frames). Derived from the same constants the picture uses.
import { CADENCE, MACRO_K, MACRO_T0, PRINTS, T_IMPACT, WALK_T0 } from './trail';
import { ECHOES, PULSE_PERIOD, PULSE_T0 } from './network';
import { axonExitDelay, pulseFootArrival } from './figure';
import { CAP, ECHO_F, REWIND } from './timing';

export interface Cue {
  frame: number;
  kind: string;
  description: string;
  intensity: number;
}

export function s08Cues(): Cue[] {
  const c: Cue[] = [];
  const add = (frame: number, kind: string, description: string, intensity: number) => c.push({ frame: Math.round(frame), kind, description, intensity });
  add(0, 'transition', 'continuous from S07 (identical frame): residual-heat hum of the two thermal footprints, starts cooling', 0.35);
  add(CAP.c1[0], 'text', 'C1 condenses: “最后一个问题：…昨天…明天？” (soft shimmer; 明天 stays a cold ghost)', 0.2);
  add(6, 'swell', 'a low sun rakes in from the right: warm pad rises as the sand materialises (to f58); thermal hiss cools (yellow → purple)', 0.45);
  add(50, 'ambience', 'wind over sand begins (grains saltating right→left), rising to f110, stays under the walk', 0.3);
  add(98, 'tick', 'HUD type-on: 现在', 0.2);
  add(114, 'tick', 'HUD type-on: 未来 · ？ (colder, thinner)', 0.15);
  for (const p of PRINTS) {
    if (p.k < 2 || p.k === MACRO_K) continue;
    add(p.T, 'footstep', `footprint ${p.k} lands (${p.side < 0 ? 'left' : 'right'} foot, pan ${p.side < 0 ? 'L' : 'R'}), soft sand crunch + grain puff`, 0.35 + 0.02 * p.k);
  }
  for (let n = 1; n <= 4; n++) add(86 + 30 * n + 4, 'tick', `HUD ruler tick type-on: −${n} s`, 0.15);
  add(150, 'swell', 'S-gauge appears at the left edge (entropy rises one notch per footprint)', 0.15);
  add(CAP.c3[0], 'text', 'C3 “脚印，只指向过去。”', 0.2);
  add(MACRO_T0, 'transition', 'macro zoom-in begins (the walk camera glides into a ×2.4 macro); time slows (tape-slow / time-stretch, sub swell into the impact)', 0.5);
  add(CAP.c4[0], 'text', 'C4 “痕迹，只能顺着熵增的方向留下。”', 0.2);
  add(T_IMPACT - 30, 'swell', 'the invisible foot’s soft shadow slides in from the left and converges on the landing spot as it descends — low rumble rising to the impact', 0.55);
  add(T_IMPACT, 'impact', 'SLOW-MOTION FOOTFALL: deep granular crunch + sub thump, camera shake; S-gauge jumps', 1.0);
  add(T_IMPACT + 1, 'texture', 'infrared heat breath (warm red noise) spreading and fading over ~40 f', 0.4);
  add(T_IMPACT + 6, 'texture', 'grain rain: ~1100 grains land, scatter and settle (granular patter, decaying to f320)', 0.6);
  add(304, 'tick', 'HUD ❚❚ appears (mono click)', 0.3);
  add(REWIND[0], 'rewind', '◀◀ ×¼ rewind attempt: tape strain / reverse squeal + glitch tears; law-cyan return paths from every grain back to where it came from; the grains are dragged ~35 % of the way back (trembling, lifting) and the dent partly refills; S-gauge falls red', 0.75);
  add(REWIND[0] + 12, 'swell', 'the strain peaks (pitch bending up, the reversal almost “working”)', 0.6);
  add(REWIND[1], 'impact', 'FAIL: everything snaps back at once (2-frame camera jolt) — a red ✕ slashes across the print with a short flash, ✕ 不可逆 stamps in (held > 1 s); the cyan target shatters (glassy crack); then near-silence (wind tail only)', 0.95);
  add(REWIND[1] + 1, 'texture', 'grains resettling after the snap (short granular patter)', 0.3);
  add(REWIND[1] + 4, 'tick', 'S-gauge eases back up (red → cream)', 0.15);
  add(332, 'transition', 'pull back from the macro (reverse-cymbal whoosh); prints fill with molten gold', 0.5);
  add(CAP.c5[0], 'text', 'C5 “记忆，是大脑里的脚印。”', 0.2);
  add(352, 'hit', 'the present ignites (soma of the newest footprint): bright electric spark', 0.8);
  for (let k = MACRO_K - 1; k >= 0; k--) add(352 + (MACRO_K - k) * 3.2, 'tick', `ignition runs down the trail-axon: bead ${k} lights`, 0.3);
  add(358, 'texture', 'lightning dendrites grow from every bead: dry electric crackle swelling to f430', 0.6);
  add(414, 'swell', 'the head outline rises from the neck around the network; long pull-back begins (to f546)', 0.45);
  add(CAP.c6[0], 'text', 'C6 “你感到的“时间之箭”——也许，正是熵增在你身体里的回声。”', 0.2);
  const exitD = axonExitDelay();
  for (let f0 = PULSE_T0; f0 <= 569; f0 += PULSE_PERIOD) {
    for (const [dl, amp] of ECHOES) add(f0 + dl, 'pulse', `${dl === 0 ? 'soma fires: echo pulse + ring' : `delay tap +${dl} f (echo ${amp})`} (fired at f${f0})`, dl === 0 ? 0.7 : 0.7 * amp);
    add(f0 + exitD, 'tick', `pulse fired at f${f0} leaves the head into the spinal cord`, 0.2);
    const arr = pulseFootArrival(f0);
    if (arr <= 569) add(arr, 'tick', `pulse fired at f${f0} reaches the soles: tiny ground ripple`, 0.25);
  }
  add(446, 'swell', 'body outline draws down from the neck to the feet (to f534)', 0.35);
  add(ECHO_F, 'text', '回声: two hollow copies of the word expand from it on this pulse and its +7 tap', 0.3);
  add(ECHO_F + 30, 'text', '回声 copies expand once more, fainter (next pulse)', 0.2);
  add(CAP.c6[0] + CAP.c6[1], 'silence', 'caption gone: 0.8 s hold on FIGURE_S08 (f545–569), long reverb tail of the last echo, continuing into S09', 0.3);
  return c.filter((q) => q.frame <= 569).sort((a, b) => a.frame - b.frame);
}

export const CADENCE_FRAMES = CADENCE;
export const WALK_START = WALK_T0;
