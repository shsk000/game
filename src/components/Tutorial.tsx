import { useState } from 'react';
import { useGameStore } from '../state/gameStore';

/**
 * 起動時のチュートリアル。
 *
 * ⚠ **ここに書くのは実際に起きることだけ。** 旧文面は
 * 「③ 任意で磨いて品質UP」（ポリッシュ画面は stub で存在しない）と
 * 「コンボが続くと品質ブースト」（品質という合成値は廃止・コンボは打鍵倍率で最大 ×1.02）
 * という2つの嘘を、新規プレイヤー全員に最初に見せていた。
 */
const STEPS = [
  'タイピング工場へようこそ。コードを打って作品を完成させる経営シムです。',
  '① ジャンル＆テーマを選ぶ → ② チームが得意な分野の文を打ち切る → ③ テスト・デバッグ → ④ リリース！',
  '打った分野が作品の特徴（操作性・グラフィック・サウンド・ストーリー）になり、レビュー点と売上が決まります。',
  'ジャンルによって重要な分野が違います。手持ちの社員に合うジャンルを選ぶのがコツ。',
  'ゴーストを抜くと記録更新。広告は任意で、見ると得します（見なくても進めます）。',
  'では最初の1本を作ってみましょう。',
];

export const Tutorial = () => {
  const [step, setStep] = useState(0);

  const finish = () => {
    useGameStore.getState().finishTutorial();
  };

  const next = () => {
    if (step >= STEPS.length - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  const isLast = step >= STEPS.length - 1;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <div className="tutorial-step-indicator">
          {step + 1} / {STEPS.length}
        </div>
        <p>{STEPS[step]}</p>
        <div className="tutorial-buttons">
          <button className="link-btn" onClick={finish}>
            スキップ
          </button>
          <button className="primary-btn" onClick={next}>
            {isLast ? 'はじめる' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
};
