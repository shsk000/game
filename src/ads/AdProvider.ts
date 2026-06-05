/**
 * 広告 SDK の抽象レイヤー。
 * 現在はモック実装のみ。実SDK差し替え時は `provider` を入れ替える。
 *
 * 設計書 6 章の鉄則：
 *  - リワードは見れば得・任意
 *  - 完了コールバック後に報酬付与（スキップ/在庫なし/ブロッカーはフォールバック）
 *  - 強制広告（interstitial）は手が止まる切れ目に限定
 */

export type AdProvider = {
  showRewarded(options: {
    onComplete: () => void;
    onFail?: (reason: 'skipped' | 'no-inventory' | 'blocked' | 'error') => void;
    /** UI上のラベル用ヒント。実SDKでは無視されてよい */
    label?: string;
  }): void;

  showInterstitial(options?: {
    onComplete?: () => void;
    onFail?: () => void;
  }): void;
};

/** MVP用モック実装：仮の遅延の後に必ず成功とする */
const mockProvider: AdProvider = {
  showRewarded({ onComplete }) {
    setTimeout(() => onComplete(), 400);
  },
  showInterstitial({ onComplete } = {}) {
    setTimeout(() => onComplete?.(), 200);
  },
};

let current: AdProvider = mockProvider;

export const setAdProvider = (p: AdProvider) => {
  current = p;
};

export const ads: AdProvider = {
  showRewarded: (opts) => current.showRewarded(opts),
  showInterstitial: (opts) => current.showInterstitial(opts),
};
