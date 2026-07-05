/**
 * v0.15「ビルドアップ・タイピング」（オーナー承認 2026-07-05）：
 * 文＝開発作業。各文は属性（面白さ/グラフィック/サウンド/企画力/バグ）を持ち、
 * 打ち切るとその属性の開発パラメータが伸びる。「入力がどこに効くか」を色と数字で見せる。
 *
 * ※ ひらがなのみ（タイピングエンジン制約：長音「ー」・カタカナ不可）
 */

export type DevAttr = 'fun' | 'graphics' | 'sound' | 'plan' | 'bug';

export const DEV_ATTR_META: Record<
  DevAttr,
  { icon: string; label: string; color: string; dim: string }
> = {
  fun: { icon: '🎮', label: '面白さ', color: '#ff9f2e', dim: '#5a3a10' },
  graphics: { icon: '🎨', label: 'グラフィック', color: '#4db3ff', dim: '#123a5a' },
  sound: { icon: '🎵', label: 'サウンド', color: '#5fe08a', dim: '#124a28' },
  plan: { icon: '📋', label: '企画力', color: '#d8a5ff', dim: '#3a2255' },
  bug: { icon: '🐛', label: 'バグ修正', color: '#ff5a5a', dim: '#4a1212' },
};

/** 属性ごとの開発作業フレーズ（ひらがなのみ） */
const POOLS: Record<DevAttr, string[]> = {
  fun: [
    'ひっさつわざをたす',
    'てきのうごきをつよくする',
    'あたらしいすてーじをつくる',
    'かくしようそをしこむ',
    'ぼすのこうげきをふやす',
    'こんぼのきもちよさをあげる',
    'あそびのはばをひろげる',
    'むずかしさをちょうせいする',
  ],
  graphics: [
    'はいけいをかきこむ',
    'どっとえをうちこむ',
    'きゃらのあにめをつける',
    'いろをぬりなおす',
    'えふぇくとをひからせる',
    'がめんをはでにする',
    'もんすたあをでざいんする',
    'まちなみをかきたす',
  ],
  sound: [
    'こうかおんをつける',
    'おんがくをつくる',
    'たいこのおとをいれる',
    'かちおとをきもちよくする',
    'ぼすせんのきょくをかく',
    'あしおとをならす',
    'ふぁんふぁーれをつくる',
    'おとのばらんすをとる',
  ],
  plan: [
    'しようをきめる',
    'ばらんすをととのえる',
    'あそびかたをせいりする',
    'てすとけいかくをたてる',
    'ゆーざーのこえをよむ',
    'うりかたをかんがえる',
    'せかいかんをかためる',
    'すけじゆうるをひきなおす',
  ],
  bug: [
    'ばぐをしゅうせいする',
    'くらっしゅをとめる',
    'えらーろぐをつぶす',
    'ぬけみちをふさぐ',
  ],
};

export type AttrPhrase = { attr: DevAttr; phrase: string };

/**
 * 開発 1 本ぶんの属性つきフレーズ列を生成。
 * 4 属性をバランスよく回しつつ、約 12% でバグ文（赤）を混ぜる。
 */
export const buildAttrPhrases = (count: number, seedShuffle = Math.random): AttrPhrase[] => {
  const attrs: DevAttr[] = ['fun', 'graphics', 'sound', 'plan'];
  const out: AttrPhrase[] = [];
  for (let i = 0; i < count; i++) {
    const attr: DevAttr =
      seedShuffle() < 0.12 ? 'bug' : attrs[Math.floor(seedShuffle() * attrs.length)];
    const pool = POOLS[attr];
    out.push({ attr, phrase: pool[Math.floor(seedShuffle() * pool.length)] });
  }
  return out;
};

/** コンボ倍率（数字インフレ）：10 で×1.5、30 で×2、100 で×3（叩き台 🔧） */
export const comboAttrMultiplier = (combo: number): number =>
  combo >= 100 ? 3 : combo >= 30 ? 2 : combo >= 10 ? 1.5 : 1;

export type SpeedRank = 'PERFECT' | 'GREAT' | 'GOOD';

/**
 * 文の速度判定：かな 1 文字あたり 340ms を基準（par）に、
 * 55% 未満 PERFECT(×1.5) / 85% 未満 GREAT(×1.2) / それ以外 GOOD(×1)。
 */
export const speedRank = (
  hiraganaLen: number,
  elapsedMs: number,
): { rank: SpeedRank; mult: number } => {
  const par = Math.max(1, hiraganaLen) * 340;
  if (elapsedMs < par * 0.55) return { rank: 'PERFECT', mult: 1.5 };
  if (elapsedMs < par * 0.85) return { rank: 'GREAT', mult: 1.2 };
  return { rank: 'GOOD', mult: 1 };
};

/** 1 文の基礎獲得値（属性ポイント） */
export const ATTR_BASE_GAIN = 4;
