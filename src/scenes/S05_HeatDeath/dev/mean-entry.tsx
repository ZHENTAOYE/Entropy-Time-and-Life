// Dev-only: mean colour of the shell layer alone at several frames.
import React, { useLayoutEffect, useRef } from 'react';
import { Composition, registerRoot } from 'remotion';
import { webGeometry, fullParams } from '../../../lib/cosmos';
import { drawShells } from '../shells';
import { webAt } from '../timing';

const M: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const L: string[] = [];
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1920;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    for (const f of [100, 130, 160, 185, 200, 220, 244, 270]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 1080, 1920);
      const p = fullParams(webAt(f));
      ctx.globalCompositeOperation = 'lighter';
      drawShells(ctx, { frame: f, width: 1080, height: 1920, geo: webGeometry(p, 160), params: p }, f);
      const d = ctx.getImageData(0, 0, 1080, 1920).data;
      const m = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4 * 37) for (let k = 0; k < 3; k++) m[k] += d[i + k];
      const n = d.length / (4 * 37);
      L.push(`f${f} eq ${p.eq.toFixed(2)}: ${m.map((v) => (v / n).toFixed(1)).join(' ')}`);
    }
    if (ref.current) ref.current.innerText = L.join('\n');
  });
  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', fontSize: 30, fontFamily: 'monospace', padding: 30, whiteSpace: 'pre' }} />;
};
registerRoot(() => <Composition id="M" component={M} durationInFrames={10} fps={30} width={1080} height={1920} />);
