/**
 * タイピング統計エンジン（純粋ロジック。logic-architecture §1）。
 * nano-type-jp の判定結果（correct / fail / complete）を受けて
 * コンボ・WPM・正確度を更新する。DOM・時計・乱数に依存しない（時刻は nowMs 引数）。
 * useTyping.ts から抽出（P4。挙動は無変更）。
 */

export type TypingKeyResult = 'correct' | 'fail' | 'complete';

export type TypingStats = {
  combo: number;
  correctCount: number;
  failCount: number;
  /** 成功打鍵タイムスタンプ（直近 WPM_WINDOW 件） */
  correctTimes: number[];
  /** 最後に算出できた WPM（サンプル不足の間は初期値 0 を保持） */
  wpm: number;
  /** 正確度 0..1（打鍵前は 1） */
  accuracy: number;
};

/** WPM の移動窓サイズ（直近の成功打鍵 N 件で平均） */
export const WPM_WINDOW = 30;
/** WPM を算出する最低サンプル数 */
export const WPM_MIN_SAMPLES = 5;

export const initialTypingStats = (): TypingStats => ({
  combo: 0,
  correctCount: 0,
  failCount: 0,
  correctTimes: [],
  wpm: 0,
  accuracy: 1,
});

export type ApplyKeyResult = {
  stats: TypingStats;
  /** fail でコンボが切れたとき、切れる直前のコンボ値（切れなければ null） */
  comboBroken: number | null;
  /** この打鍵で WPM が再計算されたか */
  wpmUpdated: boolean;
};

const accuracyOf = (correct: number, fail: number): number => {
  const total = correct + fail;
  return total === 0 ? 1 : correct / total;
};

/**
 * 1 打鍵ぶんの状態遷移。
 *  - correct: コンボ+1・タイムスタンプ記録・WPM 再計算（5 打鍵以上たまってから）
 *  - fail:    コンボ 0 に（切れた値を comboBroken で返す）。WPM は据え置き
 *  - complete:フレーズ完了打。コンボ+1（タイムスタンプは積まない＝既存挙動の踏襲）
 */
export const applyKey = (
  stats: TypingStats,
  result: TypingKeyResult,
  nowMs: number,
): ApplyKeyResult => {
  if (result === 'fail') {
    const comboBroken = stats.combo > 0 ? stats.combo : null;
    const failCount = stats.failCount + 1;
    return {
      stats: {
        ...stats,
        combo: 0,
        failCount,
        accuracy: accuracyOf(stats.correctCount, failCount),
      },
      comboBroken,
      wpmUpdated: false,
    };
  }

  const correctCount = stats.correctCount + 1;
  const combo = stats.combo + 1;

  if (result === 'complete') {
    return {
      stats: {
        ...stats,
        combo,
        correctCount,
        accuracy: accuracyOf(correctCount, stats.failCount),
      },
      comboBroken: null,
      wpmUpdated: false,
    };
  }

  // correct
  const correctTimes = [...stats.correctTimes, nowMs];
  while (correctTimes.length > WPM_WINDOW) correctTimes.shift();
  let wpm = stats.wpm;
  let wpmUpdated = false;
  if (correctTimes.length >= WPM_MIN_SAMPLES) {
    const spanMin = (correctTimes[correctTimes.length - 1] - correctTimes[0]) / 1000 / 60;
    if (spanMin > 0) {
      wpm = (correctTimes.length - 1) / spanMin;
      wpmUpdated = true;
    }
  }
  return {
    stats: {
      combo,
      correctCount,
      failCount: stats.failCount,
      correctTimes,
      wpm,
      accuracy: accuracyOf(correctCount, stats.failCount),
    },
    comboBroken: null,
    wpmUpdated,
  };
};
