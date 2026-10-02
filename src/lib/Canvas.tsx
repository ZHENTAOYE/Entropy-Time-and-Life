import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export interface DrawInfo {
  /** frame relative to the enclosing <Sequence> */
  frame: number;
  fps: number;
  /** logical size in px (independent of `scale`) */
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}
export type DrawFn = (ctx: CanvasRenderingContext2D, info: DrawInfo) => void;

/**
 * A full-frame (or sized) 2D canvas that is redrawn synchronously every frame.
 * The context is pre-scaled so you always draw in logical px (default 1080x1920).
 * `scale` < 1 renders at lower internal resolution (cheaper, softer) — good for blurry/glowy layers.
 * The canvas is cleared before each draw unless `clear={false}`.
 */
export const CanvasLayer: React.FC<{
  draw: DrawFn;
  width?: number;
  height?: number;
  scale?: number;
  clear?: boolean;
  style?: React.CSSProperties;
  /** frame override (e.g. for time remapping / rewinding); defaults to useCurrentFrame() */
  frame?: number;
}> = ({ draw, width, height, scale = 1, clear = true, style, frame: frameOverride }) => {
  const cur = useCurrentFrame();
  const frame = frameOverride ?? cur;
  const { fps, width: vw, height: vh } = useVideoConfig();
  const w = width ?? vw;
  const h = height ?? vh;
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    if (clear) ctx.clearRect(0, 0, c.width, c.height);
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
