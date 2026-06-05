import { useGameStore, HIRE_EMPLOYEE_COST } from '../../state/gameStore';
import { nextLockedScale, SCALES } from '../../data/scales';

export const OfficeScreen = () => {
  const funds = useGameStore((s) => s.funds);
  const lifetimeRevenue = useGameStore((s) => s.lifetimeRevenue);
  const fans = useGameStore((s) => s.fans);
  const employees = useGameStore((s) => s.employees);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const library = useGameStore((s) => s.library);
  const records = useGameStore((s) => s.records);
  const pendingAdBoost = useGameStore((s) => s.pendingAdBoost);
  const hireEmployee = useGameStore((s) => s.hireEmployee);
  const unlockNextScale = useGameStore((s) => s.unlockNextScale);
  const buyAdBoost = useGameStore((s) => s.buyAdBoost);
  const goTo = useGameStore((s) => s.goTo);
  const reset = useGameStore((s) => s.reset);

  const next = nextLockedScale(unlocked);

  return (
    <div className="screen office-screen">
      <header className="topbar">
        <h1>🏢 オフィス</h1>
        <div className="topbar-meta">
          <span>💰 ¥{funds.toLocaleString()}</span>
          <span>👥 ファン {fans.toLocaleString()}</span>
          <span>🧑‍💻 {employees}人</span>
          <span>📚 {library.length}本</span>
          <button className="link-btn" onClick={() => goTo('library')}>ライブラリ</button>
          <button className="link-btn" onClick={() => goTo('collection')}>図鑑</button>
        </div>
      </header>

      <section className="card">
        <h2>会社サマリ</h2>
        <ul className="release-stats">
          <li>累計売上: ¥{lifetimeRevenue.toLocaleString()}</li>
          <li>累計リリース: {library.length}本</li>
          <li>最高メタスコア: {records.bestMetascore}</li>
          <li>最高売上: ¥{records.bestRevenue.toLocaleString()}</li>
          <li>最高コンボ: {records.bestCombo}</li>
          <li>最高WPM: {records.bestWPM}</li>
        </ul>
      </section>

      <section className="card">
        <h2>人材確保</h2>
        <p>社員1人につき自動生産 +0.5 LoC/秒</p>
        <button
          className="primary-btn"
          disabled={funds < HIRE_EMPLOYEE_COST}
          onClick={() => hireEmployee()}
        >
          社員を雇う ¥{HIRE_EMPLOYEE_COST.toLocaleString()}
        </button>
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
        <h2>📺 広告（モック）</h2>
        <p>広告を見ると次の開発で +0.5 LoC/秒の自動生産が乗ります。</p>
        <button
          className="primary-btn"
          disabled={pendingAdBoost}
          onClick={() => buyAdBoost()}
        >
          {pendingAdBoost ? '次の開発に適用予定' : '広告を見る（モック）：次の開発を加速'}
        </button>
      </section>

      <section className="card">
        <button className="primary-btn" onClick={() => goTo('plan')}>
          ▶ 新規開発へ
        </button>
        <button className="link-btn danger" onClick={() => {
          if (confirm('セーブデータをリセットしますか？')) reset();
        }}>
          セーブをリセット
        </button>
      </section>
    </div>
  );
};
