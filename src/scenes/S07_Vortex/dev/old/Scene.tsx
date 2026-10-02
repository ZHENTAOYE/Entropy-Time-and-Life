import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Caption } from '../../../../lib/Caption';
import { ShaderLayer } from '../../../../lib/Shader';
import { ease, seg } from '../../../../lib/math';
import { camAt, camUniforms } from './camera';
import { BookTitle, BorrowCard, BulbCard, ProcessCard } from './cards';
import { HudThermal } from './HudThermal';
import { Hud } from './Hud';
import { Scrim } from './glyphs';
import { S07Layers } from './Layers';
import { WATER_FRAG } from './shaders';
import { CAP, T } from './timing';
import { V } from './vortex';
import { LAYERS } from './devflags';

const WaterBg: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const q = (V.R0 * V.R0 - V.rEye * V.rEye) / V.Lin;
  return (
    <ShaderLayer
      frag={WATER_FRAG}
      scale={0.34}
      uniforms={{
        u_t: f,
        ...camUniforms(cam),
        u_mix: ease.inOutSine(seg(f, 0, T.waterIn1)),
        u_tex: 1 - seg(f, T.morph0 + 10, T.morph0 + 70),
        u_k: V.k,
        u_R0: V.R0,
        u_q: q,
        u_rc: V.rc,
        u_side: seg(f, T.tilt1a, T.tilt1b),
      }}
    />
  );
};

export const Scene: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: f < T.scan1 ? '#04050B' : '#05030F' }}>
      {f <= T.scan1 && LAYERS.water ? <WaterBg /> : null}
      {LAYERS.raster ? <S07Layers /> : null}
      {LAYERS.captions ? <>
      {/* soft scrims behind the caption lane (cheaper and calmer than per-glyph shadows) */}
      <Scrim frame={f} from={CAP.c1.at} dur={CAP.c1.dur} y={1490} h={420} strength={0.55} />
      <Scrim frame={f} from={CAP.c2.at} dur={CAP.c2.dur} y={1452} />
      <Scrim frame={f} from={CAP.c4.at} dur={CAP.c4.dur} y={1452} />
      <Scrim frame={f} from={CAP.c5.at} dur={CAP.c5.dur} y={1540} h={260} strength={0.45} />
      <Scrim frame={f} from={CAP.c6.at} dur={CAP.c6.dur} y={1488} strength={0.35} />
      <Scrim frame={f} from={CAP.c7.at} dur={CAP.c7.dur} y={1488} color="10,4,30" strength={0.6} />
      <Scrim frame={f} from={CAP.c8.at} dur={CAP.c8.dur} y={1488} color="10,4,30" strength={0.6} />
      <Scrim frame={f} from={CAP.c9.at} dur={CAP.c9.dur} y={1488} color="10,4,30" strength={0.6} />
      <Scrim frame={f} from={CAP.c10.at} dur={CAP.c10.dur} y={1500} h={240} color="10,4,30" strength={0.5} />
      <Scrim frame={f} from={CAP.c11.at} dur={CAP.c11.dur} y={1500} h={260} color="10,4,30" strength={0.55} />
      <BookTitle from={CAP.c1.at} dur={CAP.c1.dur} />
      <Caption text={'他写道：\n生命以“{负熵}”为食。'} from={CAP.c2.at} dur={CAP.c2.dur} y={1452} accent="#FFC94A" />
      <Caption text={'{形状}一直都在，\n水，{没有一滴}停留。'} from={CAP.c4.at} dur={CAP.c4.dur} y={1452} accent="#9FEFFF" />
      <Caption text="你也是。" from={CAP.c5.at} dur={CAP.c5.dur} y={1540} size={120} weight={900} enterLen={12} stagger={4} exitLen={18} glow={0.25} letterSpacing={0.12} />
      <Caption text={'你的大部分原子，\n{几个月前}还不在这里。'} from={CAP.c6.at} dur={CAP.c6.dur} y={1488} accent="#FFC94A" stagger={1} />
      <BulbCard from={CAP.c7.at} dur={CAP.c7.dur} />
      <Caption text={'按每公斤算，\n你发的热是太阳的约{7000倍}。'} from={CAP.c8.at} dur={CAP.c8.dur} y={1488} accent="#FCFFA4" accentWeight={900} stagger={1} />
      <BorrowCard from={CAP.c9.at} dur={CAP.c9.dur} />
      <Caption text="你不是一个东西。" from={CAP.c10.at} dur={CAP.c10.dur} y={1500} size={64} stagger={2} exitLen={14} />
      <ProcessCard from={CAP.c11.at} dur={CAP.c11.dur} />
      </> : null}
      {LAYERS.hud ? <Hud /> : null}
      {LAYERS.hudThermal ? <HudThermal /> : null}
    </AbsoluteFill>
  );
};
