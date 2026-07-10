import { useEffect, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { JacketView } from '../../components/JacketView';
import { Tutorial } from '../../components/Tutorial';
import { PixelButton, PixelWindow } from '../../components/ui';
import { bugSuppression } from '../../core/bugs';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import { planWeeksAllowance, ROLE_EFFECT } from '../../data/balance';
import { compatLabel, getCompat } from '../../data/compatibility';
import { sumMonthlySalaries } from '../../data/employees';
import type { GenreId } from '../../data/genres';
import { GENRE_BY_ID, GENRES } from '../../data/genres';
import type { Scale } from '../../data/scales';
import { SCALE_BY_ID, SCALES } from '../../data/scales';
import type { ThemeId } from '../../data/themes';
import { THEME_BY_ID, THEMES } from '../../data/themes';
import { generateTitle } from '../../data/titleGenerator';
import { trendLabel } from '../../data/trend';
import { useGameStore } from '../../state/gameStore';
import { estimateRevenueRange, formatWeeks, formatYen } from '../../utils/format';
import { computeProfit } from '../../utils/profit';

/**
 * 企画会議画面：ピクセルアート UI 版。
 *
 * SKILL `game-ui-design` に従い、すべての UI を PixelWindow / PixelButton /
 * PixelMenuBar / PixelStatusBar / PixelModal の組合せで構成する。
 *
 * 構造：
 *   ┌─ PixelStatusBar（資金・ファン等。上部固定）
 *   ├─ メインスクロール領域
 *   │   ├ タイトル PixelWindow（emphasis）
 *   │   ├ オフラインレポート / 実績解除（条件付・emphasis）
 *   │   ├ トレンド・ジャンル・テーマ・規模・カテゴリ・従業員アサイン・プレビュー
 *   │   └ 開発開始ボタン
 *   └─ PixelMenuBar（戻る/オフィス/ライブラリ/図鑑。下部固定）
 *
 * 既存テストとの互換のため、以下のセレクタは保持：
 * - `<h1>` テキストに「企画会議」を含む
 * - カテゴリは `<button data-category-id="...">` で disabled 切替
 * - 従業員アサインは `<input type="checkbox" data-employee-id="...">`
 * - 「▶ 開発開始」ボタン文言
 */

// 色トークン（office-visual-design / game-ui-design のクリーム＋ブラウン系）
/** v0.11 G5c：リファレンス実測（青タイトル + オフホワイト本体）に合わせた白地トークン */
const COLORS = {
  bgDark: '#c9ccd0',
  bgCream: '#e0dfda',
  bgCreamLight: '#f2f1ed',
  border: '#5a636e',
  borderHard: '#10151c',
  textDark: '#1c2228',
  textMid: '#3a4148',
  textSub: '#6b7280',
  accentYellow: '#d99114',
  accentOrange: '#cf5f10',
  accentRed: '#b8302a',
  trendHot: '#cf5f10',
  pioneer: '#2a7a3c',
  warn: '#9a6b10',
} as const;

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: COLORS.textMid,
  margin: 0,
};

// 窓タイトルバー（青 #214577）内に置くサブテキスト。明色必須（暗色だと読めない）
const subMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#bcd0e8',
  fontWeight: 400,
  marginLeft: 8,
};

type EstimateBoxProps = {
  label: string;
  value: string;
  sub?: string;
  accent: string;
};

const EstimateBox = ({ label, value, sub, accent }: EstimateBoxProps) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '4px 6px',
      borderLeft: `4px solid ${accent}`,
    }}
  >
    <span style={{ fontSize: 10, color: COLORS.textSub, fontWeight: 700, letterSpacing: '0.06em' }}>
      {label}
    </span>
    <span style={{ fontSize: 13, color: COLORS.textDark, fontWeight: 700 }}>{value}</span>
    {sub && <span style={{ fontSize: 11, color: COLORS.textMid }}>{sub}</span>}
  </div>
);

export const PlanScreen = () => {
  const startProject = useGameStore((s) => s.startProject);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const unlockedGenres = useGameStore((s) => s.unlockedGenres);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);
  const funds = useGameStore((s) => s.funds);
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
  const [title, setTitle] = useState(() => generateTitle(firstGenre, firstTheme));
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

  const isTrendyGenre = trend && trend.genreId === genreId;
  const isTrendyTheme = trend && trend.themeId === themeId;

  const pioneer = !library.some((w) => w.genreId === genreId && w.themeId === themeId);

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

  // v0.17：従業員は常に全員参加（オーナー指示）。社員が 1 人でもいれば開始できる
  const canStart = employees.length >= 1;

  const handleStart = () => {
    if (!canStart) return;
    startProject(genreId, themeId, scale, title);
  };

  // v0.11 G2：PlanScreen は ScreenOverlay の中身として描画される（ページ遷移しない）
  return (
    <div
      className="plan-screen"
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: 10,
        padding: 10,
        minHeight: 0,
        overflow: 'hidden',
        background: COLORS.bgDark,
      }}
    >
      {/* 左パネル：5 セクション（ジャンル/テーマ/規模/カテゴリ/従業員） */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: '100%',
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        {/* ジャンル — v0.10 仕上げ：未解放は何があるか見せない */}
        <PixelWindow title="ジャンルを選ぶ" variant="standard">
          <div style={chipRowStyle}>
            {GENRES.filter((g) => unlockedGenres.includes(g.id)).map((g) => {
              const isSelected = genreId === g.id;
              const hot = trend?.genreId === g.id;
              return (
                <PixelButton
                  key={g.id}
                  size="small"
                  variant={isSelected ? 'primary' : 'secondary'}
                  onClick={() => setGenreId(g.id)}
                  ariaLabel={g.name}
                >
                  {g.emoji} {g.name}
                  {hot && ' 🔥'}
                </PixelButton>
              );
            })}
            {GENRES.length > unlockedGenres.length && (
              <span style={{ fontSize: 11, color: '#9fb6d4', alignSelf: 'center' }}>
                + ? 種類（未解放）
              </span>
            )}
          </div>
        </PixelWindow>

        {/* テーマ — v0.10 仕上げ：未解放は何があるか見せない */}
        <PixelWindow title="テーマを選ぶ" variant="standard">
          <div style={chipRowStyle}>
            {THEMES.filter((t) => unlockedThemes.includes(t.id)).map((t) => {
              const isSelected = themeId === t.id;
              const hot = trend?.themeId === t.id;
              return (
                <PixelButton
                  key={t.id}
                  size="small"
                  variant={isSelected ? 'primary' : 'secondary'}
                  onClick={() => setThemeId(t.id)}
                  ariaLabel={t.name}
                >
                  {t.emoji} {t.name}
                  {hot && ' 🔥'}
                </PixelButton>
              );
            })}
            {THEMES.length > unlockedThemes.length && (
              <span style={{ fontSize: 11, color: '#9fb6d4', alignSelf: 'center' }}>
                + ? 種類（未解放）
              </span>
            )}
          </div>
        </PixelWindow>

        {/* 規模 */}
        <PixelWindow title="規模を選ぶ" variant="standard">
          <div style={sectionStyle}>
            <div style={chipRowStyle}>
              {SCALES.map((s) => {
                const isUnlocked = unlocked.includes(s.id);
                const isSelected = scale === s.id;
                return (
                  <PixelButton
                    key={s.id}
                    size="small"
                    variant={isSelected ? 'primary' : 'secondary'}
                    disabled={!isUnlocked}
                    onClick={() => setScale(s.id)}
                    ariaLabel={isUnlocked ? `${s.name} ${s.requiredLoC}LoC` : `${s.name}（未解放）`}
                  >
                    {s.name}（{s.requiredLoC}LoC）{!isUnlocked && ' 🔒'}
                  </PixelButton>
                );
              })}
            </div>
            {(() => {
              const def = SCALE_BY_ID[scale];
              const range = estimateRevenueRange(def.baseUnit);
              // v0.15.3：予定週は企画・仕上げの猶予込みで案内する
              const totalWeeks = def.neededWeeks + planWeeksAllowance(def.neededWeeks);
              const monthCount = Math.round(totalWeeks / 4);
              // E-4: 中央値売上で見込み利益。赤字なら赤色で警告
              // v0.17.1：月固定費に給与を含める（賃料だけだと実際の月次徴収と食い違う）
              const salaries = sumMonthlySalaries(employees);
              const monthlyFixed = salaries + def.monthlyRent;
              const estMonths = Math.max(1, Math.round(totalWeeks / 4));
              const profitMid = computeProfit({
                totalRevenue: range.mid,
                devCost: def.baseCost,
                monthlyFixedCost: monthlyFixed,
                developMonths: estMonths,
              });
              const profitHigh = computeProfit({
                totalRevenue: range.high,
                devCost: def.baseCost,
                monthlyFixedCost: monthlyFixed,
                developMonths: estMonths,
              });
              const profitColor = profitMid.profit >= 0 ? COLORS.pioneer : COLORS.accentRed;
              return (
                <div
                  data-testid="scale-estimate"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 8,
                    padding: 10,
                    background: COLORS.bgCreamLight,
                    border: `3px solid ${COLORS.borderHard}`,
                    boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.4)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <EstimateBox
                    label="予想開発費"
                    value={formatYen(def.baseCost)}
                    accent={COLORS.accentRed}
                  />
                  <EstimateBox
                    label="予想開発期間"
                    value={`${formatWeeks(totalWeeks)}（${monthCount} ヶ月）`}
                    accent={COLORS.accentOrange}
                  />
                  <EstimateBox
                    label="予想売上レンジ"
                    value={`${formatYen(range.low)} 〜 ${formatYen(range.high)}`}
                    sub={`平均 ${formatYen(range.mid)}`}
                    accent={COLORS.pioneer}
                  />
                  <EstimateBox
                    label="月固定費（給与＋賃料）"
                    value={`${formatYen(monthlyFixed)}/月`}
                    sub={`給与 ${formatYen(salaries)} + 賃料 ${formatYen(def.monthlyRent)}`}
                    accent={COLORS.warn}
                  />
                  <EstimateBox
                    label="予想利益（中央値）"
                    value={formatYen(profitMid.profit)}
                    sub={`大ヒット時 ${formatYen(profitHigh.profit)}`}
                    accent={profitColor}
                  />
                </div>
              );
            })()}
          </div>
        </PixelWindow>

        {/* v0.17：開発チーム（常に全員参加）＋チーム効果プレビュー */}
        <PixelWindow
          title={
            <span>
              👥 開発チーム<span style={subMetaStyle}>全員参加（{employees.length}人）</span>
            </span>
          }
          variant="standard"
        >
          {employees.length === 0 ? (
            <p style={hintStyle}>オフィスで従業員を雇うと開発を始められます。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {employees.map((e) => (
                  <li key={e.id} style={{ fontSize: 12, color: COLORS.textDark }}>
                    <strong>{e.name}</strong>
                    <span style={{ fontSize: 11, color: COLORS.textSub, marginLeft: 6 }}>
                      {e.role === 'programmer'
                        ? '🧑‍💻 プログラマー'
                        : e.role === 'designer'
                          ? '🎨 デザイナー'
                          : '📣 広報'}{' '}
                      ／ Lv{e.level}
                    </span>
                  </li>
                ))}
              </ul>
              {(() => {
                // このチームで作ると何が起きるか（効き先の可視化。値は balance.ts から生成）
                const speed = employees
                  .filter((e) => e.role === 'programmer')
                  .reduce((a, b) => a + b.power * ROLE_EFFECT.programmerLocPerSec, 0);
                const quality = employees
                  .filter((e) => e.role === 'designer')
                  .reduce((a, b) => a + b.power * ROLE_EFFECT.designerQualityBonus, 0);
                const sales = employees
                  .filter((e) => e.role === 'pr')
                  .reduce((a, b) => a + b.power * ROLE_EFFECT.prSalesBonus, 0);
                const suppress = Math.round(bugSuppression(employees) * 100);
                return (
                  <div
                    style={{
                      borderTop: `2px solid ${COLORS.borderHard}`,
                      paddingTop: 6,
                      fontSize: 11,
                      color: COLORS.textDark,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      rowGap: 2,
                    }}
                  >
                    <span>⚡ 開発速度 +{speed.toFixed(2)} LoC/秒</span>
                    <span>🎨 品質 +{quality.toFixed(1)}</span>
                    <span>📣 売上 +{Math.round(sales * 100)}%</span>
                    <span>🐛 バグ抑制 {suppress}%</span>
                  </div>
                );
              })()}
            </div>
          )}
        </PixelWindow>
      </div>

      {/* 右パネル：企画プレビュー + 予測 + 開発開始 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: '100%',
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        {/* オフライン / 実績解除 通知（あれば） */}
        {offlineReport && (
          <PixelWindow title="📬 おかえりなさい" variant="emphasis" bodyStyle={{ padding: 8 }}>
            <p style={{ margin: 0, fontSize: 12 }}>
              離席中（{Math.round(offlineReport.awaySec / 60)}分）に ¥
              {offlineReport.earned.toLocaleString()} 受領。
            </p>
            <div style={{ marginTop: 6 }}>
              <PixelButton size="small" variant="secondary" onClick={clearOfflineReport}>
                閉じる
              </PixelButton>
            </div>
          </PixelWindow>
        )}
        {newlyAchieved.length > 0 && (
          <PixelWindow title="🏆 実績解除！" variant="emphasis" bodyStyle={{ padding: 8 }}>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.4 }}>
              {newlyAchieved.map((id) => {
                const def = ACHIEVEMENT_BY_ID[id];
                return (
                  <li key={id}>
                    {def.emoji} <strong>{def.name}</strong>
                  </li>
                );
              })}
            </ul>
            <div style={{ marginTop: 6 }}>
              <PixelButton size="small" variant="secondary" onClick={clearNewlyAchieved}>
                閉じる
              </PixelButton>
            </div>
          </PixelWindow>
        )}

        {/* トレンド */}
        <PixelWindow title="📈 トレンド" variant="standard" bodyStyle={{ padding: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.trendHot,
            }}
          >
            {trend ? trendLabel(trend) : '—'}
          </p>
          <p style={{ ...hintStyle, marginTop: 2 }}>合致 ×1.3（片方）／ ×1.7（両方）</p>
        </PixelWindow>

        {/* 企画プレビュー */}
        <PixelWindow title="🎮 企画プレビュー" variant="emphasis" bodyStyle={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <input
              type="text"
              value={title}
              maxLength={16}
              placeholder="ゲームタイトル"
              onChange={(e) => setTitle(e.target.value)}
              aria-label="ゲームタイトル"
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 700,
                padding: '4px 6px',
                border: `3px solid ${COLORS.borderHard}`,
                background: '#fffef2',
                color: COLORS.textDark,
                fontFamily: 'inherit',
              }}
            />
            <PixelButton
              size="small"
              variant="secondary"
              onClick={() => setTitle(generateTitle(genreId, themeId))}
              ariaLabel="タイトルをランダム生成"
            >
              🎲
            </PixelButton>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <JacketView genreId={genreId} themeId={themeId} size="sm" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLORS.textDark,
                }}
              >
                {GENRE_BY_ID[genreId].name} × {THEME_BY_ID[themeId].name}
                {(isTrendyGenre || isTrendyTheme) && (
                  <span style={{ color: COLORS.trendHot, marginLeft: 4 }}>🔥</span>
                )}
              </p>
              {pioneer && (
                <span
                  style={{
                    padding: '1px 6px',
                    background: COLORS.pioneer,
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    width: 'fit-content',
                  }}
                >
                  🌱 新規開拓 +30%
                </span>
              )}
              {surveyedCompat !== null ? (
                <p
                  style={{
                    margin: 0,
                    color: COLORS.warn,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  相性: {compatLabel(surveyedCompat)} ({surveyedCompat.toFixed(2)}x)
                </p>
              ) : (
                <PixelButton
                  size="small"
                  variant="secondary"
                  onClick={handleSurvey}
                  disabled={adRunning}
                >
                  {adRunning ? '広告中…' : '📺 市場調査'}
                </PixelButton>
              )}
            </div>
          </div>
        </PixelWindow>

        {/* 開発開始ボタン（常時固定） */}
        <PixelWindow variant="emphasis" bodyStyle={{ padding: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
            <PixelButton size="large" variant="primary" onClick={handleStart} disabled={!canStart}>
              ▶ 開発開始
            </PixelButton>
            {!canStart && (
              <p style={{ ...hintStyle, fontSize: 10 }}>
                ※従業員がいません（オフィスで採用すると開始できます）
              </p>
            )}
            <p style={{ ...hintStyle, fontSize: 11 }}>資金: {formatYen(funds)}</p>
          </div>
        </PixelWindow>
      </div>

      {!tutorialDone && <Tutorial />}
    </div>
  );
};
