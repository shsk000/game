# public/sprites/office/

オフィス画面（OfficeView）用のドット絵スプライト置き場。

## ファイル規約

| ファイル | 用途 | 推奨サイズ | 必須/任意 |
|---|---|---|---|
| `floor_wood.png` | 自宅・小オフィスの床 | 32×32 タイラブル | 必須 |
| `floor_carpet.png` | スタジオ以降の床 | 32×32 タイラブル | 任意（fallback: wood） |
| `wall.png` | 部屋上端 | 32×32 タイラブル | 任意 |
| `desk.png` | デスク（PC含む） | 64×64 | 必須 |
| `chair.png` | 椅子（背面） | 32×32 | 任意 |
| `monitor_on.png` | PC稼働中の発光オーバーレイ | 16×16 | 任意 |
| `worker_idle.png` | 着席キャラ（静止） | 32×32 | 必須 |
| `worker_typing.gif` | 着席キャラ（タイピングアニメ） | 32×32 | 任意（fallback: idle） |
| `plant.png` | 観葉植物 | 16×16 | 任意 |
| `coffee.png` | コーヒーカップ | 16×16 | 任意 |
| `window.png` | 窓 | 32×32 | 任意 |

## スタイルガイド

- **トーン**: PC Engine 風 16色パレット
- **視点**: high top-down（やや見下ろし・~35°）
- **アウトライン**: single color black outline 推奨
- **背景**: 透明（floor/wall を除く）

## ライセンス（重要）

- AI生成物は **Asepriteで人間加工してから配置**（純AI生成は著作権保護が弱い・v0.9 spec 付録Z-4）
- 商用利用 OK のサービス（PixelLab Tier 1+）で生成すること
- このディレクトリ内の素材ライセンスは別途 `LICENSE.md` に明記する予定
