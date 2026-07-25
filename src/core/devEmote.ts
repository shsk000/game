/**
 * 開発（development フェーズ）で着席中の社員の頭上にアイコン吹き出しを出す演出用の抽選ロジック。
 * 企画会議の planEmote と同型で、ゲームの数値（品質・売上・進捗・バグ）には一切影響しない純表示演出。
 *
 * 2種類の出し方があり、どちらも同じ吹き出しスロットを共有する（同時に出るのは1つ）：
 *  - 'focus'（集中中）：打鍵と無関係にランダムな間隔で出るアンビエント演出（…/❓）。
 *  - 'done'（できた）：チケット文を1つ打ち切った瞬間、担当社員の頭上に出す（✨/❗/💡）。
 *
 * アイコンは planEmote と同じ PixelLab 製ドット絵（/sprites/ui/emote_*.png）を流用。
 * 乱数は呼び出し側（View）から注入する（logic-architecture 規約：core は純粋関数、rng は引数）。
 */

import type { PlanEmoteDef } from './planEmote';

/** できた系（チケット文の完了時）。✨❗💡 に加え v0.32 で ✓（完了）・❤（いいね）を新規発注。 */
export const DEV_DONE_EMOTES: readonly PlanEmoteDef[] = [
  { id: 'spark', src: '/sprites/ui/emote_spark.png', emoji: '✨' },
  { id: 'excl', src: '/sprites/ui/emote_excl.png', emoji: '❗' },
  { id: 'bulb', src: '/sprites/ui/emote_bulb.png', emoji: '💡' },
  { id: 'check', src: '/sprites/ui/emote_check.png', emoji: '✅' },
  { id: 'heart', src: '/sprites/ui/emote_heart.png', emoji: '❤️' },
];

/** 集中中系（アンビエント）。…❓💤 に加え v0.32 で ☕（休憩）・⚙（実装中）・💦（難航）・♪（ノッてる）を新規発注。 */
export const DEV_FOCUS_EMOTES: readonly PlanEmoteDef[] = [
  { id: 'dots', src: '/sprites/ui/emote_dots.png', emoji: '…' },
  { id: 'question', src: '/sprites/ui/emote_question.png', emoji: '❓' },
  { id: 'zzz', src: '/sprites/ui/emote_zzz.png', emoji: '💤' },
  { id: 'coffee', src: '/sprites/ui/emote_coffee.png', emoji: '☕' },
  { id: 'gear', src: '/sprites/ui/emote_gear.png', emoji: '⚙️' },
  { id: 'sweat', src: '/sprites/ui/emote_sweat.png', emoji: '💦' },
  { id: 'note', src: '/sprites/ui/emote_note.png', emoji: '🎵' },
  { id: 'flame', src: '/sprites/ui/emote_flame.png', emoji: '🔥' },
  { id: 'muscle', src: '/sprites/ui/emote_muscle.png', emoji: '💪' },
];

/** 全エモート（admin プレビュー用）。 */
export const ALL_DEV_EMOTES: readonly PlanEmoteDef[] = [...DEV_DONE_EMOTES, ...DEV_FOCUS_EMOTES];

export type DevEmoteKind = 'done' | 'focus';

const EMOTES_BY_KIND: Record<DevEmoteKind, readonly PlanEmoteDef[]> = {
  done: DEV_DONE_EMOTES,
  focus: DEV_FOCUS_EMOTES,
};

/** View が DevDeskScene まで渡す「今どの席の社員に何を出すか」の状態。 */
export interface DevEmoteEvent {
  /** 吹き出しを出す座席の index（0..seatCount-1） */
  seat: number;
  /** 表示するエモート定義 */
  def: PlanEmoteDef;
  /** ポップアニメ再生用の一意キー（発火ごとにインクリメント） */
  key: number;
}

/**
 * 「どの席の社員へ・どのエモートを」出すかを抽選する。pickPlanEmote と同じ規約。
 * @param rng 0以上1未満を返す乱数（Math.random 等を注入）
 * @param seatCount 座席数（着席している社員の人数ぶん）
 * @param kind できた('done') か 集中中('focus')。既定は 'focus'
 */
export function pickDevEmote(
  rng: () => number,
  seatCount: number,
  kind: DevEmoteKind = 'focus',
): { seat: number; def: PlanEmoteDef } {
  const safeCount = Math.max(1, Math.floor(seatCount));
  const seat = Math.min(safeCount - 1, Math.max(0, Math.floor(rng() * safeCount)));
  const defs = EMOTES_BY_KIND[kind];
  const idx = Math.min(defs.length - 1, Math.max(0, Math.floor(rng() * defs.length)));
  return { seat, def: defs[idx] };
}
