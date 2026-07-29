import { describe, expect, it } from 'vitest';
import { SCALE_BALANCE } from '../data/balance';
import type { Scale } from '../data/scales';
import { SCALE_BY_ID } from '../data/scales';
import type { Employee, EmployeeRole, FeaturePoints, Work } from '../state/types';
import { DEV_SKILL_IDS } from '../state/types';
import { computeRevenue } from '../utils/metascore';
import { addFeature, featureGainFor, initialFeatures } from './features';
import { applyReleaseGrowth } from './growth';
import { computeMetascore } from './metascore';
import { mulberry32, type Rng } from './ports';

/**
 * v0.18 進行ペーシングのシミュレーション（spec v18 §1）。
 * 「変化が起きる間隔」のガードレール：平均的な腕のプレイヤーで
 * mobile 解放が 8〜16 作目・aaa 到達が 25〜60 作目に収まることを検証する。
 * ここが落ちたら SCALE_BALANCE / 成長・評価系の変更がペーシングを壊している。
 *
 * v0.22 補足：本シミュレーションは**非課金の平均プレイヤー**（初期 power 0.4 の 3 人チーム）を
 * モデル化する。採用ガチャで S を課金ラッシュした場合の早期加速はオーナー決定で許容された
 * （v21「時間を金で買う」思想。spec v22 §8）ため、このペーシングガードには反映しない。
 */

const SCALE_ORDER: Scale[] = ['mini', 'mobile', 'indie', 'hit', 'aaa'];

const emp = (id: string, role: EmployeeRole): Employee => ({
  id,
  name: id,
  role,
  power: 0.18,
  basePower: 0.18,
  level: 1,
  exp: 0,
  wage: 0,
  specialties: [],
  rank: 'B',
  // 入門チーム：各分野の専門家1人ずつ（C/B級 Lv1 相当のスキル18）
  skills:
    role === 'programmer'
      ? { programming: 18 }
      : role === 'designer'
        ? { graphics: 18 }
        : { sound: 18 },
});

/** 60 作までシミュレートし、各規模の解放が何作目だったかを返す */
/**
 * 1本を「入門チームが素直に打ち切った」ときの特徴ポイント。
 * 4分野カバー・1分野あたり (総文数 ÷ 4) 文・打鍵倍率は普通（×1.01）。
 */
const featuresAfterPlay = (team: Employee[], scale: Scale, library: Work[]): FeaturePoints => {
  const phrasesPerField = Math.max(1, Math.round((SCALE_BY_ID[scale].neededWeeks * 3) / 4));
  let f = initialFeatures(library, 'puzzle', 'sushi');
  for (const field of DEV_SKILL_IDS) {
    for (let n = 0; n < phrasesPerField; n++) {
      f = addFeature(f, field, featureGainFor(field, team, scale, 1.01));
    }
  }
  return f;
};

/** 各リリース時点の累計売上を返す（解放閾値の校正用） */
export const trace = (seed: number) => {
  const rng: Rng = mulberry32(seed);
  let team = [emp('a', 'programmer'), emp('b', 'designer'), emp('c', 'pr')];
  const ids = team.map((e) => e.id);
  let lifetime = 0;
  const out: { n: number; scale: Scale; meta: number; lifetime: number }[] = [];
  let scaleIdx = 0;
  for (let release = 1; release <= 40; release++) {
    const scale = SCALE_ORDER[scaleIdx];
    const features = featuresAfterPlay(team, scale, []);
    const meta = computeMetascore(
      { features, genreId: 'puzzle', themeId: 'sushi', compat: 1.0, trend: null },
      rng,
    );
    lifetime += computeRevenue(meta.metascore, 'puzzle', 'sushi', scale, null, 0);
    team = applyReleaseGrowth(team, ids, meta.metascore, scale).employees;
    out.push({ n: release, scale, meta: meta.metascore, lifetime });
    // 8本ごとに次の規模へ（目標ペース）
    if (release % 8 === 0 && scaleIdx + 1 < SCALE_ORDER.length) scaleIdx += 1;
  }
  return out.filter((r) => r.n % 8 === 0);
};

const simulate = (seed: number) => {
  const rng: Rng = mulberry32(seed);
  let team = [emp('a', 'programmer'), emp('b', 'designer'), emp('c', 'pr')];
  const ids = team.map((e) => e.id);
  let lifetime = 0;
  let scaleIdx = 0; // 常に解放済みの最高規模で開発
  const unlockedAt: Partial<Record<Scale, number>> = {};

  for (let release = 1; release <= 60; release++) {
    const scale = SCALE_ORDER[scaleIdx];
    const features = featuresAfterPlay(team, scale, []);
    const meta = computeMetascore(
      { features, genreId: 'puzzle', themeId: 'sushi', compat: 1.0, trend: null },
      rng,
    );
    // 販売プールは全額回収される前提で累計に加算
    lifetime += computeRevenue(meta.metascore, 'puzzle', 'sushi', scale, null, 0);
    team = applyReleaseGrowth(team, ids, meta.metascore, scale).employees;

    // 累計売上ゲートを満たしたら次の規模を解放（資金は十分ある前提）
    while (
      scaleIdx + 1 < SCALE_ORDER.length &&
      lifetime >= SCALE_BALANCE[SCALE_ORDER[scaleIdx + 1]].unlockSalesRequired
    ) {
      scaleIdx += 1;
      unlockedAt[SCALE_ORDER[scaleIdx]] = release;
    }
  }
  return { unlockedAt, finalLevel: team[0].level, lifetime };
};

describe('進行ペーシング（spec v18 §1：変化が起きる間隔）', () => {
  it('各規模を 7〜9 本ずつ遊べる（話題作が2〜3本で通過しない）', () => {
    // docs/spec/score-model.md §5：40〜45本のプレイで4規模がそれぞれ7〜9本、AAA が残り全部。
    // 「次の規模が見えている」は本作でいちばん強い「あと少しで次」なので、
    // 23本で使い切ると後半の推進力がレベルと図鑑だけになる（game-design §10-4）
    for (let seed = 1; seed <= 5; seed++) {
      const { unlockedAt } = simulate(seed);
      const points = [0, unlockedAt.mobile, unlockedAt.indie, unlockedAt.hit, unlockedAt.aaa];
      for (let i = 1; i < points.length; i++) {
        const span = (points[i] ?? 0) - (points[i - 1] ?? 0);
        expect(span, `seed=${seed} 規模${i}`).toBeGreaterThanOrEqual(6);
        expect(span, `seed=${seed} 規模${i}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('mobile 解放は 8〜16 作目（mini 期が長すぎず短すぎない）', () => {
    for (const seed of [1, 42, 777]) {
      const { unlockedAt } = simulate(seed);
      expect(unlockedAt.mobile, `seed=${seed}`).toBeGreaterThanOrEqual(6);
      expect(unlockedAt.mobile, `seed=${seed}`).toBeLessThanOrEqual(12);
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
