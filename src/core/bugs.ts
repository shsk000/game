import { BUG_CONFIG } from '../data/balance';
import type { Employee } from '../state/types';
import type { Rng } from './ports';
import { skillTotalsOf } from './skills';

/**
 * v0.17 バグ発生システム（spec v17 §4）。純粋関数のみ。
 * 発生（開発中：ミス打鍵＋コード起因）→ 発覚（テスト）→ 返済（デバッグ）。
 * エンジニア（プログラマー）の質が高いほど発生が抑制される。
 */

/**
 * バグ抑制率（0..maxSuppression）。**プログラミングスキルの合計**で決まる。
 *
 * 実装ステップ3：旧「役職 programmer の power 合計」から付け替えた
 * （docs/spec/score-model.md §1）。役職という枠をやめたので、
 * 「プログラミングを持っている人が何人いるか」で決まる形にした。
 * 同分野の2人目以降は半減（`skillTotalsOf`）＝分業のロスは他と同じ扱い。
 *
 * 例：スキル40 が1人 → 20% 抑制 ／ スキル100 が2人（合計150）→ 75% 抑制
 */
export const bugSuppression = (employees: Employee[]): number =>
  Math.min(
    BUG_CONFIG.maxSuppression,
    skillTotalsOf(employees).programming / BUG_CONFIG.suppressSkillCap,
  );

/**
 * ミス打鍵はバグ確定（v0.17.1 オーナー指示「入力間違えた場合はバグ」）。
 * 社員能力の抑制は正打側の抽選にのみ効く＝ミスの責任はプレイヤーの腕。
 */
export const rollBugOnMiss = (): boolean => BUG_CONFIG.missAlwaysBugs;

/**
 * バグ率の軸（`axes.bugRate`）による発生率の補正。
 *
 * イベントが「バグ率 −10%」と表示して与える報酬の**効き先**。
 * 実装ステップ3 で旧品質経路を消したとき、この消費側だけが道連れで消え、
 * 報酬（4イベント）と画面表示だけが残って**効かない数値**になっていた。
 * `docs/CLAUDE.md` が列挙している事故（軸「売上予測」・「開発 +0.60 LoC/秒」）と同じ形。
 *
 * −100% で発生ゼロ、+100% で倍。極端な値でも壊れないよう 0〜2 でクランプする。
 */
export const bugRateMultiplier = (bugRate = 0): number =>
  Math.max(0, Math.min(2, 1 + bugRate / 100));

/** 正打 1 打鍵ごとのバグ発生判定（実装するほどバグは埋まる。ミスゼロでも出る） */
export const rollBugOnKeystroke = (employees: Employee[], rng: Rng, bugRate = 0): boolean =>
  rng() <
  BUG_CONFIG.onKeystrokeRate * (1 - bugSuppression(employees)) * bugRateMultiplier(bugRate);

/**
 * 開発完了時の最低保証（v0.17.1）。抽選が全部外れても最低 minBugsOnDevComplete 匹は
 * テストで見つかる。エンジニアが強くても「ゼロにはならない」（抑制は量を減らすだけ）。
 */
export const ensureMinBugsOnDevComplete = (bugCount: number): number =>
  Math.max(BUG_CONFIG.minBugsOnDevComplete, bugCount);

/**
 * v0.19 出口①：広告視聴でバグ残数の 50% を即駆除（切り上げ。spec v19 §2-2）。
 * 例：5 匹 → 3 匹駆除 / 1 匹 → 1 匹駆除 / 0 匹 → 0（駆除するものがない）
 */
export const bugsClearedByAd = (bugCount: number): number => Math.ceil(Math.max(0, bugCount) / 2);

/** デバッグフェーズの作業量（修正フレーズ数）＝ バグが多いほど大変（線形） */
export const debugWorkFor = (bugCount: number): number =>
  Math.max(0, bugCount) * BUG_CONFIG.phrasesPerBug;

/**
 * 残バグを抱えたまま発売した場合のペナルティ。
 * 品質減点は releaseWork の品質合成前に、炎上リスクは axes.reputationRisk に合流する。
 */
export const remainingBugPenalty = (
  bugCount: number,
): { qualityPenalty: number; reputationRisk: number } => ({
  qualityPenalty: Math.max(0, bugCount) * BUG_CONFIG.qualityPenaltyPerBug,
  reputationRisk: Math.max(0, bugCount) * BUG_CONFIG.reputationRiskPerBug,
});

/** デバッグフェーズで打つバグ修正フレーズ（ひらがな＋長音符のみ・UI幅の都合で1つ11文字以内） */
export const BUG_FIX_PHRASES = [
  'ばぐをさいげんする',
  'ろぐをおいかける',
  'げんいんをとくていする',
  'しゅうせいをあてる',
  'かいぜんをかくにんする',
  'りぐれっしょんをふせぐ',
  'ぬるちぇっくをたす',
  'きょうかいちをためす',
  'すたっくとれーすをよむ',
  'ぶれーくぽいんとをおく',
  'へんすうのなかみをみる',
  'めもりーりーくをふさぐ',
  'たいぷえらーをなおす',
  'いんでっくすをなおす',
  'じょうけんをみなおす',
  'きゃっしゅをくりあする',
  'てすとをかきたす',
  'あさーとをいれる',
  'えっじけーすをつぶす',
  'ひとつずれをなおす',
  'たいむあうとをのばす',
  'りとらいをくみこむ',
  'でっどろっくをさける',
  'こみっとをまきもどす',
  'ぱっちをあてる',
  'こーどをせいりする',
  'れいがいをきゃっちする',
  'くらっしゅをふせぐ',
  'けいこくをつぶす',
  'ぬるさんしょうをふせぐ',
  'すれっどをどうきする',
  'こんぱいるをとおす',
  'もんだいをきりわける',
  'すぺるみすをなおす',
] as const;

export const pickBugFixPhrase = (rng: Rng = Math.random): string =>
  BUG_FIX_PHRASES[Math.floor(rng() * BUG_FIX_PHRASES.length)];
