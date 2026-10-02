// Dev-only: print the cue sheet.
import React, { useLayoutEffect, useRef } from 'react';
import { Composition, registerRoot } from 'remotion';
import { cues } from '../cues';

const C: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.innerText = cues().map((c) => `${c.f} ${c.kind} ${c.intensity}`).join('\n');
  });
  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', fontSize: 26, fontFamily: 'monospace', padding: 20, whiteSpace: 'pre', columnCount: 2 }} />;
};
registerRoot(() => <Composition id="C" component={C} durationInFrames={10} fps={30} width={1080} height={1920} />);
