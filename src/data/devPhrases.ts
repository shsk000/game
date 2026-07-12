import type { Rng } from '../core/ports';
import type { GenreId } from './genres';

/**
 * v0.15.2「作業チケット」システム（オーナー改修指示 2026-07-08）：
 * 開発フェーズを「ゲージを見る画面」から「作業チケットをタイピングで進める画面」に作り替える。
 *
 * - 作業タイプ（カテゴリ）は固定 4 種：プログラム / グラフィック / サウンド / ゲームデザイン
 * - 作業チケットはジャンルごとに変わる具体的な作業（例：RPG のプログラムなら「敵を配置する」）
 * - 実際に打つひらがな文はカテゴリ単位の汎用プール（チケットの見出し/説明とは独立）
 * - バグ関連の入力はこのチケット周期には含めない（v0.14 のランダムイベント「バグ発生」側で扱う）
 */

export type TicketCategory = 'program' | 'graphics' | 'sound' | 'design';

export const CATEGORY_ORDER: TicketCategory[] = ['program', 'graphics', 'sound', 'design'];

export const CATEGORY_META: Record<
  TicketCategory,
  { icon: string; label: string; color: string; dim: string }
> = {
  program: { icon: '</>', label: 'プログラム', color: '#4db3ff', dim: '#123a5a' },
  graphics: { icon: '🎨', label: 'グラフィック', color: '#5fe08a', dim: '#124a28' },
  sound: { icon: '🎵', label: 'サウンド', color: '#ffd166', dim: '#4a3a12' },
  design: { icon: '📋', label: 'ゲームデザイン', color: '#d8a5ff', dim: '#3a2255' },
};

/** 1 チケットを完了させるのに必要な入力フレーズ数（叩き台 🔧） */
export const PHRASES_PER_TICKET = 3;

export type TicketFlavor = { title: string; desc: string };

/** カテゴリ別の汎用入力フレーズプール（ひらがなのみ。ジャンル共通・チケットの見出しとは別） */
export const CATEGORY_PHRASE_POOLS: Record<TicketCategory, string[]> = {
  program: [
    'てきをはいちする',
    'あたりはんていをつくる',
    'すこあをけいさんする',
    'じょうたいをかんりする',
    'せーぶしょりをつくる',
    'にゅうりょくをうけつける',
    'たいまーしょりをつくる',
    'でーたをよみこむ',
  ],
  graphics: [
    'どっとえをかきこむ',
    'いろをぬりわける',
    'あにめーしょんをつける',
    'はいけいをかきたす',
    'えふぇくとをひからせる',
    'きゃらのりんかくをととのえる',
    'ぱれっとをちょうせいする',
    'ふれーむをつなげる',
  ],
  sound: [
    'こうかおんをつける',
    'めろでぃをつくる',
    'りずむをきざむ',
    'おとをみっくすする',
    'いんとろをつくる',
    'てんぽをととのえる',
    'おとりょうをちょうせいする',
    'るーぷさせる',
  ],
  design: [
    'ばらんすをかんがえる',
    'あそびかたをまとめる',
    'なんいどをきめる',
    'ゆーざーのこえをよむ',
    'しようしょをかく',
    'てすとけいかくをたてる',
    'あいであをせいりする',
    'ゆーあいをみなおす',
  ],
};

/** ジャンル別の作業チケット（カテゴリごとに 3 件）。3 ジャンルはオーナー指定を厳守、残りは同トーンで補完。 */
export const GENRE_TICKETS: Record<GenreId, Record<TicketCategory, TicketFlavor[]>> = {
  rpg: {
    program: [
      { title: '敵を配置する', desc: '草原エリアに敵モンスターを出現させる処理を作成する' },
      { title: '戦闘処理を作る', desc: 'ターン制の戦闘システムを実装する' },
      { title: '経験値を計算する', desc: '倒した敵に応じて経験値を加算する処理を作る' },
    ],
    graphics: [
      { title: 'スライムを描く', desc: '序盤に登場する敵キャラクターのドット絵を描く' },
      { title: '草原マップを描く', desc: '最初のフィールドとなる草原エリアの背景を描く' },
      { title: '魔法エフェクトを作る', desc: '攻撃魔法を放った時の演出を作る' },
    ],
    sound: [
      { title: '戦闘BGMを作る', desc: '緊張感のあるバトル曲を作曲する' },
      { title: '攻撃音を作る', desc: '武器を振った時の効果音を作る' },
      { title: 'レベルアップ音を作る', desc: '経験値が貯まった時の達成感ある音を作る' },
    ],
    design: [
      { title: '戦闘バランスを考える', desc: '敵の強さとプレイヤーの成長速度を調整する' },
      { title: 'レベルデザインを考える', desc: 'マップの難易度配分を設計する' },
      { title: '育成システムを考える', desc: 'キャラクターの成長要素を企画する' },
    ],
  },
  puzzle: {
    program: [
      { title: 'ピース判定を作る', desc: 'ピース同士が揃った時の判定処理を実装する' },
      { title: '連鎖処理を作る', desc: '消えた後に落ちてくる連鎖ロジックを作る' },
      { title: 'スコアを計算する', desc: '消したピース数に応じてスコアを加算する処理を作る' },
    ],
    graphics: [
      { title: 'パズルピースを描く', desc: '色とりどりのピースのドット絵を描く' },
      { title: '消去エフェクトを作る', desc: 'ピースが消える時の演出を作る' },
      { title: '背景パネルを描く', desc: '盤面の背景となるパネル画像を描く' },
    ],
    sound: [
      { title: '消去音を作る', desc: 'ピースが消える時の心地よい音を作る' },
      { title: 'コンボ音を作る', desc: '連鎖が続いた時の盛り上がる音を作る' },
      { title: 'クリア音を作る', desc: 'ステージクリア時の達成音を作る' },
    ],
    design: [
      { title: '難易度カーブを考える', desc: 'ステージが進むごとの難しさの上げ方を設計する' },
      { title: '盤面サイズを考える', desc: '遊びやすい盤面の大きさを検討する' },
      { title: 'ギミック案を考える', desc: '新しい種類のピースやギミックを企画する' },
    ],
  },
  action: {
    program: [
      { title: 'ジャンプ処理を作る', desc: 'キャラクターがジャンプする物理処理を実装する' },
      { title: '当たり判定を作る', desc: '攻撃が敵に当たったか判定する処理を作る' },
      { title: '攻撃処理を作る', desc: 'プレイヤーの攻撃モーションと処理を実装する' },
    ],
    graphics: [
      { title: '主人公の走り絵を描く', desc: 'プレイヤーキャラクターの走行アニメーションを描く' },
      { title: '攻撃エフェクトを作る', desc: '攻撃がヒットした時の演出を作る' },
      { title: '爆発演出を作る', desc: '敵を倒した時の爆発エフェクトを作る' },
    ],
    sound: [
      { title: 'ダメージ音を作る', desc: '攻撃がヒットした時の効果音を作る' },
      { title: 'ジャンプ音を作る', desc: 'ジャンプ時の軽快な音を作る' },
      { title: 'ボス戦BGMを作る', desc: '緊迫感のあるボス戦専用曲を作る' },
    ],
    design: [
      { title: 'アクションの手触りを考える', desc: '爽快感のある操作感を設計する' },
      { title: 'ボスの攻撃パターンを考える', desc: 'ボス戦の駆け引きを企画する' },
      { title: 'ステージ構成を考える', desc: 'ステージの進行と山場を設計する' },
    ],
  },
  shooter: {
    program: [
      { title: '弾を発射する処理を作る', desc: '自機からの弾丸発射処理を実装する' },
      { title: '敵の弾幕パターンを作る', desc: '敵が撃ってくる弾のパターンを実装する' },
      { title: 'スコア倍率を計算する', desc: '撃破数に応じたスコア倍率処理を作る' },
    ],
    graphics: [
      { title: '自機を描く', desc: 'プレイヤーの戦闘機ドット絵を描く' },
      { title: '敵編隊を描く', desc: '編隊を組んで現れる敵機を描く' },
      { title: '爆発エフェクトを作る', desc: '敵を撃破した時の爆発演出を作る' },
    ],
    sound: [
      { title: '発射音を作る', desc: '弾を撃った時の効果音を作る' },
      { title: '爆発音を作る', desc: '敵撃破時の爆発音を作る' },
      { title: '道中BGMを作る', desc: 'ステージ道中の緊張感あるBGMを作る' },
    ],
    design: [
      { title: '弾幕パターンを考える', desc: '避けごたえのある弾幕を設計する' },
      { title: '難易度配分を考える', desc: 'ステージごとの難易度上昇を設計する' },
      { title: 'ボス構成を考える', desc: 'ボスの攻撃フェーズ構成を企画する' },
    ],
  },
  adventure: {
    program: [
      { title: '会話イベントを作る', desc: 'NPC との会話イベント処理を実装する' },
      { title: 'アイテム使用処理を作る', desc: '所持アイテムを使う処理を作る' },
      { title: 'マップ移動処理を作る', desc: 'エリア間の移動処理を実装する' },
    ],
    graphics: [
      { title: '主人公の立ち絵を描く', desc: '会話シーン用の主人公の立ち絵を描く' },
      { title: '街並みの背景を描く', desc: '物語の舞台となる街の背景を描く' },
      { title: 'アイテムアイコンを描く', desc: '所持品一覧に表示するアイコンを描く' },
    ],
    sound: [
      { title: '会話音を作る', desc: '会話送り時の効果音を作る' },
      { title: '街のBGMを作る', desc: 'のどかな街並みのBGMを作る' },
      { title: '謎解き達成音を作る', desc: '謎が解けた時の達成音を作る' },
    ],
    design: [
      { title: 'シナリオ構成を考える', desc: '物語の起承転結を設計する' },
      { title: '謎解きの難易度を考える', desc: 'ヒントの出し方と難易度を調整する' },
      { title: 'キャラクター設定を考える', desc: '登場人物の性格と関係性を企画する' },
    ],
  },
  simulation: {
    program: [
      { title: '経営パラメータを計算する', desc: '資金や満足度などのパラメータ処理を作る' },
      { title: '時間経過処理を作る', desc: 'ゲーム内の時間経過処理を実装する' },
      { title: 'イベント発生処理を作る', desc: 'ランダムイベントの発生処理を作る' },
    ],
    graphics: [
      { title: '施設アイコンを描く', desc: '建設できる施設のアイコンを描く' },
      { title: '街並みマップを描く', desc: '経営する街の全体マップを描く' },
      { title: 'グラフ画面を描く', desc: '経営状況を示すグラフ画面を作る' },
    ],
    sound: [
      { title: '日常BGMを作る', desc: 'のんびりとした経営BGMを作る' },
      { title: '決定音を作る', desc: '施設を建設した時の決定音を作る' },
      { title: '達成音を作る', desc: '目標達成時の達成音を作る' },
    ],
    design: [
      { title: '経済バランスを考える', desc: '収入と支出のバランスを設計する' },
      { title: '成長曲線を考える', desc: '街が発展していく速度を設計する' },
      { title: 'ランダムイベント案を考える', desc: '経営を彩るイベント内容を企画する' },
    ],
  },
  racing: {
    program: [
      { title: '車の挙動処理を作る', desc: '車体の加速・旋回の物理処理を作る' },
      { title: 'コース判定処理を作る', desc: 'コースアウトの判定処理を実装する' },
      { title: 'タイム計測処理を作る', desc: 'ラップタイムの計測処理を作る' },
    ],
    graphics: [
      { title: 'レースカーを描く', desc: 'プレイヤーの車のドット絵を描く' },
      { title: 'コース背景を描く', desc: 'コース沿いの風景を描く' },
      { title: 'スピードエフェクトを作る', desc: '高速時の疾走感エフェクトを作る' },
    ],
    sound: [
      { title: 'エンジン音を作る', desc: 'アクセルに応じたエンジン音を作る' },
      { title: 'タイヤの摩擦音を作る', desc: 'コーナリング時の摩擦音を作る' },
      { title: 'レースBGMを作る', desc: 'テンポの速いレースBGMを作る' },
    ],
    design: [
      { title: 'コースレイアウトを考える', desc: '見せ場のあるコース構成を設計する' },
      { title: '難易度別コースを考える', desc: '初級〜上級のコース難易度を設計する' },
      { title: '車種バランスを考える', desc: '車種ごとの性能差を企画する' },
    ],
  },
  horror: {
    program: [
      { title: '敵の追跡処理を作る', desc: 'プレイヤーを追いかけるモンスターの処理を作る' },
      { title: '恐怖演出のトリガー処理を作る', desc: '特定条件で驚かす演出の発火処理を作る' },
      { title: 'セーブポイント処理を作る', desc: 'セーブポイントの処理を実装する' },
    ],
    graphics: [
      { title: '不気味な廊下を描く', desc: '館内の薄暗い廊下の背景を描く' },
      { title: 'モンスターを描く', desc: 'プレイヤーを追う怪物のドット絵を描く' },
      { title: '暗闇の演出を作る', desc: '視界が悪くなる暗闇表現を作る' },
    ],
    sound: [
      { title: '足音を作る', desc: '近づいてくる足音の効果音を作る' },
      { title: '不穏なBGMを作る', desc: '緊張感を煽るBGMを作る' },
      { title: 'ジャンプスケア音を作る', desc: '驚かせる瞬間の効果音を作る' },
    ],
    design: [
      { title: '恐怖演出のタイミングを考える', desc: '驚かせる間合いを設計する' },
      { title: 'マップ構成を考える', desc: '探索しがいのある館の構成を設計する' },
      { title: 'モンスターの行動パターンを考える', desc: '追跡ロジックの挙動を企画する' },
    ],
  },
  fighting: {
    program: [
      { title: 'コンボ判定処理を作る', desc: '連続技の入力判定処理を作る' },
      { title: 'ガード処理を作る', desc: '防御時のダメージ軽減処理を作る' },
      { title: '必殺技ゲージ処理を作る', desc: '必殺技ゲージの増減処理を作る' },
    ],
    graphics: [
      { title: 'キャラクターの技モーションを描く', desc: '必殺技のモーションを描く' },
      { title: 'ステージ背景を描く', desc: '対戦ステージの背景を描く' },
      { title: 'ヒットエフェクトを作る', desc: '攻撃が当たった時の演出を作る' },
    ],
    sound: [
      { title: '打撃音を作る', desc: '攻撃がヒットした時の打撃音を作る' },
      { title: '必殺技の効果音を作る', desc: '必殺技発動時の効果音を作る' },
      { title: '対戦BGMを作る', desc: '熱い対戦を盛り上げるBGMを作る' },
    ],
    design: [
      { title: 'キャラクター性能を考える', desc: 'キャラごとの技構成と強さを設計する' },
      { title: 'コンボルートを考える', desc: '爽快なコンボの繋ぎを設計する' },
      { title: '対戦バランスを考える', desc: 'キャラ間の有利不利を調整する' },
    ],
  },
  roguelike: {
    program: [
      { title: 'ダンジョン自動生成処理を作る', desc: '毎回変化するダンジョン生成処理を作る' },
      { title: 'アイテムドロップ処理を作る', desc: '敵を倒した時のアイテム抽選処理を作る' },
      { title: '死亡時のリセット処理を作る', desc: '死亡時に進行をリセットする処理を作る' },
    ],
    graphics: [
      { title: 'ダンジョンタイルを描く', desc: 'ダンジョンの床や壁のタイルを描く' },
      { title: 'モンスターを描く', desc: '階層ごとに現れる敵を描く' },
      { title: 'アイテムアイコンを描く', desc: '拾えるアイテムのアイコンを描く' },
    ],
    sound: [
      { title: '探索BGMを作る', desc: '緊張感のある探索BGMを作る' },
      { title: 'アイテム取得音を作る', desc: 'アイテムを拾った時の効果音を作る' },
      { title: '死亡時の音を作る', desc: 'やられてしまった時の効果音を作る' },
    ],
    design: [
      { title: '生成ルールを考える', desc: 'ダンジョン生成のルールを設計する' },
      { title: '難易度上昇カーブを考える', desc: '階層が進むごとの難易度を設計する' },
      { title: 'アイテムの種類を考える', desc: '手に入るアイテムの種類を企画する' },
    ],
  },
  rhythm: {
    program: [
      { title: 'ノーツ判定処理を作る', desc: '流れてくるノーツの判定処理を作る' },
      { title: 'スコア計算処理を作る', desc: '判定に応じたスコア加算処理を作る' },
      { title: 'BGM同期処理を作る', desc: '楽曲とノーツのタイミング同期処理を作る' },
    ],
    graphics: [
      { title: 'ノーツを描く', desc: '流れてくるノーツのデザインを描く' },
      { title: 'ライブ背景を描く', desc: '演奏シーンの背景演出を描く' },
      { title: '判定エフェクトを作る', desc: '判定時に光るエフェクトを作る' },
    ],
    sound: [
      { title: '収録曲を作る', desc: 'プレイ用の楽曲を作曲する' },
      { title: '判定音を作る', desc: 'ノーツを叩いた時の判定音を作る' },
      { title: 'コンボ音を作る', desc: 'コンボが続いた時の音を作る' },
    ],
    design: [
      { title: '譜面パターンを考える', desc: '楽曲に合った譜面を設計する' },
      { title: '難易度別譜面を考える', desc: '易しい〜難しい譜面のバリエーションを作る' },
      { title: '曲目構成を考える', desc: '収録する楽曲のラインナップを企画する' },
    ],
  },
  sandbox: {
    program: [
      { title: 'ブロック設置処理を作る', desc: 'ブロックを設置・破壊する処理を作る' },
      { title: 'セーブ処理を作る', desc: '作った世界を保存する処理を作る' },
      { title: '物理演算処理を作る', desc: '物やキャラクターの物理挙動を作る' },
    ],
    graphics: [
      { title: 'ブロック素材を描く', desc: '設置できるブロックの見た目を描く' },
      { title: 'キャラクターを描く', desc: 'プレイヤーキャラクターを描く' },
      { title: '天候エフェクトを作る', desc: '雨や雪などの天候演出を作る' },
    ],
    sound: [
      { title: '環境音を作る', desc: '風や鳥のさえずりなどの環境音を作る' },
      { title: '設置音を作る', desc: 'ブロックを置いた時の効果音を作る' },
      { title: 'のんびりBGMを作る', desc: '自由な創作を彩るBGMを作る' },
    ],
    design: [
      { title: '素材の種類を考える', desc: '用意する素材のバリエーションを企画する' },
      { title: 'クラフトレシピを考える', desc: 'アイテムの組み合わせレシピを設計する' },
      { title: '世界の広さを考える', desc: '探索できるワールドの規模を設計する' },
    ],
  },
};

/** 汎用フォールバック（未定義ジャンル対策・実運用では発生しない想定） */
const FALLBACK_TICKETS = GENRE_TICKETS.action;

export const getGenreTickets = (genreId: GenreId): Record<TicketCategory, TicketFlavor[]> =>
  GENRE_TICKETS[genreId] ?? FALLBACK_TICKETS;

/** チケット通し番号 → { カテゴリ, フレーバー } を導出（周期的に循環） */
export const getTicketAt = (
  genreId: GenreId,
  ticketIndex: number,
): { category: TicketCategory; flavor: TicketFlavor } => {
  const category =
    CATEGORY_ORDER[
      ((ticketIndex % CATEGORY_ORDER.length) + CATEGORY_ORDER.length) % CATEGORY_ORDER.length
    ];
  const flavors = getGenreTickets(genreId)[category];
  const round = Math.floor(ticketIndex / CATEGORY_ORDER.length);
  const flavor = flavors[((round % flavors.length) + flavors.length) % flavors.length];
  return { category, flavor };
};

export const pickPhrase = (category: TicketCategory, rng: Rng = Math.random): string => {
  const pool = CATEGORY_PHRASE_POOLS[category];
  return pool[Math.floor(rng() * pool.length)];
};

/**
 * v0.20 C：ボス文章（クランチタイム中に混じる長文）。
 * 新規コンテンツを追加せず、既存プールから2文を連結して「長め」を作る（最小変更）。
 */
export const pickBossPhrase = (category: TicketCategory, rng: Rng = Math.random): string => {
  const pool = CATEGORY_PHRASE_POOLS[category];
  const a = pool[Math.floor(rng() * pool.length)];
  const b = pool[Math.floor(rng() * pool.length)];
  return a + b;
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
