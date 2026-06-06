import { useState } from 'react';
import { useGameStore } from '../state/gameStore';

const STEPS = [
  'タイピング工場へようこそ。コードを打って作品を完成させる経営シムです。',
  '① ジャンル＆テーマを選ぶ → ② 必要なコード量を打ち切れ（経過時間が記録に） → ③ 任意で磨いて品質UP → ④ リリース！',
  'コンボが続くと品質ブースト、ゴーストを抜くと記録更新。広告は任意で見ると得します。',
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
