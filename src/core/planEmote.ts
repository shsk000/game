/**
 * 企画会議（planning フェーズ）で社員の頭上にアイコン吹き出しを出す演出用の抽選ロジック。
 * ゲームの数値（品質・売上・進捗）には一切影響しない純表示演出。
 *
 * 2種類の出し方があり、どちらも同じ吹き出しスロットを共有する（同時に出るのは1つ）：
 *  - 'thinking'（考え中）：企画中ランダムな間隔で出る。タイプ完了と無関係のアンビエント演出。
 *  - 'idea'（ひらめき）：ワードを1つ打ち切った瞬間に出る。「考える→ひらめく」の流れを作る。
 *
 * アイコンは PixelLab 製のドット絵（/sprites/ui/emote_*.png）。素材が無い環境向けに emoji フォールバックを持つ。
 * 乱数は呼び出し側（View）から注入する（logic-architecture 規約：core は純粋関数、rng は引数）。
 */

/** 頭上に出す1エモートの定義。src＝ドット絵、emoji＝フォールバック。 */
export interface PlanEmoteDef {
  /** 安定した識別子（テスト・ログ用） */
  id: string;
  /** ドット絵アイコンのパス */
  src: string;
  /** 素材が読めない環境向けの絵文字フォールバック */
  emoji: string;
}

/** ひらめき系（ワード確定時）。 */
export const PLAN_IDEA_EMOTES: readonly PlanEmoteDef[] = [
  { id: 'bulb', src: '/sprites/ui/emote_bulb.png', emoji: '💡' },
  { id: 'excl', src: '/sprites/ui/emote_excl.png', emoji: '❗' },
  { id: 'spark', src: '/sprites/ui/emote_spark.png', emoji: '✨' },
];

/** 考え中系（アンビエント）。 */
export const PLAN_THINKING_EMOTES: readonly PlanEmoteDef[] = [
  { id: 'dots', src: '/sprites/ui/emote_dots.png', emoji: '…' },
  { id: 'question', src: '/sprites/ui/emote_question.png', emoji: '❓' },
  { id: 'zzz', src: '/sprites/ui/emote_zzz.png', emoji: '💤' },
];

/** 全エモート（admin プレビュー用）。 */
export const ALL_PLAN_EMOTES: readonly PlanEmoteDef[] = [
  ...PLAN_IDEA_EMOTES,
  ...PLAN_THINKING_EMOTES,
];

export type PlanEmoteKind = 'idea' | 'thinking';

const EMOTES_BY_KIND: Record<PlanEmoteKind, readonly PlanEmoteDef[]> = {
  idea: PLAN_IDEA_EMOTES,
  thinking: PLAN_THINKING_EMOTES,
};

/** View が MeetingScene まで渡す「今どの社員に何を出すか」の状態。 */
export interface PlanEmoteEvent {
  /** 吹き出しを出す会議スポットの index（0..spotCount-1） */
  spot: number;
  /** 表示するエモート定義 */
  def: PlanEmoteDef;
  /** ポップアニメ再生用の一意キー（発火ごとにインクリメント） */
  key: number;
}

/**
 * 「どのスポットの社員へ・どのエモートを」出すかを抽選する。
 * @param rng 0以上1未満を返す乱数（Math.random 等を注入）
 * @param spotCount 会議スポット数（社員の人数ぶん）
 * @param kind ひらめき('idea') か 考え中('thinking')。既定は 'idea'
 */
export function pickPlanEmote(
  rng: () => number,
  spotCount: number,
  kind: PlanEmoteKind = 'idea',
): { spot: number; def: PlanEmoteDef } {
  const safeCount = Math.max(1, Math.floor(spotCount));
  const spot = Math.min(safeCount - 1, Math.max(0, Math.floor(rng() * safeCount)));
  const defs = EMOTES_BY_KIND[kind];
  const idx = Math.min(defs.length - 1, Math.max(0, Math.floor(rng() * defs.length)));
  return { spot, def: defs[idx] };
}
