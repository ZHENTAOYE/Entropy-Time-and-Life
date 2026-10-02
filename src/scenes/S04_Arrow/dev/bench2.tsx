// S04 dev bench 2: caption cost in isolation (not part of the film).
import React from 'react';
import { AbsoluteFill, Composition, Freeze, registerRoot, useCurrentFrame } from 'remotion';
import { SceneFrame } from '../../../lib/SceneFrame';
import { CanvasLayer } from '../../../lib/Canvas';
import { Voice } from '../Voice';
import { drawArrow } from '../arrow';

const C1 = () => <Voice text={'{熵增}的方向，\n就是{时间}的方向。'} from={4} dur={100} accent="#FFC94A" accentWeight={900} lineDx={[30, -30]} exitLen={22} halo="rgba(2,3,10,0.8)" />;
const C2 = () => <Voice text={'往回追：\n{越早}，熵{越低}。'} from={102} dur={70} accent="#FFC94A" exitLen={22} halo="rgba(2,3,10,0.8)" />;
const CASES: Array<() => React.ReactNode> = [
  () => <AbsoluteFill style={{ background: '#000' }} />,
  () => (<Freeze frame={100}><C1 /><C2 /></Freeze>),
  () => (<Freeze frame={60}><C1 /></Freeze>),
  () => (<Freeze frame={100}><CanvasLayer draw={(ctx) => drawArrow(ctx, 100)} /></Freeze>),
];
const Bench: React.FC = () => {
  const f = useCurrentFrame();
  return <SceneFrame><AbsoluteFill style={{ background: '#000' }}>{CASES[f % CASES.length]()}</AbsoluteFill></SceneFrame>;
};
registerRoot(() => <Composition id="Bench2" component={Bench} durationInFrames={CASES.length * 3} fps={30} width={1080} height={1920} />);
