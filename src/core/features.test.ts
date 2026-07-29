import { describe, expect, it } from 'vitest';
import { FEATURE_SCALE_COEF } from '../data/balance';
import type { Employee, Work } from '../state/types';
import { ZERO_FEATURES } from '../state/types';
import {
  addFeature,
  coveredCategoriesOf,
  coveredFieldsOf,
  featureGainFor,
  initialFeatures,
  innovationFor,
  typingMultiplier,
} from './features';

const emp = (skills: Employee['skills']): Employee =>
  ({
    id: 'e',
    name: 'x',
    role: 'programmer',
    power: 0,
    basePower: 0,
    level: 1,
    exp: 0,
    wage: 0,
    specialties: [],
    skills,
  }) as Employee;

const work = (genreId: string, themeId: string, releasedAt: number): Work =>
  ({ id: `w${releasedAt}`, genreId, themeId, releasedAt }) as Work;

describe('coveredFieldsOf（文が回ってくる分野）', () => {
  it('チームの誰かが持っている分野だけを返す', () => {
    const team = [emp({ graphics: 40 }), emp({ programming: 30, sound: 10 })];
    expect(coveredFieldsOf(team).sort()).toEqual(['graphics', 'programming', 'sound']);
  });

  it('広報は開発分野に入らない（文が回ってこない）', () => {
    expect(coveredFieldsOf([emp({ pr: 90 })])).toEqual([]);
  });

  it('作業カテゴリに変換できる', () => {
    expect(coveredCategoriesOf([emp({ scenario: 50 })])).toEqual(['scenario']);
  });
});

describe('typingMultiplier（0.95〜1.05）', () => {
  it('下手は1未満、上手は1超（ヒット区分を腕で越えさせない幅）', () => {
    const worst = typingMultiplier('good', 0);
    const best = typingMultiplier('perfect', 100);
    expect(worst).toBeLessThan(1);
    expect(best).toBeGreaterThan(1);
    expect(worst).toBeCloseTo(0.951, 2);
    expect(best).toBeCloseTo(1.051, 2);
  });

  it('幅は 1.105 倍に収まる（1.07 を超えると区分をまたぐ）', () => {
    const worst = typingMultiplier('good', 0);
    const best = typingMultiplier('perfect', 100);
    expect(best / worst).toBeLessThan(1.11);
  });

  it('コンボが伸びるほど倍率が上がる', () => {
    const vals = [0, 10, 30, 100].map((c) => typingMultiplier('great', c));
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
  });
});

describe('featureGainFor（1文あたりの加算量）', () => {
  it('規模係数 × 打鍵倍率 × スキル合計', () => {
    const team = [emp({ graphics: 50 })];
    expect(featureGainFor('graphics', team, 'mini', 1)).toBeCloseTo(FEATURE_SCALE_COEF.mini * 50, 1);
  });

  it('その分野の担当1人で決まる（2人目を足しても増えない＝寄せる意味がない）', () => {
    const one = featureGainFor('graphics', [emp({ graphics: 100 })], 'mini', 1);
    const two = featureGainFor(
      'graphics',
      [emp({ graphics: 100 }), emp({ graphics: 100 })],
      'mini',
      1,
    );
    expect(two).toBe(one);
    // より強い人を入れれば伸びる（育成・採用に意味がある）
    expect(
      featureGainFor('graphics', [emp({ graphics: 100 }), emp({ graphics: 50 })], 'mini', 1),
    ).toBe(one);
  });

  it('誰も持っていない分野は 0（打っても伸びない）', () => {
    expect(featureGainFor('sound', [emp({ graphics: 100 })], 'mini', 1)).toBe(0);
  });

  it('大きい規模ほど1文の重みが小さい（総文数が多いぶん割られる）', () => {
    const team = [emp({ programming: 60 })];
    expect(featureGainFor('programming', team, 'aaa', 1)).toBeLessThan(
      featureGainFor('programming', team, 'mini', 1),
    );
  });
});

describe('addFeature（加算と上限）', () => {
  it('対応する特徴ポイントだけが増える', () => {
    const f = addFeature(ZERO_FEATURES, 'sound', 12.5);
    expect(f.soundPt).toBe(12.5);
    expect(f.graphicsPt).toBe(0);
  });

  it('100 を超えない', () => {
    const f = addFeature({ ...ZERO_FEATURES, graphicsPt: 95 }, 'graphics', 50);
    expect(f.graphicsPt).toBe(100);
  });
});

describe('innovationFor（同じ組合せの連投で下がる）', () => {
  it('前作と違う組合せなら 100', () => {
    const lib = [work('action', 'ninja', 1)];
    expect(innovationFor(lib, 'puzzle', 'sushi')).toBe(100);
  });

  it('同じ組合せを重ねるほど下がる（100 → 50 → 25 → 10）', () => {
    const lib: Work[] = [];
    expect(innovationFor(lib, 'action', 'ninja')).toBe(100);
    lib.push(work('action', 'ninja', 1));
    expect(innovationFor(lib, 'action', 'ninja')).toBe(50);
    lib.push(work('action', 'ninja', 2));
    expect(innovationFor(lib, 'action', 'ninja')).toBe(25);
    lib.push(work('action', 'ninja', 3));
    expect(innovationFor(lib, 'action', 'ninja')).toBe(10);
  });

  it('別の組合せを1本挟めば 100 に復活する（間隔は見ない）', () => {
    const lib = [
      work('action', 'ninja', 1),
      work('action', 'ninja', 2),
      work('puzzle', 'sushi', 3),
    ];
    expect(innovationFor(lib, 'action', 'ninja')).toBe(100);
  });

  it('テーマだけ変えても別の組合せ扱い', () => {
    expect(innovationFor([work('action', 'ninja', 1)], 'action', 'sushi')).toBe(100);
  });
});

describe('initialFeatures（企画開始時）', () => {
  it('革新性だけ最初から入り、他は 0（打鍵で伸ばす）', () => {
    const f = initialFeatures([work('action', 'ninja', 1)], 'action', 'ninja');
    expect(f.innovationPt).toBe(50);
    expect(f.graphicsPt).toBe(0);
    expect(f.usabilityPt).toBe(0);
  });
});
