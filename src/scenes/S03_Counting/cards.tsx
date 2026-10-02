// All on-screen text of S03. Narration lines use lib/Caption (condense → diffuse); the special cards (colon-aligned
// monumental numerals, the monumental 10⁻³⁰, the mirror-aligned golden line, 熵's pinyin, the 3-line definition with
// 乱 struck through) are laid out glyph by glyph with Type.tsx so columns and baselines align exactly.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Caption } from '../../lib/Caption';
import { FONT, useFontsReady } from '../../lib/fonts';
import { ease, memo, seg } from '../../lib/math';
import { C, T } from './constants';
import { GItem, Glyphs, RunSpec, adv, layout, width } from './Type';

const VOICE = { family: 'serif' as const, size: 56, weight: 600, color: C.voice, tracking: 0.08 };

// ------------------------------------------------------------------ card 3 · 全在左边：1种 / 左右各半：6种
const NUM = { family: 'mono' as const, size: 156, weight: 700 };
function card3(): { l1: GItem[]; n1: GItem[]; z1: GItem[]; l2: GItem[]; n2: GItem[]; z2: GItem[] } {
  return memo('S03:card3', () => {
    const wl = width([{ t: '全在左边：' }], VOICE);
    const wn = adv('mono', NUM.size, NUM.weight, '1');
    const wz = adv('serif', 56, 600, '种');
    const total = wl + 18 + wn + 14 + wz;
    const x0 = 540 - total / 2;
    const xn = x0 + wl + 18;
    const xz = xn + wn + 14;
    const y1 = 1356;
    const y2 = 1532;
    const lab = (t: string, y: number) => layout([{ t }], x0, y, VOICE).items;
    const num = (t: string, y: number, color: string) => layout([{ t, glow: 0.45 }], xn, y + 6, { ...NUM, color }).items;
    const zh = (y: number) => layout([{ t: '种' }], xz, y, VOICE).items;
    return { l1: lab('全在左边：', y1), n1: num('1', y1, '#FFFFFF'), z1: zh(y1), l2: lab('左右各半：', y2), n2: num('6', y2, C.amber), z2: zh(y2) };
  });
}

// ------------------------------------------------------------------ card 5 · 100个粒子全在左边：/ 约 10⁻³⁰
function card5(): { l1: GItem[]; big: GItem[]; small: GItem[] } {
  return memo('S03:card5', () => {
    const r1: RunSpec[] = [{ t: '100个粒子全在左边：' }];
    const w1 = width(r1, VOICE) - 0.08 * 56;
    const l1 = layout(r1, 540 - w1 / 2, 806, VOICE).items;
    const big: RunSpec[] = [
      { t: '约', family: 'serif', size: 96, weight: 900, color: C.voice },
      { t: ' ', family: 'latin', size: 96, weight: 600 },
      { t: '10', family: 'latin', size: 270, weight: 600, color: C.pale, glow: 0.35, tracking: -0.03 },
      { t: '−', family: 'mono', size: 150, weight: 400, color: C.pale, rise: 128, glow: 0.35, tracking: -0.3 },
      { t: '30', family: 'latin', size: 150, weight: 600, color: C.pale, rise: 120, glow: 0.35 },
    ];
    const base = { family: 'latin' as const, size: 270, weight: 600, color: C.pale };
    const wb = width(big, base);
    const bigI = layout(big, 540 - wb / 2, 1032, base).items;
    const sm: RunSpec[] = [
      { t: '2' },
      { t: '−100', size: 16, rise: 11 },
      { t: ' = 7.9 × 10' },
      { t: '−31', size: 16, rise: 11 },
    ];
    const sb = { family: 'mono' as const, size: 26, weight: 400, color: C.amber };
    const ws = width(sm, sb);
    const small = layout(sm, 540 - ws / 2, 1092, sb).items;
    return { l1, big: bigI, small };
  });
}

// ------------------------------------------------------------------ card 6 · 一杯水，约 10²⁵ 个分子——/ 全挤到一边的概率：
function card6(): { a: GItem[]; b: GItem[] } {
  return memo('S03:card6', () => {
    const r1: RunSpec[] = [{ t: '一杯水，约 ' }, { t: '10', color: C.amber, family: 'latin', size: 64, tracking: 0.02 }, { t: '25', color: C.amber, family: 'latin', size: 38, rise: 26, tracking: 0.02 }, { t: ' 个分子——' }];
    const r2: RunSpec[] = [{ t: '全挤到一边的概率：' }];
    const w1 = width(r1, VOICE) - 0.08 * 56;
    const w2 = width(r2, VOICE) - 0.08 * 56;
    return { a: layout(r1, 540 - w1 / 2, 1418, VOICE).items, b: layout(r2, 540 - w2 / 2, 1505, VOICE).items };
  });
}

// ------------------------------------------------------------------ card 10 · 聚回来，不是不可能—— / 只是太不可能。
const GOLD = '#FFD98A';
function card10(): { a: GItem[]; b: GItem[] } {
  return memo('S03:card10', () => {
    const base = { ...VOICE, size: 60 };
    const p1: RunSpec[] = [{ t: '聚回来，不是' }];
    const m1: RunSpec[] = [{ t: '不可能', color: C.pale }, { t: '——' }];
    const p2: RunSpec[] = [{ t: '只是', color: GOLD, glow: 0.25 }, { t: '太', color: '#FFFFFF', glow: 0.5 }];
    const m2: RunSpec[] = [{ t: '不可能', color: GOLD, glow: 0.25 }, { t: '。', color: GOLD }];
    const wp1 = width(p1, base);
    const wm1 = width(m1, base) - 0.08 * 60;
    // the shared column: 不可能 sits at the same x in both lines; centre the whole block
    const xc = 540 - (wp1 + wm1) / 2 + wp1;
    const wp2 = width(p2, base);
    const y1 = 1404;
    const y2 = 1512;
    const a = [...layout(p1, xc - wp1, y1, base).items, ...layout(m1, xc, y1, base).items];
    const b = [...layout(p2, xc - wp2, y2, base).items, ...layout(m2, xc, y2, base).items];
    return { a, b };
  });
}

// ------------------------------------------------------------------ card 11 · pinyin
function pinyin(): GItem[] {
  return memo('S03:pinyin', () => {
    const base = { family: 'latin' as const, size: 72, weight: 600, color: C.pale, tracking: 0.12 };
    const r: RunSpec[] = [{ t: 'shāng', italic: true }];
    const w = width(r, base) - 0.12 * 72;
    return layout(r, 540 - w / 2, 404, base).items;
  });
}

// ------------------------------------------------------------------ card 13 · 熵不是“乱”。/ 它数的是：多少种微观排列，/ 看起来一模一样。
const STRIKE_F = T.c13 + 26;
function card13(): { l1: GItem[]; l2: GItem[]; l3: GItem[]; luan: { x: number; w: number; y: number } } {
  return memo('S03:card13', () => {
    const center = (runs: RunSpec[], y: number) => {
      const w = width(runs, VOICE) - 0.08 * 56;
      return layout(runs, 540 - w / 2, y, VOICE).items;
    };
    const luanFx = (local: number) => {
      const k = seg(local, STRIKE_F - T.c13 + 8, STRIKE_F - T.c13 + 16);
      return k > 0 ? { color: k > 0.5 ? '#8A5A3A' : C.voice, opacity: 1 - 0.45 * k } : undefined;
    };
    const l1 = center([{ t: '熵不是“' }, { t: '乱', fx: luanFx }, { t: '”。' }], 1356);
    const l2 = center([{ t: '它数的是：' }, { t: '多少种', color: C.amber }, { t: '微观排列，' }], 1444);
    const l3 = center([{ t: '看起来' }, { t: '一模一样', color: C.pale }, { t: '。' }], 1532);
    const lu = l1.find((g) => g.ch === '乱')!;
    return { l1, l2, l3, luan: { x: lu.x, w: adv('serif', 56, 600, '乱'), y: lu.y } };
  });
}

const StrikeLine: React.FC<{ f: number; x: number; w: number; y: number }> = ({ f, x, w, y }) => {
  const k = ease.inOutCubic(seg(f, STRIKE_F, STRIKE_F + 8));
  const out = 1 - seg(f, T.c13End - 22, T.c13End - 8);
  if (k <= 0 || out <= 0) return null;
  const flash = Math.exp(-Math.max(0, f - STRIKE_F - 8) / 4);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 10,
        top: y - 56 * 0.36 - 2,
        width: (w + 20) * k,
        height: 4,
        background: C.strike,
        opacity: out,
        boxShadow: `0 0 ${8 + 14 * flash}px ${C.strike}`,
        transform: 'rotate(-4deg)',
        transformOrigin: '0 50%',
      }}
    />
  );
};

// ------------------------------------------------------------------ all cards
export const Cards: React.FC = () => {
  const f = useCurrentFrame();
  const ready = useFontsReady([
    [`600 56px ${FONT.serif}`, '全在左边：种左右各半100个粒子聚回来，不是不可能——只是太。熵不“乱”它数的：多少微观排列看起一模样'],
    [`600 60px ${FONT.serif}`, '聚回来，不是不可能——只是太。'],
    [`900 96px ${FONT.serif}`, '约'],
    [`700 156px ${FONT.mono}`, '16'],
    [`400 26px ${FONT.mono}`, '2−100=7.9×10−31 '],
    [`600 270px ${FONT.latin}`, '10−30 25'],
    [`400 150px ${FONT.mono}`, '−'],
    [`600 56px ${FONT.serif}`, '一杯水，约个分子——全挤到边的概率：'],
    [`italic 600 72px ${FONT.latin}`, 'shāng'],
  ]);
  return (
    <>
      {/* 1 · 4个粒子，数一数。 */}
      <Caption text="{4}个粒子，数一数。" from={T.c1} dur={T.deal + 4 - T.c1} accent={C.amber} accentWeight={900} />
      {ready && f >= T.c3a && f < T.c3End ? <Card3 /> : null}
      {ready && f >= T.c5 && f < T.c5End ? <Card5 /> : null}
      {/* 6 · 一杯水… */}
      {ready && f >= T.c6 && f < T.c6End ? <Card6 /> : null}
      {/* 7 · 每个零，只占1毫米。 */}
      <Caption text="每个零，只占{1毫米}。" from={T.c7} dur={T.c7End - T.c7} accent={C.amber} shadow />
      {/* 9 · 这串零，比银河系还长。 */}
      <Caption text="这串零，比{银河系}还长。" from={T.c9} dur={T.c9End - T.c9} accent={C.pale} shadow />
      {ready && f >= T.c10 && f < T.c10End ? <Card10 /> : null}
      {ready && f >= T.glyph + 8 && f < T.formula + 6 ? <Glyphs items={pinyin()} from={T.glyph + 8} dur={T.formula + 6 - (T.glyph + 8)} stagger={2} exitLen={16} seed={11} /> : null}
      {/* 12 · 玻尔兹曼墓碑上的公式 (small) */}
      <Caption text="玻尔兹曼墓碑上的公式" from={T.c12} dur={T.c12End - T.c12} size={40} y={1042} color={C.voice} opacity={0.88} exitLen={20} />
      {ready && f >= T.c13 && f < T.c13End ? <Card13 f={f} /> : null}
    </>
  );
};

const Card3: React.FC = () => {
  const c = card3();
  const end = T.c3End;
  return (
    <>
      <Glyphs items={c.l1} from={T.c3a} dur={end - T.c3a} seed={31} />
      <Glyphs items={c.n1} from={T.c3a + 8} dur={end - T.c3a - 8} enter="slam" enterLen={12} seed={32} />
      <Glyphs items={c.z1} from={T.c3a + 12} dur={end - T.c3a - 12} seed={33} />
      <Glyphs items={c.l2} from={T.c3b} dur={end - T.c3b} seed={34} />
      <Glyphs items={c.n2} from={T.c3b + 8} dur={end - T.c3b - 8} enter="slam" enterLen={12} seed={35} />
      <Glyphs items={c.z2} from={T.c3b + 12} dur={end - T.c3b - 12} seed={36} />
    </>
  );
};

const Card5: React.FC = () => {
  const c = card5();
  return (
    <>
      <Glyphs items={c.l1} from={T.c5} dur={T.c5End - T.c5} stagger={1.4} seed={51} />
      <Glyphs items={c.big} from={T.c5num} dur={T.c5End - T.c5num} enter="slam" enterLen={14} stagger={2.5} seed={52} />
      <Glyphs items={c.small} from={T.c5num + 18} dur={T.c5End - T.c5num - 18} enter="type" stagger={0.7} seed={53} />
    </>
  );
};

const Card6: React.FC = () => {
  const c = card6();
  return (
    <>
      <Glyphs items={c.a} from={T.c6} dur={T.c6End - T.c6} stagger={1.2} seed={61} shadow />
      <Glyphs items={c.b} from={T.c6 + 20} dur={T.c6End - T.c6 - 20} stagger={1.2} seed={62} shadow />
    </>
  );
};

const Card10: React.FC = () => {
  const c = card10();
  return (
    <>
      <Glyphs items={c.a} from={T.c10} dur={T.c10End - T.c10} stagger={1.5} seed={101} shadow />
      <Glyphs items={c.b} from={T.c10 + 26} dur={T.c10End - T.c10 - 26} stagger={2} seed={102} shadow />
    </>
  );
};

const Card13: React.FC<{ f: number }> = ({ f }) => {
  const c = card13();
  return (
    <>
      <Glyphs items={c.l1} from={T.c13} dur={T.c13End - T.c13} stagger={1.5} seed={131} exitLen={26} />
      <StrikeLine f={f} {...c.luan} />
      <Glyphs items={c.l2} from={T.c13 + 20} dur={T.c13End - T.c13 - 20} stagger={1.2} seed={132} exitLen={26} />
      <Glyphs items={c.l3} from={T.c13 + 40} dur={T.c13End - T.c13 - 40} stagger={1.5} seed={133} exitLen={26} />
    </>
  );
};
