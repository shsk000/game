import { ACHIEVEMENTS } from '../../data/achievements';
import { REFRESH_COST, roleLabel } from '../../data/employees';
import { nextLockedScale, SCALES } from '../../data/scales';
import { useGameStore } from '../../state/gameStore';

const formatPower = (role: string, power: number) => {
  if (role === 'programmer') return `+${power.toFixed(1)} LoC/秒`;
  if (role === 'designer') return `品質基礎 +${power}`;
  return `売上 +${power}%`;
};

export const OfficeScreen = () => {
  const funds = useGameStore((s) => s.funds);
  const lifetimeRevenue = useGameStore((s) => s.lifetimeRevenue);
  const fans = useGameStore((s) => s.fans);
  const employees = useGameStore((s) => s.employees);
  const candidate = useGameStore((s) => s.candidate);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const library = useGameStore((s) => s.library);
  const records = useGameStore((s) => s.records);
  const achievements = useGameStore((s) => s.achievements);
  const hireCandidate = useGameStore((s) => s.hireCandidate);
  const refreshCandidate = useGameStore((s) => s.refreshCandidate);
  const fireEmployee = useGameStore((s) => s.fireEmployee);
  const unlockNextScale = useGameStore((s) => s.unlockNextScale);
  const goTo = useGameStore((s) => s.goTo);
  const reset = useGameStore((s) => s.reset);

  const next = nextLockedScale(unlocked);
  const sellingWorks = library.filter((w) => w.selling);

  return (
    <div className="screen office-screen">
      <header className="topbar">
        <h1>🏢 オフィス</h1>
        <div className="topbar-meta">
          <span>💰 ¥{funds.toLocaleString()}</span>
          <span>👥 ファン {fans.toLocaleString()}</span>
          <span>🧑‍💻 {employees.length}人</span>
          <span>📚 {library.length}本</span>
          <button className="link-btn" onClick={() => goTo('library')}>
            ライブラリ
          </button>
          <button className="link-btn" onClick={() => goTo('collection')}>
            図鑑
          </button>
        </div>
      </header>

      <section className="card">
        <h2>会社サマリ</h2>
        <ul className="release-stats">
          <li>累計売上: ¥{lifetimeRevenue.toLocaleString()}</li>
          <li>累計リリース: {library.length}本</li>
          <li>販売中: {sellingWorks.length}本</li>
          <li>最高メタスコア: {records.bestMetascore}</li>
          <li>最高売上: ¥{records.bestRevenue.toLocaleString()}</li>
          <li>最高コンボ: {records.bestCombo}</li>
          <li>最高WPM: {records.bestWPM}</li>
        </ul>
      </section>

      {sellingWorks.length > 0 && (
        <section className="card">
          <h2>📈 販売中の作品</h2>
          <ul className="selling-list">
            {sellingWorks.slice(0, 5).map((w) => {
              const pct = (w.salesPool / Math.max(1, w.initialSalesPool)) * 100;
              return (
                <li key={w.id} className="selling-item">
                  <div className="selling-title">
                    {w.title}（🎯{w.metascore}）
                  </div>
                  <div className="selling-bar">
                    <div className="selling-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="selling-meta">
                    残¥{Math.round(w.salesPool).toLocaleString()} / 累計¥
                    {w.totalRevenue.toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
          {sellingWorks.length > 5 && <p className="hint">他 {sellingWorks.length - 5} 本販売中</p>}
        </section>
      )}

      <section className="card">
        <h2>採用</h2>
        {candidate ? (
          <div className="candidate-card">
            <div className="candidate-row">
              <span className="candidate-name">{candidate.name}</span>
              <span className={`candidate-role role-${candidate.role}`}>
                {roleLabel(candidate.role)}
              </span>
            </div>
            <div className="candidate-power">{formatPower(candidate.role, candidate.power)}</div>
            <div className="candidate-actions">
              <button
                className="primary-btn"
                disabled={funds < candidate.wage}
                onClick={() => hireCandidate()}
              >
                採用 ¥{candidate.wage.toLocaleString()}
              </button>
              <button
                className="link-btn"
                disabled={funds < REFRESH_COST}
                onClick={() => refreshCandidate()}
              >
                別の候補 ¥{REFRESH_COST}
              </button>
            </div>
          </div>
        ) : (
          <p className="hint">候補がいません</p>
        )}

        {employees.length > 0 && (
          <div className="employees">
            <h3 className="sub-h">在籍メンバー</h3>
            <ul className="employee-list">
              {employees.map((e) => (
                <li key={e.id} className="employee-item">
                  <span className={`role-tag role-${e.role}`}>{roleLabel(e.role)}</span>
                  <span className="employee-name">{e.name}</span>
                  <span className="employee-power">{formatPower(e.role, e.power)}</span>
                  <button className="link-btn danger small" onClick={() => fireEmployee(e.id)}>
                    解雇
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2>規模解放</h2>
        <ul className="scale-list">
          {SCALES.map((s) => {
            const isUnlocked = unlocked.includes(s.id);
            return (
              <li key={s.id} className={isUnlocked ? 'unlocked' : 'locked'}>
                {isUnlocked ? '✅' : '🔒'} {s.name}（{s.requiredLoC}LoC・最低保証Q{s.baseQuality}）
                {!isUnlocked && ` 解放 ¥${s.unlockCost.toLocaleString()}`}
              </li>
            );
          })}
        </ul>
        {next && (
          <button
            className="primary-btn"
            disabled={funds < next.unlockCost}
            onClick={() => unlockNextScale()}
          >
            「{next.name}」を解放する ¥{next.unlockCost.toLocaleString()}
          </button>
        )}
      </section>

      <section className="card">
        <h2>
          🏆 実績 {achievements.length}/{ACHIEVEMENTS.length}
        </h2>
        <ul className="ach-list">
          {ACHIEVEMENTS.map((a) => {
            const done = achievements.includes(a.id);
            return (
              <li key={a.id} className={`ach-item ${done ? 'done' : 'todo'}`}>
                <span className="ach-emoji">{a.emoji}</span>
                <span className="ach-name">{a.name}</span>
                <span className="ach-desc">{a.desc}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <button className="primary-btn" onClick={() => goTo('plan')}>
          ▶ 新規開発へ
        </button>
        <button
          className="link-btn danger"
          onClick={() => {
            if (confirm('セーブデータをリセットしますか？')) reset();
          }}
        >
          セーブをリセット
        </button>
      </section>
    </div>
  );
};
