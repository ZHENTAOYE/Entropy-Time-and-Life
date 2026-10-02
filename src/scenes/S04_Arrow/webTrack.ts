// The CosmicWeb parameter track of S04 (pure: no DOM, no lib/cosmos renderer import) — shared by the scene
// (cosmosTrack.ts) and by cues.ts, which derives exact ignition / un-ignition frames from the same nodes.
import { WEB_FINAL, WebParams } from '../../lib/cosmosWeb';
import { ease, lerp, prog, smoothstep } from '../../lib/math';
import { T } from './timing';

/** smallest scale factor reached by the rewind's contraction */
export const ZMIN = 0.62;
export const IX = 540;
export const IY = -6000;

export function webParams(f: number): WebParams {
  const t = f / 30;
  if (f >= T.still) return { ...WEB_FINAL, t };
  if (f < T.cosmosOff + 20) {
    // rewind → plasma (see the header: every change is tied to the look-back counter)
    const ignite = 1 - prog(f, T.unIgnite[0], T.unIgnite[1], ease.inOutSine);
    const c = 1 - prog(f, T.unClump[0], T.unClump[1], ease.inOutSine);
    const heat = prog(f, T.heatUp[0], T.heatUp[1], ease.inOutSine);
    // space contracts to 0.62 of its size (a = 1/(1+z) as a visual stand-in; deeper zooms only multiply the geometry)
    const zoom = f < T.slam + 2 ? lerp(1, ZMIN, prog(f, T.contract[0], T.contract[1], ease.inOutCubic)) : lerp(ZMIN, 0.92, prog(f, T.slam + 2, 590, ease.inOutSine));
    const roll = -0.05 * prog(f, 150, T.slam, ease.inOutSine) + 0.03 * prog(f, T.slam + 14, 590, ease.inOutSine);
    const exposure = 1 - 0.3 * smoothstep(140, 176, f) * (1 - smoothstep(236, 266, f)) + 0.38 * prog(f, T.whiteOut[0], T.whiteOut[1], ease.inOutSine);
    // floor of time → Penrose: the camera tilts up (the plasma drifts down the frame)
    const cy = -0.9 * prog(f, T.slam - 2, 548, ease.inOutSine);
    return { c, heat, ignite, igniteRate: 0.55, sparks: 1 - prog(f, 190, 236), zoom, roll, t, exposure, cy };
  }
  // gravity: inverted ink gathers → flip to light → ignition → camera settles on WEB_FINAL
  const kc = prog(f, T.camera[0], T.camera[1], ease.inOutCubic);
  const zoom = Math.exp(lerp(Math.log(1.45), Math.log(WEB_FINAL.zoom), kc));
  const roll = lerp(0, WEB_FINAL.roll, kc);
  const c = lerp(0.12, 1, prog(f, T.clump[0], T.clump[1], ease.inOutSine));
  let invert = 1;
  if (f >= T.flip[0]) invert = f >= T.flip[1] ? 0 : lerp(0.975, 0.66, prog(f, T.flip[0], T.flip[1], ease.inOutSine));
  const ignite = prog(f, T.ignite[0], T.ignite[1], ease.inOutSine);
  const sparks = prog(f, T.sparksUp[0], T.sparksUp[1], ease.inOutSine);
  return { c, heat: 0, ignite, igniteRate: 0.42, sparks, zoom, roll, t, invert, ix: IX, iy: IY };
}

