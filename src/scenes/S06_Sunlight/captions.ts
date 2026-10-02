// The five narration cards of S06 (text locked by docs/screenplay.md v1; curly quotes U+201C/U+201D).
// Timing (timing.ts CAP): screenplay v1 ±0.5 s; per-line stagger; C5's second line is formed by local ~30.
import { CaptionSpec } from './RichCaption';
import { P } from './palette';
import { CAP, YOU_AT } from './timing';
import { floodR } from './sky';
import { seg } from '../../lib/math';

const RED_DEEP = '#F0342C';

export const CAPTIONS: CaptionSpec[] = [
  {
    from: CAP.c1.at,
    dur: CAP.c1.dur,
    lineDelay: [0, 6],
    // no dark smudge on the uniform grey: the backdrop arrives once the light has cleared the lower third
    backdropGate: (f) => seg(floodR(f), 700, 1150),
    lines: [
      [{ text: '地球不“攒”阳光：' }],
      [{ text: '收', color: P.gold, glow: 0.35 }, { text: '多少，几乎就' }, { text: '还', color: '#FF5A48', glow: 0.35 }, { text: '多少。' }],
    ],
  },
  {
    from: CAP.c2.at,
    dur: CAP.c2.dur,
    // line 2 condenses as the gold packet lands and starts to unzip
    lineDelay: [0, 22],
    lines: [
      [{ text: '进来' }, { text: '1', color: P.gold, size: 74, glow: 0.45 }, { text: '个光子，' }],
      [{ text: '出去约' }, { text: '20', color: RED_DEEP, size: 74, glow: 0.45 }, { text: '个。' }],
    ],
  },
  {
    from: CAP.c3.at,
    dur: CAP.c3.dur,
    y: 1452,
    backdrop: 1.35,
    lineDelay: [0, 6],
    lineGap: 0.3,
    lines: [
      [{ text: '能量一样多——' }],
      [
        { text: '熵，多了约' },
        { text: '20', color: RED_DEEP, size: 168, glow: 0.55, letterSpacing: 0.01 },
        { text: '倍', color: RED_DEEP, size: 132, weight: 900, glow: 0.55, letterSpacing: 0.02 },
        { text: '。' },
      ],
    ],
  },
  {
    from: CAP.c4.at,
    dur: CAP.c4.dur,
    lineDelay: [0, 6],
    lines: [[{ text: '像那滴墨，' }], [{ text: '阳光在地球上“' }, { text: '散开', color: '#FFF1EA', fx: 'ink', fxAt: 36 }, { text: '”了。' }]],
  },
  {
    from: CAP.c5.at,
    dur: CAP.c5.dur,
    lineDelay: [0, 6],
    stagger: 0.8,
    lines: [
      [{ text: '这一“散”的' }, { text: '差价', color: P.leaf, glow: 0.3 }, { text: '，' }],
      [{ text: '养活了绿叶，也养活了' }, { text: '你', fx: 'bright', fxAt: YOU_AT - CAP.c5.at }, { text: '。' }],
    ],
  },
];
