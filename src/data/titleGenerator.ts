import type { GenreId } from './genres';
import type { ThemeId } from './themes';

const PREFIX_BY_GENRE: Record<GenreId, string[]> = {
  action: ['爆走！', '激闘', '剣豪', '疾風の', 'バーサーカー'],
  puzzle: ['ふしぎな', '謎解き', '頭脳の', 'ひらめき', '究極の'],
  rpg:    ['伝説の', '英雄譚', '勇者と', '叙事詩', '王国の'],
  horror: ['呪いの', '深夜の', '禁断の', '怨念の', '黒き'],
};

const NOUN_BY_THEME: Record<ThemeId, string[]> = {
  fantasy: ['竜と聖剣', '魔法学院', '光と影の城'],
  sf:      ['銀河放浪記', 'コロニー脱出', '量子の彼方'],
  sushi:   ['回転寿司GP', '大トロ伝説', '寿司職人物語'],
  ninja:   ['影の忍法帖', '里抜け','忍びの七つ道具'],
  zombie:  ['ゾンビ大行進', '腐肉の街', '生存者の手記'],
  onsen:   ['大浴場', '湯けむり旅館', '秘湯探訪'],
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const generateTitle = (genre: GenreId, theme: ThemeId): string => {
  const prefix = pick(PREFIX_BY_GENRE[genre]);
  const noun = pick(NOUN_BY_THEME[theme]);
  return `${prefix}${noun}`;
};
