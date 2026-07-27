import type { DevAxis, DevPhase } from '../state/types';

/**
 * v0.14：フェーズ別ランダムイベント＋ベース入力ミッション（spec §5）。
 *
 * 設計（オーナー決定）:
 * - 各フェーズに最低 1 回の「ベース入力ミッション」を置く（案B）。イベント無しでも必ず打つ。
 * - 各イベントは「入力ミッション（ひらがな）」を打ち切ると成功効果が適用される。
 * - スキップ（打たない選択）は無し（オーナーFB 2026-07-08）。必ず打って解決する＝詰みなし。
 * - 効果は新名称軸（DevAxis）への ± デルタ。リリース時に既存パイプラインへ合流（spec §5-6）。
 *
 * ※ ミッション文はタイピングエンジン（ひらがな）に合わせ、長音符「ー」・カタカナを避ける。
 * ※ 数値・発生率は叩き台（spec R2）。balance 調整は実機で。
 */

export type EventCategory = 'trouble' | 'chance' | 'schedule' | 'market' | 'quality';

/** 新軸への効果デルタ（成功時に適用） */
export type AxisDelta = Partial<Record<DevAxis, number>>;

export type DevEvent = {
  id: string;
  /** 表示名（漢字可） */
  name: string;
  category: EventCategory;
  /** 内容の短い説明 */
  flavor: string;
  /** 入力ミッション（ひらがな・実際に打つ文） */
  mission: string;
  /** ミッションの表示見出し（漢字可） */
  missionLabel: string;
  /** 発生率 0..1（叩き台） */
  rate: number;
  /** 成功時（打ち切り）の効果 */
  success: AxisDelta;
};

/** 系統の表示メタ（下部バー・アイコン） */
export const EVENT_CATEGORY_META: Record<EventCategory, { label: string; icon: string }> = {
  trouble: { label: 'トラブル', icon: '🐛' },
  chance: { label: 'チャンス', icon: '💡' },
  schedule: { label: 'スケジュール', icon: '⏰' },
  market: { label: '市場', icon: '⚔️' },
  quality: { label: '品質', icon: '🎯' },
};

// v0.14 後期：ベース入力ミッション（「企画書を書く」等の固定文）は廃止（オーナーFB 2026-07-05）。
// 効果ゼロの固定文を毎回打たせても意味が無い。打つのは「効果があるもの＝イベント」だけにし、
// イベントが発生しないフェーズは完了演出で自動進行する。

/** フェーズ別イベント表（spec §5-2）。 */
export const PHASE_EVENTS: Record<DevPhase, DevEvent[]> = {
  planning: [
    {
      id: 'plan-idea',
      name: '天才のひらめき',
      category: 'chance',
      flavor: '社員が面白いアイデアを出した',
      mission: 'あいであをかたちにする',
      missionLabel: 'アイデアを形にする',
      rate: 0.2,
      success: { hype: 25 },
    },
    {
      id: 'plan-drift',
      name: 'コンセプト迷走',
      category: 'trouble',
      flavor: '企画の方向性がブレている',
      mission: 'ほうこうせいをきめなおす',
      missionLabel: '方向性を決め直す',
      rate: 0.12,
      success: { hype: 5 },
    },
    {
      id: 'plan-trend',
      name: '市場トレンド発見',
      category: 'market',
      flavor: '今流行のジャンルを見つけた',
      mission: 'とれんどをぶんせきする',
      missionLabel: 'トレンドを分析する',
      rate: 0.15,
      // 旧 salesForecast +15 から付け替え（軸削除に伴う。流行を掴んだ＝話題になる、で意味は通る）
      success: { buzz: 15 },
    },
    {
      id: 'plan-budget',
      name: '予算見直し',
      category: 'schedule',
      flavor: '予算が足りるか検討する',
      mission: 'よさんをちょうせいする',
      missionLabel: '予算を調整する',
      rate: 0.1,
      success: { costMod: -10 },
    },
    {
      id: 'plan-target',
      name: 'ターゲット再設定',
      category: 'market',
      flavor: '想定ユーザーを見直す',
      mission: 'そうていそうをきめる',
      missionLabel: 'ターゲットを決める',
      rate: 0.1,
      success: { trust: 10 },
    },
  ],
  development: [
    {
      id: 'dev-bug',
      name: 'バグ発生',
      category: 'trouble',
      flavor: '開発中に不具合が見つかった',
      mission: 'ばぐをしゅうせいする',
      missionLabel: 'バグを修正する',
      rate: 0.15,
      success: { bugRate: -10 },
    },
    {
      id: 'dev-deadline',
      name: '締切迫る',
      category: 'schedule',
      flavor: 'スケジュールが厳しくなってきた',
      mission: 'いそいでじっそうする',
      missionLabel: '急いで実装する',
      rate: 0.15,
      success: { devWeeksDelta: -1 },
    },
    {
      id: 'dev-idea',
      name: '天才のひらめき',
      category: 'chance',
      flavor: '新システムの案が出た',
      mission: 'あいであをじっそうする',
      missionLabel: 'アイデアを実装する',
      rate: 0.2,
      success: { hype: 8, buzz: 10 },
    },
    {
      id: 'dev-rival',
      name: 'ライバル出現',
      category: 'market',
      flavor: '他社が似たゲームを発表した',
      mission: 'さべつかをはかる',
      missionLabel: '差別化を図る',
      rate: 0.1,
      success: { buzz: 15 },
    },
    {
      id: 'dev-spec',
      name: '仕様変更',
      category: 'trouble',
      flavor: '途中で必要な機能が増えた',
      mission: 'しようをくみなおす',
      missionLabel: '仕様を組み直す',
      rate: 0.1,
      success: { hype: 5 },
    },
  ],
  testing: [
    {
      id: 'test-feel',
      name: '操作性に違和感',
      category: 'quality',
      flavor: 'テスターが操作しづらさを発見',
      mission: 'そうさかんをちょうせいする',
      missionLabel: '操作感を調整する',
      rate: 0.15,
      success: { hype: 10 },
    },
    {
      id: 'test-difficulty',
      name: '難易度が高すぎる',
      category: 'quality',
      flavor: 'ボスや敵が強すぎる',
      mission: 'なんいどをちょうせいする',
      missionLabel: '難易度を調整する',
      rate: 0.15,
      success: { hype: 10 },
    },
    {
      id: 'test-hiddenbug',
      name: '隠しバグ発見',
      category: 'trouble',
      flavor: '普段見つからない不具合が出た',
      mission: 'さいげんてじゅんをかくにんする',
      missionLabel: '再現手順を確認する',
      rate: 0.12,
      success: { bugRate: -8 },
    },
    {
      id: 'test-praise',
      name: 'テスター大好評',
      category: 'chance',
      flavor: 'プレイテストで好反応',
      mission: 'おもしろさをのばす',
      missionLabel: '面白さを伸ばす',
      rate: 0.15,
      success: { hype: 15 },
    },
    {
      id: 'test-ui',
      name: 'UIが分かりづらい',
      category: 'quality',
      flavor: 'メニューや説明が不親切',
      mission: 'がめんをみやすくする',
      missionLabel: 'UIを改善する',
      rate: 0.12,
      success: { hype: 6 },
    },
  ],
  debugging: [
    {
      id: 'debug-critical',
      name: '致命的バグ',
      category: 'trouble',
      flavor: 'ゲームが進行不能になる',
      mission: 'ちめいてきばぐをなおす',
      missionLabel: '致命的バグを修正する',
      rate: 0.18,
      success: { bugRate: -20 },
    },
    {
      id: 'debug-crash',
      name: 'クラッシュ多発',
      category: 'trouble',
      flavor: '特定条件でゲームが落ちる',
      mission: 'くらっしゅをなおす',
      missionLabel: 'クラッシュを直す',
      rate: 0.15,
      success: { hype: 8 },
    },
    {
      id: 'debug-save',
      name: 'セーブデータ破損',
      category: 'trouble',
      flavor: 'セーブ関連の問題が発生',
      mission: 'ほぞんしょりをなおす',
      missionLabel: 'セーブ処理を直す',
      rate: 0.12,
      success: { trust: 10 },
    },
    {
      id: 'debug-unknown',
      name: '原因不明の不具合',
      category: 'trouble',
      flavor: '再現しづらいバグが発生',
      mission: 'げんいんをとくていする',
      missionLabel: '原因を特定する',
      rate: 0.15,
      success: { bugRate: -12 },
    },
    {
      id: 'debug-chain',
      name: '修正の連鎖',
      category: 'trouble',
      flavor: '直したら別のバグが出た',
      mission: 'しゅうせいをかくにんする',
      missionLabel: '修正内容を確認する',
      rate: 0.12,
      success: { hype: 5 },
    },
  ],
  // release フェーズのイベントは全削除（オーナー判断 2026-07-25）。
  // advancePhase は debugging の次に 'release' を設定せず finishDevelopment() に飛ぶため
  // （gameStore.ts）、ここに置いた5件（SNSで話題化 / 配信者が紹介 / 炎上危機 /
  // ストア審査トラブル / サーバー負荷増加）は一度も発生しない死にデータだった。
  // イベント方式そのものを作り直す方針が決まっているので、暫定で生かすのではなく削除する。
  // 消したイベント定義が必要になったら git 履歴（この行を含むコミットの親）から復元できる。
  release: [],
  complete: [],
};

/** 軸 → 表示ラベル＆単位（イベント結果テロップ用） */
export const AXIS_META: Record<DevAxis, { label: string; unit: string }> = {
  hype: { label: '期待度', unit: '' },
  buzz: { label: '話題性', unit: '' },
  bugRate: { label: 'バグ率', unit: '%' },
  reputationRisk: { label: '炎上リスク', unit: '' },
  devWeeksDelta: { label: '開発期間', unit: '週' },
  costMod: { label: 'コスト', unit: '%' },
  trust: { label: '信頼度', unit: '' },
};

/** AxisDelta を「面白さ +15 / 期待度 +10」のような表示文に整形 */
export const formatAxisDelta = (delta: AxisDelta): string => {
  const parts = Object.entries(delta)
    .filter(([, v]) => v && v !== 0)
    .map(([k, v]) => {
      const meta = AXIS_META[k as DevAxis];
      const sign = (v as number) > 0 ? '+' : '';
      return `${meta.label} ${sign}${v}${meta.unit}`;
    });
  return parts.length > 0 ? parts.join(' / ') : '効果なし';
};
