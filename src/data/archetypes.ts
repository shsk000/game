import type { FeatureId } from '../state/types';
import type { GenreId } from './genres';

/**
 * ジャンルの「型」と特徴ポイントの重み（docs/spec/score-model.md §4）。
 *
 * **重みは3段階のラベルで持つ。** 自由な数値では書かない。
 * - バランス調整が3定数で済む（「◎が強すぎる」なら `◎: 3 → 2.5` の1箇所）
 * - 27ジャンル分を作るとき ◎○△ の判断だけで済む（自由な数値だと毎回ブレる）
 * - プレイヤーにそのまま見せられる
 *
 * ⚠ **実装ステップ3 でスコアに接続するまで、この重みは使われない。**
 */

export type WeightLabel = '◎' | '○' | '△';

/** 段階の素の値 🔧（ここを変えると全ジャンルに反映される） */
export const WEIGHT_VALUE: Record<WeightLabel, number> = {
  '◎': 3,
  '○': 1,
  '△': 0.3,
};

export type ArchetypeId = 'action' | 'sensory' | 'tactical' | 'party' | 'illustrated' | 'narrative';

export type FeatureWeights = Record<FeatureId, WeightLabel>;

/**
 * 型の一覧（確定）。
 *
 * **💡 革新性は全型で ○ 固定**（スキルで伸ばすものではないため型で差をつけない）。
 * ◎ は残り4分野から2つ選ぶので組み合わせは6通り＝型は6つ。
 * **全型が ◎2つ・○2つ・△1つ**で重みの合計が揃う。
 */
export const ARCHETYPES: Record<ArchetypeId, { label: string; weights: FeatureWeights }> = {
  action: {
    label: 'アクション型',
    weights: {
      usabilityPt: '◎',
      graphicsPt: '◎',
      soundPt: '○',
      storyPt: '△',
      innovationPt: '○',
    },
  },
  sensory: {
    label: '体感型',
    weights: {
      usabilityPt: '◎',
      graphicsPt: '○',
      soundPt: '◎',
      storyPt: '△',
      innovationPt: '○',
    },
  },
  tactical: {
    label: '戦術型',
    weights: {
      usabilityPt: '◎',
      graphicsPt: '○',
      soundPt: '△',
      storyPt: '◎',
      innovationPt: '○',
    },
  },
  party: {
    label: '賑わい型',
    weights: {
      usabilityPt: '○',
      graphicsPt: '◎',
      soundPt: '◎',
      storyPt: '△',
      innovationPt: '○',
    },
  },
  illustrated: {
    label: '絵物語型',
    weights: {
      usabilityPt: '△',
      graphicsPt: '◎',
      soundPt: '○',
      storyPt: '◎',
      innovationPt: '○',
    },
  },
  narrative: {
    label: '物語型',
    weights: {
      usabilityPt: '△',
      graphicsPt: '○',
      soundPt: '◎',
      storyPt: '◎',
      innovationPt: '○',
    },
  },
};

/** 全27ジャンルの型割当（docs/spec/score-model.md §4 の表） */
export const GENRE_ARCHETYPE: Record<GenreId, ArchetypeId> = {
  // アクション型
  action: 'action',
  shooter: 'action',
  platformer: 'action',
  sports: 'action',
  puzzle: 'action',
  towerdefense: 'action',
  boardgame: 'action',
  // 体感型
  fighting: 'sensory',
  fps: 'sensory',
  racing: 'sensory',
  rhythm: 'sensory',
  fishing: 'sensory',
  // 戦術型
  strategy: 'tactical',
  quiz: 'tactical',
  roguelike: 'tactical',
  // 賑わい型
  partygame: 'party',
  sandbox: 'party',
  // 絵物語型
  cardgame: 'illustrated',
  adventure: 'illustrated',
  romanceadventure: 'illustrated',
  escapegame: 'illustrated',
  simulation: 'illustrated',
  // 物語型
  rpg: 'narrative',
  visualnovel: 'narrative',
  raisingsim: 'narrative',
  horror: 'narrative',
  survival: 'narrative',
};

/** そのジャンルの重みラベル */
export const weightsFor = (genreId: GenreId): FeatureWeights =>
  ARCHETYPES[GENRE_ARCHETYPE[genreId]].weights;

/**
 * 正規化した重み（そのジャンルで合計 1.0）。
 *
 * **正規化は必須。** 揃えないと ◎ の多いジャンルほどメタスコアが出やすくなり、
 * 特定ジャンル一択になる。
 */
export const normalizedWeightsFor = (genreId: GenreId): Record<FeatureId, number> => {
  const labels = weightsFor(genreId);
  const raw = Object.entries(labels) as [FeatureId, WeightLabel][];
  const total = raw.reduce((sum, [, l]) => sum + WEIGHT_VALUE[l], 0);
  const out = {} as Record<FeatureId, number>;
  for (const [id, l] of raw) out[id] = WEIGHT_VALUE[l] / total;
  return out;
};
