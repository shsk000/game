import { describe, expect, it } from 'vitest';
import {
  DEBT_CONFIG,
  INITIAL_FUNDS,
  MONTHLY_RENT,
  SCALE_BALANCE,
  TIME_RATE_MS_PER_WEEK,
  computeBorrowingLimit,
} from '../data/balance';
import { sumMonthlySalaries } from '../data/employees';
import type { Scale } from '../data/scales';
import type { Employee, EmployeeRole, Work } from '../state/types';
import { computeCharacterScore } from '../utils/character';
import { computeMetascore, computeQualityV10, computeRevenue } from '../utils/metascore';
import { INITIAL_SHARE, decayRateFor, settleAllWorks } from '../utils/sales';
import { computeMonthlyTick, computeSpend } from './economy';
import { applyReleaseGrowth } from './growth';
import { mulberry32, type Rng } from './ports';

/**
 * v0.28 solvency（資金繰り）シミュレーション（新設）。
 *
 * 既存 progressionSimulation.test.ts は「資金は十分ある前提」で累計"粗"売上のみを追い、
 * 固定費・給与・借金・破産を一切モデル化していない。一方ゲーム本体の破産判定は
 * economy.ts computeMonthlyTick（gameOver = debt > borrowingLimit && funds<=0）に実在する。
 * シミュと実経済が乖離しているため、敵対的レビューの「中央値プレイヤーは 7〜8 本目で破産」の
 * 当否を数値で判定できなかった。
 *
 * 本シミュはプロダクションの純粋関数（computeSpend / computeMonthlyTick / settleAllWorks /
 * computeRevenue）をそのまま通し、資金・借金の時間推移を並走させて
 * 「序盤の破産でプレイヤーの継続を殺していないか」を数値で測る（§10-② 誰も弾かない）。
 *
 * 本項は計測基盤のみ：balance 数値・state・プレイ挙動は一切変更しない。
 * 粗累計による解放判定は progression sim と同一ロジックで整合を保つ（粗売上と実回収 funds を
 * 別アカウンタで持つ）。数値の変更が必要と分かった場合はオーナー GO 項目に分離する。
 */

const SCALE_ORDER: Scale[] = ['mini', 'mobile', 'indie', 'hit', 'aaa'];

/** 平均的プレイヤー：相性=初期帯平均(31点)・タイピング70・軸ボーナス半分（progression sim と同値） */
const AFFINITY = 31;
const TYPING = 70;
const AXIS_BONUS = 4;

/** 4 週 = 1 ヶ月（types.ts dateToWeekIndex：(month-1)*4）。月境界で固定費を精算する */
const WEEKS_PER_MONTH = 4;
/** idle 中の 1 週あたり実秒（TIME_RATE_MS_PER_WEEK.idle）。販売プールの取り崩しに使う */
const IDLE_SEC_PER_WEEK = TIME_RATE_MS_PER_WEEK.idle / 1000;

const MEDIAN_SEEDS = [1, 42, 777] as const;

const emp = (id: string, role: EmployeeRole, power = 0.4): Employee => ({
  id,
  name: id,
  role,
  power,
  basePower: power,
  level: 1,
  exp: 0,
  wage: 0,
  specialties: [],
});

const medianTeam = (): Employee[] => [
  emp('a', 'programmer'),
  emp('b', 'designer'),
  emp('c', 'pr'),
];

/**
 * settleAllWorks に渡す販売中作品。プール減衰に必要なフィールドのみ実値、
 * 他は表示用ダミー（settleAllWorks は selling / salesPool / decayPerSec / totalRevenue しか読まない）。
 */
const sellingWork = (salesPool: number, metascore: number): Work => ({
  id: `w-${metascore}-${salesPool}`,
  title: 'sim',
  genreId: 'puzzle',
  themeId: 'sushi',
  scale: 'mini',
  quality: 0,
  metascore,
  isMasterpiece: false,
  developSec: 1,
  initialRevenue: 0,
  salesPool,
  initialSalesPool: salesPool,
  decayPerSec: decayRateFor(metascore),
  totalRevenue: 0,
  selling: salesPool > 0,
  fansGained: 0,
  ghostBeaten: false,
  launchAdUsed: false,
  pioneer: false,
  releasedAt: 0,
  createdAt: 0,
  breakdown: {},
});

type SolvencyResult = {
  unlockedAt: Partial<Record<Scale, number>>;
  /** 初めて gameOver=true になったリリース番号（何本目で破産したか）。破産しなければ null */
  bankruptAtRelease: number | null;
  /** 初めて「その月の販売収入 ≥ その月の固定費」になったリリース番号（黒字転換）。無ければ null */
  blackTurnRelease: number | null;
  /** 破産する前に mobile 解放（粗累計 ≥ unlockSalesRequired）へ到達したか */
  reachedMobileSolvent: boolean;
  finalFunds: number;
  finalDebt: number;
  grossLifetime: number;
};

/**
 * 資金繰りシミュレーション（既存の純粋関数を合成するだけ。プロダクションコードは無変更）。
 *  1. 各リリースで開発費を前払い（computeSpend＝不足分は自動借金振替）
 *  2. neededWeeks を 1 週ずつ進め、毎週 settleAllWorks で販売プールを取り崩し funds に加算
 *  3. 4 週ごとに computeMonthlyTick で固定費（給与+賃料+利息）を引き、破産を判定
 *  4. リリース時に品質→メタ→売上を確定。初動 INITIAL_SHARE を即 funds、残りを販売プールへ
 *  5. 解放判定は既存 progression sim と同一（粗累計 ≥ unlockSalesRequired）
 *
 * 注：ゲーム本体は gameOver で終了するが、本シミュは計測用に破産後も継続する。
 * bankruptAtRelease は「最初に破産に達した本数」を記録する（それ以降の推移は参考値）。
 */
const simulateSolvency = (seed: number, maxReleases = 20): SolvencyResult => {
  const rng: Rng = mulberry32(seed);
  let team = medianTeam();
  const ids = team.map((e) => e.id);

  let funds = INITIAL_FUNDS;
  let debt = 0;
  let grossLifetime = 0;
  let scaleIdx = 0;
  let library: Work[] = [];
  const unlockedAt: Partial<Record<Scale, number>> = {};
  let bankruptAtRelease: number | null = null;
  let blackTurnRelease: number | null = null;
  let reachedMobileSolvent = false;

  for (let release = 1; release <= maxReleases; release++) {
    const scale = SCALE_ORDER[scaleIdx];
    const def = SCALE_BALANCE[scale];

    // 1) 開発費を前払い（不足分は自動借金振替）
    const spend = computeSpend({ funds, debt }, def.devCost);
    funds = spend.funds;
    debt = spend.debt;

    // 2) 開発期間を 1 週ずつ進める（毎週：販売プール取り崩し／4 週ごと：固定費精算）
    let monthWeek = 0;
    let monthSales = 0;
    for (let w = 0; w < def.neededWeeks; w++) {
      const settled = settleAllWorks(library, IDLE_SEC_PER_WEEK);
      library = settled.library;
      funds += settled.earned;
      monthSales += settled.earned;
      monthWeek += 1;

      // 3) 月境界：固定費精算＋破産判定
      if (monthWeek >= WEEKS_PER_MONTH) {
        const tick = computeMonthlyTick({
          funds,
          debt,
          employees: team,
          unlockedScales: SCALE_ORDER.slice(0, scaleIdx + 1),
        });
        funds = tick.funds;
        debt = tick.debt;
        if (blackTurnRelease === null && monthSales >= tick.cost.total) {
          blackTurnRelease = release;
        }
        if (bankruptAtRelease === null && tick.gameOver) {
          bankruptAtRelease = release;
        }
        monthWeek = 0;
        monthSales = 0;
      }
    }

    // 4) リリース：品質→メタ→売上（progression sim と同じ入力・呼び出しで整合）
    const { score: charPower } = computeCharacterScore({ assignedEmployees: team, scale });
    const { Q } = computeQualityV10(
      { charPower, genreAffinity: AFFINITY, typingScore: TYPING },
      rng,
    );
    const quality = Math.max(0, Math.min(100, Math.round(Q + AXIS_BONUS)));
    const meta = computeMetascore(quality, 'puzzle', 'sushi', null, rng);
    const total = computeRevenue(meta.metascore, 'puzzle', 'sushi', scale, null, 0, false);
    grossLifetime += total;

    const initialRevenue = Math.round(total * INITIAL_SHARE);
    funds += initialRevenue; // 初動は収入（借金ではないので直接加算）
    library = [sellingWork(total - initialRevenue, meta.metascore), ...library];

    team = applyReleaseGrowth(team, ids, meta.metascore).employees;

    // 5) 解放判定：粗累計（既存 progression sim と同一ロジック）
    while (
      scaleIdx + 1 < SCALE_ORDER.length &&
      grossLifetime >= SCALE_BALANCE[SCALE_ORDER[scaleIdx + 1]].unlockSalesRequired
    ) {
      scaleIdx += 1;
      unlockedAt[SCALE_ORDER[scaleIdx]] = release;
    }

    // mini→mobile を「破産する前に」到達したか（本項の主眼＝非破産経路の存在）
    if (!reachedMobileSolvent && unlockedAt.mobile === release && bankruptAtRelease === null) {
      reachedMobileSolvent = true;
    }
  }

  return {
    unlockedAt,
    bankruptAtRelease,
    blackTurnRelease,
    reachedMobileSolvent,
    finalFunds: funds,
    finalDebt: debt,
    grossLifetime,
  };
};

// ============================================================
// 境界値ユニット（computeMonthlyTick の破産判定 economy.ts:50 を直接固定）
// ============================================================

describe('solvency 境界：computeMonthlyTick の破産判定（economy.ts gameOver）', () => {
  it('資金ちょうど 0 で月をまたぐ→固定費は全額 debt へ振替・funds=0・借入上限内なら破産しない', () => {
    const team = medianTeam();
    const salaries = sumMonthlySalaries(team);
    const tick = computeMonthlyTick({
      funds: 0,
      debt: 0,
      employees: team,
      unlockedScales: ['mini'],
    });
    // debt 0 → 利息 0。固定費 = 給与 + 賃料 が全額 debt へ、funds は 0 で下げ止まる
    expect(tick.funds).toBe(0);
    expect(tick.debt).toBe(salaries + MONTHLY_RENT);
    // 上限（(給与+賃料)×12）には遠く及ばない → 破産しない
    expect(tick.gameOver).toBe(false);
  });

  it('借入上限「ちょうど」は破産せず、+1 で破産する（economy.ts:50 の strict > 方向を固定）', () => {
    // 社員なし・mini 賃料のみ → 固定費 = 賃料、上限 L = 賃料 × 12
    const rent = MONTHLY_RENT;
    const L = computeBorrowingLimit(rent);
    // funds=1 と funds=0 は「振替後 debt」がちょうど 1 だけ違う（利息は debt_before 依存で同一）。
    // これを使い debt が L ちょうど / L+1 に着地する debt_before を選ぶ。
    const D = 3_203_884; // D + rent + round(D×0.03) - 1 === L となる境界（下の assert が保証）
    const interest = Math.round(D * DEBT_CONFIG.monthlyInterestRate);
    const total = rent + interest;
    // ガード：定数が変わってもこの D が境界であることを明示（崩れたら赤で再計算を促す）
    expect(D + total - 1).toBe(L); // funds=1 のときの振替後 debt
    expect(D + total).toBe(L + 1); // funds=0 のときの振替後 debt

    const atLimit = computeMonthlyTick({
      funds: 1,
      debt: D,
      employees: [],
      unlockedScales: ['mini'],
    });
    expect(atLimit.debt).toBe(L); // ちょうど上限
    expect(atLimit.funds).toBe(0); // funds<=0 は満たすが…
    expect(atLimit.gameOver).toBe(false); // debt > L は false（= では破産しない）

    const overLimit = computeMonthlyTick({
      funds: 0,
      debt: D,
      employees: [],
      unlockedScales: ['mini'],
    });
    expect(overLimit.debt).toBe(L + 1); // 上限 +1
    expect(overLimit.funds).toBe(0);
    expect(overLimit.gameOver).toBe(true); // debt > L かつ funds<=0 → 破産
  });
});

// ============================================================
// solvency シミュレーション本体
// ============================================================

describe('solvency シミュ（§10-②：序盤の破産でプレイヤーの継続を殺していないか）', () => {
  it('中央値プレイヤー（新人3人・素直運用）の破産／黒字転換の本数を数値で出力・アサート', () => {
    const summary = MEDIAN_SEEDS.map((seed) => {
      const r = simulateSolvency(seed);
      return {
        seed,
        mobile: r.unlockedAt.mobile ?? null,
        bankruptAt: r.bankruptAtRelease,
        blackTurn: r.blackTurnRelease,
        solventToMobile: r.reachedMobileSolvent,
      };
    });
    // doneChecklist：中央値ケースが何本目で破産/黒字転換したかを数値で表示
    // eslint-disable-next-line no-console
    console.log('[solvency] median-player results:', JSON.stringify(summary, null, 2));

    for (const s of summary) {
      // mobile 解放は progression sim と同じ 8〜16 作目（粗累計ロジックの整合を確認）
      expect(s.mobile, `seed=${s.seed} mobile`).not.toBeNull();
      expect(s.mobile as number, `seed=${s.seed} mobile`).toBeGreaterThanOrEqual(8);
      expect(s.mobile as number, `seed=${s.seed} mobile`).toBeLessThanOrEqual(16);

      // 黒字転換（月次で売上が固定費を上回る月）は horizon 内に必ず訪れる
      expect(s.blackTurn, `seed=${s.seed} blackTurn`).not.toBeNull();

      // 敵対的レビューの主張「7〜8 本目で破産」の当否を数値で判定：
      // 破産が起きるとしても 7〜8 本目より後（≥9 本目）＝主張は本シミュでは再現されない。
      if (s.bankruptAt !== null) {
        expect(s.bankruptAt, `seed=${s.seed} bankruptAt`).toBeGreaterThanOrEqual(9);
      }
    }
  });

  it('mini→mobile 到達までに破産しない経路が少なくとも 1 つ存在する', () => {
    const solvent = MEDIAN_SEEDS.filter((seed) => simulateSolvency(seed).reachedMobileSolvent);
    // 存在しなければ赤＝「balance 変更が要る」シグナル（本項では数値を変えず計画へ戻す合図）。
    expect(solvent.length, 'seeds reaching mobile without bankruptcy').toBeGreaterThanOrEqual(1);
  });

  it('中央値プレイヤーが少なくとも 1 度は借金に沈む（固定費モデルが効いている＝資金十分の前提ではない）', () => {
    // 既存 progression sim（wage:0・資金無限）との差分を保証：本シミュは固定費で必ず借金が発生する。
    for (const seed of MEDIAN_SEEDS) {
      const r = simulateSolvency(seed);
      expect(r.finalDebt, `seed=${seed} debt`).toBeGreaterThan(0);
    }
  });
});
