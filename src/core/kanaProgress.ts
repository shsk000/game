/**
 * v0.20 A-2：入力中かな表示のグルーピング（表示専用の純粋関数）。
 *
 * 経緯：当初は「今どこを打っているか」をローマ字の打鍵数から近似していたが、
 * 拗音の代替入力（例：しゅ＝shu/syu の直接入力 と si+小さいゅ の分割入力）等、
 * 1モーラに複数の正当な打鍵数パターンが存在する日本語ローマ字入力の仕様により、
 * 3種類の近似（文字数比・固定長テーブル・ライブ比率）すべてが実プレイで破綻した。
 *
 * 結論：近似をやめ、nano-type-jp@0.7 が公開する resolvedUnitCount
 * （何個目の入力単位＝モーラまで確定したか。内部の targetTypingPatternResolverNumber
 * をそのまま公開したもの）をそのまま使う（DevelopScreen.tsx 側）。
 * このファイルは「ひらがな文字列を表示用のモーラ単位に分割する」グルーピングだけを担う
 * （resolvedUnitCount の分割方法と一致することは nano-type-jp 側のテストで確認済み）。
 */

const isYouonMark = (ch: string): boolean => 'ゃゅょャュョ'.includes(ch);
const isSokuon = (ch: string): boolean => ch === 'っ' || ch === 'ッ';

/**
 * ひらがなを「打鍵の単位（モーラ）」に分割する（表示のグルーピング専用）。
 * - 拗音（きゃ等）は直前の1文字と結合して1モーラ（2文字）
 * - 促音（っ）は直後のモーラ（拗音込みなら3文字）と結合して1モーラ
 */
export const splitMorae = (hiragana: string): string[] => {
  const chars = [...hiragana];
  const morae: string[] = [];
  let i = 0;
  while (i < chars.length) {
    if (isSokuon(chars[i]) && i + 1 < chars.length) {
      const nextIsYouon = i + 2 < chars.length && isYouonMark(chars[i + 2]);
      const span = nextIsYouon ? 3 : 2;
      morae.push(chars.slice(i, i + span).join(''));
      i += span;
      continue;
    }
    if (i + 1 < chars.length && isYouonMark(chars[i + 1])) {
      morae.push(chars[i] + chars[i + 1]);
      i += 2;
      continue;
    }
    morae.push(chars[i]);
    i += 1;
  }
  return morae;
};
