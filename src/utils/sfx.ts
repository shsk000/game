/**
 * v0.14：内蔵シンセ SE（Web Audio・外部アセット不要）。
 *
 * タイピング中の視線は入力文字に固定されるため、状態変化（イベント発生・成功・ミス）は
 * 文字ではなく「音」と「画面全体」で伝える（オーナーFB 2026-07-05）。
 * チップチューン風の矩形波ビープのみ＝権利問題なし・ロード不要。
 * AudioContext はユーザー操作（初回打鍵）で生成される。
 */

let ctx: AudioContext | null = null;

const ac = (): AudioContext | null => {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

const beep = (
  freq: number,
  durSec: number,
  opts: { type?: OscillatorType; gain?: number; delaySec?: number } = {},
) => {
  const a = ac();
  if (!a) return;
  const { type = 'square', gain = 0.035, delaySec = 0 } = opts;
  try {
    const t0 = a.currentTime + delaySec;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + durSec + 0.02);
  } catch {
    /* SE は失敗しても無視（ゲーム進行に影響させない） */
  }
};

export const sfx = {
  /** 正打：短い高音チッ（音程を揺らして機械感を消す） */
  key: () => beep(840 + Math.random() * 120, 0.035, { gain: 0.02 }),
  /** ミス：低いブザー */
  miss: () => beep(110, 0.16, { type: 'sawtooth', gain: 0.05 }),
  /** フレーズ完了：上昇 2 音 */
  complete: () => {
    beep(660, 0.07);
    beep(990, 0.09, { delaySec: 0.07 });
  },
  /** イベント発生：警報 3 音（タイピング中でも気づく） */
  alert: () => {
    beep(740, 0.1, { gain: 0.055 });
    beep(587, 0.1, { gain: 0.055, delaySec: 0.12 });
    beep(740, 0.14, { gain: 0.055, delaySec: 0.24 });
  },
  /** イベント成功：ファンファーレ（上昇アルペジオ） */
  success: () => {
    beep(523, 0.09);
    beep(659, 0.09, { delaySec: 0.09 });
    beep(784, 0.09, { delaySec: 0.18 });
    beep(1047, 0.16, { delaySec: 0.27 });
  },
  /** フェーズ完了：チャイム */
  phase: () => {
    beep(784, 0.1);
    beep(1047, 0.18, { delaySec: 0.1 });
  },
};
