import type { GenreId } from './genres';
import type { ThemeId } from './themes';

const PREFIX_BY_GENRE: Record<GenreId, string[]> = {
  action:     ['爆走！', '激闘', '剣豪', '疾風の', 'バーサーカー'],
  puzzle:     ['ふしぎな', '謎解き', '頭脳の', 'ひらめき', '究極の'],
  rpg:        ['伝説の', '英雄譚', '勇者と', '叙事詩', '王国の'],
  shooter:    ['銀河の', '爆撃', '光線', '宇宙', '撃墜'],
  adventure:  ['果てなき', '物語', '旅人と', '黄昏の', '記憶の'],
  simulation: ['経営録', '街の', '日々の', '構築', '指揮'],
  racing:     ['爆走！', '頂上', 'ターボ', 'グランプリ', '0km/h からの'],
  horror:     ['呪いの', '深夜の', '禁断の', '怨念の', '黒き'],
  fighting:   ['激突！', 'KING OF', '無双', '蹴撃', '頂上'],
  roguelike:  ['無限の', '不思議な', '迷宮', '永遠の', '深淵の'],
  rhythm:     ['ビート', '踊れ！', 'リズム', '熱狂の', 'ノリノリ'],
  sandbox:    ['創造の', '無限の', '築け！', 'クラフト', '世界の'],
};

const NOUN_BY_THEME: Record<ThemeId, string[]> = {
  fantasy:   ['竜と聖剣', '魔法学院', '光と影の城'],
  sf:        ['銀河放浪記', 'コロニー脱出', '量子の彼方'],
  medieval:  ['騎士物語', '城塞戦記', '王と剣'],
  modern:    ['街角紀行', '日常譚', '都市探訪'],
  war:       ['塹壕日記', '前線突破', '亡国の戦記'],
  sushi:     ['回転寿司GP', '大トロ伝説', '寿司職人物語'],
  farming:   ['牧場日和', '田植えの記', '豊穣の地'],
  salaryman: ['課長奮闘記', '出世物語', '営業の流儀'],
  konbini:   ['深夜の店長', 'レジ打ち戦記', '24時間営業'],
  onsen:     ['大浴場', '湯けむり旅館', '秘湯探訪'],
  ninja:     ['影の忍法帖', '里抜け', '忍びの七つ道具'],
  pirate:    ['七つの海', '海賊王の夢', '宝島伝説'],
  alien:     ['宇宙人来日', '異星の使者', '銀河訪問録'],
  zombie:    ['ゾンビ大行進', '腐肉の街', '生存者の手記'],
  animal:    ['けものたちの', 'もふもふ広場', '動物紀行'],
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const generateTitle = (genre: GenreId, theme: ThemeId): string => {
  const prefix = pick(PREFIX_BY_GENRE[genre]);
  const noun = pick(NOUN_BY_THEME[theme]);
  return `${prefix}${noun}`;
};
