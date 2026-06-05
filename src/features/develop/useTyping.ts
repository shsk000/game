import { useEffect, useRef, useState } from 'react';
import NanoTypeJp from '@shsk002/nano-type-jp';

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
};

export const useTyping = ({
  phrases,
  onPhraseComplete,
  paused = false,
  onComboBreak,
  onCorrect,
  onWpm,
}: Options) => {
  const engineRef = useRef<NanoTypeJp | null>(null);
  if (engineRef.current === null) engineRef.current = new NanoTypeJp();

  const [idx, setIdx] = useState(0);
  const [view, setView] = useState<TypingView>({ hiragana: '', completed: '', remained: '' });
  const [failCount, setFailCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wpm, setWpm] = useState(0);

  const onPhraseCompleteRef = useRef(onPhraseComplete);
  const onComboBreakRef = useRef(onComboBreak);
  const onCorrectRef = useRef(onCorrect);
  const onWpmRef = useRef(onWpm);
  useEffect(() => {
    onPhraseCompleteRef.current = onPhraseComplete;
    onComboBreakRef.current = onComboBreak;
    onCorrectRef.current = onCorrect;
    onWpmRef.current = onWpm;
  }, [onPhraseComplete, onComboBreak, onCorrect, onWpm]);

  // WPM 計算用：成功打鍵タイムスタンプ（直近30件で平均）
  const correctTimesRef = useRef<number[]>([]);

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
      if (r.result === 'correct') {
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
      } else if (r.result === 'fail') {
        setFailCount((c) => c + 1);
        setCombo((c) => {
          if (c > 0) onComboBreakRef.current?.(c);
          return 0;
        });
      } else if (r.result === 'complete') {
        onPhraseCompleteRef.current();
        setCombo((c) => {
          const nc = c + 1;
          onCorrectRef.current?.(nc);
          return nc;
        });
        setIdx((i) => i + 1);
      }
    };
    window.addEventListener('keypress', handler);
    return () => window.removeEventListener('keypress', handler);
  }, [paused]);

  return { view, idx, failCount, combo, wpm };
};
