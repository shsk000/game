export type GenreId =
  | 'action'
  | 'puzzle'
  | 'rpg'
  | 'shooter'
  | 'adventure'
  | 'simulation'
  | 'racing'
  | 'horror'
  | 'fighting'
  | 'roguelike'
  | 'rhythm'
  | 'sandbox';

export type GenreTag = 'fast' | 'logic' | 'epic' | 'scary' | 'chill' | 'wild' | 'story';

export type Genre = {
  id: GenreId;
  name: string;
  emoji: string;
  bgColor: string;
  tags: GenreTag[];
  /** 解放ステージ（1=初期 / 2=序盤 / 3=中盤 / 4=終盤） */
  unlockStage: 1 | 2 | 3 | 4;
  snippets: string[];
};

export const GENRES: Genre[] = [
  {
    id: 'action',
    name: 'アクション',
    emoji: '⚔️',
    bgColor: '#b1361e',
    tags: ['fast', 'wild'],
    unlockStage: 1,
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
    tags: ['logic', 'chill'],
    unlockStage: 1,
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
    tags: ['epic', 'story'],
    unlockStage: 1,
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
    id: 'shooter',
    name: 'シューティング',
    emoji: '🛸',
    bgColor: '#c2185b',
    tags: ['fast', 'wild'],
    unlockStage: 2,
    snippets: [
      'うちまくれ',
      'れんしゃ',
      'そうこうげき',
      'かいひこうどう',
      'ぼすしゅつげん',
      'ばりあ',
      'ろっくおん',
      'どだいばくはつ',
      'せんめつ',
      'せんぽうきょうか',
      'えねるぎーかいふく',
      'がんばーれる',
      'ぱわーあっぷ',
    ],
  },
  {
    id: 'adventure',
    name: 'アドベンチャー',
    emoji: '🗺️',
    bgColor: '#6b4f1d',
    tags: ['story', 'chill'],
    unlockStage: 2,
    snippets: [
      'ぼうけんがはじまる',
      'とびらをあける',
      'てがみをよむ',
      'せんちょうのにっき',
      'ちずをひろげる',
      'みなとまち',
      'きいろいかぎ',
      'ふるいかいだん',
      'せれんでぃぴてぃ',
      'ものがたりはつづく',
      'ふしぎなはこ',
      'うみがみえる',
    ],
  },
  {
    id: 'simulation',
    name: 'シミュレーション',
    emoji: '🏗️',
    bgColor: '#37474f',
    tags: ['logic', 'chill'],
    unlockStage: 3,
    snippets: [
      'けいざいをまわす',
      'じゅうみんのこえ',
      'どうろをひく',
      'こうじょうをたてる',
      'けいかくたっせい',
      'しせいせんきょ',
      'すうちかんり',
      'ぼうえきかいし',
      'こうつうもう',
      'ぜいきんちょうしゅう',
      'こうきょうじぎょう',
      'よみがえるまち',
    ],
  },
  {
    id: 'racing',
    name: 'レース',
    emoji: '🏁',
    bgColor: '#e65100',
    tags: ['fast'],
    unlockStage: 3,
    snippets: [
      'すたーとだっしゅ',
      'こーなーくりあ',
      'ぴっといん',
      'たいやこうかん',
      'ぶーすと',
      'いっきにごぼう',
      'まくり',
      'ふぁいなるらっぷ',
      'せっつう',
      'どらいぶ',
      'ばっくみらー',
      'ふぃにっしゅ',
    ],
  },
  {
    id: 'horror',
    name: 'ホラー',
    emoji: '👻',
    bgColor: '#5a2680',
    tags: ['scary', 'story'],
    unlockStage: 3,
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
  {
    id: 'fighting',
    name: '格闘',
    emoji: '🥊',
    bgColor: '#7b1818',
    tags: ['fast', 'wild'],
    unlockStage: 3,
    snippets: [
      'ばーじょんちぇんじ',
      'こんぼ',
      'ひっさつ',
      'じゃすとがーど',
      'うらわざ',
      'はっそく',
      'ためうち',
      'たいてん',
      'れんけきはっせい',
      'とどめ',
      'えくせれんとぎゃくてん',
      'けってん',
    ],
  },
  {
    id: 'roguelike',
    name: 'ローグライク',
    emoji: '🎲',
    bgColor: '#2e7d32',
    tags: ['wild', 'logic'],
    unlockStage: 4,
    snippets: [
      'らんだむせいせい',
      'たんけん',
      'てつだいぼっとう',
      'ふっかつふか',
      'じょうきょうほうかい',
      'はいぶりっどたっく',
      'せんりつだんじょん',
      'ふんぐつ',
      'がしかくとく',
      'せかいせんたく',
      'いちごいちえ',
      'せんりょくくみあげ',
    ],
  },
  {
    id: 'rhythm',
    name: 'リズム',
    emoji: '🎵',
    bgColor: '#ad1457',
    tags: ['fast', 'chill'],
    unlockStage: 4,
    snippets: [
      'びーとをきざめ',
      'てんぽあっぷ',
      'ぱーふぇくと',
      'こんぼけいぞく',
      'ふるこんぼ',
      'りずむきーぷ',
      'たいみんぐきっかり',
      'うらびーと',
      'じゅうろくびーと',
      'ぐるーぶ',
      'えくせれんと',
      'まっくすこんぼ',
    ],
  },
  {
    id: 'sandbox',
    name: 'サンドボックス',
    emoji: '🧱',
    bgColor: '#5d4037',
    tags: ['epic', 'chill'],
    unlockStage: 4,
    snippets: [
      'けんちくはじめ',
      'ぶろっくつみあげ',
      'こうぶつほりおこし',
      'どうぐきょうか',
      'けんちくかんせい',
      'のうじょうかいたく',
      'ようさいけんせつ',
      'とおいせかいへ',
      'こうぞうたいけんさ',
      'りょうさんたいせい',
      'ぼうけんしゃぼしゅう',
      'せかいさいせい',
    ],
  },
];

export const GENRE_BY_ID: Record<GenreId, Genre> = GENRES.reduce(
  (acc, g) => {
    acc[g.id] = g;
    return acc;
  },
  {} as Record<GenreId, Genre>,
);

export const getPhrases = (genreId: GenreId, count: number): string[] => {
  const pool = GENRE_BY_ID[genreId].snippets;
  const result: string[] = [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
};

export const INITIAL_GENRE_IDS: GenreId[] = GENRES.filter((g) => g.unlockStage === 1).map(
  (g) => g.id,
);
