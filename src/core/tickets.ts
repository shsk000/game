import { TICKET_HAND_CONFIG } from '../data/balance';
import {
  getTicketAt,
  PHRASES_PER_TICKET,
  type TicketCategory,
  type TicketFlavor,
} from '../data/devPhrases';
import type { GenreId } from '../data/genres';
import type { PlanCategory } from '../data/planTickets';
import type { Rng } from './ports';

/**
 * v0.19 作業チケットの選択制（spec v19 §1）。純粋関数のみ・rng は注入。
 *
 * 「打つ対象は常に1つ」の原則（v15確定）は守ったまま、打つ前に
 * 「安全に積むか（標準）／リスクを取るか（チャレンジ）／借金を返すか（即修）」の
 * 3択を発生させて作業感を壊す。数値は data/balance.ts の TICKET_HAND_CONFIG。
 */

export type HandTicketKind = 'standard' | 'challenge' | 'bugfix';

export type HandTicket = {
  kind: HandTicketKind;
  /** standard / challenge のみ。bugfix はカテゴリを持たない */
  category?: TicketCategory;
  flavor?: TicketFlavor;
  /** このチケットを完了させるのに打つ文数 */
  phrases: number;
  /** 属性報酬（addDevStat の gain）に掛かる倍率。bugfix は報酬なし（0） */
  rewardMult: number;
  /** 打鍵中のミス1打あたりのバグ化数（noteBugOnMiss に渡す倍率） */
  missBugMult: number;
};

export type HandContext = {
  genreId: GenreId;
  /** 標準チケットの周回位置（従来の getTicketAt の通し番号） */
  ticketIndex: number;
  bugCount: number;
};

/** 標準チケット（従来の getTicketAt 相当。3文・報酬×1・ミスバグ化×1） */
const standardAt = (genreId: GenreId, index: number): HandTicket => {
  const t = getTicketAt(genreId, index);
  return {
    kind: 'standard',
    category: t.category,
    flavor: t.flavor,
    phrases: PHRASES_PER_TICKET,
    rewardMult: 1,
    missBugMult: 1,
  };
};

/**
 * 手札3枚の生成。
 * - 1枚目：常に標準（ticketIndex の従来チケット）＝「標準は必ず1枚以上」の保証
 * - 2枚目：出現率 30% でチャレンジ（次番のチケット題材・5文・報酬×1.5・ミスバグ化×2）、外れたら標準
 * - 3枚目：bugCount≥1 のとき出現率 50% で即修（2文・バグ−1）、外れたら標準
 */
export const drawHand = (ctx: HandContext, rng: Rng = Math.random): HandTicket[] => {
  const { genreId, ticketIndex, bugCount } = ctx;
  const cfg = TICKET_HAND_CONFIG;
  const hand: HandTicket[] = [standardAt(genreId, ticketIndex)];

  if (rng() < cfg.challenge.rate) {
    const t = getTicketAt(genreId, ticketIndex + 1);
    hand.push({
      kind: 'challenge',
      category: t.category,
      flavor: t.flavor,
      phrases: cfg.challenge.phrases,
      rewardMult: cfg.challenge.rewardMult,
      missBugMult: cfg.challenge.missBugMult,
    });
  } else {
    hand.push(standardAt(genreId, ticketIndex + 1));
  }

  if (bugCount >= 1 && rng() < cfg.bugfix.rate) {
    hand.push({
      kind: 'bugfix',
      phrases: cfg.bugfix.phrases,
      rewardMult: 0,
      missBugMult: 1,
    });
  } else {
    hand.push(standardAt(genreId, ticketIndex + 2));
  }

  return hand;
};

/**
 * 企画フェーズの手札：残りカテゴリの先頭から最大 handSize 件を提示する
 * （順序は PLAN_CATEGORY_ORDER 準拠のまま「次にどれを埋めるか」だけ選ばせる）。
 */
export const drawPlanHand = (remaining: PlanCategory[]): PlanCategory[] =>
  remaining.slice(0, TICKET_HAND_CONFIG.handSize);
