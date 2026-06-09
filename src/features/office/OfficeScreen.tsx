import { useState } from 'react';
import { OfficeView } from '../../components/OfficeView';
import {
  PixelButton,
  PixelMenuBar,
  type PixelMenuItem,
  PixelModal,
  PixelStatusBar,
  PixelWindow,
} from '../../components/ui';
import { ACHIEVEMENTS } from '../../data/achievements';
import { DEBT_CONFIG, computeBorrowingLimit } from '../../data/balance';
import { REFRESH_COST, roleLabel, sumMonthlySalaries } from '../../data/employees';
import { nextLockedScale, SCALE_BY_ID, SCALES } from '../../data/scales';
import { useGameStore } from '../../state/gameStore';
import { formatYen } from '../../utils/format';

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

type ModalKind = 'hire' | 'scale' | 'achievements' | 'settings' | 'debt' | null;

const formatPower = (role: string, power: number) => {
  if (role === 'programmer') return `+${power.toFixed(1)} LoC/秒`;
  if (role === 'designer') return `品質基礎 +${power}`;
  return `売上 +${power}%`;
};

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
  const refreshCandidate = useGameStore((s) => s.refreshCandidate);
  const fireEmployee = useGameStore((s) => s.fireEmployee);
  const unlockNextScale = useGameStore((s) => s.unlockNextScale);
  const borrowMoney = useGameStore((s) => s.borrowMoney);
  const repayDebt = useGameStore((s) => s.repayDebt);
  const goTo = useGameStore((s) => s.goTo);
  const reset = useGameStore((s) => s.reset);

  const [modal, setModal] = useState<ModalKind>(null);
  const [debtAmountInput, setDebtAmountInput] = useState<string>('');
  const closeModal = () => setModal(null);

  const next = nextLockedScale(unlocked);
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
      id: 'settings',
      label: '設定',
      emoji: '⚙️',
      iconSrc: `${ICON_BASE}/icon_settings.png`,
      onClick: () => setModal('settings'),
    },
  ];

  return (
    <div className="screen office-screen" style={{ gap: 0 }}>
      <PixelStatusBar />

      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '760px 460px',
          gap: 12,
          padding: 12,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* 左パネル：オフィスビュー 760×580 */}
        <PixelWindow
          title="🏠 オフィス"
          variant="standard"
          bodyStyle={{ padding: 8, height: '100%', display: 'flex' }}
          style={{ height: '100%' }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#1a0f08',
              padding: 8,
              overflow: 'hidden',
            }}
          >
            <OfficeView scale={currentScale} employeeCount={employees.length} />
          </div>
        </PixelWindow>

        {/* 右パネル：経営情報 3 枠（販売中 / 月固定費 / 借金）460×580 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            height: '100%',
            minHeight: 0,
          }}
        >
          {/* 販売中の作品（高さ 240px、3 件まで表示） */}
          <PixelWindow
            title={`📈 販売中の作品 (${sellingWorks.length})`}
            variant="standard"
            bodyStyle={{ padding: 8 }}
            style={{ flex: '0 0 auto', height: 240, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {sellingWorks.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#6b4f3a' }}>
                  販売中の作品はありません
                </p>
              ) : (
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
                  {sellingWorks.slice(0, 3).map((w) => {
                    const pct = (w.salesPool / Math.max(1, w.initialSalesPool)) * 100;
                    return (
                      <li key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>
                          {w.title}（🎯{w.metascore}）
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: '#1a0f08',
                            border: '2px solid #2c1f15',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: '#5aa84a',
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: '#3a2a1e',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          残{formatYen(w.salesPool)} / 累計{formatYen(w.totalRevenue)}
                        </div>
                      </li>
                    );
                  })}
                  {sellingWorks.length > 3 && (
                    <li style={{ fontSize: 10, color: '#6b4f3a' }}>
                      他 {sellingWorks.length - 3} 本販売中
                    </li>
                  )}
                </ul>
              )}
            </div>
          </PixelWindow>

          {/* v0.10：月固定費パネル＋先月の収支 */}
          <PixelWindow
            title="💸 月々の固定費"
            variant="emphasis"
            bodyStyle={{ padding: 8 }}
            style={{ flex: '0 0 auto' }}
          >
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <li>
                人件費（{employees.length}人）: <strong>{formatYen(monthlySalaries)}</strong>/月
              </li>
              <li>
                オフィス賃料（{currentScaleDef.name}）: <strong>{formatYen(monthlyRent)}</strong>/月
              </li>
              {monthlyInterest > 0 && (
                <li>
                  借金月利（{Math.round(DEBT_CONFIG.monthlyInterestRate * 100)}%）:{' '}
                  <strong>{formatYen(monthlyInterest)}</strong>/月
                </li>
              )}
              <li
                style={{
                  marginTop: 4,
                  paddingTop: 4,
                  borderTop: '2px solid #2c1f15',
                  fontWeight: 700,
                }}
              >
                合計: <strong style={{ color: '#a02828' }}>{formatYen(monthlyTotal)}</strong>/月
              </li>
              <li style={{ marginTop: 6, fontSize: 12, color: '#6b4f3a' }}>
                先月の収支:{' '}
                {lastFixedCost ? (
                  <strong style={{ color: '#a02828' }}>-{formatYen(lastFixedCost.total)}</strong>
                ) : (
                  <span>—（まだ月初を迎えていません）</span>
                )}
              </li>
            </ul>
          </PixelWindow>

          {/* 借金パネル */}
          <PixelWindow
            title="🏦 借金"
            variant={debt > 0 ? 'emphasis' : 'standard'}
            bodyStyle={{ padding: 8 }}
            style={{ flex: '0 0 auto' }}
          >
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <li>
                残債:{' '}
                <strong style={{ color: debt > 0 ? '#a02828' : '#3a2a1e' }}>
                  {formatYen(debt)}
                </strong>
                <span style={{ marginLeft: 8, fontSize: 11, color: '#6b4f3a' }}>
                  / 上限 {formatYen(borrowingLimit)}
                </span>
              </li>
              <li>
                月利息: <strong>{formatYen(monthlyInterest)}</strong>/月
                <span style={{ marginLeft: 8, fontSize: 11, color: '#6b4f3a' }}>
                  借入可 {formatYen(borrowingAvailable)}
                </span>
              </li>
              <li style={{ marginTop: 4 }}>
                <PixelButton size="small" onClick={() => setModal('debt')}>
                  借入 / 返済
                </PixelButton>
              </li>
            </ul>
          </PixelWindow>
        </div>
      </main>

      <PixelMenuBar items={menuItems} />

      {/* ── 採用モーダル ── */}
      <PixelModal open={modal === 'hire'} onClose={closeModal} title="採用" maxWidth={560}>
        {candidate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16 }}>{candidate.name}</span>
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  background: '#3a2a1e',
                  color: '#fff8e0',
                  borderRadius: 2,
                }}
              >
                {roleLabel(candidate.role)}
              </span>
            </div>
            <div style={{ fontSize: 13 }}>{formatPower(candidate.role, candidate.power)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PixelButton
                variant="primary"
                disabled={funds < candidate.wage}
                onClick={() => hireCandidate()}
              >
                採用 ¥{candidate.wage.toLocaleString()}
              </PixelButton>
              <PixelButton
                variant="secondary"
                disabled={funds < REFRESH_COST}
                onClick={() => refreshCandidate()}
              >
                別の候補 ¥{REFRESH_COST}
              </PixelButton>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13 }}>候補がいません</p>
        )}

        {employees.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3
              style={{
                fontSize: 13,
                margin: '0 0 8px',
                paddingBottom: 4,
                borderBottom: '2px solid #2c1f15',
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
                    background: '#fff4d0',
                    border: '2px solid #2c1f15',
                    borderRadius: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      background: '#3a2a1e',
                      color: '#fff8e0',
                      borderRadius: 2,
                    }}
                  >
                    {roleLabel(e.role)}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: '#3a2a1e' }}>
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
                  background: isUnlocked ? '#d0e8c0' : '#e8d8b0',
                  border: '2px solid #2c1f15',
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
            background: '#fff4d0',
            border: '2px solid #2c1f15',
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
                  background: done ? '#fff4d0' : '#e8d8b0',
                  border: '2px solid #2c1f15',
                  borderRadius: 2,
                  opacity: done ? 1 : 0.7,
                }}
              >
                <span style={{ fontSize: 22 }}>{a.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: 13, minWidth: 110 }}>{a.name}</span>
                <span style={{ fontSize: 12, color: '#3a2a1e', flex: 1 }}>{a.desc}</span>
              </li>
            );
          })}
        </ul>
      </PixelModal>

      {/* ── 借入 / 返済モーダル（T-24） ── */}
      <PixelModal open={modal === 'debt'} onClose={closeModal} title="🏦 借入 / 返済" maxWidth={460}>
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
            <li>残債: <strong>{formatYen(debt)}</strong></li>
            <li>所持金: <strong>{formatYen(funds)}</strong></li>
            <li>借入上限: <strong>{formatYen(borrowingLimit)}</strong>（月固定費 × 12）</li>
            <li>残り借入可能: <strong>{formatYen(borrowingAvailable)}</strong></li>
            <li style={{ fontSize: 11, color: '#6b4f3a' }}>
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
                border: '2px solid #2c1f15',
                background: '#fff8e0',
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
              disabled={
                !debtAmountInput ||
                Number(debtAmountInput) <= 0 ||
                debt <= 0 ||
                funds <= 0
              }
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
    </div>
  );
};
