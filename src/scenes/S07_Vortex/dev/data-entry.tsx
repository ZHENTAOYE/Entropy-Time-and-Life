// Dev-only: print model event frames (census crossings, beats, day counter, turnover stats) for the cue sheet.
import React, { useLayoutEffect, useRef } from 'react';
import { Composition, registerRoot } from 'remotion';
import { censusFraction, censusZero } from '../vortex';
import { BEATS } from '../heart';
import { dayAt, dayFlow, flowTime, originalFraction, turnover } from '../flow';
import { morphDone, morphStart } from '../bodyDraw';
import { bodyData, N_BODY } from '../body';
import { T } from '../timing';
import { exhaleOnsets } from '../breath';

const D: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const L: string[] = [];
    let last = 11;
    const cross: string[] = [];
    for (let f = T.tag; f < T.tag + 100; f++) {
      const k = Math.ceil(censusFraction(f) * 10 - 1e-9);
      if (k < last) {
        cross.push(`${f}:${k * 10}%`);
        last = k;
      }
    }
    L.push('census ' + cross.join(' ') + ' zero ' + censusZero());
    L.push('beats ' + BEATS.join(' '));
    const days: string[] = [];
    let ld = -1;
    for (let f = 380; f < 470; f++) {
      const d = dayAt(f);
      if (Math.floor(d / 10) !== Math.floor(ld / 10)) days.push(`${f}:${d}`);
      ld = d;
    }
    L.push('days ' + days.join(' '));
    let mn = 1e9;
    const done: number[] = [];
    for (let i = 0; i < N_BODY; i++) {
      mn = Math.min(mn, morphStart(i));
      done.push(morphDone(i));
    }
    done.sort((a, b) => a - b);
    const pc = (q: number) => done[Math.min(done.length - 1, Math.floor(q * done.length))].toFixed(0);
    L.push(`morph start ${mn.toFixed(0)} seated 10% ${pc(0.1)} 50% ${pc(0.5)} 70% ${pc(0.7)} 90% ${pc(0.9)} 100% ${pc(0.9999)}`);
    const B = bodyData();
    const TO = turnover();
    let nb = 0;
    for (let s = 0; s < B.ns; s++) nb += B.bone[s];
    const pools = [0, 0, 0];
    for (let i = 0; i < N_BODY; i++) pools[TO.pool[i]]++;
    L.push(`ns ${B.ns} boneSlots ${nb} pools water/bone/slow ${pools.join('/')} exchanges ${TO.exT.length}`);
    const D0 = flowTime(T.days0);
    const dpf = dayFlow();
    L.push(`dayFlow ${dpf.toFixed(3)} s0 ${D0.toFixed(2)} s(899) ${flowTime(899).toFixed(1)}`);
    L.push('orig ' + [0, 7, 14, 34, 60, 90].map((d) => `d${d}:${(originalFraction(D0 + d * dpf) * 100).toFixed(1)}%`).join(' '));
    L.push('exhale ' + exhaleOnsets(372, 899).join(' '));
    if (ref.current) ref.current.innerText = L.join('\n');
  });
  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', fontSize: 30, fontFamily: 'monospace', padding: 40, whiteSpace: 'pre-wrap', width: 1000 }} />;
};
registerRoot(() => <Composition id="D" component={D} durationInFrames={10} fps={30} width={1080} height={1920} />);
