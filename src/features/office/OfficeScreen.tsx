import { useEffect, useRef, useState } from 'react';
import { OfficeView } from '../../components/OfficeView';
import {
  PixelButton,
  PixelMenuBar,
  type PixelMenuItem,
  PixelModal,
  PixelStatusBar,
  PixelWindow,
  SegGauge,
} from '../../components/ui';
import { gachaPrice, pityThreshold } from '../../core/gacha';
import { nextGoals } from '../../core/goals';
import { nextExpFor } from '../../core/growth';
import { ACHIEVEMENTS } from '../../data/achievements';
import { computeBorrowingLimit, DEBT_CONFIG } from '../../data/balance';
import { roleLabel, sumMonthlySalaries } from '../../data/employees';
import { GENRE_BY_ID } from '../../data/genres';
import { MAX_EMPLOYEES, NATIVE_H, NATIVE_W } from '../../data/officeLayout';
import { nextLockedScale, SCALE_BY_ID, SCALES } from '../../data/scales';
import { THEME_BY_ID } from '../../data/themes';
import { useGameStore } from '../../state/gameStore';
import { formatYen } from '../../utils/format';
import { EquipmentModal } from './EquipmentModal';
import { formatPower, RANK_VISUAL, ROLE_VISUAL } from './employeeDisplay';
import { GachaReveal } from './GachaReveal';

/**
 * オフィス画面：ゲームのトップ画面。
 *
 * 構造：
 *   ┌─ PixelStatusBar（資金・ファン等。上部固定）
 *   ├─ OfficeView（アイソメトリック世界。中央メイン）
 *   └─ PixelMenuBar（計画/採用/規模/作品/図鑑/実績/設定。下部固定）
 *
 * モーダル系の機能は画面遷移ではなく PixelModal で表示する。
 * 詳細は `.claude/plans/office-ui-pixel-redesign.md` Phase D を参照。
 */

const ICON_BASE = '/sprites/ui';

type ModalKind =
  | 'hire'
  | 'scale'
  | 'equipment'
  | 'achievements'
  | 'settings'
  | 'debt'
  | 'officeUpgrade'
  | null;

// formatPower / ROLE_VISUAL / RANK_VISUAL は employeeDisplay.ts に共通化（v0.22）
// SegGauge は src/components/ui/SegGauge.tsx に共通化（v0.11 開発フェーズと共用）

export const OfficeScreen = () => {
  const funds = useGameStore((s) => s.funds);
  const lifetimeRevenue = useGameStore((s) => s.lifetimeRevenue);
  const employees = useGameStore((s) => s.employees);
  const candidate = useGameStore((s) => s.candidate);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const library = useGameStore((s) => s.library);
  const records = useGameStore((s) => s.records);
  const achievements = useGameStore((s) => s.achievements);
  const lastFixedCost = useGameStore((s) => s.lastFixedCost);
  const debt = useGameStore((s) => s.debt);
  const hireCandidate = useGameStore((s) => s.hireCandidate);
  const pullGacha = useGameStore((s) => s.pullGacha);
  const dismissCandidate = useGameStore((s) => s.dismissCandidate);
  const gachaPity = useGameStore((s) => s.gachaPity);
  const fireEmployee = useGameStore((s) => s.fireEmployee);
  const unlockNextScale = useGameStore((s) => s.unlockNextScale);
  const borrowMoney = useGameStore((s) => s.borrowMoney);
  const repayDebt = useGameStore((s) => s.repayDebt);
  const goTo = useGameStore((s) => s.goTo);
  const reset = useGameStore((s) => s.reset);
  const muted = useGameStore((s) => s.muted);
  const volume = useGameStore((s) => s.volume);
  const setMuted = useGameStore((s) => s.setMuted);
  const setVolume = useGameStore((s) => s.setVolume);

  const [modal, setModal] = useState<ModalKind>(null);
  const [debtAmountInput, setDebtAmountInput] = useState<string>('');
  const closeModal = () => setModal(null);

  const trend = useGameStore((s) => s.trend);
  const currentDate = useGameStore((s) => s.currentDate);

  // ティッカー用：次の週まで進捗（IDLE 30 秒/週、GlobalTicker と同期）
  const [weekProgress, setWeekProgress] = useState(0);
  const weekStartRef = useRef<number>(performance.now());
  useEffect(() => {
    weekStartRef.current = performance.now();
    setWeekProgress(0);
  }, [currentDate]);
  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = performance.now() - weekStartRef.current;
      setWeekProgress(Math.min(100, (elapsed / 30_000) * 100));
    }, 250);
    return () => clearInterval(t);
  }, []);

  const next = nextLockedScale(unlocked);
  const normalGachaPrice = gachaPrice('normal', unlocked);
  const premiumGachaPrice = gachaPrice('premium', unlocked);
  const premiumPity = pityThreshold('premium');
  const sellingWorks = library.filter((w) => w.selling);
  const currentScale = unlocked[unlocked.length - 1] ?? 'mini';
  const currentScaleDef = SCALE_BY_ID[currentScale];
  const monthlySalaries = sumMonthlySalaries(employees);
  const monthlyRent = currentScaleDef.monthlyRent;
  const monthlyInterest = Math.round(debt * DEBT_CONFIG.monthlyInterestRate);
  const monthlyTotal = monthlySalaries + monthlyRent + monthlyInterest;
  const borrowingLimit = computeBorrowingLimit(monthlySalaries + monthlyRent);
  const borrowingAvailable = Math.max(0, borrowingLimit - debt);

  const menuItems: PixelMenuItem[] = [
    {
      id: 'plan',
      label: '計画',
      emoji: '📋',
      iconSrc: `${ICON_BASE}/icon_plan.png`,
      onClick: () => goTo('plan'),
    },
    {
      id: 'hire',
      label: '採用',
      emoji: '👥',
      iconSrc: `${ICON_BASE}/icon_hire.png`,
      onClick: () => setModal('hire'),
    },
    {
      id: 'scale',
      label: '規模',
      emoji: '🏆',
      iconSrc: `${ICON_BASE}/icon_scale.png`,
      onClick: () => setModal('scale'),
    },
    {
      id: 'equipment',
      label: '装備',
      emoji: '🛠',
      onClick: () => setModal('equipment'),
    },
    {
      id: 'library',
      label: '作品',
      emoji: '📚',
      iconSrc: `${ICON_BASE}/icon_library.png`,
      onClick: () => goTo('library'),
    },
    {
      id: 'collection',
      label: '図鑑',
      emoji: '📖',
      iconSrc: `${ICON_BASE}/icon_collection.png`,
      onClick: () => goTo('collection'),
    },
    {
      id: 'achievements',
      label: '実績',
      emoji: '🌟',
      iconSrc: `${ICON_BASE}/icon_achievements.png`,
      onClick: () => setModal('achievements'),
    },
    {
      // v0.xx：将来のオフィスアップグレード機能のティザー（薄グレー＋準備中バッジ）。
      // 押すと「準備中／近日追加予定」モーダルを出すだけ（機能は未実装）。
      id: 'office',
      label: 'オフィス',
      emoji: '🏢',
      dimmed: true,
      onClick: () => setModal('officeUpgrade'),
    },
    {
      id: 'settings',
      label: '設定',
      emoji: '⚙️',
      iconSrc: `${ICON_BASE}/icon_settings.png`,
      onClick: () => setModal('settings'),
    },
  ];

  // v0.17.1：オフィスの見た目は規模で変えない（オーナー指示「大きさは変わらなくていい」）。
  // v0.19：正面向き背景（1枚絵、ネイティブ 1445×1088）に刷新。机レイアウトは元々全規模共通。
  const stageScale = Math.min(1, 1280 / NATIVE_W, 720 / NATIVE_H);

  // G5：お知らせ（リファレンスの左上窓）。store の状態から直近の出来事を導出
  const news: { icon: string; text: string; tone?: 'warn' | 'good' }[] = [];
  if (employees.length === 0) {
    news.push({ icon: '👥', text: '従業員を採用しましょう', tone: 'warn' });
  }
  if (trend) {
    const tg = GENRE_BY_ID[trend.genreId]?.name ?? '';
    const tt = THEME_BY_ID[trend.themeId]?.name ?? '';
    news.push({ icon: '📈', text: `${tg}×${tt} が人気です`, tone: 'good' });
  }
  if (library[0]) {
    news.push({ icon: '🎮', text: `『${library[0].title}』を発売しました` });
  }
  if (debt > 0) {
    news.push({ icon: '⚠', text: `借金 ${formatYen(debt)} の返済をお忘れなく`, tone: 'warn' });
  }
  if (next && funds >= next.unlockCost && lifetimeRevenue >= next.unlockSalesRequired) {
    news.push({ icon: '🏆', text: `「${next.name}」が解放可能です！`, tone: 'good' });
  }
  if (news.length === 0) {
    news.push({ icon: '📋', text: '新しいゲームを企画しましょう' });
  }

  return (
    <div className="office-stage-root office-screen">
      {/* ── 世界ステージ：オフィスが画面全体（HUD の裏まで広がる） ── */}
      <div className="office-stage">
        <div style={{ transform: `scale(${stageScale})`, transformOrigin: 'center center' }}>
          <OfficeView employees={employees} />
        </div>
      </div>

      {/* ── HUD（世界の上に浮く、40px 薄バー） ── */}
      <PixelStatusBar style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }} />

      {/* ── 左側：お知らせ + 社員リスト（リファレンス準拠） ── */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 48,
          width: 264,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 5,
        }}
      >
        <PixelWindow title="📢 お知らせ" variant="standard" bodyStyle={{ padding: 8 }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            {news.slice(0, 5).map((n) => (
              <li
                key={n.text}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: '#1c2228' }}>{n.text}</span>
                {/* リファレンス準拠：行の右端に色丸インジケータ */}
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '1px solid #10151c',
                    background:
                      n.tone === 'warn' ? '#e05252' : n.tone === 'good' ? '#3fb950' : '#2f81d6',
                  }}
                />
              </li>
            ))}
          </ul>
        </PixelWindow>

        {/* v0.18：つぎの目標（常設3行。core/goals.ts。短期目標の連鎖でリテンションを作る） */}
        <PixelWindow title="🎯 つぎの目標" variant="standard" bodyStyle={{ padding: 8 }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            {nextGoals({
              unlockedScales: unlocked,
              lifetimeRevenue,
              funds,
              employees,
              library,
            }).map((g) => (
              <li
                key={`${g.icon}-${g.label}`}
                style={{
                  display: 'flex',
                  gap: 6,
                  justifyContent: 'space-between',
                  color: '#1c2228',
                  fontWeight: g.done ? 700 : 400,
                }}
              >
                <span>
                  {g.icon} {g.label}
                </span>
                <span style={{ color: g.done ? '#2a7a3c' : '#3a4148', whiteSpace: 'nowrap' }}>
                  {g.done ? '✓ ' : ''}
                  {g.value}
                </span>
              </li>
            ))}
          </ul>
        </PixelWindow>

        <PixelWindow
          title={`👥 社員リスト ${employees.length}人`}
          variant="standard"
          bodyStyle={{ padding: 8 }}
        >
          {employees.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: '#6b7684' }}>まだ社員がいません</p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              {employees.slice(0, 6).map((e) => {
                const v = ROLE_VISUAL[e.role] ?? ROLE_VISUAL.programmer;
                return (
                  <li
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{v.emoji}</span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.name}
                    </span>
                    <span style={{ color: v.color, fontSize: 10 }}>{roleLabel(e.role)}</span>
                    <span style={{ color: '#6b7684', fontSize: 10 }}>Lv{e.level}</span>
                  </li>
                );
              })}
              {employees.length > 6 && (
                <li style={{ fontSize: 10, color: '#6b7684' }}>他 {employees.length - 6} 人</li>
              )}
            </ul>
          )}
        </PixelWindow>
      </div>

      {/* ── 右側：経営情報の浮遊小窓（コンパクト） ── */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 48,
          width: 296,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 5,
        }}
      >
        {sellingWorks.length > 0 && (
          <PixelWindow
            title={`📈 販売中 (${sellingWorks.length})`}
            variant="standard"
            bodyStyle={{ padding: 6 }}
          >
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              {sellingWorks.slice(0, 3).map((w) => {
                const pct = (w.salesPool / Math.max(1, w.initialSalesPool)) * 100;
                return (
                  <li key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {w.title}（🎯{w.metascore}）
                    </div>
                    <SegGauge pct={pct} />
                    <div
                      style={{
                        fontSize: 10,
                        color: '#3a4452',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      残{formatYen(w.salesPool)} / 累計{formatYen(w.totalRevenue)}
                    </div>
                  </li>
                );
              })}
              {sellingWorks.length > 3 && (
                <li style={{ fontSize: 10, color: '#6b7684' }}>他 {sellingWorks.length - 3} 本</li>
              )}
            </ul>
          </PixelWindow>
        )}

        {/* 経営：固定費 + 借金を 1 窓に統合 */}
        <PixelWindow
          title="💸 経営"
          variant={debt > 0 ? 'emphasis' : 'standard'}
          bodyStyle={{ padding: 6 }}
        >
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <li>
              固定費 <strong style={{ color: '#cc2f2f' }}>{formatYen(monthlyTotal)}</strong>/月
              <span style={{ marginLeft: 6, color: '#6b7684' }}>
                （人件費 {formatYen(monthlySalaries)} + 賃料 {formatYen(monthlyRent)}
                {monthlyInterest > 0 && ` + 利息 ${formatYen(monthlyInterest)}`}）
              </span>
            </li>
            <li>
              借金{' '}
              <strong style={{ color: debt > 0 ? '#cc2f2f' : '#222a35' }}>{formatYen(debt)}</strong>
              <span style={{ marginLeft: 6, color: '#6b7684' }}>
                / 借入可 {formatYen(borrowingAvailable)}
              </span>
              <PixelButton size="small" onClick={() => setModal('debt')} style={{ marginLeft: 8 }}>
                借入/返済
              </PixelButton>
            </li>
            {lastFixedCost && (
              <li style={{ color: '#6b7684' }}>
                先月 <strong style={{ color: '#cc2f2f' }}>-{formatYen(lastFixedCost.total)}</strong>
              </li>
            )}
          </ul>
        </PixelWindow>
      </div>

      {/* ── CTA：左下に浮くボタン ── */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 112,
          width: 264,
          zIndex: 5,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (employees.length === 0) {
              setModal('hire');
            } else {
              goTo('plan');
            }
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: '#ffd54a',
            color: '#0a1422',
            border: '1px solid #ffd54a',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            imageRendering: 'pixelated',
          }}
        >
          ▶ 新しいゲームを作る
        </button>
        {employees.length === 0 && (
          <p
            style={{
              margin: '4px 0 0',
              padding: '3px 8px',
              fontSize: 10,
              color: '#ffb454',
              background: 'rgba(10,20,34,0.88)',
              border: '1px solid #4a6a9a',
              textAlign: 'center',
            }}
          >
            まず従業員を採用しましょう（↑クリック）
          </p>
        )}
      </div>

      {/* ── dock（タイル型、ティッカーの上） ── */}
      <PixelMenuBar
        items={menuItems}
        style={{ position: 'absolute', bottom: 28, left: 0, right: 0, zIndex: 10 }}
      />

      {/* ── 最下部ティッカー（リファレンス実測 #151c27） ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 10px',
          background: '#151c27',
          borderTop: '1px solid #10151c',
          color: '#e8f0ff',
          fontSize: 11,
          zIndex: 10,
        }}
      >
        {/* 左：再生コントロール風（装飾。時間は常に流れる） */}
        <div style={{ display: 'flex', gap: 2 }}>
          {['⏸', '▶'].map((c) => (
            <span
              key={c}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 18,
                background: '#222c3c',
                border: '1px solid #10151c',
                fontSize: 9,
                color: '#8a96a8',
              }}
            >
              {c}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>次の週まで</span>
          <div style={{ width: 80 }}>
            <SegGauge pct={weekProgress} color="#f5c33e" track="#222c3c" />
          </div>
        </div>
        {trend && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#2f81d6',
                border: '1px solid #10151c',
              }}
            />
            <span>
              今月のトレンド：
              <span style={{ color: '#f5c33e', fontWeight: 700 }}>
                {GENRE_BY_ID[trend.genreId]?.name} × {THEME_BY_ID[trend.themeId]?.name}
              </span>
              が人気！
            </span>
          </div>
        )}
        {/* 右：通知アイコン風 */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, color: '#8a96a8' }}>
          <span>✉ {library.length}</span>
          <span>🏆 {achievements.length}</span>
        </div>
      </div>

      {/* ── 採用モーダル（v0.22：ガチャ） ── */}
      <PixelModal open={modal === 'hire'} onClose={closeModal} title="採用ガチャ" maxWidth={560}>
        {candidate ? (
          <GachaReveal
            key={candidate.id}
            candidate={candidate}
            funds={funds}
            isFull={employees.length >= MAX_EMPLOYEES}
            onHire={() => hireCandidate()}
            onDismiss={() => dismissCandidate()}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* ノーマル：安価・S 無し（序盤の主力） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: '#1c2b45',
                border: '2px solid #0a1422',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f0f3f8' }}>
                  ノーマル採用 <span style={{ color: RANK_VISUAL.A.color }}>A</span> /{' '}
                  <span style={{ color: RANK_VISUAL.B.color }}>B</span>
                </div>
                <div style={{ fontSize: 11, color: '#aab8cc' }}>手頃な人材（S は出ません）</div>
              </div>
              <PixelButton
                variant="primary"
                disabled={funds < normalGachaPrice}
                onClick={() => pullGacha('normal')}
              >
                引く ¥{normalGachaPrice.toLocaleString()}
              </PixelButton>
            </div>

            {/* プレミアム：高額・S 源（中盤以降） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: '#2a2440',
                border: `2px solid ${RANK_VISUAL.S.color}`,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f0f3f8' }}>
                  プレミアム採用 <span style={{ color: RANK_VISUAL.S.color }}>S</span> /{' '}
                  <span style={{ color: RANK_VISUAL.A.color }}>A</span> /{' '}
                  <span style={{ color: RANK_VISUAL.B.color }}>B</span>
                </div>
                <div style={{ fontSize: 11, color: '#aab8cc' }}>
                  高確率で A、稀に S。あと {Math.max(0, premiumPity - gachaPity)} 回で S 確定
                </div>
              </div>
              <PixelButton
                variant="primary"
                disabled={funds < premiumGachaPrice}
                onClick={() => pullGacha('premium')}
              >
                引く ¥{premiumGachaPrice.toLocaleString()}
              </PixelButton>
            </div>
          </div>
        )}

        {employees.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3
              style={{
                fontSize: 13,
                margin: '0 0 8px',
                paddingBottom: 4,
                borderBottom: '2px solid #0a1422',
              }}
            >
              在籍メンバー
            </h3>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {employees.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: '#24395c',
                    border: '2px solid #0a1422',
                    borderRadius: 2,
                  }}
                >
                  {e.rank && (
                    <span
                      className={`gacha-rank-badge gacha-rank-badge--${e.rank}`}
                      style={{ width: 20, height: 20, fontSize: 11 }}
                    >
                      {RANK_VISUAL[e.rank].label}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      background: '#0f1d33',
                      color: '#ffffff',
                      borderRadius: 2,
                    }}
                  >
                    {roleLabel(e.role)}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1, color: '#f0f3f8' }}>
                    {e.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#aab8cc' }}>
                    Lv{e.level}（次まで exp {Math.max(0, nextExpFor(e.level) - e.exp)}）／{' '}
                    {formatPower(e.role, e.power)}
                  </span>
                  <PixelButton size="small" variant="danger" onClick={() => fireEmployee(e.id)}>
                    解雇
                  </PixelButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PixelModal>

      {/* ── 装備モーダル（v0.25 装備システム） ── */}
      <EquipmentModal open={modal === 'equipment'} onClose={closeModal} />

      {/* ── 規模解放モーダル ── */}
      <PixelModal open={modal === 'scale'} onClose={closeModal} title="規模解放" maxWidth={520}>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {SCALES.map((s) => {
            const isUnlocked = unlocked.includes(s.id);
            return (
              <li
                key={s.id}
                style={{
                  padding: '6px 10px',
                  background: isUnlocked ? '#d0e8c0' : '#2e4568',
                  // 濃色（青）背景では色未指定だと黒字継承で不可視になるため明色を明示
                  color: isUnlocked ? '#0a1422' : '#e6ecf5',
                  border: '2px solid #0a1422',
                  borderRadius: 2,
                  fontSize: 13,
                  opacity: isUnlocked ? 1 : 0.85,
                }}
              >
                {isUnlocked ? '✅' : '🔒'} {s.name}（{s.requiredLoC}LoC・最低保証Q
                {s.baseQuality}）{!isUnlocked && ` 解放 ¥${s.unlockCost.toLocaleString()}`}
              </li>
            );
          })}
        </ul>
        {next && (
          <div style={{ marginTop: 12 }}>
            <PixelButton
              variant="primary"
              disabled={funds < next.unlockCost}
              onClick={() => unlockNextScale()}
            >
              「{next.name}」を解放する ¥{next.unlockCost.toLocaleString()}
            </PixelButton>
          </div>
        )}
      </PixelModal>

      {/* ── 実績モーダル（会社サマリ含む） ── */}
      <PixelModal
        open={modal === 'achievements'}
        onClose={closeModal}
        title={`🏆 実績 ${achievements.length}/${ACHIEVEMENTS.length}`}
        maxWidth={560}
      >
        {/* v0.11 L2-3：会社サマリを実績モーダルの先頭に移設 */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            padding: 10,
            marginBottom: 10,
            background: '#24395c',
            // 濃紺背景では色未指定だと黒字継承で不可視になるため明色を明示
            color: '#e6ecf5',
            border: '2px solid #0a1422',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div>
            累計売上: <strong>{formatYen(lifetimeRevenue)}</strong>
          </div>
          <div>
            累計リリース: <strong>{library.length}本</strong>
          </div>
          <div>
            販売中: <strong>{sellingWorks.length}本</strong>
          </div>
          <div>
            最高メタ: <strong>{records.bestMetascore}</strong>
          </div>
          <div>
            最高売上: <strong>{formatYen(records.bestRevenue)}</strong>
          </div>
          <div>
            最高コンボ: <strong>{records.bestCombo}</strong>
          </div>
          <div>
            最高WPM: <strong>{records.bestWPM}</strong>
          </div>
        </section>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {ACHIEVEMENTS.map((a) => {
            const done = achievements.includes(a.id);
            return (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: done ? '#24395c' : '#2e4568',
                  // 濃紺背景では色未指定だと黒字継承で不可視になるため明色を明示
                  color: '#e6ecf5',
                  border: '2px solid #0a1422',
                  borderRadius: 2,
                  opacity: done ? 1 : 0.7,
                }}
              >
                <span style={{ fontSize: 22 }}>{a.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: 13, minWidth: 110 }}>{a.name}</span>
                <span style={{ fontSize: 12, color: '#b3bccb', flex: 1 }}>{a.desc}</span>
              </li>
            );
          })}
        </ul>
      </PixelModal>

      {/* ── 借入 / 返済モーダル（T-24） ── */}
      <PixelModal
        open={modal === 'debt'}
        onClose={closeModal}
        title="🏦 借入 / 返済"
        maxWidth={460}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <li>
              残債: <strong>{formatYen(debt)}</strong>
            </li>
            <li>
              所持金: <strong>{formatYen(funds)}</strong>
            </li>
            <li>
              借入上限: <strong>{formatYen(borrowingLimit)}</strong>（月固定費 × 12）
            </li>
            <li>
              残り借入可能: <strong>{formatYen(borrowingAvailable)}</strong>
            </li>
            <li style={{ fontSize: 11, color: '#6b7684' }}>
              月利 {Math.round(DEBT_CONFIG.monthlyInterestRate * 100)}%（残債に対し毎月発生）
            </li>
          </ul>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>金額（円）</span>
            <input
              type="number"
              min={0}
              value={debtAmountInput}
              onChange={(e) => setDebtAmountInput(e.target.value)}
              style={{
                padding: '4px 6px',
                fontSize: 14,
                fontFamily: 'inherit',
                border: '2px solid #0a1422',
                background: '#0f1d33',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <PixelButton
              variant="primary"
              disabled={
                !debtAmountInput ||
                Number(debtAmountInput) <= 0 ||
                Number(debtAmountInput) > borrowingAvailable
              }
              onClick={() => {
                const n = Number(debtAmountInput);
                if (borrowMoney(n)) setDebtAmountInput('');
              }}
            >
              借入
            </PixelButton>
            <PixelButton
              variant="secondary"
              disabled={!debtAmountInput || Number(debtAmountInput) <= 0 || debt <= 0 || funds <= 0}
              onClick={() => {
                const n = Number(debtAmountInput);
                if (repayDebt(n)) setDebtAmountInput('');
              }}
            >
              返済
            </PixelButton>
          </div>
        </div>
      </PixelModal>

      {/* ── 設定モーダル ── */}
      <PixelModal open={modal === 'settings'} onClose={closeModal} title="設定" maxWidth={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* v0.24：効果音のミュート/音量 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>効果音</span>
              <PixelButton variant="secondary" onClick={() => setMuted(!muted)}>
                {muted ? 'OFF' : 'ON'}
              </PixelButton>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, width: 40 }}>音量</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                disabled={muted}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                style={{ flex: 1, accentColor: '#4a90d9' }}
                aria-label="効果音音量"
              />
              <span style={{ fontSize: 12, width: 36, textAlign: 'right' }}>
                {Math.round(volume * 100)}
              </span>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(0,0,0,0.15)' }} />
          {/* 開発ビルド限定：お金デバッグ（動いているゲームに即反映。localStorage 経由の
              admin/econ と違いタブ上書き問題が起きない） */}
          {import.meta.env.DEV && (
            <div
              style={{
                border: '2px solid #0a1422',
                background: '#eef0d8',
                padding: 10,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
                🛠 デバッグ（開発ビルドのみ）
              </p>

              {/* 所持金 */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#606878' }}>
                  所持金を追加（現在：{formatYen(funds)}）
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: '+¥100万', amt: 1_000_000 },
                    { label: '+¥1000万', amt: 10_000_000 },
                    { label: '+¥1億', amt: 100_000_000 },
                    { label: '+¥10億', amt: 1_000_000_000 },
                  ].map((q) => (
                    <PixelButton
                      key={q.amt}
                      size="small"
                      variant="secondary"
                      onClick={() => useGameStore.setState((s) => ({ funds: s.funds + q.amt }))}
                    >
                      {q.label}
                    </PixelButton>
                  ))}
                </div>
              </div>

              {/* 累計売上（規模解放ゲートはこれで判定。所持金では解放できない） */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#606878' }}>
                  累計売上を追加（規模解放の条件。現在：{formatYen(lifetimeRevenue)}）
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: '+¥1000万', amt: 10_000_000 },
                    { label: '+¥1億', amt: 100_000_000 },
                    { label: '+¥10億', amt: 1_000_000_000 },
                  ].map((q) => (
                    <PixelButton
                      key={q.amt}
                      size="small"
                      variant="secondary"
                      onClick={() =>
                        useGameStore.setState((s) => ({
                          lifetimeRevenue: s.lifetimeRevenue + q.amt,
                        }))
                      }
                    >
                      {q.label}
                    </PixelButton>
                  ))}
                </div>
              </div>

              {/* 規模を強制解放（条件を無視して次の規模を追加） */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#606878' }}>
                  規模解放（条件無視。現在：{currentScale}）
                </p>
                <PixelButton
                  size="small"
                  variant="secondary"
                  disabled={!next}
                  onClick={() =>
                    useGameStore.setState((s) => {
                      const nx = nextLockedScale(s.unlockedScales);
                      return nx ? { unlockedScales: [...s.unlockedScales, nx.id] } : {};
                    })
                  }
                >
                  {next ? `${next.name} を解放` : '全規模解放済み'}
                </PixelButton>
              </div>
            </div>
          )}
          <p style={{ margin: 0, fontSize: 13 }}>
            セーブデータを削除して初期状態に戻します。元には戻せません。
          </p>
          <PixelButton
            variant="danger"
            onClick={() => {
              if (confirm('セーブデータをリセットしますか？')) {
                reset();
                closeModal();
              }
            }}
          >
            セーブをリセット
          </PixelButton>
        </div>
      </PixelModal>

      {/* ── オフィスアップグレード（準備中ティザー） ── */}
      <PixelModal
        open={modal === 'officeUpgrade'}
        onClose={closeModal}
        title="オフィスアップグレード"
        maxWidth={380}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
            color: '#1c2228',
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1 }}>🏢</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>準備中</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            オフィスを拡張・アップグレードできる機能を開発中です。
            <br />
            近日追加予定です！ 🛠️
          </p>
          <PixelButton variant="secondary" onClick={closeModal}>
            とじる
          </PixelButton>
        </div>
      </PixelModal>
    </div>
  );
};
