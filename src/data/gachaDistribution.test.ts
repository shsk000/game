import { afterEach, describe, expect, it } from 'vitest';
import { defaultDeps, mulberry32 } from '../core/ports';
import { rollRank4 } from '../core/skills';
import { setGameDeps, useGameStore } from '../state/gameStore';
import { GACHA_RANK_RATES, GACHA_RANKS, RANK_TOTAL_POWER, SKILL_CONFIG } from './balance';
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
    const c = newCandidate(deps, rollRank4(kind, rng));
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

/**
 * ランクごとの Lv1 総合力の中央値から理論平均を出す。
 * 実装ステップ3：power は総合力 ÷ 100 で導出されるので、Lv1 帯（15〜28）が基準になる。
 */
const theoreticalMeanPower = (kind: 'normal' | 'premium'): number => {
  const rates = GACHA_RANK_RATES[kind];
  return GACHA_RANKS.reduce((sum, r) => {
    const t = RANK_TOTAL_POWER[r];
    // 2スキル持ち（50%）は分散ペナルティで目減りする
    const mid = ((t.lv1Min + t.lv1Max) / 2 / 100) * (1 + SKILL_CONFIG.spreadPenalty) / 2;
    return sum + rates[r] * mid;
  }, 0);
};

describe('採用ガチャの出力分布（ゴールデン値）', () => {
  it.each(['normal', 'premium'] as const)(
    '%s の平均 power がランク帯の理論値と一致する（±0.01）',
    (kind) => {
      const { meanPower } = measure(kind);
      expect(meanPower).toBeCloseTo(theoreticalMeanPower(kind), 1);
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

  it('総合力は power × 100 と一致する（power は総合力から導出している）', () => {
    const rng = mulberry32(3);
    const deps = { rng, now: () => 0 };
    for (let i = 0; i < 500; i++) {
      const c = newCandidate(deps, rollRank4('premium', rng));
      const total = Object.values(c.skills ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      expect(total).toBeCloseTo(c.power * 100, 0);
    }
  });

  it('Lv1 の総合力はランクによらずほぼ同じ（15〜28。開封時点では差が分からない）', () => {
    const rng = mulberry32(11);
    const deps = { rng, now: () => 0 };
    for (const rank of GACHA_RANKS) {
      for (let i = 0; i < 100; i++) {
        const total = Object.values(newCandidate(deps, rank).skills ?? {}).reduce(
          (a, b) => a + (b ?? 0),
          0,
        );
        expect(total, rank).toBeGreaterThanOrEqual(RANK_TOTAL_POWER[rank].lv1Min * SKILL_CONFIG.spreadPenalty - 1.5);
        expect(total, rank).toBeLessThanOrEqual(RANK_TOTAL_POWER[rank].lv1Max + 0.5);
      }
    }
  });
});

/**
 * **本番の入口（`pullGacha`）から通す**分布ガード。
 *
 * これが必要な理由：上のテスト群はランクを自分で決めて `newCandidate` に渡すので、
 * ゲーム本体が呼ぶランク抽選関数を**一度も通らない**。実際にそこが差し替わったまま残り
 * （`gameStore` が `rollRank4` を呼び、C を 35% 排出していた）、上のテストは全部緑だった。
 * 「本番が通らない経路を検証している」のは、恒真テストと同じ穴。
 */
describe('本番経路（pullGacha）の出力分布', () => {
  const measureViaStore = (kind: 'normal' | 'premium', n: number) => {
    const rng = mulberry32(23);
    setGameDeps({ rng, now: () => 0 });
    const store = useGameStore.getState();
    let powerSum = 0;
    const ranks: Record<string, number> = { C: 0, B: 0, A: 0, S: 0 };
    const roles: Record<string, number> = { programmer: 0, designer: 0, pr: 0 };
    let pulled = 0;
    for (let i = 0; i < n; i++) {
      // 資金と天井をリセットして1回ずつ引く（価格・破産の影響を除く）
      useGameStore.setState({ funds: 1e12, gachaPity: 0, candidate: null });
      if (!useGameStore.getState().pullGacha(kind)) continue;
      const c = useGameStore.getState().candidate;
      if (!c) continue;
      pulled += 1;
      powerSum += c.power;
      ranks[c.rank ?? 'B'] += 1;
      roles[c.role] += 1;
    }
    void store;
    return { pulled, meanPower: powerSum / pulled, ranks, roles };
  };

  afterEach(() => {
    setGameDeps(defaultDeps);
    useGameStore.setState({ candidate: null, gachaPity: 0 });
  });

  it('C を含む4ランクが排出される（実装ステップ3 で解禁）', () => {
    const { pulled, ranks } = measureViaStore('premium', 2_000);
    expect(pulled).toBe(2_000);
    for (const r of GACHA_RANKS) expect(ranks[r], r).toBeGreaterThan(0);
  });

  it('normal は S を出さない', () => {
    expect(measureViaStore('normal', 2_000).ranks.S).toBe(0);
  });

  it.each(['normal', 'premium'] as const)(
    '%s の平均 power がランク帯の理論値と一致する（±0.01）',
    (kind) => {
      const { meanPower } = measureViaStore(kind, 20_000);
      expect(meanPower).toBeCloseTo(theoreticalMeanPower(kind), 1);
    },
  );

  it('職種の分布が旧 ROLE_DICE と同じ（programmer 40% / designer 40% / pr 20%）', () => {
    const { pulled, roles } = measureViaStore('normal', 20_000);
    expect(roles.programmer / pulled).toBeCloseTo(0.4, 1);
    expect(roles.designer / pulled).toBeCloseTo(0.4, 1);
    expect(roles.pr / pulled).toBeCloseTo(0.2, 1);
  });
});

