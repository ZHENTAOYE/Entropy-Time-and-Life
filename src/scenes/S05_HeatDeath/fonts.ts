// Every font slice S05 draws into its canvas (loaded once, before the first frame is drawn).
import { FONT } from '../../lib/fonts';

export const F = {
  voice: `600 56px ${FONT.serif}`,
  void: `200 210px ${FONT.serif}`,
  numeral: `300 106px ${FONT.mono}`,
  expo: `300 55px ${FONT.mono}`,
  year: `400 44px ${FONT.sans}`,
  label: `400 38px ${FONT.sans}`,
  hud: `400 28px ${FONT.mono}`,
  hudSup: `400 17px ${FONT.mono}`,
  hudSmall: `400 21px ${FONT.mono}`,
  gaugeS: `italic 600 30px ${FONT.latin}`,
  zh: `400 26px ${FONT.sans}`,
  data: `400 24px ${FONT.mono}`,
} as const;

const DIGITS = '0123456789';

export const CAPTION_TEXT = '滚到最后呢？温度处处相同。能量都还在，却再也做不了任何事。这叫——但在滚落的路上——';

export const FONT_SPECS: Array<[string, string]> = [
  [F.voice, CAPTION_TEXT],
  [F.void, '热寂。'],
  [F.numeral, '~' + DIGITS],
  [F.expo, DIGITS],
  [F.year, '年'],
  [F.label, '·最后的恒星熄灭最大的黑洞蒸发殆尽'],
  [F.hud, '×:' + DIGITS],
  [F.hudSup, DIGITS],
  [F.hudSmall, 'STARSBLACKHOLES ' + DIGITS],
  [F.gaugeS, 'S'],
  [F.zh, '冷热能量净流'],
  [F.data, DIGITS + '.%'],
];
