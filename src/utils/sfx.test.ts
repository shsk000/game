import { describe, expect, it } from 'vitest';
import { getSfxVolume, isSfxMuted, setSfxMuted, setSfxVolume } from './sfx';

// 効果音の「再生そのもの」はテスト対象外（testing-rules §テストしないもの）。
// ここでは音量・ミュートの状態管理ロジック（クランプ・トグル）だけを検証する。
describe('sfx ミュート/音量', () => {
  it('setSfxVolume は 0..1 にクランプする', () => {
    setSfxVolume(0.5);
    expect(getSfxVolume()).toBe(0.5);
    setSfxVolume(-1);
    expect(getSfxVolume()).toBe(0);
    setSfxVolume(2);
    expect(getSfxVolume()).toBe(1);
    setSfxVolume(1); // 後続テストへ状態を持ち越さない
  });

  it('setSfxMuted で isSfxMuted が切り替わる', () => {
    setSfxMuted(true);
    expect(isSfxMuted()).toBe(true);
    setSfxMuted(false);
    expect(isSfxMuted()).toBe(false);
  });
});
