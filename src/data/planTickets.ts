import type { Rng } from '../core/ports';
import type { GenreId } from './genres';

/**
 * v0.15.3「企画チケット」システム（オーナー改修指示 2026-07-09）：
 * 企画フェーズを「固定文を打つだけの画面」から「企画チケットをタイピングで進め、
 * ゲームの方向性が固まっていく画面」に作り替える。
 *
 * - 企画カテゴリは固定 7 種（スペック指定順）：
 *   コンセプト設計 → ジャンル選定 → ターゲット設定 → 世界観設計 → コアシステム設計 → タイトル案 → 販売方針
 * - ジャンルごとに変えるのはカテゴリではなく具体的なチケット内容
 *   （創作系 3 種＝コンセプト/世界観/コアはジャンル別に執筆、残り 4 種は汎用＋バリアント）
 * - チケット完了で「決定事項（decided）」が右ペインの企画書に埋まっていく
 * - 実効果は applyAxisDelta（面白さ funFactor / 期待度 hype）でリリースへ合流（因果を一本に）
 */

export type PlanCategory = 'concept' | 'genre' | 'target' | 'world' | 'core' | 'title' | 'sales';

/** スペック指定の進行順 */
export const PLAN_CATEGORY_ORDER: PlanCategory[] = [
  'concept',
  'genre',
  'target',
  'world',
  'core',
  'title',
  'sales',
];

export const PLAN_CATEGORY_META: Record<
  PlanCategory,
  {
    icon: string;
    label: string;
    color: string;
    dim: string;
    /** 企画書のチェックリストに出す短い項目名 */
    docLabel: string;
    /** 1 文完了ごとの実効果ウェイト（gain に乗算して applyAxisDelta へ） */
    effects: { funFactor: number; hype: number };
  }
> = {
  concept: {
    icon: '💡',
    label: 'コンセプト設計',
    color: '#ffd166',
    dim: '#4a3a12',
    docLabel: 'ゲームの核',
    effects: { funFactor: 2, hype: 1 },
  },
  genre: {
    icon: '🎯',
    label: 'ジャンル選定',
    color: '#4db3ff',
    dim: '#123a5a',
    docLabel: 'ジャンル',
    effects: { funFactor: 1, hype: 2 },
  },
  target: {
    icon: '👥',
    label: 'ターゲット設定',
    color: '#5fe08a',
    dim: '#124a28',
    docLabel: 'ターゲット',
    effects: { funFactor: 1, hype: 2 },
  },
  world: {
    icon: '🗺️',
    label: '世界観設計',
    color: '#d8a5ff',
    dim: '#3a2255',
    docLabel: '世界観',
    effects: { funFactor: 1, hype: 2 },
  },
  core: {
    icon: '⚙️',
    label: 'コアシステム設計',
    color: '#ff8a3c',
    dim: '#4a2a10',
    docLabel: 'コアシステム',
    effects: { funFactor: 2, hype: 1 },
  },
  title: {
    icon: '✒️',
    label: 'タイトル案',
    color: '#7adfff',
    dim: '#123a4a',
    docLabel: 'タイトル',
    effects: { funFactor: 1, hype: 2 },
  },
  sales: {
    icon: '💰',
    label: '販売方針',
    color: '#f0c020',
    dim: '#4a3a08',
    docLabel: '販売方針',
    effects: { funFactor: 1, hype: 1 },
  },
};

/**
 * 1 企画チケットを完了させるのに必要な入力フレーズ数。
 * v0.15.3 当初は 2 だったが、企画がリアル時間を消費しすぎて開発期間が予定超過する
 * （オーナー指摘 2026-07-09）ため 1 に短縮：全 7 文で企画完了・1 文ごとに決定が出るテンポ重視。
 */
export const PHRASES_PER_PLAN_TICKET = 1;

export type PlanTicketFlavor = {
  title: string;
  desc: string;
  /** 完了時に企画書へ書き込まれる決定事項 */
  decided: string;
};

/** カテゴリ別の入力フレーズプール（ひらがな。ジャンル共通） */
export const PLAN_PHRASE_POOLS: Record<PlanCategory, string[]> = {
  concept: [
    'あそびのかくをきめる',
    'たのしさをことばにする',
    'だれがよろこぶかをかんがえる',
    'きもちよさのしょうたいをさがす',
  ],
  genre: [
    'はやりのじゃんるをしらべる',
    'とくいなぶんやをえらぶ',
    'きょうごうさくをけんきゅうする',
    'かちすじをみきわめる',
  ],
  target: [
    'たーげっとをきめる',
    'あそぶひとをおもいうかべる',
    'ねんれいそうをしぼりこむ',
    'ぷれいじかんをそうていする',
  ],
  world: [
    'せかいかんをふくらませる',
    'ぶたいのふんいきをきめる',
    'しゅじんこうぞうをかためる',
    'ものがたりのたねをまく',
  ],
  core: [
    'こあしすてむをきめる',
    'るーるをみがきあげる',
    'そうさかんをつきつめる',
    'げーむさいくるをまわす',
  ],
  title: [
    'たいとるあんをだしあう',
    'ひびきのよいなまえをさがす',
    'みじかくおぼえやすくする',
    'ろごのいめーじをかんがえる',
  ],
  sales: [
    'ねだんをけんとうする',
    'うりかたをかんがえる',
    'はんばいけいかくをたてる',
    'せんでんほうしんをきめる',
  ],
};

/** カテゴリ別の企画メモ候補（1 文打ち切るごとに 1 行増える会議メモ） */
export const PLAN_MEMO_POOLS: Record<PlanCategory, string[]> = {
  concept: ['遊びの核を書き出した', '参考タイトルを並べた', '一言コンセプトが決まった'],
  genre: ['市場の流行を確認した', '得意分野と照らし合わせた', '勝負ジャンルを絞り込んだ'],
  target: ['想定プレイヤー像を描いた', 'プレイ時間帯を想定した', '刺さる層が見えてきた'],
  world: ['舞台のラフを描いた', '主人公像が固まってきた', 'キーワードを整理した'],
  core: ['遊びの流れを図にした', 'ルールの矛盾を潰した', 'コアループがつながった'],
  title: ['候補を10個書き出した', '語感のよい案を残した', 'ロゴの落書きをした'],
  sales: ['価格帯を比較した', '競合の売り方を調べた', '宣伝プランを描いた'],
};

/** ジャンル別の創作系チケット内容（コンセプト/世界観/コア）＋アイデアカード用キーワード */
type GenrePlanContent = {
  concept: PlanTicketFlavor;
  world: PlanTicketFlavor;
  core: PlanTicketFlavor;
  ideaKeywords: string[];
};

export const GENRE_PLAN_CONTENT: Record<GenreId, GenrePlanContent> = {
  rpg: {
    concept: {
      title: '冒険の目的を決める',
      desc: 'プレイヤーが何を求めて旅に出るのかを決める',
      decided: '冒険しながら成長する楽しさ',
    },
    world: {
      title: '王国と魔王の関係を決める',
      desc: '物語の舞台となる世界の対立軸を設計する',
      decided: '剣と魔法のファンタジー世界',
    },
    core: {
      title: '成長システムを考える',
      desc: 'レベルや装備でどう強くなるかを設計する',
      decided: 'レベルアップと転職の成長',
    },
    ideaKeywords: ['冒険', '成長', 'ボス戦', '宝箱', '仲間'],
  },
  puzzle: {
    concept: {
      title: '気持ちよさの正体を決める',
      desc: 'このパズルの何が気持ちいいのかを言語化する',
      decided: '消える瞬間の爽快感',
    },
    world: {
      title: '盤面の見た目を決める',
      desc: 'プレイ画面の色と雰囲気を設計する',
      decided: 'カラフルでポップな盤面',
    },
    core: {
      title: '連鎖ルールを考える',
      desc: '連鎖がどう発生しどう伸びるかを設計する',
      decided: '連鎖でスコアが伸びる仕組み',
    },
    ideaKeywords: ['連鎖', '爽快感', 'ひらめき', 'ハイスコア', 'すきま時間'],
  },
  action: {
    concept: {
      title: '爽快感の軸を決める',
      desc: '攻撃の手応えとスピード感の方向性を決める',
      decided: '一撃の手応えと疾走感',
    },
    world: {
      title: 'ステージの雰囲気を決める',
      desc: '戦いの舞台となる世界のトーンを設計する',
      decided: '荒廃した戦場ステージ',
    },
    core: {
      title: '必殺技システムを考える',
      desc: 'ゲージや条件で放つ大技を設計する',
      decided: 'ゲージ消費の必殺技',
    },
    ideaKeywords: ['疾走感', '必殺技', 'コンボ', 'ボス', '緊張感'],
  },
  shooter: {
    concept: {
      title: '撃つ楽しさを決める',
      desc: '避ける・撃つ・稼ぐのバランスを決める',
      decided: '弾幕をかいくぐる快感',
    },
    world: {
      title: '宇宙戦争の背景を決める',
      desc: 'なぜ戦うのかの物語背景を設計する',
      decided: '銀河をめぐる宇宙戦争',
    },
    core: {
      title: 'パワーアップを考える',
      desc: '自機の強化がどう進むかを設計する',
      decided: '段階強化のパワーアップ',
    },
    ideaKeywords: ['弾幕', '自機', 'スコア', 'ボム', '敵編隊'],
  },
  adventure: {
    concept: {
      title: '物語の魅力を決める',
      desc: 'プレイヤーを引き込む物語の芯を決める',
      decided: '謎解きと物語の没入感',
    },
    world: {
      title: '舞台の街を決める',
      desc: '物語の始まる場所と空気感を設計する',
      decided: '秘密を抱えた港町',
    },
    core: {
      title: '分岐システムを考える',
      desc: '選択がどう物語を変えるかを設計する',
      decided: '選択肢で変わる物語',
    },
    ideaKeywords: ['物語', '謎解き', '選択肢', '登場人物', '結末'],
  },
  simulation: {
    concept: {
      title: '経営の面白さを決める',
      desc: '数字を育てる楽しさの核を決める',
      decided: '街が育つ達成感',
    },
    world: {
      title: '舞台のスケールを決める',
      desc: 'どこから始まりどこまで育つかを設計する',
      decided: '小さな町から大都市へ',
    },
    core: {
      title: '経済ループを考える',
      desc: '収入と支出の循環を設計する',
      decided: '投資と回収の経済ループ',
    },
    ideaKeywords: ['発展', '経営', '住民', '施設', '収支'],
  },
  racing: {
    concept: {
      title: 'スピード感を決める',
      desc: '速さの気持ちよさをどう出すかを決める',
      decided: '限界ぎりぎりの走り',
    },
    world: {
      title: 'コースの舞台を決める',
      desc: 'どんな景色の中を走るかを設計する',
      decided: '世界各地のサーキット',
    },
    core: {
      title: 'ドリフトを考える',
      desc: 'コーナリングの駆け引きを設計する',
      decided: 'ドリフトで差がつく操作',
    },
    ideaKeywords: ['加速', 'ドリフト', 'ライバル', 'コース', '優勝'],
  },
  horror: {
    concept: {
      title: '怖さの種類を決める',
      desc: '驚かせるのか、じわじわ怖いのかを決める',
      decided: 'じわじわ迫る心理的恐怖',
    },
    world: {
      title: '舞台の館を決める',
      desc: '閉ざされた空間の設定を設計する',
      decided: '廃病院の閉ざされた夜',
    },
    core: {
      title: '追跡者を考える',
      desc: '逃げ隠れの緊張感を生む敵を設計する',
      decided: '隠れるしかない追跡者',
    },
    ideaKeywords: ['恐怖', '暗闇', '足音', '逃走', '正体'],
  },
  fighting: {
    concept: {
      title: '駆け引きを決める',
      desc: '対戦の読み合いの芯を決める',
      decided: '読み合いの駆け引き',
    },
    world: {
      title: '大会の設定を決める',
      desc: 'なぜ戦うのかの舞台を設計する',
      decided: '世界最強を決める大会',
    },
    core: {
      title: 'コンボシステムを考える',
      desc: '入門しやすく極めがいのある技を設計する',
      decided: '浅く始めて深いコンボ',
    },
    ideaKeywords: ['対戦', 'コンボ', '必殺技', '読み合い', 'キャラ'],
  },
  roguelike: {
    concept: {
      title: '繰り返す楽しさを決める',
      desc: '何度も潜りたくなる理由を決める',
      decided: '毎回変わるダンジョン',
    },
    world: {
      title: '迷宮の設定を決める',
      desc: 'なぜ潜るのか、何が眠るのかを設計する',
      decided: '深層に眠る秘宝の迷宮',
    },
    core: {
      title: '死の意味を考える',
      desc: 'やられた時に何を失い何が残るかを設計する',
      decided: '死んでも引き継ぐ成長',
    },
    ideaKeywords: ['迷宮', '運', '一期一会', '秘宝', '全滅'],
  },
  rhythm: {
    concept: {
      title: 'ノる楽しさを決める',
      desc: '音と操作が重なる快感の核を決める',
      decided: '音と一体になる快感',
    },
    world: {
      title: 'ステージ演出を決める',
      desc: 'ライブの盛り上がりをどう見せるか設計する',
      decided: 'ネオン輝くライブ会場',
    },
    core: {
      title: '判定システムを考える',
      desc: 'ジャスト判定の気持ちよさを設計する',
      decided: '気持ちいいジャスト判定',
    },
    ideaKeywords: ['リズム', '楽曲', '判定', 'フルコンボ', 'ライブ'],
  },
  sandbox: {
    concept: {
      title: '自由の楽しさを決める',
      desc: '何でもできる中の面白さの芯を決める',
      decided: '何を作ってもいい自由',
    },
    world: {
      title: '世界の広さを決める',
      desc: 'どこまで行けてどこを掘れるかを設計する',
      decided: '果てなく広がる大地',
    },
    core: {
      title: 'クラフトを考える',
      desc: '素材集めから創造までの流れを設計する',
      decided: '素材集めとクラフト',
    },
    ideaKeywords: ['創造', '建築', '素材', '探検', '自由'],
  },
};

/** ターゲット設定のバリアント（ジャンルごとに決定的に 1 つ選ぶ） */
const TARGET_VARIANTS = ['ライトユーザー', 'コアゲーマー', '忙しい社会人', '親子で遊ぶ層'];

/** 販売方針のバリアント */
const SALES_VARIANTS = [
  '低価格で広く届ける',
  'じっくり型のこだわり価格',
  '話題づくり重視の宣伝',
  'シリーズ化を見据える',
];

/** ジャンル ID から決定的にバリアントを選ぶ（同じ企画では常に同じ結果） */
const hashPick = <T>(arr: T[], seed: string): T => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[((h % arr.length) + arr.length) % arr.length];
};

/**
 * 企画チケットの解決：index（0..6）→ カテゴリ＋内容＋決定事項。
 * ジャンル選定/タイトル案の decided は実データ（ジャンル名/タイトル）から計算する。
 */
export const getPlanTicketAt = (
  genreId: GenreId,
  index: number,
  ctx: { genreName: string; projectTitle: string },
): { category: PlanCategory; flavor: PlanTicketFlavor } => {
  const category = PLAN_CATEGORY_ORDER[Math.min(index, PLAN_CATEGORY_ORDER.length - 1)];
  const content = GENRE_PLAN_CONTENT[genreId] ?? GENRE_PLAN_CONTENT.action;
  switch (category) {
    case 'concept':
      return { category, flavor: content.concept };
    case 'world':
      return { category, flavor: content.world };
    case 'core':
      return { category, flavor: content.core };
    case 'genre':
      return {
        category,
        flavor: {
          title: 'ジャンルを見極める',
          desc: '今作の勝負ジャンルを確定する',
          decided: `${ctx.genreName}でいく`,
        },
      };
    case 'target':
      return {
        category,
        flavor: {
          title: 'ターゲットを決める',
          desc: '誰に一番遊んでほしいかを決める',
          decided: hashPick(TARGET_VARIANTS, `${genreId}-target`),
        },
      };
    case 'title':
      return {
        category,
        flavor: {
          title: 'タイトル案を練る',
          desc: '店頭で目を引く名前を考える',
          decided: ctx.projectTitle,
        },
      };
    case 'sales':
      return {
        category,
        flavor: {
          title: '販売方針を決める',
          desc: '価格と売り方の作戦を立てる',
          decided: hashPick(SALES_VARIANTS, `${genreId}-sales`),
        },
      };
  }
};

export const pickPlanPhrase = (category: PlanCategory, rng: Rng = Math.random): string => {
  const pool = PLAN_PHRASE_POOLS[category];
  return pool[Math.floor(rng() * pool.length)];
};

export const pickPlanMemo = (category: PlanCategory, index: number): string => {
  const pool = PLAN_MEMO_POOLS[category];
  return pool[index % pool.length];
};

/** アイデアカード（付箋）の色ローテーション */
export const IDEA_CARD_COLORS = ['#ffe08a', '#a8e6a1', '#ffb3c1', '#a5d8ff', '#e3c8ff'];

/** 1 文の基礎獲得値（企画）。カテゴリの effects ウェイト × 倍率 × これ */
export const PLAN_BASE_GAIN = 1;
