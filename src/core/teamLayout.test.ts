import { describe, expect, it } from 'vitest';
import { GACHA_RANKS, type GachaRank } from '../data/balance';
import { SCALE_BY_ID, type Scale } from '../data/scales';
import type { DevSkillId, Employee, FeaturePoints } from '../state/types';
import { DEV_SKILL_IDS, ZERO_FEATURES } from '../state/types';
import { addFeature, featureGainFor } from './features';
import { computeMetascore } from './metascore';
import { totalPowerFor } from './skills';

/**
 * **チーム編成に支配戦略が無いことのガード。**
 *
 * `score-model.md` §3 の狙いは「均等は**1本のスコアを取る**／集中は**早く安く回す**。
 * どちらも選べる」。実装当初はここが崩れており、**集中が半分の労力でスコアも売上も上**
 * だった（実機で発見。同じ4人・同じ総スキルで 均等メタ75・12文 vs 集中メタ86・6文）。
 *
 * 原因は「1分野あたりの文数は固定」なので集中しても打つ量は増えないのに、
 * スキル合計だけ増えて ◎ の分野が上限100 に張り付き、△ の分野を捨てられたこと。
 * `SKILL_CONFIG.secondMemberEfficiency` を 0.5 → 0.12 に下げて解いた。
 *
 * **この定数には上下両方から制約がある**（片方だけ見て動かすと別の支配戦略が生まれる）：
 * - 上げすぎ → 「◎に人を寄せる」が勝つ
 * - 下げすぎ → 「◎の2分野に1人ずつ、2人だけ雇う」が勝つ（人件費も開発期間も半分）
 */

/** メタスコアの差として意味を持つ最小幅。丸めや装備で簡単に反転しない余裕を取る */
const MARGIN = 5;

/** 規模ごとの入門チーム（score-model.md §3 の規模係数はこれを基準に校正されている） */
const ENTRY_TEAM: Record<Scale, { rank: GachaRank; level: number }> = {
  mini: { rank: 'C', level: 1 },
  mobile: { rank: 'B', level: 3 },
  indie: { rank: 'A', level: 5 },
  hit: { rank: 'A', level: 8 },
  aaa: { rank: 'A', level: 10 },
};

const emp = (id: string, field: DevSkillId, skill: number): Employee =>
  ({
    id,
    name: id,
    role: 'designer',
    power: skill / 100,
    basePower: skill / 100,
    level: 1,
    exp: 0,
    wage: 0,
    specialties: [],
    rank: 'B',
    skills: { [field]: skill },
  }) as Employee;

type Layout = 'even' | 'concentrated' | 'duo';

/** 編成を作る。even=4分野に1人ずつ／concentrated=◎の2分野に2人ずつ／duo=◎の2分野に1人ずつ */
const teamFor = (layout: Layout, skill: number): Employee[] => {
  if (layout === 'even') return DEV_SKILL_IDS.map((f, i) => emp(`e${i}`, f, skill));
  // アクション型（puzzle）の ◎ は 操作性=programming と グラフィック=graphics
  const hot: DevSkillId[] = ['programming', 'graphics'];
  if (layout === 'duo') return hot.map((f, i) => emp(`e${i}`, f, skill));
  return hot.flatMap((f, i) => [emp(`e${i}a`, f, skill), emp(`e${i}b`, f, skill)]);
};

/** そのチームで素直に打ち切ったときのメタスコアと総文数 */
const play = (layout: Layout, skill: number, scale: Scale) => {
  const team = teamFor(layout, skill);
  const perField = Math.max(1, Math.round((SCALE_BY_ID[scale].neededWeeks * 3) / 4));
  let features: FeaturePoints = { ...ZERO_FEATURES, innovationPt: 100 };
  let covered = 0;
  for (const field of DEV_SKILL_IDS) {
    const gain = featureGainFor(field, team, scale, 1.01);
    if (gain <= 0) continue;
    covered += 1;
    for (let n = 0; n < perField; n++) features = addFeature(features, field, gain);
  }
  const meta = computeMetascore(
    { features, genreId: 'puzzle', themeId: 'sushi', compat: 1.0, trend: null },
    () => 0.5, // ブレ 0（編成の差だけを見る）
  );
  return { metascore: meta.metascore, phrases: perField * covered, features };
};

/** 規模ごとの「入門 / 中間 / 最強」チーム強度 */
const strengthsFor = (scale: Scale): { label: string; skill: number }[] => {
  const e = ENTRY_TEAM[scale];
  const entry = totalPowerFor(e.rank, e.level);
  return [
    { label: '入門', skill: entry },
    { label: '中間', skill: Math.min(100, entry * 1.4) },
    { label: '最強', skill: totalPowerFor('S', 10) },
  ];
};

const SCALES = Object.keys(ENTRY_TEAM) as Scale[];
const CASES = SCALES.flatMap((scale) =>
  strengthsFor(scale).map((s) => ({ scale, ...s, label: `${scale}/${s.label}` })),
);

describe('①均等は集中よりスコアが高い（1本のスコアを取れる）', () => {
  it.each(CASES.map((c) => [c.label, c] as const))('%s', (_l, c) => {
    const even = play('even', c.skill, c.scale);
    const conc = play('concentrated', c.skill, c.scale);
    expect(
      even.metascore - conc.metascore,
      `均等${even.metascore} vs 集中${conc.metascore}`,
    ).toBeGreaterThanOrEqual(MARGIN);
  });
});

describe('②集中は均等より早く終わる（早く安く回せる）', () => {
  it.each(CASES.map((c) => [c.label, c] as const))('%s', (_l, c) => {
    expect(play('concentrated', c.skill, c.scale).phrases).toBeLessThan(
      play('even', c.skill, c.scale).phrases,
    );
  });
});

describe('③同じ分野に人を足しても強くならない（寄せる意味がない）', () => {
  it.each(CASES.map((c) => [c.label, c] as const))('%s', (_l, c) => {
    // 担当制：その分野は**いちばん強い1人**で決まる。同じ強さの2人目は控え。
    // 「◎の2分野に寄せる」に旨みが無いことを、ここで直接固定する
    const conc = play('concentrated', c.skill, c.scale); // ◎2分野 × 2人ずつ＝4人
    const duo = play('duo', c.skill, c.scale); // ◎2分野 × 1人ずつ＝2人
    expect(conc.metascore, `集中${conc.metascore} vs 少人数${duo.metascore}`).toBe(duo.metascore);
  });
});

describe('④まだ担当がいない分野を埋める社員が強い（§10-4 メタ進行）', () => {
  it.each(SCALES.map((s) => [s, s] as const))('%s：空いている分野を埋めると点が上がる', (_l, scale) => {
    const e = ENTRY_TEAM[scale];
    const skill = totalPowerFor(e.rank, e.level);
    const perField = Math.max(1, Math.round((SCALE_BY_ID[scale].neededWeeks * 3) / 4));

    const build = (team: Employee[]) => {
      let f: FeaturePoints = { ...ZERO_FEATURES, innovationPt: 100 };
      for (const field of DEV_SKILL_IDS) {
        const gain = featureGainFor(field, team, scale, 1.01);
        for (let n = 0; n < perField; n++) f = addFeature(f, field, gain);
      }
      return computeMetascore(
        { features: f, genreId: 'puzzle', themeId: 'sushi', compat: 1.0, trend: null },
        () => 0.5,
      ).metascore;
    };

    const three = DEV_SKILL_IDS.slice(0, 3).map((f, i) => emp(`e${i}`, f, skill));
    const four = [...three, emp('extra', DEV_SKILL_IDS[3], skill)];
    const dup = [...three, emp('dup', DEV_SKILL_IDS[0], skill)];
    expect(build(four), '空いている分野を埋めると上がる').toBeGreaterThan(build(three));
    expect(build(dup), '埋まっている分野に足しても上がらない').toBe(build(three));
  });
});

describe('プレイヤーが選ぶ理由が数字で言える', () => {
  it('均等はスコアで勝ち、集中は文数で勝つ（ミニ・入門チーム）', () => {
    const skill = totalPowerFor('C', 1);
    const even = play('even', skill, 'mini');
    const conc = play('concentrated', skill, 'mini');
    expect(even.metascore).toBeGreaterThan(conc.metascore);
    expect(conc.phrases).toBe(even.phrases / 2);
  });

  it('全ランクで、同じ総スキルなら均等が勝つ（ランクによらず成立する）', () => {
    for (const rank of GACHA_RANKS) {
      const skill = totalPowerFor(rank, 5);
      const even = play('even', skill, 'mobile');
      const conc = play('concentrated', skill, 'mobile');
      expect(even.metascore, rank).toBeGreaterThan(conc.metascore);
    }
  });
});
