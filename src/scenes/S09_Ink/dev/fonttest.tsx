// DEV ONLY (deleted before hand-off): first-use cost of each canvas font on a cold page.
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { FONT_SPECS, useFontGate } from '../fonts';

const T: React.FC = () => {
  const ready = useFontGate(FONT_SPECS);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const ctx = ref.current.getContext('2d', { willReadFrequently: true })!;
    for (const pass of [0, 1]) {
      for (const [spec, text] of FONT_SPECS) {
        const t0 = performance.now();
        ctx.font = spec;
        ctx.fillStyle = '#fff';
        ctx.fillText(text.slice(0, 12), 10, 100);
        ctx.getImageData(0, 0, 1, 1);
        console.log(`[font] pass${pass} ${spec.slice(0, 28)} ${(performance.now() - t0).toFixed(1)}`);
      }
    }
  });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <canvas ref={ref} width={1080} height={1920} />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="FontTest" component={T} durationInFrames={10} fps={30} width={1080} height={1920} />);
