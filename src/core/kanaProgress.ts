/**
 * v0.20 A-2 修正：入力中かな表示の「今どこを打っているか」をローマ字進捗から求める。
 * 純粋関数のみ。
 *
 * 経緯：
 * 1) 当初はひらがな文字数とローマ字文字数の単純な比率で現在位置を近似していたが、
 *    拗音（きゃ・じょ等）はひらがな2文字で1モーラ（1打鍵単位）のため、比率換算では
 *    「zyou（じょう）まで打ったのに"う"がまだ光っている」という体感のズレが発生した
 * 2) モーラごとに固定のローマ字打鍵数（拗音=3・ん=2 等）を仮定するテーブル方式に直したが、
 *    日本語ローマ字入力の仕様として「しゅ」は shu/syu（3打鍵）だけでなく
 *    「し」+小さい「ゅ」= si + lyu/xyu（5打鍵）という別解も正当な入力であり、
 *    固定打鍵数の仮定が崩れて再びズレた（オーナー指摘：「siを打った時点で
 *    ライブラリの返す残り文字列も変わっているはず」）
 *
 * 結論：モーラごとの打鍵数を仮定しない。**モーラの「個数」だけ splitMorae で求め、
 * 各キー入力時点でライブラリ（nano-type-jp）が実際に返す completedLen/remainedLen
 * （選ばれた入力パターンを反映した生きた値）との比率でモーラ進捗を近似する。**
 * 比率なので、どの入力パターンが選ばれても実際の残り長に追従する。
 */

const isYouonMark = (ch: string): boolean => 'ゃゅょャュョ'.includes(ch);
const isSokuon = (ch: string): boolean => ch === 'っ' || ch === 'ッ';

/**
 * ひらがなを「打鍵の単位（モーラ）」に分割する（表示のグルーピング専用。個数のみ使う）。
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

export type KanaProgress = { doneMorae: number; totalMorae: number };

/**
 * ローマ字の入力済み/残り文字数（毎打鍵ごとに nano-type-jp から取得するライブ値）から、
 * 「モーラ単位で何個確定したか」を比率で概算する（表示専用。実入力の正誤判定は
 * nano-type-jp が担う）。
 */
export const kanaProgressFromRomaji = (
  hiragana: string,
  completedLen: number,
  remainedLen: number,
): KanaProgress => {
  const totalMorae = splitMorae(hiragana).length;
  const total = Math.max(1, completedLen + remainedLen);
  const doneMorae = Math.min(totalMorae, Math.floor((totalMorae * completedLen) / total));
  return { doneMorae, totalMorae };
};
