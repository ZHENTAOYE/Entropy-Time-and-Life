// TEMPORARY dev-only micro-benchmark (deleted after the revision).
import React from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { CpuCanvas } from './CpuCanvas';
import { renderFrag } from './gl';
import { sandFrag } from './sandShader';
import { sandNoise } from './sandNoise';

function bench() {
  const base = sandFrag(false);
  const variants: Record<string, string> = {
    full: base,
    noShadow: base.replace('for (int i = 0; i < 3; i++) {', 'for (int i = 0; i < 0; i++) {'),
    noNoise: base
      .replace(/float w = vnoise5\([^;]*;/, 'float w = 0.3;')
      .replace(/float defT = [^;]*;/, 'float defT = 0.2;')
      .replace(/float am = vnoise\([^;]*;/, 'float am = 0.5;'),
    
    
  };
  const relief = document.createElement('canvas');
  relief.width = 540;
  relief.height = 960;
  relief.getContext('2d', { willReadFrequently: true })!.fillRect(0, 0, 540, 960);
  const U = (t: number) => ({ u_rs: [1 / 540, 1 / 960], u_cam: [540, 600, 0.8, 0.5], u_anchor: [540, 960], u_t: t, u_light: 1, u_dark: 0, u_gold: 0, u_glitch: 0, u_wind: 1, u_dof: [0.5, 0.42, 0.5], u_ghost: [0, 0, 0, 0], u_sun: [0.96, -0.18, 0.21, 0.217], u_rip: [2, 0.26, 8, 0.7], u_corr: 1 });
  const res: Record<string, number[]> = {};
  const sizes: Array<[number, number]> = [[540, 960], [500, 888], [454, 806]];
  // compile all first
  const tc: string[] = [];
  for (const [k, src] of Object.entries(variants)) {
    const t0 = performance.now();
    renderFrag('b_' + k, src, 540, 960, U(0), { u_relief: relief, u_noise: { src: sandNoise(), repeat: true } });
    tc.push(k + ' first=' + Math.round(performance.now() - t0));
  }
  for (let r = 0; r < 14; r++)
    for (const [k, src] of Object.entries(variants))
      for (const [w, h] of sizes) {
        if (k !== 'full' && w !== 540) continue;
        const t0 = performance.now();
        renderFrag('b_' + k, src, w, h, U(r + 1), { u_relief: relief, u_noise: { src: sandNoise(), repeat: true } });
        const key = k + '@' + w;
        (res[key] = res[key] || []).push(performance.now() - t0);
      }
  console.log('BENCH ' + tc.join(' | ') + ' | ' + Object.entries(res).map(([k, v]) => k + ' min=' + Math.round(Math.min(...v.slice(1)))).join(' | '));
}
const Bench: React.FC = () => (
  <AbsoluteFill style={{ background: '#0A0705' }}>
    <CpuCanvas draw={() => bench()} />
  </AbsoluteFill>
);
registerRoot(() => <Composition id="Bench" component={Bench} durationInFrames={2} fps={30} width={1080} height={1920} />);
