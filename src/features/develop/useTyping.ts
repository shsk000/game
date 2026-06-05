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
};

export const useTyping = ({ phrases, onPhraseComplete, paused = false }: Options) => {
  const engineRef = useRef<NanoTypeJp | null>(null);
  if (engineRef.current === null) engineRef.current = new NanoTypeJp();

  const [idx, setIdx] = useState(0);
  const [view, setView] = useState<TypingView>({ hiragana: '', completed: '', remained: '' });
  const [failCount, setFailCount] = useState(0);
  const [perfectStreak, setPerfectStreak] = useState(0);

  const onPhraseCompleteRef = useRef(onPhraseComplete);
  useEffect(() => {
    onPhraseCompleteRef.current = onPhraseComplete;
  }, [onPhraseComplete]);

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
      } else if (r.result === 'fail') {
        setFailCount((c) => c + 1);
      } else if (r.result === 'complete') {
        setPerfectStreak(r.perfectStreakCount);
        onPhraseCompleteRef.current();
        setIdx((i) => i + 1);
      }
    };
    window.addEventListener('keypress', handler);
    return () => window.removeEventListener('keypress', handler);
  }, [paused]);

  return { view, idx, failCount, perfectStreak };
};
