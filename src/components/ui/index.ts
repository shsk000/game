/**
 * ピクセルアート UI コンポーネント群。
 *
 * 棲み分け：
 * - 本ディレクトリ：オフィスゲーム画面の「ドット絵ゲーム UI」基盤
 * - 既存の `src/components/*`（OfficeView, SpriteAnimation 等）：ゲーム世界の描画
 *
 * 詳細は SKILL `office-visual-design` を参照。
 */

export { PixelWindow } from './PixelWindow';
export { PixelButton } from './PixelButton';
export { PixelMenuBar } from './PixelMenuBar';
export type { PixelMenuItem } from './PixelMenuBar';
export { PixelStatusBar } from './PixelStatusBar';
export { PixelModal } from './PixelModal';
export { PixelIcon } from './PixelIcon';
