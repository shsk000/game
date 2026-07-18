import type { GenreId } from './genres';
import type { ThemeId } from './themes';

/** タブ・改行込みの複数行テンプレ（実装ログでインデント付きコードとして流れる） */
export const TEMPLATES: string[] = [
  'function {verb}({arg}) {\n\treturn {arg}.{prop};\n}',
  'async function {verb}({arg}) {\n\tawait {arg}.{prop}();\n}',
  'class {Cls} extends {Base} {\n\t{prop} = {val};\n}',
  'const {arg} = new {Cls}(\n\t{prop}: {val},\n);',
  'export function {verb}({arg}) {\n\t{arg}.{prop} = {val};\n}',
  'interface I{Cls} {\n\t{prop}: {val};\n\t{verb}(): void;\n}',
  'private {verb}({arg}: {Cls}) {\n\tif ({arg}.{prop}) return;\n}',
  'public {verb}({arg}) {\n\tfor (const i of {arg}.{prop})\n\t\ti.{verb}();\n}',
  'const {Cls} = ({ {arg} }) => (\n\t<div>{ {arg}.{prop} }</div>\n);',
  'function {verb}() {\n\treturn {arg}.{prop} * 2;\n}',
];

export const GENRE_VERBS: Record<GenreId, string[]> = {
  action: ['attack', 'dash', 'combo', 'rage', 'strike', 'parry'],
  puzzle: ['solve', 'match', 'rotate', 'swap', 'clear'],
  rpg: ['cast', 'slay', 'revive', 'quest', 'levelUp', 'enchant'],
  shooter: ['fire', 'reload', 'lockOn', 'snipe', 'dodge'],
  adventure: ['explore', 'unlock', 'readNote', 'travel', 'discover'],
  simulation: ['simulate', 'build', 'manage', 'invest', 'optimize'],
  racing: ['boost', 'drift', 'overtake', 'brake', 'shift'],
  horror: ['haunt', 'whisper', 'flicker', 'curse', 'lurk'],
  fighting: ['punch', 'kick', 'guard', 'counter', 'launch'],
  roguelike: ['descend', 'reroll', 'loot', 'spawn', 'perish'],
  rhythm: ['tap', 'hold', 'sync', 'beat', 'groove'],
  sandbox: ['mine', 'craft', 'place', 'harvest', 'sculpt'],
  strategy: ['command', 'scout', 'fortify', 'ally', 'conquer', 'deploy'],
  sports: ['kick', 'pass', 'sprint', 'score', 'train', 'cheer'],
  survival: ['scavenge', 'craft', 'hunt', 'shelter', 'endure', 'forage'],
  cardgame: ['draw', 'shuffle', 'summon', 'combo', 'bluff', 'deal'],
  towerdefense: ['place', 'upgrade', 'defend', 'intercept', 'repel'],
  partygame: ['jump', 'race', 'tag', 'shuffle', 'celebrate'],
  escapegame: ['unlock', 'solve', 'search', 'decode', 'escape'],
  romanceadventure: ['confess', 'blush', 'meet', 'remember', 'choose'],
  boardgame: ['roll', 'move', 'trade', 'build', 'collect'],
  quiz: ['answer', 'buzz', 'guess', 'study', 'score'],
  platformer: ['jump', 'dash', 'climb', 'bounce', 'glide', 'land'],
  visualnovel: ['narrate', 'choose', 'branch', 'recall', 'unfold'],
  raisingsim: ['feed', 'nurture', 'evolve', 'pet', 'hatch'],
  fishing: ['cast', 'reel', 'wait', 'hook', 'release'],
  fps: ['aim', 'reload', 'cover', 'breach', 'suppress', 'advance'],
};

export const GENRE_CLASSES: Record<GenreId, string[]> = {
  action: ['Hero', 'Sword', 'Enemy', 'Boss'],
  puzzle: ['Board', 'Tile', 'Solver', 'Cell'],
  rpg: ['Warrior', 'Mage', 'Dragon', 'Party'],
  shooter: ['Ship', 'Bullet', 'Wave', 'Beam'],
  adventure: ['Hero', 'Map', 'Door', 'Journal'],
  simulation: ['City', 'Citizen', 'Factory', 'Road'],
  racing: ['Car', 'Track', 'Driver', 'Tire'],
  horror: ['Yokai', 'Curse', 'Shadow', 'Ghost'],
  fighting: ['Fighter', 'Stage', 'Combo', 'Move'],
  roguelike: ['Dungeon', 'Run', 'Item', 'Floor'],
  rhythm: ['Note', 'Track', 'Player', 'Beat'],
  sandbox: ['Block', 'World', 'Tool', 'Builder'],
  strategy: ['Commander', 'Army', 'Territory', 'Tactic'],
  sports: ['Player', 'Team', 'Stadium', 'Match'],
  survival: ['Survivor', 'Shelter', 'Resource', 'Threat'],
  cardgame: ['Card', 'Deck', 'Hand', 'Duelist'],
  towerdefense: ['Tower', 'Wave', 'Path', 'Core'],
  partygame: ['Player', 'Minigame', 'Party', 'Confetti'],
  escapegame: ['Room', 'Puzzle', 'Key', 'Clock'],
  romanceadventure: ['Heroine', 'Letter', 'Memory', 'Ending'],
  boardgame: ['Pawn', 'Board', 'Dice', 'Piece'],
  quiz: ['Question', 'Buzzer', 'Score', 'Panel'],
  platformer: ['Hero', 'Platform', 'Coin', 'Goal'],
  visualnovel: ['Story', 'Choice', 'Chapter', 'Route'],
  raisingsim: ['Creature', 'Egg', 'Habitat', 'Bond'],
  fishing: ['Rod', 'Fish', 'Lake', 'Bait'],
  fps: ['Soldier', 'Weapon', 'Squad', 'Objective'],
};

export const THEME_NOUNS: Record<ThemeId, string[]> = {
  fantasy: ['elf', 'dragon', 'spell', 'crown', 'rune'],
  sf: ['quantum', 'warpDrive', 'cyborg', 'plasma', 'orbit'],
  medieval: ['knight', 'castle', 'crest', 'lance', 'banner'],
  modern: ['city', 'subway', 'phone', 'street', 'cafe'],
  war: ['tank', 'medic', 'trench', 'rifle', 'radar'],
  sushi: ['tuna', 'wasabi', 'rice', 'plate', 'belt'],
  farming: ['crop', 'tractor', 'seed', 'barn', 'cow'],
  salaryman: ['report', 'meeting', 'overtime', 'deadline', 'manager'],
  konbini: ['onigiri', 'register', 'shelf', 'receipt', 'oden'],
  onsen: ['hotSpring', 'towel', 'steam', 'yukata', 'sake'],
  ninja: ['shuriken', 'shadow', 'kunai', 'scroll', 'rooftop'],
  pirate: ['treasure', 'compass', 'rum', 'sail', 'parrot'],
  alien: ['ufo', 'tentacle', 'beam', 'probe', 'mothership'],
  zombie: ['brain', 'horde', 'shelter', 'survivor', 'virus'],
  animal: ['cat', 'puppy', 'paw', 'feather', 'tail'],
  camping: ['tent', 'campfire', 'lantern', 'sleepingBag', 'trail'],
  library: ['bookshelf', 'archive', 'quill', 'index', 'silence'],
  school: ['classroom', 'chalk', 'locker', 'notebook', 'recess'],
  amusementpark: ['ferrisWheel', 'ticket', 'parade', 'balloon', 'coaster'],
  resort: ['palm', 'cocktail', 'poolside', 'sunset', 'lagoon'],
  idol: ['spotlight', 'mic', 'fanClub', 'encore', 'glowStick'],
  detective: ['clue', 'magnifier', 'alibi', 'suspect', 'fog'],
  hauntedhouse: ['cobweb', 'creak', 'candle', 'portrait', 'attic'],
  circus: ['tightrope', 'juggler', 'tent', 'clown', 'trapeze'],
  urbanlegend: ['rumor', 'shadow', 'whisper', 'phone', 'alley'],
  musicfestival: ['stage', 'crowd', 'speaker', 'setlist', 'encore'],
  samurai: ['katana', 'dojo', 'honor', 'scroll', 'lantern'],
  cyberpunk: ['neon', 'implant', 'hacker', 'drone', 'megacity'],
};

export const THEME_PROPS: Record<ThemeId, string[]> = {
  fantasy: ['mana', 'aura', 'might', 'glory'],
  sf: ['energy', 'velocity', 'entropy', 'lumen'],
  medieval: ['honor', 'valor', 'armor', 'oath'],
  modern: ['signal', 'traffic', 'feed', 'noise'],
  war: ['morale', 'ammo', 'cover', 'rank'],
  sushi: ['freshness', 'spice', 'umami', 'price'],
  farming: ['growth', 'soil', 'yield', 'rain'],
  salaryman: ['fatigue', 'salary', 'kpi', 'mood'],
  konbini: ['stock', 'price', 'demand', 'shift'],
  onsen: ['warmth', 'pressure', 'mineral', 'relax'],
  ninja: ['stealth', 'speed', 'focus', 'silence'],
  pirate: ['gold', 'wind', 'fame', 'rum'],
  alien: ['energy', 'signal', 'mass', 'dna'],
  zombie: ['hunger', 'rot', 'panic', 'count'],
  animal: ['cuteness', 'energy', 'hunger', 'mood'],
  camping: ['warmth', 'supplies', 'quiet', 'smoke'],
  library: ['silence', 'dust', 'knowledge', 'order'],
  school: ['grade', 'friendship', 'schedule', 'nostalgia'],
  amusementpark: ['excitement', 'queue', 'joy', 'lights'],
  resort: ['relaxation', 'breeze', 'tan', 'leisure'],
  idol: ['charisma', 'fame', 'sweat', 'applause'],
  detective: ['tension', 'logic', 'doubt', 'evidence'],
  hauntedhouse: ['fear', 'chill', 'dust', 'silence'],
  circus: ['balance', 'wonder', 'risk', 'applause'],
  urbanlegend: ['dread', 'mystery', 'static', 'unease'],
  musicfestival: ['hype', 'volume', 'unity', 'fatigue'],
  samurai: ['honor', 'discipline', 'resolve', 'silence'],
  cyberpunk: ['signal', 'implantRate', 'grime', 'voltage'],
};

const BASES = ['Entity', 'Component', 'Node', 'Actor', 'Sprite', 'Controller'];

const pick = <T>(arr: T[], idx: number): T => arr[Math.abs(idx) % arr.length];

const formatValue = (raw: string, idx: number): string => {
  const mode = idx % 4;
  if (mode === 0) return `'${raw}'`;
  if (mode === 1) return String(((idx * 7) % 90) + 10);
  if (mode === 2) return 'true';
  return `[${(idx % 5) + 1}]`;
};

const buildStatement = ({
  genreId,
  themeId,
  idx,
}: {
  genreId: GenreId;
  themeId: ThemeId;
  idx: number;
}): string => {
  const tpl = pick(TEMPLATES, idx);
  const verbs = GENRE_VERBS[genreId];
  const classes = GENRE_CLASSES[genreId];
  const nouns = THEME_NOUNS[themeId];
  const props = THEME_PROPS[themeId];

  const verb = pick(verbs, idx);
  const cls = pick(classes, idx + 1);
  const base = pick(BASES, idx + 2);
  const arg = pick(nouns, idx);
  const prop = pick(props, idx + 1);
  const val = formatValue(pick(nouns, idx + 3), idx);

  return tpl
    .replaceAll('{verb}', verb)
    .replaceAll('{Cls}', cls)
    .replaceAll('{Base}', base)
    .replaceAll('{arg}', arg)
    .replaceAll('{prop}', prop)
    .replaceAll('{val}', val);
};

/** 1回のフレーズで複数の文を繋げて長めのコードブロックにする（打つほど色んな文が流れて見える） */
const STATEMENTS_PER_LINE = 3;

export const buildLine = ({
  genreId,
  themeId,
  idx,
}: {
  genreId: GenreId;
  themeId: ThemeId;
  idx: number;
}): string =>
  Array.from({ length: STATEMENTS_PER_LINE }, (_, i) =>
    buildStatement({ genreId, themeId, idx: idx * STATEMENTS_PER_LINE + i * 7 }),
  ).join('\n\n');
