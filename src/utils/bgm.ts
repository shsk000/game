/**
 * v0.24：内蔵シンセ BGM（Web Audio・外部アセット不要）。
 *
 * sfx.ts と同じチップチューン路線（矩形/三角波のみ＝権利問題なし・ロード不要）。
 * ミュート/音量は sfx の設定（isSfxMuted / getSfxVolume）に連動する
 * ＝設定モーダルの1つのトグル/スライダーで SE と BGM の両方を制御する。
 * ループはブラウザの autoplay ポリシー上、最初のユーザー操作後に開始する（配線は boot.ts）。
 */
import { getSfxVolume, isSfxMuted } from './sfx';

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;

// C → G → Am → F（王道進行）を各4音のアルペジオで。落ち着いたオフィス BGM。
const SEQUENCE = [
  262, 330, 392, 330, // C
  196, 247, 294, 247, // G
  220, 262, 330, 262, // Am
  175, 220, 262, 220, // F
];
const STEP_MS = 260;

const ac = (): AudioContext | null => {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

const tick = () => {
  const freq = SEQUENCE[step];
  step = (step + 1) % SEQUENCE.length; // ミュート中も位置は進める（解除時にフレーズが飛ばない）
  if (isSfxMuted() || getSfxVolume() <= 0) return;
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    const peak = 0.025 * getSfxVolume(); // SE を邪魔しないよう控えめ
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (STEP_MS / 1000) * 0.9);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + STEP_MS / 1000);
  } catch {
    /* BGM は失敗してもゲーム進行に影響させない */
  }
};

/** ループ開始（冪等）。ユーザー操作直後に呼ぶ＝AudioContext を resume できる */
export const startBgm = (): void => {
  if (timer !== null) return;
  ac();
  timer = setInterval(tick, STEP_MS);
};

/** ループ停止 */
export const stopBgm = (): void => {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
};

export const isBgmPlaying = (): boolean => timer !== null;
