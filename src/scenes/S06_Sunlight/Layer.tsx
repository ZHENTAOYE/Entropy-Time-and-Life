// Local canvas layer: same contract as lib/Canvas.tsx CanvasLayer, plus
//  · `soft` (default true): a CPU-rasterised 2D context ({ willReadFrequently }) — measured faster than the
//    SwiftShader-emulated GPU canvas for this scene's many thin strokes, gradients and small text draws;
//  · `version`: redraw key besides the frame (e.g. fonts became ready); no redundant redraw otherwise.
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { DrawFn } from '../../lib/Canvas';

export const Layer: React.FC<{ draw: DrawFn; scale?: number; style?: React.CSSProperties; soft?: boolean; version?: string }> = ({ draw, scale = 1, style, soft = true, version = '' }) => {
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<string | null>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    const key = frame + '|' + version;
    if (!c || last.current === key) return;
    const ctx = c.getContext('2d', { willReadFrequently: soft });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx, { frame, fps, width: w, height: h, canvas: c });
    last.current = key;
  });
  return <canvas ref={ref} width={Math.round(w * scale)} height={Math.round(h * scale)} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, ...style }} />;
};
