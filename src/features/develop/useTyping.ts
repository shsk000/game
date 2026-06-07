import NanoTypeJp from '@shsk002/nano-type-jp';
import { useEffect, useRef, useState } from 'react';

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
  /** 正打ごとに今のコンボ値が渡る */
  onCorrect?: (combo: number) => void;
  /** WPM（成功打鍵/分）が更新されたとき */
  onWpm?: (wpm: number) => void;
  /** 正確度（0〜1）が更新されたとき。各キー入力ごとに発火 */
  onAccuracy?: (acc: number) => void;
};

export const useTyping = ({
  phrases,
  onPhraseComplete,
  paused = false,
  onComboBreak,
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
  const onCorrectRef = useRef(onCorrect);
  const onWpmRef = useRef(onWpm);
  const onAccuracyRef = useRef(onAccuracy);
  useEffect(() => {
    onPhraseCompleteRef.current = onPhraseComplete;
    onComboBreakRef.current = onComboBreak;
    onCorrectRef.current = onCorrect;
    onWpmRef.current = onWpm;
    onAccuracyRef.current = onAccuracy;
  }, [onPhraseComplete, onComboBreak, onCorrect, onWpm, onAccuracy]);

  // WPM 計算用：成功打鍵タイムスタンプ（直近30件で平均）
  const correctTimesRef = useRef<number[]>([]);
  // 正確度カウント
  const correctCountRef = useRef(0);
  const failCountRef = useRef(0);

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
    const reportAccuracy = () => {
      const correct = correctCountRef.current;
      const fail = failCountRef.current;
      const total = correct + fail;
      const acc = total === 0 ? 1 : correct / total;
      setAccuracy(acc);
      onAccuracyRef.current?.(acc);
    };
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const engine = engineRef.current!;
      const r = engine.answerAlphabet(e.key);
      if (r.result === 'correct') {
        correctCountRef.current += 1;
        setView((v) => ({
          ...v,
          completed: r.inputAlphabet.completedInputAlphabet,
          remained: r.inputAlphabet.remainedAlphabet,
        }));
        setCombo((c) => {
          const nc = c + 1;
          onCorrectRef.current?.(nc);
          return nc;
        });
        const now = performance.now();
        const arr = correctTimesRef.current;
        arr.push(now);
        while (arr.length > 30) arr.shift();
        if (arr.length >= 5) {
          const spanMin = (arr[arr.length - 1] - arr[0]) / 1000 / 60;
          if (spanMin > 0) {
            const w = (arr.length - 1) / spanMin;
            setWpm(w);
            onWpmRef.current?.(w);
          }
        }
        reportAccuracy();
      } else if (r.result === 'fail') {
        failCountRef.current += 1;
        setFailCount((c) => c + 1);
        setCombo((c) => {
          if (c > 0) onComboBreakRef.current?.(c);
          return 0;
        });
        reportAccuracy();
      } else if (r.result === 'complete') {
        correctCountRef.current += 1;
        onPhraseCompleteRef.current();
        setCombo((c) => {
          const nc = c + 1;
          onCorrectRef.current?.(nc);
          return nc;
        });
        setIdx((i) => i + 1);
        reportAccuracy();
      }
    };
    window.addEventListener('keypress', handler);
    return () => window.removeEventListener('keypress', handler);
  }, [paused]);

  return { view, idx, failCount, combo, wpm, accuracy };
};
