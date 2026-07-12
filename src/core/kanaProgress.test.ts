import { describe, expect, it } from 'vitest';
import { kanaProgressFromRomaji, splitMorae } from './kanaProgress';

describe('splitMorae（かな→打鍵単位の分割。個数のみ使う）', () => {
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

describe('kanaProgressFromRomaji（ライブなローマ字進捗の比率でモーラ進捗を近似）', () => {
  it('「じょうたいをかんりする」で zyou（4/19打鍵）打った時点で2モーラ確定（じょ・う）', () => {
    // 実際のローマ字全体は zyoutaiwokannrisuru（19文字。ん=nn）
    const p = kanaProgressFromRomaji('じょうたいをかんりする', 4, 19 - 4);
    expect(p.doneMorae).toBe(2);
    expect(p.totalMorae).toBe(10); // じょ,う,た,い,を,か,ん,り,す,る
  });

  it('「とれんどをぶんせきする」で torenndow（9/22打鍵）打った時点で4モーラ確定し、「を」が現在（オーナー実プレイで発見した回帰：んの打鍵数を1と仮定してズレていた）', () => {
    // 実測のローマ字全体は torenndowobunnsekisuru（22文字。ん=nn）
    const p = kanaProgressFromRomaji('とれんどをぶんせきする', 9, 22 - 9);
    expect(p.doneMorae).toBe(4);
    expect(splitMorae('とれんどをぶんせきする')[p.doneMorae]).toBe('を');
  });

  it('拗音の代替入力パターン（si+小さいゅ）でも打鍵数が変わるだけで比率が追従する（オーナー指摘：日本語入力の仕様。しゅうせい＝syuusei でも silyuusei でも打てる）', () => {
    // 「しゅうせいをあてる」：shu パターンなら全体14文字、si+lyu パターンなら全体16文字。
    // 「し」まで（1モーラ）打ち終えた時点＝どちらのパターンでも doneMorae は変わらないはず。
    const viaShu = kanaProgressFromRomaji('しゅうせいをあてる', 1, 14 - 1); // "s" だけ打った直後
    const viaSplit = kanaProgressFromRomaji('しゅうせいをあてる', 2, 16 - 2); // "si" まで打った直後（1モーラ目「しゅ」の代替入力が確定）
    expect(viaShu.doneMorae).toBe(0); // "s" だけではまだ「しゅ」は未確定
    expect(viaSplit.doneMorae).toBe(1); // "si" で1モーラ目が確定（残りは lyuuseiwoateru）
  });

  it('1文字も打っていない時は0モーラ', () => {
    expect(kanaProgressFromRomaji('たのしい', 0, 8).doneMorae).toBe(0);
  });

  it('全部打ち終えると全モーラ確定', () => {
    const hira = 'たのしい';
    const p = kanaProgressFromRomaji(hira, 8, 0);
    expect(p.doneMorae).toBe(p.totalMorae);
  });

  it('remainedLen が 0 でも例外を投げない（防御）', () => {
    expect(() => kanaProgressFromRomaji('た', 2, 0)).not.toThrow();
  });
});
