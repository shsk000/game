import { afterEach, describe, expect, it } from 'vitest';
import { SALES_MULTIPLIER_BY_SCORE, SCALE_BALANCE, scoreTierFor } from '../data/balance';
import { SCALE_BY_ID, type Scale } from '../data/scales';
import type { Employee, FeaturePoints } from '../state/types';
import { DEV_SKILL_IDS } from '../state/types';
import { setGameDeps, useGameStore } from '../state/gameStore';
import { addFeature, featureGainFor, initialFeatures } from './features';
import { computeMetascore } from './metascore';
import { defaultDeps, mulberry32 } from './ports';
import { growSkills } from './skills';

/**
 * **本番のガチャ経路で採った社員**で、各規模が黒字になるかのガード。
 *
 * これまでの採算ガード（`aaaProfitability.test.ts` ほか）は Employee を手組みしていた：
 * 6人が1スキルずつ・4分野を完璧に分担、という理想配置。
 * **実際のガチャは 50% が2スキル持ち**（分散ペナルティで主スキルは最大 49.5）で、
 * **主スキルの 20% が広報**（開発の特徴ポイントに一切効かない）。
 * つまり排出の6割前後は開発分野の主力にならない。
 *
 * lessons #16「ガードは本番が実際に呼ぶ入口から通す」の3度目の適用。
 * `pullGacha` → `rollRank4` → `newCandidate` → `rollSkills` を通す。
 */

/** pullGacha を回して n 人採用し、Lv まで育てる */
const hireViaGacha = (n: number, kind: 'normal' | 'premium', level: number, seed: number) => {
  setGameDeps({ rng: mulberry32(seed), now: () => 0 });
  const out: Employee[] = [];
  for (let i = 0; i < n; i++) {
    useGameStore.setState({ funds: 1e13, gachaPity: 0, candidate: null });
    useGameStore.getState().pullGacha(kind);
    const c = useGameStore.getState().candidate;
    if (!c) continue;
    const grown: Employee = {
      ...(c as unknown as Employee),
      id: `e${i}`,
      level,
      skills: c.rank ? growSkills(c.skills ?? {}, c.rank, level) : (c.skills ?? {}),
    };
    out.push(grown);
  }
  return out;
};

/**
 * そのチームで素直に打ち切ったときのメタスコアと粗利。
 *
 * **ジャンルは「手持ちに合うもの」を選ぶ**（docs/spec/score-model.md §4 の狙い＝
 * 手持ちのスキルに合うジャンルを選ぶ遊び）。ジャンル固定で測ると、
 * プレイヤーが当然やる選択を無視した不当に低い値になる（実測で −11〜13点）。
 */
const play = (team: Employee[], scale: Scale, seed: number) => {
  const perField = Math.max(1, Math.round((SCALE_BY_ID[scale].neededWeeks * 3) / 4));
  let features: FeaturePoints = initialFeatures([], 'action', 'ninja');
  let covered = 0;
  for (const field of DEV_SKILL_IDS) {
    const gain = featureGainFor(field, team, scale, 1.01);
    if (gain <= 0) continue;
    covered += 1;
    for (let n = 0; n < perField; n++) features = addFeature(features, field, gain);
  }
  // 6つの型を代表するジャンルから、このチームでいちばん点が出るものを選ぶ
  const CANDIDATE_GENRES = [
    'action',
    'fighting',
    'strategy',
    'partygame',
    'adventure',
    'rpg',
  ] as const;
  const meta = Math.max(
    ...CANDIDATE_GENRES.map(
      (g) =>
        computeMetascore(
          { features, genreId: g, themeId: 'ninja', compat: 1.0, trend: null },
          mulberry32(seed),
        ).metascore,
    ),
  );
  const revenue = SCALE_BALANCE[scale].baseRevenue * SALES_MULTIPLIER_BY_SCORE[scoreTierFor(meta)];
  const fixed =
    (580_000 * team.length + 300_000) * (SCALE_BY_ID[scale].neededWeeks / 4);
  return {
    meta,
    tier: scoreTierFor(meta),
    profit: revenue - SCALE_BALANCE[scale].devCost - fixed,
    covered,
  };
};

const SEEDS = [1, 7, 42, 101, 777];

afterEach(() => {
  setGameDeps(defaultDeps);
  useGameStore.setState({ candidate: null, gachaPity: 0 });
});

describe('本番ガチャのチームで各規模が黒字になる', () => {
  it('ガチャは2スキル持ちと広報を混ぜて出す（理想配置は現実には出ない）', () => {
    const team = hireViaGacha(12, 'normal', 1, 3);
    const twoSkill = team.filter((e) => Object.keys(e.skills ?? {}).length >= 2).length;
    const prOnly = team.filter((e) => (e.skills?.pr ?? 0) > 0).length;
    expect(twoSkill, '2スキル持ちが混ざる').toBeGreaterThan(0);
    expect(prOnly, '広報が混ざる').toBeGreaterThan(0);
  });

  it.each([
    ['mini', 2, 1],
    ['mobile', 3, 3],
    ['indie', 4, 5],
    ['hit', 5, 8],
  ] as const)('%s：入門相当のガチャチームで黒字になる（%i人・Lv%i）', (scale, seats, level) => {
    const results = SEEDS.map((seed) => {
      const team = hireViaGacha(seats, 'normal', level, seed);
      return play(team, scale, seed);
    });
    const profits = results.map((r) => r.profit).sort((a, b) => a - b);
    const median = profits[Math.floor(profits.length / 2)];
    expect(
      median,
      `${scale} 粗利中央値 ¥${Math.round(median / 1e4).toLocaleString()}万 / メタ ${results.map((r) => r.meta).join(',')}`,
    ).toBeGreaterThan(0);
  });

  it('AAA：育てたガチャチームで黒字になる（終盤が「作るほど損」にならない）', () => {
    const results = SEEDS.map((seed) => {
      const team = hireViaGacha(6, 'premium', 10, seed);
      return play(team, 'aaa', seed);
    });
    const profits = results.map((r) => r.profit).sort((a, b) => a - b);
    const median = profits[Math.floor(profits.length / 2)];
    expect(
      median,
      `AAA 粗利中央値 ¥${Math.round(median / 1e8)}億 / メタ ${results.map((r) => r.meta).join(',')}`,
    ).toBeGreaterThan(0);
  });

  it('規模の順序が正しい（育てたチームでは AAA のほうが儲かるのが多数）', () => {
    // 全 seed で逆転しないことは要求しない：AAA は「大作を当てにいく」規模なので、
    // 引きが悪いチームでは話題作のほうが安全、が正しい姿。
    // ただし**多数のチームで AAA が上**でなければ、終盤に AAA を作る理由が消える。
    const wins = SEEDS.filter((seed) => {
      const team = hireViaGacha(6, 'premium', 10, seed);
      return play(team, 'aaa', seed).profit > play(team, 'hit', seed).profit;
    }).length;
    expect(wins, `AAA が勝った seed 数 ${wins}/${SEEDS.length}`).toBeGreaterThanOrEqual(
      Math.ceil(SEEDS.length / 2),
    );
  });
});
