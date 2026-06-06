import { useEffect, useMemo, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { JacketView } from '../../components/JacketView';
import { Tutorial } from '../../components/Tutorial';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import type { CategoryId } from '../../data/categories';
import { CATEGORIES, CATEGORY_BY_ID, categoryAffinity } from '../../data/categories';
import { compatLabel, getCompat } from '../../data/compatibility';
import type { GenreId } from '../../data/genres';
import { GENRE_BY_ID, GENRES } from '../../data/genres';
import type { Scale } from '../../data/scales';
import { SCALES } from '../../data/scales';
import type { ThemeId } from '../../data/themes';
import { THEME_BY_ID, THEMES } from '../../data/themes';
import { trendLabel } from '../../data/trend';
import { useGameStore } from '../../state/gameStore';

export const PlanScreen = () => {
  const startProject = useGameStore((s) => s.startProject);
  const goTo = useGameStore((s) => s.goTo);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const unlockedGenres = useGameStore((s) => s.unlockedGenres);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);
  const unlockedCategories = useGameStore((s) => s.unlockedCategories);
  const funds = useGameStore((s) => s.funds);
  const fans = useGameStore((s) => s.fans);
  const employees = useGameStore((s) => s.employees);
  const library = useGameStore((s) => s.library);
  const trend = useGameStore((s) => s.trend);
  const offlineReport = useGameStore((s) => s.offlineReport);
  const clearOfflineReport = useGameStore((s) => s.clearOfflineReport);
  const newlyAchieved = useGameStore((s) => s.newlyAchieved);
  const clearNewlyAchieved = useGameStore((s) => s.clearNewlyAchieved);
  const tutorialDone = useGameStore((s) => s.tutorialDone);

  const firstGenre = (unlockedGenres[0] ?? GENRES[0].id) as GenreId;
  const firstTheme = (unlockedThemes[0] ?? THEMES[0].id) as ThemeId;

  const [genreId, setGenreId] = useState<GenreId>(firstGenre);
  const [themeId, setThemeId] = useState<ThemeId>(firstTheme);
  const [scale, setScale] = useState<Scale>('mini');
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([]);
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);
  const [surveyedCompat, setSurveyedCompat] = useState<number | null>(null);
  const [adRunning, setAdRunning] = useState(false);

  useEffect(() => {
    if (!unlockedGenres.includes(genreId)) setGenreId(unlockedGenres[0] as GenreId);
  }, [unlockedGenres, genreId]);
  useEffect(() => {
    if (!unlockedThemes.includes(themeId)) setThemeId(unlockedThemes[0] as ThemeId);
  }, [unlockedThemes, themeId]);

  useEffect(() => {
    setSurveyedCompat(null);
  }, [genreId, themeId]);

  // 解放外カテゴリが選択に残っていたら除去
  useEffect(() => {
    setSelectedCategories((prev) => prev.filter((id) => unlockedCategories.includes(id)));
  }, [unlockedCategories]);

  // 退職などで存在しなくなった従業員が割当に残っていたら除去
  useEffect(() => {
    setAssignedEmployeeIds((prev) => prev.filter((id) => employees.some((e) => e.id === id)));
  }, [employees]);

  const isTrendyGenre = trend && trend.genreId === genreId;
  const isTrendyTheme = trend && trend.themeId === themeId;

  const pioneer = !library.some((w) => w.genreId === genreId && w.themeId === themeId);
  const sellingCount = library.filter((w) => w.selling).length;

  const categoryHitTotal = useMemo(() => {
    return selectedCategories.reduce((sum, cid) => {
      const cat = CATEGORY_BY_ID[cid];
      if (!cat) return sum;
      return sum + categoryAffinity(cat, genreId, themeId);
    }, 0);
  }, [selectedCategories, genreId, themeId]);

  const toggleCategory = (id: CategoryId) => {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const toggleEmployee = (id: string) => {
    setAssignedEmployeeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSurvey = () => {
    if (adRunning) return;
    setAdRunning(true);
    ads.showRewarded({
      label: 'survey',
      onComplete: () => {
        setSurveyedCompat(getCompat(genreId, themeId));
        setAdRunning(false);
      },
      onFail: () => setAdRunning(false),
    });
  };

  const canStart = selectedCategories.length === 3 && assignedEmployeeIds.length >= 1;

  const handleStart = () => {
    if (!canStart) return;
    startProject(genreId, themeId, scale, selectedCategories, assignedEmployeeIds);
  };

  return (
    <div className="screen plan-screen">
      <header className="topbar">
        <h1>📐 企画会議</h1>
        <div className="topbar-meta">
          <span>💰 ¥{funds.toLocaleString()}</span>
          <span>👥 ファン {fans.toLocaleString()}</span>
          <span>🧑‍💻 {employees.length}人</span>
          <span>📚 {library.length}本</span>
          {sellingCount > 0 && <span>📈 販売中 {sellingCount}本</span>}
          <button className="link-btn" onClick={() => goTo('office')}>
            オフィスへ
          </button>
          <button className="link-btn" onClick={() => goTo('library')}>
            ライブラリ
          </button>
          <button className="link-btn" onClick={() => goTo('collection')}>
            図鑑
          </button>
        </div>
      </header>

      {offlineReport && (
        <section className="card offline-card">
          <h2>📬 おかえりなさい</h2>
          <p>
            離席中（{Math.round(offlineReport.awaySec / 60)}分）にファンが ¥
            {offlineReport.earned.toLocaleString()} を運んできました。
          </p>
          <button className="link-btn" onClick={clearOfflineReport}>
            受け取った（閉じる）
          </button>
        </section>
      )}

      {newlyAchieved.length > 0 && (
        <section className="card achievement-toast">
          <h2>🏆 実績解除！</h2>
          <ul>
            {newlyAchieved.map((id) => {
              const def = ACHIEVEMENT_BY_ID[id];
              return (
                <li key={id}>
                  {def.emoji} <strong>{def.name}</strong> — {def.desc}
                </li>
              );
            })}
          </ul>
          <button className="link-btn" onClick={clearNewlyAchieved}>
            閉じる
          </button>
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

      <section className="card">
        <h2>
          開発カテゴリを選ぶ <span className="cat-meta">選択 {selectedCategories.length}/3</span>
        </h2>
        <div className="chip-row">
          {CATEGORIES.filter((c) => unlockedCategories.includes(c.id)).map((c) => {
            const isSelected = selectedCategories.includes(c.id);
            const reachedMax = selectedCategories.length >= 3 && !isSelected;
            return (
              <button
                key={c.id}
                data-category-id={c.id}
                className={`chip ${isSelected ? 'selected' : ''}`}
                disabled={reachedMax}
                onClick={() => toggleCategory(c.id)}
                title={reachedMax ? '3つまで選択できます' : ''}
              >
                {c.emoji} {c.name}
              </button>
            );
          })}
        </div>
        <p className="hint">
          相性合計（推定）: <strong>{categoryHitTotal}</strong>
        </p>
      </section>

      <section className="card">
        <h2>
          従業員アサイン <span className="cat-meta">アサイン {assignedEmployeeIds.length}/3</span>
        </h2>
        {employees.length === 0 ? (
          <p className="hint">オフィスで従業員を雇うとアサインできます。</p>
        ) : (
          <ul className="assign-list">
            {employees.map((e) => {
              const isAssigned = assignedEmployeeIds.includes(e.id);
              const reachedMax = assignedEmployeeIds.length >= 3 && !isAssigned;
              const roleLabel =
                e.role === 'programmer'
                  ? 'プログラマー'
                  : e.role === 'designer'
                    ? 'デザイナー'
                    : '広報';
              return (
                <li key={e.id} className={`assign-item ${isAssigned ? 'selected' : ''}`}>
                  <label>
                    <input
                      type="checkbox"
                      data-employee-id={e.id}
                      checked={isAssigned}
                      disabled={reachedMax}
                      onChange={() => toggleEmployee(e.id)}
                    />
                    <span>
                      <strong>{e.name}</strong>{' '}
                      <span className="cat-meta">
                        {roleLabel} ／ power {e.power}
                      </span>
                    </span>
                    {e.specialties.length > 0 && (
                      <span className="cat-meta">
                        {e.specialties
                          .map((sp) => `${CATEGORY_BY_ID[sp.categoryId]?.emoji ?? ''}+${sp.bonus}`)
                          .join(' ')}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
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
            {pioneer && <p className="pioneer-pill">🌱 新規開拓ボーナス +30%</p>}
            <p className="hint">※相性は完成後に判明します（隠しパラメータ）</p>
            <p className="hint">
              選択カテゴリ × ジャンル/テーマ 相性合計: <strong>{categoryHitTotal}</strong>
            </p>
            <div className="survey-row">
              {surveyedCompat !== null ? (
                <p style={{ color: 'var(--warn)' }}>
                  相性: {compatLabel(surveyedCompat)} ({surveyedCompat.toFixed(2)}x)
                </p>
              ) : (
                <button className="link-btn" onClick={handleSurvey} disabled={adRunning}>
                  {adRunning ? '広告再生中…' : '📺 市場調査（広告で相性を一部開示）'}
                </button>
              )}
            </div>
          </div>
        </div>
        <button className="primary-btn" onClick={handleStart} disabled={!canStart}>
          ▶ 開発開始
        </button>
        {!canStart && (
          <p className="hint">※ カテゴリを3つ選び、従業員を1人以上アサインしてください。</p>
        )}
      </section>

      {!tutorialDone && <Tutorial />}
    </div>
  );
};
