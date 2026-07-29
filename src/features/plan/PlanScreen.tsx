import { useEffect, useState } from 'react';
import { ads } from '../../ads/AdProvider';
import { JacketView } from '../../components/JacketView';
import { Tutorial } from '../../components/Tutorial';
import { PixelButton, PixelModal, PixelWindow } from '../../components/ui';
import { bugSuppression } from '../../core/bugs';
import { jobTitleOf } from '../../core/skills';
import { investPrice } from '../../core/invest';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import { planWeeksAllowance } from '../../data/balance';
import { weightsFor } from '../../data/archetypes';
import { compatLabel, getCompat } from '../../data/compatibility';
import { innovationFor } from '../../core/features';
import { leadForField } from '../../core/skills';
import { sumPrBonus } from '../../data/employees';
import { DEV_SKILL_IDS } from '../../state/types';
import { SKILL_VISUAL } from '../office/employeeDisplay';
import { formatSkills } from '../office/employeeDisplay';
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

/**
 * v0.21 投資：未解放ジャンル/テーマの先行購入ショップ（ジャンル/テーマ共通）。
 * 既定は閉じておき「🔒未解放を購入 (N)」を押すと未解放の一覧（鍵＋価格）を展開する。
 * 常時全部（最大15＋13）を出すと画面を圧迫しスクロールを招くため（no-scroll 原則）。
 */
type LockedItem = { id: string; emoji: string; name: string; unlockStage: number };
/** 購入確認の対象（クリックで即購入せず、確認モーダルを開くために保持する） */
type PurchaseTarget = { kind: 'genre' | 'theme'; id: string; emoji: string; name: string; price: number };
const LockedShop = ({
  kind,
  locked,
  funds,
  purchaseCount,
  open,
  onToggle,
  onRequest,
}: {
  kind: 'genre' | 'theme';
  locked: LockedItem[];
  funds: number;
  /** これまでの先行購入数（価格の逓増カーブに使う。買うほど全項目が高くなる） */
  purchaseCount: number;
  open: boolean;
  onToggle: () => void;
  /** クリック時：即購入せず、確認対象を親へ渡す（親が確認モーダルを開く） */
  onRequest: (target: PurchaseTarget) => void;
}) => {
  if (locked.length === 0) return null;
  return (
    <>
      <PixelButton
        size="small"
        variant="secondary"
        onClick={onToggle}
        ariaLabel={`未解放を購入 ${locked.length}種`}
      >
        🔒 未解放を購入 ({locked.length}) {open ? '▲' : '▼'}
      </PixelButton>
      {open &&
        locked.map((it) => {
          const price = investPrice(it.unlockStage, purchaseCount);
          if (price === null) return null;
          const affordable = funds >= price;
          return (
            <PixelButton
              key={it.id}
              size="small"
              variant="secondary"
              disabled={!affordable}
              onClick={() => onRequest({ kind, id: it.id, emoji: it.emoji, name: it.name, price })}
              ariaLabel={`${it.name} を ${formatYen(price)} で購入`}
            >
              🔒 {it.emoji} {it.name} {formatYen(price)}
            </PixelButton>
          );
        })}
    </>
  );
};

export const PlanScreen = () => {
  const startProject = useGameStore((s) => s.startProject);
  const unlocked = useGameStore((s) => s.unlockedScales);
  const unlockedGenres = useGameStore((s) => s.unlockedGenres);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);
  const buyGenre = useGameStore((s) => s.buyGenre);
  const buyTheme = useGameStore((s) => s.buyTheme);
  const investPurchaseCount = useGameStore((s) => s.investPurchaseCount);
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
  // v0.21 投資：未解放ジャンル/テーマの先行購入ショップの開閉（既定は閉じて画面を圧迫しない）
  const [genreShopOpen, setGenreShopOpen] = useState(false);
  const [themeShopOpen, setThemeShopOpen] = useState(false);
  // 誤操作防止：チップのクリックでは即購入せず、確認モーダルを開く（対象を保持）
  const [pendingPurchase, setPendingPurchase] = useState<PurchaseTarget | null>(null);

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
            <LockedShop
              kind="genre"
              locked={GENRES.filter((g) => !unlockedGenres.includes(g.id))}
              funds={funds}
              purchaseCount={investPurchaseCount}
              open={genreShopOpen}
              onToggle={() => setGenreShopOpen((v) => !v)}
              onRequest={setPendingPurchase}
            />
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
            <LockedShop
              kind="theme"
              locked={THEMES.filter((t) => !unlockedThemes.includes(t.id))}
              funds={funds}
              purchaseCount={investPurchaseCount}
              open={themeShopOpen}
              onToggle={() => setThemeShopOpen((v) => !v)}
              onRequest={setPendingPurchase}
            />
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
              // 予測は「このチームで実際に届く範囲」。固定の段だと AAA を赤字表示していた
              const range = estimateRevenueRange(scale, employees, genreId, themeId);
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
                    sub={`中央値 ${formatYen(range.mid)}`}
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
                      {jobTitleOf(e.skills)} ／ Lv{e.level} ／ {formatSkills(e.skills)}
                    </span>
                  </li>
                ))}
              </ul>
              {(() => {
                // このチームで作ると何が起きるか（効き先の可視化。値は balance.ts から生成）
                // ここに出すのは**実際にスコア・売上へ効くものだけ**。
                // 「開発速度 LoC/秒」は自動開発機能が存在しないため表示しない（進捗は打鍵のみ）
                // 「🎨 品質 +X」は designerQualityBonus がどの計算にも繋がっておらず、
                // 何も起きない数値だったため撤去した（docs/spec/glossary.md の ❌廃止）
                const sales = sumPrBonus(employees);
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
          <p style={{ ...hintStyle, marginTop: 2 }}>
            合致：スコア +5／+10・売上 +5%／+10%（片方／両方）
          </p>
        </PixelWindow>

        {/* このジャンルで重要な分野（docs/spec/score-model.md §4）。
            プレイヤーが「手持ちのスキルに合うジャンルを選ぶ」判断をするための表示 */}
        <PixelWindow
          // 「型」（絵物語型 等）は27ジャンルを整理するための内部の分類名。
          // プレイヤーが選んだのはジャンルなので、ジャンル名で言う
          title={`🎯 ${GENRE_BY_ID[genreId].name}で重要な分野`}
          variant="standard"
          bodyStyle={{ padding: 8 }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {FEATURE_ROWS.map((row) => {
              const label = weightsFor(genreId)[row.id];
              const color =
                label === '◎' ? COLORS.trendHot : label === '○' ? COLORS.textDark : COLORS.textSub;
              return (
                <span
                  key={row.id}
                  style={{ fontSize: 12, color, fontWeight: label === '◎' ? 700 : 400 }}
                >
                  {label} {row.icon}
                  {row.label}
                </span>
              );
            })}
          </div>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            ◎ が重い。打って伸ばした分野がジャンルに合うほどメタスコアが伸びる
          </p>
          {/* 革新性は打鍵では動かず、**ここでしか直せない**（組合せを変える）。
              だから開発中ではなく企画画面に出す */}
          {(() => {
            const innovation = innovationFor(library, genreId, themeId);
            if (innovation >= 100) return null;
            return (
              <p style={{ ...hintStyle, marginTop: 4, color: COLORS.trendHot }}>
                ⚠ 💡 革新性 {innovation}／100 ── この組合せが続いています。
                ジャンルかテーマを変えれば 100 に戻ります
              </p>
            );
          })()}
          {/* 分野ごとの担当者（docs/spec/score-model.md §3）。
              **その分野でいちばん強い1人が担当**なので、注釈なしで読める。
              担当がいない分野は「担当なし」＝そこを埋める社員を採るべきだと一目で分かる */}
          {employees.length > 0 && (
            <div style={{ marginTop: 5, borderTop: `1px solid ${COLORS.borderHard}`, paddingTop: 4 }}>
              {DEV_SKILL_IDS.map((field) => {
                const lead = leadForField(employees, field);
                return (
                  <div key={field} style={{ fontSize: 11, color: COLORS.textDark }}>
                    {SKILL_VISUAL[field].emoji}{' '}
                    {lead ? (
                      <>
                        担当：{lead.name}{' '}
                        <strong>{Math.round(lead.skills?.[field] ?? 0)}</strong>
                      </>
                    ) : (
                      <span style={{ color: COLORS.trendHot }}>担当なし</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* 革新性は打鍵では動かず、**ここでしか直せない**（組合せを変える）。
              だから開発中ではなく企画画面に出す */}
          {(() => {
            const innovation = innovationFor(library, genreId, themeId);
            if (innovation >= 100) return null;
            return (
              <p style={{ ...hintStyle, marginTop: 4, color: COLORS.trendHot }}>
                ⚠ 💡 革新性 {innovation}／100 ── この組合せが続いています。
                ジャンルかテーマを変えれば 100 に戻ります
              </p>
            );
          })()}
          {/* 分野ごとのスキル合計と内訳（docs/spec/score-model.md §3）。
              同じ分野の2人目以降は効率が落ちるので、その内訳も見せる */}
          {employees.length > 0 && (
            <div style={{ marginTop: 5, borderTop: `1px solid ${COLORS.borderHard}`, paddingTop: 4 }}>
              {DEV_SKILL_IDS.map((field) => {
                const lead = leadForField(employees, field);
                return (
                  <div key={field} style={{ fontSize: 11, color: COLORS.textDark }}>
                    {SKILL_VISUAL[field].emoji}{' '}
                    {lead ? (
                      <>
                        担当：{lead.name} <strong>{Math.round(lead.skills?.[field] ?? 0)}</strong>
                      </>
                    ) : (
                      <span style={{ color: COLORS.trendHot }}>担当なし</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                  🌱 新規開拓 +5%
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

      {/* v0.21 投資：先行購入の確認モーダル（ワンクリック誤購入の防止） */}
      <PixelModal
        open={pendingPurchase !== null}
        onClose={() => setPendingPurchase(null)}
        title="先行投資の確認"
        maxWidth={420}
      >
        {pendingPurchase && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 4 }}>
            <p style={{ ...hintStyle, fontSize: 14, color: COLORS.textDark }}>
              {pendingPurchase.emoji} {pendingPurchase.name}（{pendingPurchase.kind === 'genre' ? 'ジャンル' : 'テーマ'}）を
              <br />
              <strong>{formatYen(pendingPurchase.price)}</strong> で先行購入しますか？
            </p>
            <p style={{ ...hintStyle, fontSize: 12 }}>
              資金: {formatYen(funds)} → {formatYen(funds - pendingPurchase.price)}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <PixelButton
                size="small"
                variant="secondary"
                onClick={() => setPendingPurchase(null)}
                ariaLabel="購入をやめる"
              >
                やめる
              </PixelButton>
              <PixelButton
                size="small"
                variant="primary"
                onClick={() => {
                  if (pendingPurchase.kind === 'genre') buyGenre(pendingPurchase.id as GenreId);
                  else buyTheme(pendingPurchase.id as ThemeId);
                  setPendingPurchase(null);
                }}
                ariaLabel={`${pendingPurchase.name} を購入する`}
              >
                購入する
              </PixelButton>
            </div>
          </div>
        )}
      </PixelModal>
    </div>
  );
};


/** 企画画面で出す特徴ポイントの見出し（docs/spec/score-model.md §2 の順） */
const FEATURE_ROWS = [
  { id: 'usabilityPt', icon: '🕹', label: '操作性' },
  { id: 'graphicsPt', icon: '🎨', label: 'グラフィック' },
  { id: 'soundPt', icon: '🎵', label: 'サウンド' },
  { id: 'storyPt', icon: '📖', label: 'ストーリー' },
  { id: 'innovationPt', icon: '💡', label: '革新性' },
] as const;
