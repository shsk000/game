import { useState, useEffect } from 'react';
import { useGameStore } from '../../state/gameStore';
import { GENRES, GENRE_BY_ID } from '../../data/genres';
import type { GenreId } from '../../data/genres';
import { THEMES, THEME_BY_ID } from '../../data/themes';
import type { ThemeId } from '../../data/themes';
import { SCALES } from '../../data/scales';
import type { Scale } from '../../data/scales';
import { JacketView } from '../../components/JacketView';
import { trendLabel } from '../../data/trend';

export const PlanScreen = () => {
  const startProject = useGameStore((s) => s.startProject);
  const goTo = useGameStore((s) => s.goTo);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const unlockedGenres = useGameStore((s) => s.unlockedGenres);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);
  const funds = useGameStore((s) => s.funds);
  const fans = useGameStore((s) => s.fans);
  const employees = useGameStore((s) => s.employees);
  const library = useGameStore((s) => s.library);
  const pendingAdBoost = useGameStore((s) => s.pendingAdBoost);
  const trend = useGameStore((s) => s.trend);
  const offlineReport = useGameStore((s) => s.offlineReport);
  const clearOfflineReport = useGameStore((s) => s.clearOfflineReport);

  const firstGenre = (unlockedGenres[0] ?? GENRES[0].id) as GenreId;
  const firstTheme = (unlockedThemes[0] ?? THEMES[0].id) as ThemeId;

  const [genreId, setGenreId] = useState<GenreId>(firstGenre);
  const [themeId, setThemeId] = useState<ThemeId>(firstTheme);
  const [scale, setScale] = useState<Scale>('mini');

  useEffect(() => {
    if (!unlockedGenres.includes(genreId)) setGenreId(unlockedGenres[0] as GenreId);
  }, [unlockedGenres, genreId]);
  useEffect(() => {
    if (!unlockedThemes.includes(themeId)) setThemeId(unlockedThemes[0] as ThemeId);
  }, [unlockedThemes, themeId]);

  const isTrendyGenre = trend && trend.genreId === genreId;
  const isTrendyTheme = trend && trend.themeId === themeId;

  return (
    <div className="screen plan-screen">
      <header className="topbar">
        <h1>📐 企画会議</h1>
        <div className="topbar-meta">
          <span>💰 ¥{funds.toLocaleString()}</span>
          <span>👥 ファン {fans.toLocaleString()}</span>
          <span>🧑‍💻 {employees}人</span>
          <span>📚 {library.length}本</span>
          <button className="link-btn" onClick={() => goTo('office')}>オフィスへ</button>
          <button className="link-btn" onClick={() => goTo('library')}>ライブラリ</button>
          <button className="link-btn" onClick={() => goTo('collection')}>図鑑</button>
        </div>
      </header>

      {offlineReport && (
        <section className="card offline-card">
          <h2>📬 おかえりなさい</h2>
          <p>
            離席中（{Math.round(offlineReport.awaySec / 60)}分）にファンが
            ¥{offlineReport.earned.toLocaleString()} を運んできました。
          </p>
          <button className="link-btn" onClick={clearOfflineReport}>受け取った（閉じる）</button>
        </section>
      )}

      <section className="card trend-card">
        <h2>📈 今月のトレンド</h2>
        <p className="trend-text">{trend ? trendLabel(trend) : '—'}</p>
        <p className="hint">合致 ×1.3（片方）／ ×1.7（両方）の売上ブースト</p>
      </section>

      <section className="card">
        <h2>ジャンルを選ぶ</h2>
        <div className="chip-row">
          {GENRES.map((g) => {
            const isUnlocked = unlockedGenres.includes(g.id);
            const hot = trend?.genreId === g.id;
            return (
              <button
                key={g.id}
                className={`chip ${genreId === g.id ? 'selected' : ''} ${hot ? 'hot' : ''}`}
                disabled={!isUnlocked}
                onClick={() => setGenreId(g.id)}
                title={isUnlocked ? '' : 'リリースを重ねると解放されます'}
              >
                {g.emoji} {g.name} {hot && '🔥'} {!isUnlocked && '🔒'}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>テーマを選ぶ</h2>
        <div className="chip-row">
          {THEMES.map((t) => {
            const isUnlocked = unlockedThemes.includes(t.id);
            const hot = trend?.themeId === t.id;
            return (
              <button
                key={t.id}
                className={`chip ${themeId === t.id ? 'selected' : ''} ${hot ? 'hot' : ''}`}
                disabled={!isUnlocked}
                onClick={() => setThemeId(t.id)}
                title={isUnlocked ? '' : 'リリースを重ねると解放されます'}
              >
                {t.emoji} {t.name} {hot && '🔥'} {!isUnlocked && '🔒'}
              </button>
            );
          })}
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
            <p>
              {GENRE_BY_ID[genreId].name} × {THEME_BY_ID[themeId].name}
              {(isTrendyGenre || isTrendyTheme) && (
                <span className="trend-hit"> 🔥 トレンド合致！</span>
              )}
            </p>
            <p className="hint">※相性は完成後に判明します（隠しパラメータ）</p>
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
