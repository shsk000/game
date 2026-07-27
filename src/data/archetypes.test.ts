import { describe, expect, it } from 'vitest';
import { FEATURE_IDS } from '../state/types';
import {
  ARCHETYPES,
  type ArchetypeId,
  GENRE_ARCHETYPE,
  normalizedWeightsFor,
  weightsFor,
  WEIGHT_VALUE,
} from './archetypes';
import { GENRES } from './genres';

describe('型の一覧（docs/spec/score-model.md §4）', () => {
  const ids = Object.keys(ARCHETYPES) as ArchetypeId[];

  it('型は6つ（◎を4分野から2つ選ぶ組み合わせ）', () => {
    expect(ids).toHaveLength(6);
  });

  it('全型が ◎2つ・○2つ・△1つ（重みの合計が揃う）', () => {
    for (const id of ids) {
      const w = Object.values(ARCHETYPES[id].weights);
      expect(w.filter((x) => x === '◎'), id).toHaveLength(2);
      expect(w.filter((x) => x === '○'), id).toHaveLength(2);
      expect(w.filter((x) => x === '△'), id).toHaveLength(1);
    }
  });

  it('革新性は全型で ○ 固定（スキルで伸ばすものではないので型で差をつけない）', () => {
    for (const id of ids) expect(ARCHETYPES[id].weights.innovationPt, id).toBe('○');
  });

  it('◎ の組み合わせが型ごとに違う（6通りを重複なく使い切る）', () => {
    const combos = ids.map((id) =>
      (Object.entries(ARCHETYPES[id].weights) as [string, string][])
        .filter(([, l]) => l === '◎')
        .map(([k]) => k)
        .sort()
        .join('+'),
    );
    expect(new Set(combos).size).toBe(6);
  });
});

describe('ジャンルの型割当', () => {
  it('全27ジャンルにいずれかの型が割り当たっている', () => {
    for (const g of GENRES) {
      expect(GENRE_ARCHETYPE[g.id], g.id).toBeDefined();
      expect(ARCHETYPES[GENRE_ARCHETYPE[g.id]], g.id).toBeDefined();
    }
    expect(Object.keys(GENRE_ARCHETYPE)).toHaveLength(GENRES.length);
  });

  it('存在しないジャンルが混ざっていない', () => {
    const known = new Set(GENRES.map((g) => g.id as string));
    for (const id of Object.keys(GENRE_ARCHETYPE)) expect(known.has(id), id).toBe(true);
  });
});

describe('normalizedWeightsFor（正規化）', () => {
  it('どのジャンルでも重みの合計が 1.0（◎の多いジャンルが有利にならない）', () => {
    for (const g of GENRES) {
      const w = normalizedWeightsFor(g.id);
      const total = FEATURE_IDS.reduce((s, id) => s + w[id], 0);
      expect(total, g.id).toBeCloseTo(1, 10);
    }
  });

  it('ラベルの順序が重みの大小に一致する（◎ > ○ > △）', () => {
    const w = normalizedWeightsFor('horror');
    const l = weightsFor('horror');
    const val = (id: (typeof FEATURE_IDS)[number]) => w[id];
    const marks = FEATURE_IDS.map((id) => ({ id, label: l[id], v: val(id) }));
    const maru = marks.filter((m) => m.label === '◎').map((m) => m.v);
    const shiro = marks.filter((m) => m.label === '○').map((m) => m.v);
    const sankaku = marks.filter((m) => m.label === '△').map((m) => m.v);
    expect(Math.min(...maru)).toBeGreaterThan(Math.max(...shiro));
    expect(Math.min(...shiro)).toBeGreaterThan(Math.max(...sankaku));
  });

  it('段階の素の値を変えると全ジャンルに反映される（調整が3定数で済む）', () => {
    expect(WEIGHT_VALUE['◎'] / WEIGHT_VALUE['○']).toBe(3);
    expect(WEIGHT_VALUE['○'] / WEIGHT_VALUE['△']).toBeCloseTo(1 / 0.3, 5);
  });

  it('ホラーの正規化重みが spec の例と一致する', () => {
    // spec §4：🎵0.36 📖0.36 🎨0.12 🕹0.04 💡0.12（素の合計 8.3）
    const w = normalizedWeightsFor('horror');
    expect(w.soundPt).toBeCloseTo(0.36, 2);
    expect(w.storyPt).toBeCloseTo(0.36, 2);
    expect(w.graphicsPt).toBeCloseTo(0.12, 2);
    expect(w.usabilityPt).toBeCloseTo(0.04, 2);
    expect(w.innovationPt).toBeCloseTo(0.12, 2);
  });
});

describe('分野ごとの公平性（この表を崩さないための基準）', () => {
  it('どの特徴ポイントも、◎ がつくジャンルが存在する', () => {
    for (const id of FEATURE_IDS) {
      if (id === 'innovationPt') continue; // 革新性は全型 ○ 固定
      const hasMaru = GENRES.some((g) => weightsFor(g.id)[id] === '◎');
      expect(hasMaru, id).toBe(true);
    }
  });

  it('◎になるジャンル数が spec の集計と一致する（12〜15 に収まる）', () => {
    // spec §4：🕹15 ／ 🎨14 ／ 🎵12 ／ 📖13 ／ 💡0（常に○）
    // 特定の分野だけ◎が集まると、その分野のスキルを持つ社員が常に最優先になり、
    // 他の職種を雇う理由が消える（設計の初期案は 🕹14／🎨9／💡7／📖5／🎵2 まで偏っていた）
    const count = (id: (typeof FEATURE_IDS)[number]) =>
      GENRES.filter((g) => weightsFor(g.id)[id] === '◎').length;
    expect(count('usabilityPt')).toBe(15);
    expect(count('graphicsPt')).toBe(14);
    expect(count('soundPt')).toBe(12);
    expect(count('storyPt')).toBe(13);
    expect(count('innovationPt')).toBe(0);
  });
});
