// S09 dev probe 5 (NOT part of the film): CosmicWeb cost by settings (forced flush, timing printed on the frame).
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { CosmicWeb } from '../../../lib/cosmos';
import { pullbackWeb } from '../pullback';

const VARIANTS: Array<[string, Record<string, unknown>]> = [
  ['default 0.5/1', {}],
  ['scale .35', { scale: 0.35 }],
  ['overlay .5', { overlayScale: 0.5 }],
  ['.35 + ov .5', { scale: 0.35, overlayScale: 0.5 }],
  ['.35 + ov .5 nodust', { scale: 0.35, overlayScale: 0.5, dust: false }],
  ['.3 + ov .5 nodust noGroups', { scale: 0.3, overlayScale: 0.5, dust: false, flares: { groups: false } }],
];
const P: React.FC = () => {
  const f = useCurrentFrame();
  const [name, extra] = VARIANTS[f % VARIANTS.length];
  const wp = pullbackWeb(f >= 6 ? 200 : 180);
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const t0 = useRef(performance.now());
  const pre = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d', { willReadFrequently: true })!;
    const a = performance.now();
    const c = wrap.current?.querySelector('canvas');
    if (c) ctx.drawImage(c, 0, 0, 1080, 1920);
    ctx.getImageData(0, 0, 1, 1);
    const b = performance.now();
    if (pre.current) pre.current.textContent = `${name}\nweb layout ${(a - t0.current).toFixed(0)}\nblit+flush ${(b - a).toFixed(0)}`;
  });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div ref={wrap} style={{ display: 'none' }}>
        <CosmicWeb {...wp} flares={{ spikes: 1 / Math.max(1, wp.zoom / 2), size: 1 / Math.max(1, Math.sqrt(wp.zoom / 2)), groups: wp.zoom < 6 }} {...extra} />
      </div>
      <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', width: 1080, height: 1920 }} />
      <pre ref={pre} style={{ position: 'absolute', left: 30, top: 30, color: '#0f0', fontSize: 34, background: 'rgba(0,0,0,0.7)' }} />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="P" component={P} durationInFrames={12} fps={30} width={1080} height={1920} />);
