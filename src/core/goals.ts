import { GENRES } from '../data/genres';
import type { Scale } from '../data/scales';
import { nextLockedScale } from '../data/scales';
import { THEMES } from '../data/themes';
import type { Employee, Work } from '../state/types';
import { formatYen } from '../utils/format';
import { nextExpFor } from './growth';

/**
 * v0.18「つぎの目標」ウィジェット（spec v18 §2）。純粋関数。
 * 経営シムの中毒性は「常に短期目標が数個見えている」ことで作られる。
 * オフィス画面に常設し、①次の規模解放 ②次にLvが上がる社員 ③図鑑発見 を返す。
 */

export type Goal = {
  icon: string;
  label: string;
  value: string;
  /** 達成済み（解放可能到達など）。UI は強調表示する */
  done?: boolean;
};

export type GoalsCtx = {
  unlockedScales: Scale[];
  lifetimeRevenue: number;
  funds: number;
  employees: Employee[];
  library: Work[];
};

export const nextGoals = (ctx: GoalsCtx): Goal[] => {
  const goals: Goal[] = [];

  // ① 次の規模解放（累計売上ゲート）
  const next = nextLockedScale(ctx.unlockedScales);
  if (next) {
    const remain = next.unlockSalesRequired - ctx.lifetimeRevenue;
    if (remain > 0) {
      goals.push({ icon: '🏢', label: `${next.name}解放まで`, value: `あと ${formatYen(remain)}` });
    } else if (ctx.funds < next.unlockCost) {
      goals.push({
        icon: '🏢',
        label: `${next.name}解放`,
        value: `資金 ${formatYen(next.unlockCost)} で購入可`,
      });
    } else {
      goals.push({ icon: '🏢', label: `${next.name}解放`, value: '解放可能！', done: true });
    }
  }

  // ② 次にレベルが上がる社員（必要 exp が最小の1人）
  if (ctx.employees.length === 0) {
    goals.push({ icon: '👥', label: '従業員を採用しよう', value: 'オフィスの採用から' });
  } else {
    const soonest = ctx.employees.reduce((best, e) => {
      const remainE = nextExpFor(e.level) - e.exp;
      const remainBest = nextExpFor(best.level) - best.exp;
      return remainE < remainBest ? e : best;
    });
    const remain = Math.max(0, nextExpFor(soonest.level) - soonest.exp);
    goals.push({
      icon: '⬆',
      label: `${soonest.name} Lv${Math.min(10, soonest.level + 1)} まで`,
      value: soonest.level >= 10 ? 'MAX' : `あと exp ${remain}`,
      done: soonest.level >= 10,
    });
  }

  // ③ 図鑑発見（ジャンル×テーマのユニーク組合せ）
  const discovered = new Set(ctx.library.map((w) => `${w.genreId}|${w.themeId}`)).size;
  goals.push({
    icon: '📖',
    // 「図鑑」の文字はメニューバーのボタンとテキスト衝突するため使わない（e2e セレクタ対策）
    label: '発見した組合せ',
    value: `${discovered} / ${GENRES.length * THEMES.length}`,
  });

  return goals;
};
