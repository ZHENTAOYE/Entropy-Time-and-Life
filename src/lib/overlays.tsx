import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CanvasLayer } from './Canvas';
import { mulberry32 } from './random';
import { memo } from './math';

function grainTile(): HTMLCanvasElement {
  return memo('grain-tile', () => {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(S, S);
    const r = mulberry32(1234);
    for (let i = 0; i < S * S; i++) {
      // roughly gaussian luminance noise around mid-grey
      const v = 128 + ((r() + r() + r() - 1.5) / 1.5) * 110;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
}

/** Animated film grain (overlay blend). Cheap: one pre-generated tile, jittered per frame. */
export const FilmGrain: React.FC<{ opacity?: number; scale?: number }> = ({ opacity = 0.07, scale = 1.5 }) => {
  return (
    <CanvasLayer
      scale={0.5}
      style={{ mixBlendMode: 'overlay', opacity, pointerEvents: 'none' }}
      draw={(ctx, { frame, width, height }) => {
        const tile = grainTile();
        const r = mulberry32(frame * 7919 + 13);
        const ox = -Math.floor(r() * 256 * scale);
        const oy = -Math.floor(r() * 256 * scale);
        const ts = 256 * scale;
        for (let y = oy; y < height; y += ts) for (let x = ox; x < width; x += ts) ctx.drawImage(tile, x, y, ts, ts);
      }}
    />
  );
};

/** Radial vignette. */
export const Vignette: React.FC<{ strength?: number; color?: string }> = ({ strength = 0.55, color = '0,0,0' }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 75% 62% at 50% 50%, rgba(${color},0) 55%, rgba(${color},${strength}) 100%)`,
    }}
  />
);

/** Full-frame colour flash / dip helper, opacity driven by caller. */
export const Flash: React.FC<{ opacity: number; color?: string }> = ({ opacity, color = '#ffffff' }) =>
  opacity > 0.001 ? <AbsoluteFill style={{ background: color, opacity, pointerEvents: 'none' }} /> : null;

/** Returns the current frame inside a Sequence — re-export for convenience. */
export const useFrame = useCurrentFrame;
