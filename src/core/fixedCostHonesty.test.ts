import { afterEach, describe, expect, it } from 'vitest';
import { MONTHLY_RENT } from '../data/balance';
import { setGameDeps, useGameStore } from '../state/gameStore';
import { defaultDeps, mulberry32 } from './ports';

/**
 * リリース画面が出す「開発中に会社が払った固定費」が、
 * **実際に資金から減った額と一致する**ことのガード。
 *
 * ## 直した嘘
 *
 * 以前は `月固定費 × Math.max(1, Math.round(開発週数 ÷ 4))` という推定を出していた。
 * - 月またぎ0回でも1ヶ月ぶん請求していた（下限1ヶ月）
 * - 10週なら `round(2.5)` で3ヶ月と表示されるが、実際の徴収は2回のことがある
 * - 「今の給与 × 月数」なので、開発の後半で採用すると過去の月にも新しい給与が適用された
 *
 * 誤差1ヶ月は3人チームで約 ¥252万＝ミニゲーム1本の総売上（¥300万）を超える。
 * オーナー指摘「これ最終的にマイナスだけど本当にマイナス？残高的にはプラス」2026-07-29。
 *
 * いまは `monthlyTick`（＝実際に funds を減らす場所）で実額を積む。
 */

afterEach(() => {
  setGameDeps(defaultDeps);
  useGameStore.getState().reset();
});

/** 企画を1本立ち上げ、開発中の状態にする */
const startWork = () => {
  setGameDeps({ rng: mulberry32(1), now: () => 0 });
  useGameStore.getState().reset();
  useGameStore.setState({ funds: 1_000_000_000, debt: 0 });
  const s = useGameStore.getState();
  s.startProject(s.unlockedGenres[0], s.unlockedThemes[0], 'mini');
};

describe('開発中に払った固定費は実額', () => {
  it('月またぎが0回なら 0（下限1ヶ月で水増ししない）', () => {
    startWork();
    expect(useGameStore.getState().current?.fixedCostPaid ?? 0).toBe(0);
    expect(useGameStore.getState().current?.fixedCostTicks ?? 0).toBe(0);
  });

  it('積んだ額は、その間に資金から実際に減った額と一致する', () => {
    startWork();
    const before = useGameStore.getState().funds;
    // 月初を3回またぐ（1ヶ月=4週）
    for (let i = 0; i < 12; i++) useGameStore.getState().tickWeek();
    const s = useGameStore.getState();
    const spent = before - s.funds;
    expect(s.current?.fixedCostTicks).toBe(3);
    expect(s.current?.fixedCostPaid).toBe(spent);
    expect(spent).toBeGreaterThan(0);
  });

  it('開発の途中で採用したら、それ以降の月だけ新しい給与になる', () => {
    startWork();
    // 社員ゼロ（初期状態）で1ヶ月：賃料だけ
    for (let i = 0; i < 4; i++) useGameStore.getState().tickWeek();
    const afterFirst = useGameStore.getState().current?.fixedCostPaid ?? 0;
    expect(afterFirst).toBe(MONTHLY_RENT);

    // 社員を1人足してさらに1ヶ月
    useGameStore.setState({
      employees: [
        {
          id: 'e1',
          name: 'テスト',
          role: 'programmer',
          power: 0.5,
          basePower: 0.5,
          level: 1,
          exp: 0,
          wage: 600_000,
          specialties: [],
          rank: 'B',
          skills: { programming: 30 },
        },
      ] as never,
    });
    for (let i = 0; i < 4; i++) useGameStore.getState().tickWeek();
    const total = useGameStore.getState().current?.fixedCostPaid ?? 0;
    const secondMonth = total - afterFirst;

    // 2ヶ月目だけ給与が乗る。「今の給与 × 2ヶ月」なら secondMonth === afterFirst になるはず
    expect(secondMonth).toBeGreaterThan(afterFirst);
    expect(afterFirst).toBe(MONTHLY_RENT); // 1ヶ月目は遡って増えない
  });

  it('借金があるとき、利息も含めて実額に乗る', () => {
    startWork();
    useGameStore.setState({ debt: 10_000_000 });
    const before = useGameStore.getState().funds;
    for (let i = 0; i < 4; i++) useGameStore.getState().tickWeek();
    const s = useGameStore.getState();
    // 利息ぶん、賃料だけの月より多い
    expect(s.current?.fixedCostPaid).toBeGreaterThan(MONTHLY_RENT);
    expect(s.current?.fixedCostPaid).toBe(before - s.funds);
  });

  it('リリースした作品に実額が引き継がれる', () => {
    startWork();
    for (let i = 0; i < 8; i++) useGameStore.getState().tickWeek();
    const paid = useGameStore.getState().current?.fixedCostPaid ?? 0;
    const ticks = useGameStore.getState().current?.fixedCostTicks ?? 0;
    const w = useGameStore.getState().releaseWork();
    expect(w.fixedCostPaid).toBe(paid);
    expect(w.fixedCostTicks).toBe(ticks);
    expect(ticks).toBe(2);
  });
});
