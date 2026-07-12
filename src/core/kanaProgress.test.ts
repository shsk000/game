import { describe, expect, it } from 'vitest';
import { kanaProgressFromRomaji, romajiLenFor, splitMorae } from './kanaProgress';

describe('splitMorae（かな→打鍵単位の分割）', () => {
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
});

describe('romajiLenFor（モーラ→概算打鍵数）', () => {
  it('母音単体は1打鍵', () => {
    expect(romajiLenFor('あ')).toBe(1);
    expect(romajiLenFor('い')).toBe(1);
  });

  it('ん・ーは1打鍵、をは2打鍵', () => {
    expect(romajiLenFor('ん')).toBe(1);
    expect(romajiLenFor('ー')).toBe(1);
    expect(romajiLenFor('を')).toBe(2);
  });

  it('通常の子音+母音は2打鍵', () => {
    expect(romajiLenFor('か')).toBe(2);
    expect(romajiLenFor('た')).toBe(2);
  });

  it('拗音（きゃ等）は3打鍵', () => {
    expect(romajiLenFor('きゃ')).toBe(3);
    expect(romajiLenFor('じょ')).toBe(3);
  });

  it('促音＋Xは (Xの打鍵数 + 1)', () => {
    expect(romajiLenFor('っこ')).toBe(3); // こ(2) + 1
    expect(romajiLenFor('っきゃ')).toBe(4); // きゃ(3) + 1
  });
});

describe('kanaProgressFromRomaji（ローマ字進捗→モーラ進捗）', () => {
  it('「じょうたいをかんりする」で zyou（4打鍵）打ち切った時点で3モーラ確定（じょ・う）', () => {
    // じょ(3)+う(1) = 4 → completedLen=4 でちょうど2モーラ確定
    const p = kanaProgressFromRomaji('じょうたいをかんりする', 4);
    expect(p.doneMorae).toBe(2);
    expect(p.totalMorae).toBe(10); // じょ,う,た,い,を,か,ん,り,す,る（じ+ょ が1モーラに畳まれ11→10）
  });

  it('1文字も打っていない時は0モーラ', () => {
    expect(kanaProgressFromRomaji('たのしい', 0).doneMorae).toBe(0);
  });

  it('全部打ち終えると全モーラ確定', () => {
    const hira = 'たのしい';
    const total = romajiLenFor('た') + romajiLenFor('の') + romajiLenFor('し') + romajiLenFor('い');
    const p = kanaProgressFromRomaji(hira, total);
    expect(p.doneMorae).toBe(p.totalMorae);
  });

  it('モーラ境界のちょうど手前では確定しない', () => {
    // 「か」= 2打鍵。1打鍵目では未確定
    const p = kanaProgressFromRomaji('かき', 1);
    expect(p.doneMorae).toBe(0);
  });
});
