import { describe, expect, it } from 'vitest';
import { rollRank } from '../core/gacha';
import { mulberry32 } from '../core/ports';
import { GACHA_CONFIG } from './balance';
import { newCandidate } from './employees';

/**
 * 採用ガチャの出力分布のゴールデン値。
 *
 * **なぜ必要か**：実装ステップ1 で社員をスキル化したとき、`power` をスキルから導出しようとして
 * 旧 power 帯（B 0.2〜0.4）と新しい総合力帯（Lv1 15〜28）の単位ズレに気づかず、
 * **採用社員の平均 power が半減**した（序盤の総売上が ¥105万 → ¥10万＝10分の1）。
 * それでもユニットテストは 463 件全緑だった。当時の安全弁が
 * 「power が同じならスコアが同じ」という**恒真テスト**で、power の値そのものを見ていなかったため。
 *
 * ここでは実際に `newCandidate` を回して**分布そのもの**を固定する。
 * スコア式ではなく「誰が出るか」が変わったときに落ちるのがこのテストの役割。
 */

const measure = (kind: 'normal' | 'premium', n = 20_000) => {
  const rng = mulberry32(7);
  const deps = { rng, now: () => 0 };
  let powerSum = 0;
  const roles: Record<string, number> = { programmer: 0, designer: 0, pr: 0 };
  for (let i = 0; i < n; i++) {
    const c = newCandidate(deps, rollRank(kind, rng));
    powerSum += c.power;
    roles[c.role] += 1;
  }
  return {
    meanPower: powerSum / n,
    roleRate: {
      programmer: roles.programmer / n,
      designer: roles.designer / n,
      pr: roles.pr / n,
    },
  };
};

/** ランク帯の中央値から理論平均を出す（GACHA_CONFIG を変えたらここも自動で追従する） */
const theoreticalMeanPower = (kind: 'normal' | 'premium'): number => {
  const rates = GACHA_CONFIG[kind].rates;
  return (['B', 'A', 'S'] as const).reduce((sum, r) => {
    const range = GACHA_CONFIG.powerRange[r];
    return sum + rates[r] * ((range.min + range.max) / 2);
  }, 0);
};

describe('採用ガチャの出力分布（ゴールデン値）', () => {
  it.each(['normal', 'premium'] as const)(
    '%s の平均 power がランク帯の理論値と一致する（±0.01）',
    (kind) => {
      const { meanPower } = measure(kind);
      expect(meanPower).toBeCloseTo(theoreticalMeanPower(kind), 2);
    },
  );

  it('職種の分布が旧 ROLE_DICE と同じ（programmer 40% / designer 40% / pr 20%）', () => {
    // スキルは5種だが、graphics / sound / scenario はどれも旧 designer に対応する。
    // 主スキルの抽選重み（core/skills.ts PRIMARY_SKILL_WEIGHTS）でこの分布を再現している。
    // ここが崩れると、バグ抑制（プログラマーの power 合計）の期待値が変わる。
    const { roleRate } = measure('normal');
    expect(roleRate.programmer).toBeCloseTo(0.4, 1);
    expect(roleRate.designer).toBeCloseTo(0.4, 1);
    expect(roleRate.pr).toBeCloseTo(0.2, 1);
  });

  it('総合力は power × 100 と一致する（実装ステップ1 では同じ値の別表現）', () => {
    const rng = mulberry32(3);
    const deps = { rng, now: () => 0 };
    for (let i = 0; i < 500; i++) {
      const c = newCandidate(deps, rollRank('premium', rng));
      const total = Object.values(c.skills ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      // 2スキルでも合計が目減りしない（分散ペナルティは実装ステップ3 から）
      expect(total).toBeCloseTo(c.power * 100, 1);
    }
  });

  it('ランクは B / A / S の3種（C の排出は実装ステップ3 から）', () => {
    const rng = mulberry32(11);
    const deps = { rng, now: () => 0 };
    for (let i = 0; i < 500; i++) {
      expect(newCandidate(deps, rollRank('premium', rng)).rank).not.toBe('C');
    }
  });
});
