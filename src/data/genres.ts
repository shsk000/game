export type GenreId = 'action' | 'puzzle' | 'rpg' | 'horror';

export type Genre = {
  id: GenreId;
  name: string;
  emoji: string;
  bgColor: string;
  snippets: string[];
};

export const GENRES: Genre[] = [
  {
    id: 'action',
    name: 'アクション',
    emoji: '⚔️',
    bgColor: '#b1361e',
    snippets: [
      'たたかえ',
      'ひっさつわざ',
      'ばくはつする',
      'はやくにげろ',
      'こうげき',
      'ぼうぎょ',
      'ふきとばす',
      'みきり',
      'いちげきりだつ',
      'はんげき',
      'ためうち',
      'こんしんのいちげき',
      'のろし',
      'りゅうせいぐん',
    ],
  },
  {
    id: 'puzzle',
    name: 'パズル',
    emoji: '🧩',
    bgColor: '#1f6aa3',
    snippets: [
      'ひらめき',
      'こたえはなに',
      'もうひとてま',
      'くみあわせ',
      'ぴたりとはまる',
      'ふかいろんり',
      'てとり',
      'はんてん',
      'ななめにそろえる',
      'いってがけ',
      'たてとよこ',
      'けいさん',
      'ぱずるかんせい',
    ],
  },
  {
    id: 'rpg',
    name: 'RPG',
    emoji: '🐉',
    bgColor: '#3d8b3d',
    snippets: [
      'まおうをたおせ',
      'でんせつのつるぎ',
      'ぱーてぃ',
      'まほうつかい',
      'やくそう',
      'すらいむ',
      'けいけんち',
      'れべるあっぷ',
      'ちからをためる',
      'ふっかつのじゅもん',
      'なかまになる',
      'たびのおわり',
      'よみがえる',
      'こだいのいせき',
      'おうのまえ',
    ],
  },
  {
    id: 'horror',
    name: 'ホラー',
    emoji: '👻',
    bgColor: '#5a2680',
    snippets: [
      'うしろをみるな',
      'あしおとがちかい',
      'ろうそくのひ',
      'のろい',
      'よみがえる',
      'やみのなか',
      'こえがきこえる',
      'ひめいがひびく',
      'にげばがない',
      'うしろにいる',
      'まどがあいた',
      'かべのうら',
      'にどとふりむくな',
      'こわれたかがみ',
    ],
  },
];

export const GENRE_BY_ID: Record<GenreId, Genre> = GENRES.reduce((acc, g) => {
  acc[g.id] = g;
  return acc;
}, {} as Record<GenreId, Genre>);

export const getPhrases = (genreId: GenreId, count: number): string[] => {
  const pool = GENRE_BY_ID[genreId].snippets;
  const result: string[] = [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
};
