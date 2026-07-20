import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBgmTrack, isBgmPlaying, setBgmTrack, startBgm, stopBgm } from './bgm';

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

  it('setBgmTrack でトラックが切り替わり、再生は継続する', () => {
    vi.useFakeTimers();
    setBgmTrack('office'); // 既定へ揃える
    startBgm();
    expect(getBgmTrack()).toBe('office');
    setBgmTrack('develop');
    expect(getBgmTrack()).toBe('develop');
    expect(isBgmPlaying()).toBe(true); // トラック変更後も鳴り続ける
    stopBgm();
  });
});
