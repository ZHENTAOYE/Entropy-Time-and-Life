// S09 dev (NOT part of the film): cold vs warm cost of the ink field / figure / pull-back parts (forced flush).
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { drawInkField } from '../inkfield';
import { drawFigure, drawHaze } from '../inkfx';

const Warm: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const pre = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d', { willReadFrequently: true })!;
    const out: string[] = [`f${f}`];
    const m = (name: string, fn: () => void) => {
      for (const pass of ['cold', 'warm', 'warm2']) {
        ctx.fillStyle = '#F1EADB';
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.getImageData(0, 0, 1, 1);
        const a = performance.now();
        fn();
        ctx.getImageData(0, 0, 1, 1);
        out.push(`${name} ${pass} ${(performance.now() - a).toFixed(0)}`);
      }
    };
    m('field', () => drawInkField(ctx, f, 1));
    m('haze', () => drawHaze(ctx, f, 0.1));
    m('figure', () => drawFigure(ctx, f, 1));
    if (pre.current) pre.current.textContent = out.join('\n');
  });
  return (
    <AbsoluteFill style={{ background: '#fff' }}>
      <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', width: 1080, height: 1920 }} />
      <pre ref={pre} style={{ position: 'absolute', left: 30, top: 30, color: '#0a0', fontSize: 34, background: 'rgba(255,255,255,0.8)' }} />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="Warm" component={Warm} durationInFrames={848} fps={30} width={1080} height={1920} />);
