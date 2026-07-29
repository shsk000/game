# バグハント（AI探索 + 敵対的検証）

ローカルで手動起動し、ゲームを実際にプレイしてバグ候補を集め、**敵対的検証と再現ゲートで偽陽性を落としてから** GitHub issue 化する手順。実行は `/bug-hunt` コマンド。

> なぜ敵対的検証が要るか：2026 年の実地知見では、AI のバグ報告は**偽陽性が本番の問題**（curl はバウンティ閉鎖、HackerOne は IBB を一時停止、80 体超の合議が存在しない脆弱性を全員推奨）。素朴な多数決・多agent合議は逆効果になり得る。→ 本手法は [Refute-or-Promote](https://arxiv.org/html/2604.19049)（非対称の反証ゲート）と evidence-based assertion を採用する。

---

## 設計の芯（3 原則）

1. **証拠主義（evidence-based）** — エージェントの「できました／バグです」という自己申告は信じない。候補は必ず**客観的証拠**（スクショ・実数値・console ログ・viewport はみ出し量・再現手順）とセットにする。最大の敵は silent wrong-success（誤りを正しいと誤信）。
2. **2 オラクルで検証の重さを変える** — 何が「正しい挙動か」の基準を 2 系統持つ。
   - **規約オラクル（機械判定）**：反論の余地なし → 証拠で確定して即 issue。
   - **仕様オラクル（要判断）**：spec と照合 → 敵対的検証に通す。
3. **反証はデフォルト却下（kill mandate）** — 反証役の仕事は「改善」でも「採点」でもなく**却下**。1 体でも反証に成功したら候補は死ぬ。

---

## 2 つのオラクル

| 種別 | 例 | 判定方法 | 検証の重さ |
|---|---|---|---|
| **規約オラクル** | 1280×720 はみ出し／スクロール発生・`console.error`／uncaught・`NaN`／マイナス残高・白画面 | 数値・ログで機械的に測定 | **議論不要**。証拠が出たら確定 |
| **仕様オラクル** | 挙動が spec とズレる・進行不能（詰み）・評価/売上が企画と食い違う | `docs/` 最大版 spec ＋ game-design skill と照合 | **敵対的検証 → 再現ゲート** |

規約オラクルの根拠はメモリ規約：スクロール禁止（feedback_no_scroll_game_ui）／濃色背景に黒字禁止（feedback_dark_bg_light_text）。

⚠ **リリース画面（`.release-screen`）だけはスクロール可**（オーナー判断 2026-07-29）。
この画面は内容量がプレイ結果で変わり（売上の補正が乗るほど行が増える・打ち上げの評価が最大5件）、
詰めても「あと1行」で溢れて**次へ進めなくなる**事故が繰り返された。
ここで見るのは「収まっているか」ではなく**「押せるか」**。横方向のあふれは引き続き禁止。

---

## フロー

```
[0] 準備      dev 起動・実ポート確認 → 1280×800 → console クリア
      ↓
[1] プレイ    各 UC を実際に操作。候補は必ず「証拠」付きで記録
      ↓
   ├─ 規約オラクル該当 ──────────────→ [4] へ直行（確定）
      ↓ 仕様オラクル該当
[2] 敵対的検証  反証役に「主張＋証拠＋spec」だけ渡す（発見役の推論は捨てる＝
                アンカリング防止）。kill mandate・デフォルト却下で反論を試みる
      ↓ 反論できたら排除
[3] 再現ゲート  その再現手順をブラウザで“もう一度実際に”踏む
      ↓ 再現しなければ排除（← 偽陽性を落とす最強フィルタ）
[4] issue 化   生存分のみ gh issue create。証拠を全部添付。既存 open と dedupe
```

### [0] 準備
- worktree なら `npm install` 済みか確認 → `npm run dev`。**起動ログの実ポート**を必ず確認（main と worktree で 5173/5174 に割れる）。
- `browser_resize` 1280×800 → `browser_navigate` → `browser_console_messages` でクリーン確認。
- **はみ出し判定のときだけ** `browser_resize` 1280×**720** にして `scrollWidth>innerWidth || scrollHeight>innerHeight` で測る。**800 のまま 720 と比較しない**（誤検知＝スモークで実際に踏んだ）。

### [1] プレイ（発見）
- `docs/qa/usecases.md` の各 UC を Playwright MCP で操作。
- 期待（オラクル）と違う点を**候補**として記録。候補 1 件 = `{ 症状 / 再現手順 / 期待 / 実際 / 証拠(スクショパス・実数値・console) / オラクル種別 }`。
- 証拠のない「感想」は候補にしない。

### [2] 敵対的検証（仕様オラクルのみ）
- 反証役を**まっさら**な状態で立てる（発見役の推論は渡さない）。渡すのは **主張＋証拠＋該当 spec 抜粋**のみ。
- 指示：「これは**仕様通り**だと反論せよ。デフォルトは仕様通り（不採用）。バグと言い切れる根拠が無ければ却下。」
- 反論が成立したら候補を破棄。

### [3] 経験的再現ゲート
- 生存候補の**再現手順をブラウザで再実行**し、同じ症状が出るか確認。
- 再現しない／フレークなら破棄。**ここが最も偽陽性を落とす**（論文でも合議で死ななかった偽陽性がテスト 1 回で死んだ）。

### [4] issue 化
- 生存分のみ `gh issue create`。
- **dedupe**：既存 open issue をタイトル/症状シグネチャで検索し、重複は起票せずコメント追記 or スキップ。
- テンプレ（本文）：
  ```
  ## 症状
  ## 再現手順（1. …）
  ## 期待 / 実際
  ## 証拠（スクショ・数値・console）
  ## 検出元（commit / UC-ID / オラクル種別）
  ```
- ラベル：`auto-bug`, `ai-found`（＋規約系は `guideline`）。

---

## 付録：規約オラクルの実測スニペット（`browser_evaluate` で流す）

### はみ出し（1280×720 にリサイズしてから）
```js
() => { const d=document.scrollingElement;
  return { overflowX:d.scrollWidth>innerWidth, overflowY:d.scrollHeight>innerHeight,
           scrollW:d.scrollWidth, scrollH:d.scrollHeight }; }
```

### コントラスト（濃色背景に黒字＝可読性・アクセシビリティ）
全テキスト要素で WCAG コントラスト比を測る。**実機で調整済み**：絵文字は独自色なので除外／重大度を2段に分ける。
- **`fail`（比 < 3.0）＝「見えない」**＝青地に黒字などの実害。議論不要でそのまま起票。
- **`warn`（3.0 ≤ 比 < AA 閾値）**＝ミュート補助色など borderline。意図的な場合が多いので**要判断**（仕様オラクル扱い or まとめて相談）。
```js
() => {
  const lum = (r,g,b) => { const f=v=>{v/=255; return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const parse = c => (c.match(/[\d.]+/g)||[]).map(Number); // "rgb(a)" → [r,g,b,(a)]
  const bgOf = el => { for (let n=el; n; n=n.parentElement){ const p=parse(getComputedStyle(n).backgroundColor);
    if(p.length>=3 && (p[3]===undefined||p[3]>0)) return p; } return [255,255,255]; };
  const ratio = (a,b) => { const L1=lum(...a.slice(0,3)), L2=lum(...b.slice(0,3));
    const hi=Math.max(L1,L2), lo=Math.min(L1,L2); return (hi+0.05)/(lo+0.05); };
  const EMOJI=/[\p{Extended_Pictographic}☀-➿️]/gu;
  const fails=[], warns=[];
  for (const el of document.querySelectorAll('*')) {
    const txt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    if(!txt) continue;
    if(!txt.replace(EMOJI,'').trim()) continue; // 絵文字のみは対象外（独自色）
    const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none') continue;
    const fg=parse(cs.color); if(fg[3]===0) continue;
    const size=parseFloat(cs.fontSize), bold=+cs.fontWeight>=700;
    const large = size>=24 || (size>=18.66 && bold);
    const r=ratio(fg, bgOf(el)); const min=large?3:4.5;
    if (r < min) { const rec={ text:txt.slice(0,30), ratio:+r.toFixed(2), need:min,
      color:cs.color, bg:getComputedStyle(el).backgroundColor };
      (r < 3 ? fails : warns).push(rec); }
  }
  return { failCount: fails.length, warnCount: warns.length,
           fails: fails.slice(0,30), warns: warns.slice(0,30) };
}
```
→ `failCount>0` は規約オラクル違反＝**そのまま起票候補**（証拠に ratio と color/bg を添付）。`warn` は要判断。
→ **全画面・全モーダルを開いて**流すこと（オフィスだけでなく企画/開発/発売/図鑑/設定/各ガチャ）。青地×黒字は特定モーダルに潜む。
→ **注意（実測した死角）**：白文字が透過背景に乗る要素は、祖先チェーンに不透明背景が無いと `bgOf` が拾えず誤検知/見落としが出る。**「暗色文字が不透明カラー背景に乗る」署名**（fgL<0.25 かつ bgL>fgL）で絞ると青地×黒字を正確に狙える。ダイアログを開いたら `root=[role=dialog]` にスコープして office 背景の雑音を除く。

> **初回スイープ実績（2026-07-20）**：この手順で `規模解放`（ロック行 比1.66）と `実績`（会社サマリ＋実績行 比1.02〜1.66）の青地×黒字を検出→`OfficeScreen.tsx` で明色を明示して修正。`図鑑`未解放グレー(2.14)・`企画`トレンドオレンジ(2.97)は意図的ディムの可能性ありで warn 据え置き（要オーナー判断）。

---

## 補足（採用しなかった/割り切り）
- **別モデルファミリー批評**（論文 Stage D）：同族モデルは誤りが相関するため本来有効だが、ローカルは Claude 単一構成のため今回は省略。効果を上げたければ発見役と反証役でモデル tier を変える程度に留める。
- **定期実行**：今回は対象外（手動起動のみ）。
