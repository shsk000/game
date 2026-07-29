import { describe, expect, it } from 'vitest';
import { GACHA_RANK_RATES, type GachaRank, RANK_TOTAL_POWER, SKILL_CONFIG } from '../data/balance';
import type { Employee, SkillId } from '../state/types';
import { mulberry32 } from './ports';
import {
  distributeSkills,
  growSkills,
  jobTitleOf,
  ownedSkillIds,
  primarySkillOf,
  prSkillTotalOf,
  rollRank4,
  rollSkills,
  scaleSkills,
  leadForField,
  skillTotalsOf,
  totalPowerFor,
  totalPowerOf,
} from './skills';

const emp = (skills: Employee['skills'], id = 'e'): Employee =>
  ({ id, name: 'x', role: 'programmer', power: 0, basePower: 0, level: 1, exp: 0, wage: 0, specialties: [], skills }) as Employee;

describe('totalPowerFor（ランク×レベル → 総合力）', () => {
  it('Lv1 はランクによらずほぼ同じ（15〜28）', () => {
    const lv1 = (['C', 'B', 'A', 'S'] as GachaRank[]).map((r) => totalPowerFor(r, 1, 0.5));
    for (const v of lv1) {
      expect(v).toBeGreaterThanOrEqual(15);
      expect(v).toBeLessThanOrEqual(28);
    }
    // 最大でも 8 ポイントしか開かない＝「採用直後は差が分からない」
    expect(Math.max(...lv1) - Math.min(...lv1)).toBeLessThanOrEqual(8);
  });

  it('Lv10 でランクごとの天井に届く（40 / 60 / 80 / 100）', () => {
    for (const r of ['C', 'B', 'A', 'S'] as GachaRank[]) {
      expect(totalPowerFor(r, 10, 0.5)).toBeCloseTo(RANK_TOTAL_POWER[r].lv10, 5);
    }
  });

  it('レベルは 1〜10 にクランプされる', () => {
    expect(totalPowerFor('S', 0)).toBe(totalPowerFor('S', 1));
    expect(totalPowerFor('S', 99)).toBe(totalPowerFor('S', 10));
  });

  it('同ランクなら単調増加', () => {
    for (let lv = 1; lv < 10; lv++) {
      expect(totalPowerFor('A', lv + 1)).toBeGreaterThan(totalPowerFor('A', lv));
    }
  });
});

describe('distributeSkills（総合力の配分）', () => {
  it('1スキルなら総合力がそのまま乗る（尖る）', () => {
    const s = distributeSkills(80, ['graphics']);
    expect(s.graphics).toBe(80);
    expect(totalPowerOf(s)).toBe(80);
  });

  it('2スキルは分散ペナルティで目減りする（専門特化のほうが総合力が高い）', () => {
    const one = distributeSkills(80, ['graphics']);
    const two = distributeSkills(80, ['graphics', 'scenario']);
    expect(totalPowerOf(two)).toBeLessThan(totalPowerOf(one));
    expect(totalPowerOf(two)).toBeCloseTo(80 * SKILL_CONFIG.spreadPenalty, 0);
  });

  it('2スキルは主 > 副 の比で配分される', () => {
    const s = distributeSkills(100, ['graphics', 'sound']);
    expect(s.graphics!).toBeGreaterThan(s.sound!);
  });
});

describe('rollSkills（採用時のスキル抽選）', () => {
  it('必ず1つか2つ持ち、合計はランクの Lv1 帯に収まる', () => {
    for (const rank of ['C', 'B', 'A', 'S'] as GachaRank[]) {
      for (let seed = 0; seed < 50; seed++) {
        const s = rollSkills(totalPowerFor(rank, 1, 0.5), mulberry32(seed));
        const ids = ownedSkillIds(s);
        expect(ids.length).toBeGreaterThanOrEqual(1);
        expect(ids.length).toBeLessThanOrEqual(2);
        expect(new Set(ids).size).toBe(ids.length); // 同じスキルが重複しない
        const r = RANK_TOTAL_POWER[rank];
        expect(totalPowerOf(s)).toBeGreaterThanOrEqual(r.lv1Min * SKILL_CONFIG.spreadPenalty - 0.5);
        expect(totalPowerOf(s)).toBeLessThanOrEqual(r.lv1Max + 0.5);
      }
    }
  });
});

describe('rollRank4（C を含む4種の排出）', () => {
  it('normal は S を出さない', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 3000; i++) expect(rollRank4('normal', rng)).not.toBe('S');
  });

  it('実測の排出率が設定値に近い（±3%）', () => {
    const rng = mulberry32(42);
    const N = 30_000;
    const counts: Record<GachaRank, number> = { C: 0, B: 0, A: 0, S: 0 };
    for (let i = 0; i < N; i++) counts[rollRank4('premium', rng)]++;
    for (const r of ['C', 'B', 'A', 'S'] as GachaRank[]) {
      expect(Math.abs(counts[r] / N - GACHA_RANK_RATES.premium[r])).toBeLessThan(0.03);
    }
  });

  it('premium は天井到達で S 確定', () => {
    expect(rollRank4('premium', () => 0.99, 10)).toBe('S');
  });
});

describe('growSkills（レベルアップ）', () => {
  it('総合力が増え、スキルの種類は増えない', () => {
    const before = distributeSkills(totalPowerFor('A', 1, 0.5), ['graphics']);
    const after = growSkills(before, 'A', 10);
    expect(ownedSkillIds(after)).toEqual(ownedSkillIds(before));
    expect(totalPowerOf(after)).toBeGreaterThan(totalPowerOf(before));
    expect(totalPowerOf(after)).toBeCloseTo(RANK_TOTAL_POWER.A.lv10, 0);
  });

  it('2スキルは配分の比率を保ったまま伸びる（尖った社員は尖ったまま）', () => {
    const before = distributeSkills(totalPowerFor('S', 1, 0.5), ['graphics', 'sound']);
    const after = growSkills(before, 'S', 10);
    const ratioBefore = before.graphics! / before.sound!;
    const ratioAfter = after.graphics! / after.sound!;
    expect(ratioAfter).toBeCloseTo(ratioBefore, 1);
  });

  it('ランクの天井を超えない', () => {
    const before = distributeSkills(totalPowerFor('C', 1, 1), ['programming']);
    const after = growSkills(before, 'C', 10);
    expect(totalPowerOf(after)).toBeLessThanOrEqual(RANK_TOTAL_POWER.C.lv10 + 0.5);
  });
});

describe('skillTotalsOf（チームの分野別スキル合計）', () => {
  it('その分野の担当（いちばん強い1人）で決まる。2人目以降は控え', () => {
    // 「合計だが2人目は効率が落ちる」方式は、画面に3か所も注釈を足さないと
    // 伝わらなかったので廃止した（オーナー指摘 2026-07-29）。
    // 担当制なら注釈ゼロで伝わり、均等と集中の差はむしろ広がる
    expect(skillTotalsOf([emp({ graphics: 100 }), emp({ graphics: 100 })]).graphics).toBe(100);
    expect(skillTotalsOf([emp({ graphics: 40 }), emp({ graphics: 90 })]).graphics).toBe(90);
  });

  it('担当は入れ替わる（控えを育てて先発を追い越せる）', () => {
    const before = leadForField([emp({ graphics: 60 }, 'a'), emp({ graphics: 30 }, 'b')], 'graphics');
    const after = leadForField([emp({ graphics: 60 }, 'a'), emp({ graphics: 80 }, 'b')], 'graphics');
    expect(before?.id).toBe('a');
    expect(after?.id).toBe('b');
  });

  it('高い順に1人目が満額なので、順序を入れ替えても結果が変わらない', () => {
    const a = skillTotalsOf([emp({ sound: 40 }), emp({ sound: 90 })]);
    const b = skillTotalsOf([emp({ sound: 90 }), emp({ sound: 40 })]);
    expect(a.sound).toBe(b.sound);
    expect(a.sound).toBe(90); // 担当＝いちばん強い1人
  });

  it('誰も持っていない分野は 0（その分野の文は回ってこない）', () => {
    const totals = skillTotalsOf([emp({ graphics: 50 })]);
    expect(totals.scenario).toBe(0);
    expect(totals.programming).toBe(0);
  });

  it('広報は開発分野に含まれない', () => {
    const totals = skillTotalsOf([emp({ pr: 90 })]);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
    expect(prSkillTotalOf([emp({ pr: 90 })])).toBe(90);
  });
});

describe('職種（一番高いスキルの呼び名）', () => {
  it.each([
    [{ programming: 50 } as const, 'プログラマー'],
    [{ graphics: 50 } as const, 'グラフィッカー'],
    [{ sound: 50 } as const, 'サウンドクリエイター'],
    [{ scenario: 50 } as const, 'シナリオライター'],
    [{ pr: 50 } as const, '広報'],
  ])('%o → %s', (skills, expected) => {
    expect(jobTitleOf(skills)).toBe(expected);
  });

  it('2スキルなら高いほうの呼び名になる（2つ目は職種名に出ない）', () => {
    expect(jobTitleOf({ graphics: 45, scenario: 36 })).toBe('グラフィッカー');
    expect(primarySkillOf({ graphics: 45, scenario: 36 })).toBe<SkillId>('graphics');
  });

  it('スキルが無ければ「社員」', () => {
    expect(jobTitleOf({})).toBe('社員');
    expect(primarySkillOf({})).toBeNull();
  });
});

describe('scaleSkills（旧セーブ移行組の成長）', () => {
  it('配分の比率を保ったまま一律に伸びる', () => {
    const after = scaleSkills({ graphics: 40, sound: 20 }, 1.15);
    expect(after.graphics).toBe(46);
    expect(after.sound).toBe(23);
    expect(after.graphics! / after.sound!).toBeCloseTo(2, 5);
  });

  it('持っていないスキルは生えない', () => {
    expect(ownedSkillIds(scaleSkills({ programming: 30 }, 2))).toEqual(['programming']);
  });

  it('スキルなしなら空のまま', () => {
    expect(scaleSkills({}, 2)).toEqual({});
  });
});

describe('rollSkills：引いた主スキルが常に最大値（職種分布の前提）', () => {
  it('2スキル持ちでも主スキルが最大値になる', () => {
    // roleFromSkills は primarySkillOf（最大値）を見るので、これが崩れると
    // 職種分布（programmer 40% / designer 40% / pr 20%）が黙って歪む。
    // spreadRatio を 50/50 にするとタイブレークが ALL_SKILL_IDS の順に落ちて落ちる
    expect(SKILL_CONFIG.spreadRatio.primary).toBeGreaterThan(
      SKILL_CONFIG.spreadRatio.secondary,
    );
    for (let seed = 0; seed < 200; seed++) {
      const s = rollSkills(40, mulberry32(seed), 1);
      const ids = ownedSkillIds(s);
      if (ids.length < 2) continue;
      const max = Math.max(...ids.map((id) => s[id] ?? 0));
      const primary = primarySkillOf(s);
      expect(s[primary!]).toBe(max);
      // 同値が並ばない（並ぶとタイブレーク順に依存してしまう）
      const others = ids.filter((id) => id !== primary).map((id) => s[id] ?? 0);
      expect(Math.max(...others)).toBeLessThan(max);
    }
  });
});
