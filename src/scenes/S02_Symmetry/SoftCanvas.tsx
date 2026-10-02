// Local variant of lib/Canvas.tsx: identical contract, but the 2D context is created with
// { willReadFrequently: true }, which makes Chrome keep the canvas in CPU (Skia raster) memory. Under the
// SwiftShader GPU emulation used for rendering, this is much cheaper for many small anti-aliased shapes.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { DrawFn } from '../../lib/Canvas';

export const SoftCanvas: React.FC<{ draw: DrawFn; scale?: number; style?: React.CSSProperties }> = ({ draw, scale = 1, style }) => {
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx, { frame, fps, width: w, height: h, canvas: c });
  });
  return (
    <canvas
      ref={ref}
      width={Math.round(w * scale)}
      height={Math.round(h * scale)}
      style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, ...style }}
    />
  );
};
