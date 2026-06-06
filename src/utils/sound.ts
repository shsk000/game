export type SfxName = 'click' | 'keystroke' | 'phrase' | 'complete' | 'release' | 'fanfare';

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AC: typeof AudioContext | undefined =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  return ctx;
};

const playTone = (
  c: AudioContext,
  type: OscillatorType,
  freq: number,
  durationMs: number,
  gain: number,
  startOffset = 0,
  endFreq?: number,
) => {
  const now = c.currentTime + startOffset;
  const dur = durationMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== undefined) {
    osc.frequency.linearRampToValueAtTime(endFreq, now + dur);
  }
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + Math.min(0.01, dur * 0.2));
  g.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
};

export const playSfx = (name: SfxName): void => {
  try {
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __sfxMuted?: boolean }).__sfxMuted
    ) {
      return;
    }
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') {
      c.resume().catch(() => {});
    }
    switch (name) {
      case 'click':
        playTone(c, 'square', 440, 60, 0.05);
        break;
      case 'keystroke':
        playTone(c, 'square', 880, 25, 0.03);
        break;
      case 'phrase':
        playTone(c, 'triangle', 660, 80, 0.07);
        break;
      case 'complete':
        playTone(c, 'triangle', 880, 200, 0.1, 0, 1320);
        break;
      case 'release':
        playTone(c, 'triangle', 523, 140, 0.1, 0);
        playTone(c, 'triangle', 783, 140, 0.1, 0.14);
        break;
      case 'fanfare': {
        const notes = [523, 659, 784, 1046];
        const each = 0.15;
        notes.forEach((n, i) => {
          playTone(c, 'triangle', n, each * 1000, 0.1, i * each);
        });
        break;
      }
    }
  } catch {
    // swallow
  }
};

export const setSfxMuted = (m: boolean): void => {
  if (typeof window === 'undefined') return;
  (window as unknown as { __sfxMuted?: boolean }).__sfxMuted = m;
};

export const isSfxMuted = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { __sfxMuted?: boolean }).__sfxMuted;
};
