// DEV ONLY (deleted before hand-off): the reference 你 with an em grid, to author the brush strokes.
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { FONT } from '../../../lib/fonts';
import { useFontGate } from '../fonts';

const SPECS: Array<[string, string]> = [[`900 800px ${FONT.serif}`, '你'], [`400 800px ${FONT.serif}`, '你'], [`600 56px ${FONT.serif}`, '它画出了你。']];
const G: React.FC = () => {
  const ready = useFontGate(SPECS);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const ctx = ref.current.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1080, 1920);
    const draw = (spec: string, cy: number, col: string) => {
      ctx.font = spec;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = col;
      ctx.fillText('你', 540, cy);
    };
    // em box 800 px centred at (540, cy): x0 = 140, y0 = cy - 400
    for (const [spec, cy] of [[SPECS[0][0], 480], [SPECS[1][0], 1400]] as const) {
      draw(spec, cy, '#222');
      ctx.strokeStyle = 'rgba(255,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.font = '20px monospace';
      ctx.fillStyle = 'red';
      for (let k = 0; k <= 10; k++) {
        const x = 140 + k * 80, y = cy - 400 + k * 80;
        ctx.beginPath(); ctx.moveTo(x, cy - 400); ctx.lineTo(x, cy + 400); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(940, y); ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillText((k / 10).toFixed(1), x + 2, cy - 404);
        ctx.fillText((k / 10).toFixed(1), 100, y + 6);
      }
    }
  });
  return (
    <AbsoluteFill style={{ background: '#fff' }}>
      <canvas ref={ref} width={1080} height={1920} />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="Glyph" component={G} durationInFrames={2} fps={30} width={1080} height={1920} />);
