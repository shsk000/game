import { describe, expect, it } from 'vitest';
import { splitMorae } from './kanaProgress';

describe('splitMorae（かな→表示用モーラ単位の分割）', () => {
  it('通常のかなは1文字1モーラ', () => {
    expect(splitMorae('たのしい')).toEqual(['た', 'の', 'し', 'い']);
  });

  it('拗音（ゃゅょ）は直前の1文字と結合して1モーラ', () => {
    expect(splitMorae('じょうたい')).toEqual(['じょ', 'う', 'た', 'い']);
    expect(splitMorae('きゃく')).toEqual(['きゃ', 'く']);
  });

  it('促音（っ）は直後のモーラと結合して1モーラ', () => {
    expect(splitMorae('がっこう')).toEqual(['が', 'っこ', 'う']);
  });

  it('促音＋拗音（っきゃ等）は3文字で1モーラ', () => {
    expect(splitMorae('ひっきゃく')).toEqual(['ひ', 'っきゃ', 'く']);
  });

  it('促音が末尾にある場合は単独モーラとして扱う（防御）', () => {
    expect(splitMorae('あっ')).toEqual(['あ', 'っ']);
  });

  it('空文字は空配列', () => {
    expect(splitMorae('')).toEqual([]);
  });

  it('個数が nano-type-jp@0.7 の totalUnitCount と一致する（3つの実例。値は NanoType-JP 側の unit テストで確認済み）', () => {
    expect(splitMorae('しゅうせいをあてる')).toHaveLength(8); // しゅ,う,せ,い,を,あ,て,る
    expect(splitMorae('じょうたいをかんりする')).toHaveLength(10); // じょ,う,た,い,を,か,ん,り,す,る
    expect(splitMorae('あいであをじっそうする')).toHaveLength(10); // あ,い,で,あ,を,じ,っそ,う,す,る
  });
});
