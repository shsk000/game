import { describe, expect, it } from 'vitest';
import { COMPAT_RANGE, COMPAT_TIERS, compatLabel, getCompat } from './compatibility';
import { GENRE_BY_ID, GENRES, INITIAL_GENRE_IDS } from './genres';
import { INITIAL_THEME_IDS, THEME_BY_ID, THEMES } from './themes';

/**
 * 相性テーブルの帯とレンジ。
 * **分布そのものの平坦さは `compatDistribution.test.ts` が見ている。**
 * ここは「どこに神と地雷を置くか」という配置のルール。
 */
describe('相性テーブル', () => {
  it('全組合せの実効値はクランプの中に収まる', () => {
    for (const g of GENRES) {
      for (const t of THEMES) {
        const c = getCompat(g.id, t.id);
        expect(c, `${g.id}|${t.id}`).toBeGreaterThanOrEqual(COMPAT_RANGE.min);
        expect(c, `${g.id}|${t.id}`).toBeLessThanOrEqual(COMPAT_RANGE.max);
      }
    }
  });

  it('初期解放9組は「神なし・地雷ちょうど1つ」（初手で相性の存在を学ぶ）', () => {
    // 旧テストは「9組すべて 0.85〜1.25」だった。だが**この制約こそが初期帯を平坦にしていた**
    // （9組中8組が同値 1.20）。いまは幅を許し、代わりに配置のルールで縛る。
    const vals = INITIAL_GENRE_IDS.flatMap((g) => INITIAL_THEME_IDS.map((t) => getCompat(g, t)));
    expect(vals.filter((v) => compatLabel(v) === '🔥 神').length, '初手に神は置かない').toBe(0);
    expect(vals.filter((v) => compatLabel(v) === '💀 地雷').length, '地雷はちょうど1つ').toBe(1);
    for (const v of vals) expect(v, '初手に即死級は置かない').toBeGreaterThanOrEqual(0.8);
  });

  it('初期帯の地雷は adventure|sushi（冒険 × 寿司 ＝ 企画が地味）', () => {
    expect(getCompat('adventure', 'sushi')).toBeLessThan(COMPAT_TIERS.normal);
  });

  it('🔥神は初期解放9組（stage1 × stage1）には無い', () => {
    // 中盤の発見物にするため、stage2 の交点には神を置いてよい（旧テストは stage3+ 限定だった）。
    // 初手で神を引いてしまうと「探す」動機がその場で終わる
    for (const g of INITIAL_GENRE_IDS) {
      for (const t of INITIAL_THEME_IDS) {
        expect(getCompat(g, t), `${g}|${t}`).toBeLessThan(COMPAT_TIERS.divine);
      }
    }
  });

  it('🔥神は終盤に偏らない（中盤にも当たりがある）', () => {
    const divine = GENRES.flatMap((g) =>
      THEMES.filter((t) => getCompat(g.id, t.id) >= COMPAT_TIERS.divine).map((t) => ({
        g: g.id,
        t: t.id,
        stage: Math.max(GENRE_BY_ID[g.id].unlockStage, THEME_BY_ID[t.id].unlockStage),
      })),
    );
    expect(divine.length, '神が消滅していない').toBeGreaterThanOrEqual(15);
    expect(
      divine.filter((d) => d.stage <= 2).length,
      `stage2 までに到達できる神が無い（${divine.map((d) => `${d.g}|${d.t}`).join(', ')}）`,
    ).toBeGreaterThanOrEqual(1);
  });

  it('帯の境界がラベルと一致する', () => {
    expect(compatLabel(COMPAT_TIERS.divine)).toBe('🔥 神');
    expect(compatLabel(COMPAT_TIERS.divine - 0.01)).toBe('👍 good');
    expect(compatLabel(COMPAT_TIERS.good)).toBe('👍 good');
    expect(compatLabel(COMPAT_TIERS.good - 0.01)).toBe('😐 普通');
    expect(compatLabel(COMPAT_TIERS.normal)).toBe('😐 普通');
    expect(compatLabel(COMPAT_TIERS.normal - 0.01)).toBe('💀 地雷');
  });
});
