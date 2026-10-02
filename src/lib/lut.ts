// Colour look-up tables.
import { hexToRgb } from './math';

function buildLut(stops: string[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const rgb = stops.map(hexToRgb);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (rgb.length - 1);
    const k = Math.min(rgb.length - 2, Math.floor(t));
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f;
  }
  return lut;
}

/** Inferno-like thermal camera ramp (cold → hot), 256 entries × RGB. */
export const INFERNO = buildLut(['#000004', '#1B0C41', '#4A0C6B', '#781C6D', '#A52C60', '#CF4446', '#ED6925', '#FB9B06', '#F7D13D', '#FCFFA4']);

/** Sample a LUT at t in [0,1] → css rgb(). */
export function lutColor(lut: Uint8ClampedArray, t: number, alpha = 1): string {
  const i = Math.max(0, Math.min(255, Math.round(t * 255))) * 3;
  return alpha >= 1 ? `rgb(${lut[i]},${lut[i + 1]},${lut[i + 2]})` : `rgba(${lut[i]},${lut[i + 1]},${lut[i + 2]},${alpha})`;
}

/**
 * Map a grayscale (alpha or red channel) ImageData in place through a LUT.
 * channel: 0=R, 3=A. Writes opaque pixels.
 */
export function applyLut(img: ImageData, lut: Uint8ClampedArray, channel = 0, gain = 1) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(255, d[i + channel] * gain) | 0;
    d[i] = lut[v * 3];
    d[i + 1] = lut[v * 3 + 1];
    d[i + 2] = lut[v * 3 + 2];
    d[i + 3] = 255;
  }
}
