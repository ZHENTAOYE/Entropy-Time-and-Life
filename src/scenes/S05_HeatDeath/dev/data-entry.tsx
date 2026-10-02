// Dev-only: print cosmos data used to schedule S05 (not part of the film).
import React, { useLayoutEffect, useRef } from 'react';
import { Composition, registerRoot } from 'remotion';
import { WEB_FINAL, bhCandidates, webNodes, blackHoles } from '../../../lib/cosmos';

const D: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const L: string[] = [];
    const c = bhCandidates();
    for (const b of c) L.push(`bh ${b.key} m=${b.mass.toFixed(3)} appear=${b.appear.toFixed(3)} evap=${b.evap.toFixed(3)}`);
    const hs = blackHoles({ ...WEB_FINAL, bh: 0.3 });
    for (const h of hs) L.push(`bhpos ${h.key} x=${h.x.toFixed(0)} y=${h.y.toFixed(0)} r=${h.r.toFixed(1)}`);
    const ns = webNodes(WEB_FINAL);
    const t0 = ns.filter((n) => n.tier === 0), t1 = ns.filter((n) => n.tier === 1);
    L.push(`nodes tier0 ${t0.length} tier1 ${t1.length}`);
    const vis = ns.filter((n) => n.x > 0 && n.x < 1080 && n.y > 0 && n.y < 1920);
    L.push(`onscreen ${vis.length}`);
    const sorted = [...vis].sort((a, b) => b.dieRank - a.dieRank).slice(0, 8);
    for (const n of sorted) L.push(`last t${n.tier} dr=${n.dieRank.toFixed(3)} x=${n.x.toFixed(0)} y=${n.y.toFixed(0)} m=${n.mass.toFixed(2)} b=${n.bright.toFixed(2)}`);
    const hist = new Array(10).fill(0);
    for (const n of vis) hist[Math.min(9, Math.floor(n.dieRank * 10))]++;
    L.push('dieRank hist ' + hist.join(' '));
    const big = [...t0].filter((n) => n.x > 0 && n.x < 1080 && n.y > 0 && n.y < 1920).sort((a, b) => b.mass - a.mass).slice(0, 12);
    for (const n of big) L.push(`t0 m=${n.mass.toFixed(2)} dr=${n.dieRank.toFixed(3)} x=${n.x.toFixed(0)} y=${n.y.toFixed(0)}`);
    if (ref.current) ref.current.innerText = L.join('\n');
  });
  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', fontSize: 26, fontFamily: 'monospace', padding: 30, whiteSpace: 'pre-wrap', width: 1020 }} />;
};
registerRoot(() => <Composition id="D" component={D} durationInFrames={10} fps={30} width={1080} height={1920} />);
