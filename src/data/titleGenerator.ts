import type { Rng } from '../core/ports';
import type { GenreId } from './genres';
import type { ThemeId } from './themes';

const PREFIX_BY_GENRE: Record<GenreId, string[]> = {
  action: ['爆走！', '激闘', '剣豪', '疾風の', 'バーサーカー'],
  puzzle: ['ふしぎな', '謎解き', '頭脳の', 'ひらめき', '究極の'],
  rpg: ['伝説の', '英雄譚', '勇者と', '叙事詩', '王国の'],
  shooter: ['銀河の', '爆撃', '光線', '宇宙', '撃墜'],
  adventure: ['果てなき', '物語', '旅人と', '黄昏の', '記憶の'],
  simulation: ['経営録', '街の', '日々の', '構築', '指揮'],
  racing: ['爆走！', '頂上', 'ターボ', 'グランプリ', '0km/h からの'],
  horror: ['呪いの', '深夜の', '禁断の', '怨念の', '黒き'],
  fighting: ['激突！', 'KING OF', '無双', '蹴撃', '頂上'],
  roguelike: ['無限の', '不思議な', '迷宮', '永遠の', '深淵の'],
  rhythm: ['ビート', '踊れ！', 'リズム', '熱狂の', 'ノリノリ'],
  sandbox: ['創造の', '無限の', '築け！', 'クラフト', '世界の'],
  strategy: ['大戦略', '覇道', '智将の', '天下統一', '軍師'],
  sports: ['熱血！', '甲子園', '栄光の', '全力', '逆転'],
  survival: ['極限', '生存記', '荒野の', '最後の', 'サバイブ'],
  cardgame: ['一発逆転', '手札の', '頂上決戦', 'カード', '大逆転'],
  towerdefense: ['防衛', '陥落', '絶対防衛', '迎撃', '最終防衛線'],
  partygame: ['わいわい', 'おまつり', 'みんなで', 'どっきり', '大混戦'],
  escapegame: ['脱出', '密室', '謎解き', 'タイムリミット', '封印の'],
  romanceadventure: ['恋する', '青春', 'ときめき', '放課後の', '淡い'],
  boardgame: ['盤上の', 'サイコロ', '一手', '卓上', '王手'],
  quiz: ['早押し', '一問一答', '正解は', '知識', 'クイズ王'],
  platformer: ['大冒険', 'ジャンプ', '空飛ぶ', '一気駆け', '天空の'],
  visualnovel: ['物語', '選択の', '分岐する', '綴られる', '静かな'],
  raisingsim: ['育て上げる', 'ふれあい', 'すくすく', '我が子の', '相棒'],
  fishing: ['のんびり', '大物', '静かな', '波紋の', '竿の'],
  fps: ['前線', '制圧', '一斉掃討', '最前線の', '決死の'],
};

const NOUN_BY_THEME: Record<ThemeId, string[]> = {
  fantasy: ['竜と聖剣', '魔法学院', '光と影の城'],
  sf: ['銀河放浪記', 'コロニー脱出', '量子の彼方'],
  medieval: ['騎士物語', '城塞戦記', '王と剣'],
  modern: ['街角紀行', '日常譚', '都市探訪'],
  war: ['塹壕日記', '前線突破', '亡国の戦記'],
  sushi: ['回転寿司GP', '大トロ伝説', '寿司職人物語'],
  farming: ['牧場日和', '田植えの記', '豊穣の地'],
  salaryman: ['課長奮闘記', '出世物語', '営業の流儀'],
  konbini: ['深夜の店長', 'レジ打ち戦記', '24時間営業'],
  onsen: ['大浴場', '湯けむり旅館', '秘湯探訪'],
  ninja: ['影の忍法帖', '里抜け', '忍びの七つ道具'],
  pirate: ['七つの海', '海賊王の夢', '宝島伝説'],
  alien: ['宇宙人来日', '異星の使者', '銀河訪問録'],
  zombie: ['ゾンビ大行進', '腐肉の街', '生存者の手記'],
  animal: ['けものたちの', 'もふもふ広場', '動物紀行'],
  camping: ['焚き火物語', '野営の記', '星空キャンプ'],
  library: ['静寂の書架', '禁書目録', '司書の記録'],
  school: ['放課後クロニクル', '教室の記憶', '青春ノート'],
  amusementpark: ['夢の国紀行', '観覧車の約束', 'パレード日和'],
  resort: ['南国バカンス', '波音の記憶', 'リゾート紀行'],
  idol: ['ステージの光', 'アイドル戦記', '幕張の夢'],
  detective: ['密室の真実', '探偵の推理録', '霧の事件簿'],
  hauntedhouse: ['廃屋の記録', '囁く廊下', '肝試し綺譚'],
  circus: ['天幕の魔法', '曲芸師の記憶', '見世物小屋'],
  urbanlegend: ['都市の噂話', '深夜の怪談', '口裂けの記録'],
  musicfestival: ['野外フェス記', '熱狂のステージ', '夏フェス日和'],
  samurai: ['刀と誓い', '侍道記', '江戸剣客伝'],
  cyberpunk: ['ネオン街の夜', '電脳都市記', 'ハッカー戦記'],
};

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

export const generateTitle = (genre: GenreId, theme: ThemeId, rng: Rng = Math.random): string => {
  const prefix = pick(PREFIX_BY_GENRE[genre], rng);
  const noun = pick(NOUN_BY_THEME[theme], rng);
  return `${prefix}${noun}`;
};
