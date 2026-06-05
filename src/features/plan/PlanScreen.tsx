import { useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { GENRES } from '../../data/genres';
import type { GenreId } from '../../data/genres';
import { THEMES } from '../../data/themes';
import type { ThemeId } from '../../data/themes';
import { SCALES } from '../../data/scales';
import type { Scale } from '../../data/scales';
import { JacketView } from '../../components/JacketView';

export const PlanScreen = () => {
  const startProject = useGameStore((s) => s.startProject);
  const goTo = useGameStore((s) => s.goTo);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const funds = useGameStore((s) => s.funds);
  const employees = useGameStore((s) => s.employees);
  const library = useGameStore((s) => s.library);
  const pendingAdBoost = useGameStore((s) => s.pendingAdBoost);

  const [genreId, setGenreId] = useState<GenreId>(GENRES[0].id);
  const [themeId, setThemeId] = useState<ThemeId>(THEMES[0].id);
  const [scale, setScale] = useState<Scale>('mini');

  return (
    <div className="screen plan-screen">
      <header className="topbar">
        <h1>📐 企画会議</h1>
        <div className="topbar-meta">
          <span>💰 ¥{funds.toLocaleString()}</span>
          <span>👥 {employees}人</span>
          <span>📚 {library.length}本</span>
          <button className="link-btn" onClick={() => goTo('office')}>オフィスへ</button>
          <button className="link-btn" onClick={() => goTo('library')}>ライブラリ</button>
        </div>
      </header>

      <section className="card">
        <h2>ジャンルを選ぶ</h2>
        <div className="chip-row">
          {GENRES.map((g) => (
            <button
              key={g.id}
              className={`chip ${genreId === g.id ? 'selected' : ''}`}
              onClick={() => setGenreId(g.id)}
            >
              {g.emoji} {g.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>テーマを選ぶ</h2>
        <div className="chip-row">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`chip ${themeId === t.id ? 'selected' : ''}`}
              onClick={() => setThemeId(t.id)}
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>規模を選ぶ</h2>
        <div className="chip-row">
          {SCALES.map((s) => {
            const isUnlocked = unlocked.includes(s.id);
            return (
              <button
                key={s.id}
                className={`chip ${scale === s.id ? 'selected' : ''}`}
                disabled={!isUnlocked}
                onClick={() => setScale(s.id)}
                title={isUnlocked ? '' : 'オフィスで解放してください'}
              >
                {s.name}（{s.requiredLoC}LoC）{isUnlocked ? '' : '🔒'}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card plan-preview">
        <h2>企画プレビュー</h2>
        <div className="plan-preview-body">
          <JacketView genreId={genreId} themeId={themeId} size="md" />
          <div>
            <p>※相性は完成後に判明します（隠しパラメータ）</p>
            {pendingAdBoost && (
              <p className="ad-active">📺 広告ブースト適用予定（次の開発で自動進行+0.5/秒）</p>
            )}
          </div>
        </div>
        <button
          className="primary-btn"
          onClick={() => startProject(genreId, themeId, scale)}
        >
          ▶ 開発開始
        </button>
      </section>
    </div>
  );
};
