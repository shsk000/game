/**
 * v0.20 A-2 修正：入力中かな表示の「今どこを打っているか」をローマ字進捗から正確に求める。
 * 純粋関数のみ。
 *
 * 経緯：当初はひらがな文字数とローマ字文字数の単純な比率で現在位置を近似していたが、
 * 拗音（きゃ・じょ等）はひらがな2文字で1モーラ（1打鍵単位）のため、比率換算では
 * 「zyou（じょう）まで打ったのに"う"がまだ光っている」という体感のズレが実際に発生した
 * （オーナー実プレイで発見）。かな表示は「打鍵の単位（モーラ）」で区切って進捗を積算する。
 */

const isYouonMark = (ch: string): boolean => 'ゃゅょャュョ'.includes(ch);
const isSokuon = (ch: string): boolean => ch === 'っ' || ch === 'ッ';
const VOWELS = new Set(['あ', 'い', 'う', 'え', 'お']);

/**
 * ひらがなを「打鍵の単位（モーラ）」に分割する。
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

/**
 * モーラ1つあたりのローマ字打鍵数の概算（表示用の近似値。実入力の正誤判定には使わない。
 * 実際のバリデーションは nano-type-jp が担う）。
 */
export const romajiLenFor = (mora: string): number => {
  const chars = [...mora];
  if (chars.length === 1) {
    const ch = chars[0];
    if (VOWELS.has(ch)) return 1;
    if (ch === 'ん') return 1;
    if (ch === 'を') return 2;
    if (ch === 'ー') return 1;
    return 2; // 子音+母音の基本形
  }
  if (isSokuon(chars[0])) {
    return romajiLenFor(chars.slice(1).join('')) + 1; // 促音＝子音重複+1打鍵
  }
  return 3; // 拗音（きゃ等）＝主要ローマ字3打鍵（kya 等）
};

export type KanaProgress = { doneMorae: number; totalMorae: number };

/**
 * ローマ字の入力済み文字数（completedLen）から、かな表示上「何モーラ目まで確定したか」を求める。
 * 各モーラのローマ字打鍵数（概算）を積算し、しきい値以上なら確定として扱う。
 */
export const kanaProgressFromRomaji = (hiragana: string, completedLen: number): KanaProgress => {
  const morae = splitMorae(hiragana);
  let acc = 0;
  let doneMorae = 0;
  for (const m of morae) {
    acc += romajiLenFor(m);
    if (completedLen >= acc) doneMorae += 1;
    else break;
  }
  return { doneMorae, totalMorae: morae.length };
};
