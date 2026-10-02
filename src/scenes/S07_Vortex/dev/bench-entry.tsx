// Dev-only micro-benchmark (not part of the film): times the S07 renderers in-browser and prints the result.
import React, { useLayoutEffect, useRef } from 'react';
import { Composition, registerRoot } from 'remotion';
import { renderMain, renderThermal } from '../render';
import { bodyData } from '../body';
import { vparts } from '../vortex';
import { rosette06 } from '../s06';
import { turnover } from '../flow';
import { bodyFrame } from '../bodyDraw';
import { camAt } from '../camera';

const Bench: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const lines: string[] = [];
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1920;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const t = document.createElement('canvas');
    t.width = 360;
    t.height = 640;
    const tctx = t.getContext('2d', { willReadFrequently: true })!;
    let t0 = performance.now();
    vparts();
    lines.push(`vparts ${(performance.now() - t0).toFixed(0)} ms`);
    t0 = performance.now();
    rosette06();
    lines.push(`rosette06 ${(performance.now() - t0).toFixed(0)} ms`);
    t0 = performance.now();
    bodyData();
    lines.push(`bodyData ${(performance.now() - t0).toFixed(0)} ms`);
    t0 = performance.now();
    turnover();
    lines.push(`turnover ${(performance.now() - t0).toFixed(0)} ms`);
    const time = (name: string, fn: () => void, n = 3) => {
      fn();
      const t1 = performance.now();
      for (let i = 0; i < n; i++) fn();
      ctx.getImageData(0, 0, 1, 1);
      lines.push(`${name}: ${((performance.now() - t1) / n).toFixed(1)} ms`);
    };
    for (const f of [0, 20, 200, 310, 330, 420, 452, 520, 620, 700, 790, 840, 890]) {
      time(`main f${f}`, () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, 1080, 1920);
        renderMain(ctx, f);
      });
      let nonce = 0;
      if (f >= 330) time(`  bodyFrame f${f}`, () => bodyFrame(f + 1e-4 * ++nonce, camAt(f)), 2);
      if (f >= 462) time(`  thermal f${f}`, () => renderThermal(tctx, f));
    }
    if (ref.current) ref.current.innerText = lines.join('\n');
  });
  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', fontSize: 30, fontFamily: 'monospace', padding: 40, whiteSpace: 'pre' }} />;
};
registerRoot(() => <Composition id="Bench" component={Bench} durationInFrames={900} fps={30} width={1080} height={1920} />);
