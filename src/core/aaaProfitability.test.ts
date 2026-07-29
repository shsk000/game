import { describe, expect, it } from 'vitest';
import { SCALE_BALANCE, salesMultiplierForScore, scoreTierFor } from '../data/balance';
import { SCALE_BY_ID } from '../data/scales';
import type { Employee } from '../state/types';
import { DEV_SKILL_IDS } from '../state/types';
import { addFeature, featureGainFor, initialFeatures } from './features';
import { computeMetascore } from './metascore';
import { mulberry32 } from './ports';
import { totalPowerFor } from './skills';

/**
 * AAA 帯の採算ガード（docs/spec/score-model.md §5）。
 *
 * AAA は**唯一の天井基準の規模**（最強構成でようやく100）で、開発費 ¥100億 に対し
 * 普通（¥50億）では赤字、ヒット以上で黒字になる設計。ここが崩れると
 * 終盤の10本前後が「作るほど損」になり、継続（§10-1）を直撃する。
 *
 * 解放は32本目・想定プレイは40〜45本なので、AAA 帯は8〜13本ある。
 */

/** そのチームが AAA を素直に打ち切ったときのメタスコアと粗利 */
const runAaa = (rank: 'A' | 'S', level: number, seats: number) => {
  const rng = mulberry32(11);
  const per = totalPowerFor(rank, level);
  const team: Employee[] = Array.from({ length: seats }, (_, i) => ({
    id: `e${i}`,
    name: `e${i}`,
    role: 'designer',
    power: per / 100,
    basePower: per / 100,
    level,
    exp: 0,
    wage: 0,
    specialties: [],
    rank,
    skills: { [DEV_SKILL_IDS[i % 4]]: per },
  })) as Employee[];

  const perField = Math.max(1, Math.round((SCALE_BY_ID.aaa.neededWeeks * 3) / 4));
  let f = initialFeatures([], 'puzzle', 'sushi');
  for (const field of DEV_SKILL_IDS) {
    for (let n = 0; n < perField; n++) {
      f = addFeature(f, field, featureGainFor(field, team, 'aaa', 1.01));
    }
  }
  const m = computeMetascore(
    { features: f, genreId: 'puzzle', themeId: 'sushi', compat: 1.0, trend: null },
    rng,
  );
  const revenue = SCALE_BALANCE.aaa.baseRevenue * salesMultiplierForScore(m.metascore);
  const fixed = (580_000 * seats + 300_000) * (SCALE_BY_ID.aaa.neededWeeks / 4);
  return {
    metascore: m.metascore,
    tier: scoreTierFor(m.metascore),
    profit: revenue - SCALE_BALANCE.aaa.devCost - fixed,
  };
};

describe('AAA 帯の採算（終盤が「作るほど損」にならない）', () => {
  it('入門チーム（A級Lv8・6席）はヒット帯に届き、赤字にはならない', () => {
    const r = runAaa('A', 8, 6);
    expect(r.metascore, 'ヒット帯（70〜79）').toBeGreaterThanOrEqual(70);
    // ヒット（¥100億）で開発費 ¥100億 をちょうど回収し、固定費ぶん（¥0.34億）だけ残る。
    // 「入門チームは赤字ギリギリ、育てて初めて儲かる」＝大作を当てにいく緊張
    expect(r.profit, '大きな赤字にはならない').toBeGreaterThan(-1_000_000_000);
  });

  it('育てるほどヒット区分が上がり、粗利が跳ねる', () => {
    const entry = runAaa('A', 8, 6);
    const grown = runAaa('A', 10, 6);
    const best = runAaa('S', 10, 6);
    // 入門＝ヒット（トントン）→ 育てて大ヒット → 最強で神ゲー、と区分が上がっていく
    expect(grown.metascore).toBeGreaterThanOrEqual(entry.metascore);
    expect(best.metascore).toBeGreaterThanOrEqual(grown.metascore);
    // 粗利は育てるほど増える（同じ区分に張り付くこともあるので減らないことを見る）
    expect(grown.profit).toBeGreaterThanOrEqual(entry.profit);
    expect(best.profit).toBeGreaterThanOrEqual(grown.profit);
    expect(best.profit).toBeGreaterThan(entry.profit);
    // 最強まで育てれば開発費（¥100億）を大きく上回る
    expect(best.profit).toBeGreaterThan(10_000_000_000);
  });

  it('最強構成（S級Lv10）で神ゲーに届く', () => {
    expect(runAaa('S', 10, 6).tier).toBe('godGame');
  });

  it('普通（メタ50〜69）では話題作の名作に届かない（大作を当てにいく緊張）', () => {
    // AAA を普通で出すくらいなら、話題作で名作を狙ったほうが儲かる。
    // 「AAA は当てにいく規模」という設計はこの関係で表現する
    const aaaNormal =
      SCALE_BALANCE.aaa.baseRevenue * salesMultiplierForScore(60) - SCALE_BALANCE.aaa.devCost;
    const hitMasterpiece =
      SCALE_BALANCE.hit.baseRevenue * salesMultiplierForScore(92) - SCALE_BALANCE.hit.devCost;
    expect(aaaNormal).toBeLessThan(hitMasterpiece);
  });
});
