// The scene's single visible canvas: redrawn synchronously every frame (plus whenever `version` changes, e.g. when the
// fonts become ready). CPU-backed 2D context — cheaper than an emulated-GPU canvas for this much compositing.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';

export const Layer: React.FC<{ draw: (ctx: CanvasRenderingContext2D, frame: number) => void; version?: string }> = ({ draw, version = '' }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<string | null>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    const key = frame + '|' + version;
    if (!c || last.current === key) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, c.width, c.height);
    draw(ctx, frame);
    last.current = key;
  });
  return <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />;
};
