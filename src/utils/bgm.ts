/**
 * v0.24：内蔵シンセ BGM（Web Audio・外部アセット不要）。
 *
 * sfx.ts と同じチップチューン路線（矩形/三角波のみ＝権利問題なし・ロード不要）。
 * ミュート/音量は sfx の設定（isSfxMuted / getSfxVolume）に連動する
 * ＝設定モーダルの1つのトグル/スライダーで SE と BGM の両方を制御する。
 * ループはブラウザの autoplay ポリシー上、最初のユーザー操作後に開始する（配線は boot.ts）。
 *
 * v0.24：画面別に2トラックを切り替える（office=ゆったり経営／develop=集中テンポ）。
 * 切替の配線は App.tsx（screen を監視して setBgmTrack）。
 */
import { getSfxVolume, isSfxMuted } from './sfx';

export type BgmTrack = 'office' | 'develop';

const TRACKS: Record<BgmTrack, { seq: number[]; stepMs: number }> = {
  // オフィス：C→G→Am→F の王道進行を各4音アルペジオでゆったり
  office: {
    seq: [262, 330, 392, 330, 196, 247, 294, 247, 220, 262, 330, 262, 175, 220, 262, 220],
    stepMs: 260,
  },
  // 開発：Am→F→C→G を速めのアルペジオで。集中感を出す（音量は tick 側で控えめに固定）
  develop: {
    seq: [440, 523, 659, 523, 349, 440, 523, 440, 262, 330, 392, 330, 294, 392, 494, 392],
    stepMs: 175,
  },
};

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let track: BgmTrack = 'office';

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
  const { seq, stepMs } = TRACKS[track];
  const freq = seq[step % seq.length];
  step = (step + 1) % seq.length; // ミュート中も位置は進める（解除時にフレーズが飛ばない）
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
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (stepMs / 1000) * 0.9);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + stepMs / 1000);
  } catch {
    /* BGM は失敗してもゲーム進行に影響させない */
  }
};

/** ループ開始（冪等）。ユーザー操作直後に呼ぶ＝AudioContext を resume できる */
export const startBgm = (): void => {
  if (timer !== null) return;
  ac();
  timer = setInterval(tick, TRACKS[track].stepMs);
};

/** ループ停止 */
export const stopBgm = (): void => {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
};

/** 画面に応じて BGM トラックを切り替える（再生中なら鳴らす間隔も更新） */
export const setBgmTrack = (next: BgmTrack): void => {
  if (next === track) return;
  track = next;
  step = 0; // 新トラックの先頭から
  if (timer !== null) {
    clearInterval(timer);
    timer = setInterval(tick, TRACKS[track].stepMs);
  }
};

export const getBgmTrack = (): BgmTrack => track;
export const isBgmPlaying = (): boolean => timer !== null;
