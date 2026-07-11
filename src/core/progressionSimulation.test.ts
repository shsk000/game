import { describe, expect, it } from 'vitest';
import { SCALE_BALANCE } from '../data/balance';
import type { Scale } from '../data/scales';
import type { Employee, EmployeeRole } from '../state/types';
import { computeCharacterScore } from '../utils/character';
import { computeMetascore, computeQualityV10, computeRevenue } from '../utils/metascore';
import { applyReleaseGrowth } from './growth';
import { mulberry32, type Rng } from './ports';

/**
 * v0.18 進行ペーシングのシミュレーション（spec v18 §1）。
 * 「変化が起きる間隔」のガードレール：平均的な腕のプレイヤーで
 * mobile 解放が 8〜16 作目・aaa 到達が 25〜60 作目に収まることを検証する。
 * ここが落ちたら SCALE_BALANCE / 成長・評価系の変更がペーシングを壊している。
 */

const SCALE_ORDER: Scale[] = ['mini', 'mobile', 'indie', 'hit', 'aaa'];

const emp = (id: string, role: EmployeeRole): Employee => ({
  id,
  name: id,
  role,
  power: 0.4,
  basePower: 0.4,
  level: 1,
  exp: 0,
  wage: 0,
  specialties: [],
});

/** 平均的プレイヤー：相性=初期帯平均(compat1.1→31点)・タイピング70・軸ボーナス半分 */
const AFFINITY = 31;
const TYPING = 70;
const AXIS_BONUS = 4;

/** 60 作までシミュレートし、各規模の解放が何作目だったかを返す */
const simulate = (seed: number) => {
  const rng: Rng = mulberry32(seed);
  let team = [emp('a', 'programmer'), emp('b', 'designer'), emp('c', 'pr')];
  const ids = team.map((e) => e.id);
  let lifetime = 0;
  let scaleIdx = 0; // 常に解放済みの最高規模で開発
  const unlockedAt: Partial<Record<Scale, number>> = {};

  for (let release = 1; release <= 60; release++) {
    const scale = SCALE_ORDER[scaleIdx];
    const { score: charPower } = computeCharacterScore({ assignedEmployees: team, scale });
    const { Q } = computeQualityV10(
      { charPower, genreAffinity: AFFINITY, typingScore: TYPING },
      rng,
    );
    const quality = Math.max(0, Math.min(100, Math.round(Q + AXIS_BONUS)));
    const meta = computeMetascore(quality, 'puzzle', 'sushi', null, rng);
    // 販売プールは全額回収される前提で累計に加算
    lifetime += computeRevenue(meta.metascore, 'puzzle', 'sushi', scale, null, 0, false);
    team = applyReleaseGrowth(team, ids, meta.metascore).employees;

    // 累計売上ゲートを満たしたら次の規模を解放（資金は十分ある前提）
    while (
      scaleIdx + 1 < SCALE_ORDER.length &&
      lifetime >= SCALE_BALANCE[SCALE_ORDER[scaleIdx + 1]].unlockSalesRequired
    ) {
      scaleIdx += 1;
      unlockedAt[SCALE_ORDER[scaleIdx]] = release;
    }
  }
  return { unlockedAt, finalLevel: team[0].level };
};

describe('進行ペーシング（spec v18 §1：変化が起きる間隔）', () => {
  it('mobile 解放は 8〜16 作目（mini 期が長すぎず短すぎない）', () => {
    for (const seed of [1, 42, 777]) {
      const { unlockedAt } = simulate(seed);
      expect(unlockedAt.mobile, `seed=${seed}`).toBeGreaterThanOrEqual(8);
      expect(unlockedAt.mobile, `seed=${seed}`).toBeLessThanOrEqual(16);
    }
  });

  it('aaa 到達は 25〜60 作目（1周 ≒ Lv10 到達と同期）', () => {
    for (const seed of [1, 42, 777]) {
      const { unlockedAt, finalLevel } = simulate(seed);
      expect(unlockedAt.aaa, `seed=${seed}`).toBeGreaterThanOrEqual(25);
      expect(unlockedAt.aaa, `seed=${seed}`).toBeLessThanOrEqual(60);
      // 60 作時点で社員は十分育っている（Lv7+。Lv10 は上振れ・高メタ連発時の到達点）
      expect(finalLevel).toBeGreaterThanOrEqual(7);
    }
  });

  it('各ティアの間隔が極端に潰れていない（連続解放しない）', () => {
    const { unlockedAt } = simulate(42);
    const order = ['mobile', 'indie', 'hit', 'aaa'] as const;
    for (let i = 1; i < order.length; i++) {
      const prev = unlockedAt[order[i - 1]];
      const cur = unlockedAt[order[i]];
      if (prev !== undefined && cur !== undefined) {
        expect(cur - prev, `${order[i - 1]}→${order[i]}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
