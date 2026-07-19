import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBgmPlaying, startBgm, stopBgm } from './bgm';

// BGM の「再生そのもの」はテスト対象外（testing-rules）。ここではループ制御
// （開始/停止/冪等）だけを fake timer で検証する（tick は発火させない＝AudioContext に触れない）。
describe('bgm ループ制御', () => {
  afterEach(() => {
    stopBgm();
    vi.useRealTimers();
  });

  it('start で再生中になり、二重 start しても多重起動せず、stop で停止する', () => {
    vi.useFakeTimers();
    expect(isBgmPlaying()).toBe(false);
    startBgm();
    expect(isBgmPlaying()).toBe(true);
    startBgm(); // 冪等（timer は1つのまま）
    expect(isBgmPlaying()).toBe(true);
    stopBgm();
    expect(isBgmPlaying()).toBe(false);
  });
});
