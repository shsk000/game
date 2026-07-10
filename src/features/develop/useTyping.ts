import NanoTypeJp from '@shsk002/nano-type-jp';
import { useEffect, useRef, useState } from 'react';
import { applyKey, initialTypingStats, type TypingStats } from './typingEngine';

export type TypingView = {
  hiragana: string;
  completed: string;
  remained: string;
};

type Options = {
  phrases: string[];
  onPhraseComplete: () => void;
  paused?: boolean;
  /** コンボが切れたとき呼ばれる */
  onComboBreak?: (lastCombo: number) => void;
  /** ミス打鍵ごとに毎回呼ばれる（コンボ 0 中のミスも含む） */
  onFail?: () => void;
  /** 正打ごとに今のコンボ値が渡る */
  onCorrect?: (combo: number) => void;
  /** WPM（成功打鍵/分）が更新されたとき */
  onWpm?: (wpm: number) => void;
  /** 正確度（0〜1）が更新されたとき。各キー入力ごとに発火 */
  onAccuracy?: (acc: number) => void;
};

/**
 * タイピング入力フック（薄いアダプタ。logic-architecture §5）。
 * 責務は「nano-type-jp の保持・keypress 購読・React state への反映」のみ。
 * コンボ/WPM/正確度の計算は typingEngine.ts（純粋関数）に委譲する。
 */
export const useTyping = ({
  phrases,
  onPhraseComplete,
  paused = false,
  onComboBreak,
  onFail,
  onCorrect,
  onWpm,
  onAccuracy,
}: Options) => {
  const engineRef = useRef<NanoTypeJp | null>(null);
  if (engineRef.current === null) engineRef.current = new NanoTypeJp();

  const [idx, setIdx] = useState(0);
  const [view, setView] = useState<TypingView>({ hiragana: '', completed: '', remained: '' });
  const [failCount, setFailCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(1);

  const onPhraseCompleteRef = useRef(onPhraseComplete);
  const onComboBreakRef = useRef(onComboBreak);
  const onFailRef = useRef(onFail);
  const onCorrectRef = useRef(onCorrect);
  const onWpmRef = useRef(onWpm);
  const onAccuracyRef = useRef(onAccuracy);
  useEffect(() => {
    onPhraseCompleteRef.current = onPhraseComplete;
    onComboBreakRef.current = onComboBreak;
    onFailRef.current = onFail;
    onCorrectRef.current = onCorrect;
    onWpmRef.current = onWpm;
    onAccuracyRef.current = onAccuracy;
  }, [onPhraseComplete, onComboBreak, onFail, onCorrect, onWpm, onAccuracy]);

  // 統計の真値（setState の updater 内で副作用コールバックを呼ばないため ref に保持）
  const statsRef = useRef<TypingStats>(initialTypingStats());

  useEffect(() => {
    const engine = engineRef.current!;
    const phrase = phrases[idx % phrases.length];
    if (!phrase) return;
    const reg = engine.registerNewHiragana(phrase);
    setView({
      hiragana: phrase,
      completed: reg.inputAlphabet.completedInputAlphabet,
      remained: reg.inputAlphabet.remainedAlphabet,
    });
  }, [idx, phrases]);

  useEffect(() => {
    if (paused) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const engine = engineRef.current!;
      const r = engine.answerAlphabet(e.key);
      if (r.result !== 'correct' && r.result !== 'fail' && r.result !== 'complete') return;

      const applied = applyKey(statsRef.current, r.result, performance.now());
      statsRef.current = applied.stats;

      // React state へ反映
      setCombo(applied.stats.combo);
      setFailCount(applied.stats.failCount);
      setAccuracy(applied.stats.accuracy);
      if (applied.wpmUpdated) setWpm(applied.stats.wpm);

      // 種別ごとの表示更新とコールバック発火
      if (r.result === 'correct') {
        setView((v) => ({
          ...v,
          completed: r.inputAlphabet.completedInputAlphabet,
          remained: r.inputAlphabet.remainedAlphabet,
        }));
        onCorrectRef.current?.(applied.stats.combo);
        if (applied.wpmUpdated) onWpmRef.current?.(applied.stats.wpm);
      } else if (r.result === 'fail') {
        onFailRef.current?.();
        if (applied.comboBroken !== null) onComboBreakRef.current?.(applied.comboBroken);
      } else {
        onPhraseCompleteRef.current();
        onCorrectRef.current?.(applied.stats.combo);
        setIdx((i) => i + 1);
      }
      onAccuracyRef.current?.(applied.stats.accuracy);
    };
    window.addEventListener('keypress', handler);
    return () => window.removeEventListener('keypress', handler);
  }, [paused]);

  return { view, idx, failCount, combo, wpm, accuracy };
};
