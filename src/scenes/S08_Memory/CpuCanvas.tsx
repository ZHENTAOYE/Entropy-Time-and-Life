// S08 — CanvasLayer variant whose 2D context is CPU-backed (software Skia raster).
// On the render machines canvases are otherwise "GPU"-accelerated through SwiftShader (CPU emulation), where
// thousands of additive strokes rasterise ~5× slower than plain software raster. Same API as lib CanvasLayer.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { DrawFn } from '../../lib/Canvas';

export const CpuCanvas: React.FC<{ draw: DrawFn; scale?: number; style?: React.CSSProperties }> = ({ draw, scale = 1, style }) => {
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

/** CPU-backed offscreen canvas */
export function cpuCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d', { willReadFrequently: true });
  return c;
}
