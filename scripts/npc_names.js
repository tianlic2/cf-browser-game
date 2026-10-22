// Local multiplayer-style nicknames.  A name is generated once for a roster
// slot and then remains stable for the whole match; only a new match reshuffles.
const CN_BASE = Object.freeze([
  '晚风', '阿杰', '小北', '林哥', '子墨', '南城', '半夏', '北辰',
  '小宇', '阿哲', '大白', '青山', '橘子', '十一', '老K', '小雨',
  '清欢', '木子', '可乐', '七月', '一川', '小满', '星河', '陆离',
]);
const EN_BASE = Object.freeze([
  'Alex', 'Kevin', 'Mason', 'Niko', 'Ryan', 'Leo', 'Jason', 'Kenny',
  'Rex', 'Tony', 'Dylan', 'Aiden', 'Milo', 'Lucas', 'Allen', 'Evan',
]);
const HANDLE_LEFT = Object.freeze([
  'Silent', 'Night', 'North', 'Lucky', 'Zero', 'Cold', 'Tiny', 'Blue',
  'Fast', 'Old', 'Neo', 'Dark',
]);
const HANDLE_RIGHT = Object.freeze([
  'Fox', 'Cat', 'Rain', 'Wolf', 'Ray', 'Moon', 'Ace', 'Bear',
  'Wind', 'Shot', 'K', 'One',
]);
const CLAN = Object.freeze(['GR', 'BL', 'AG', 'Q9', 'X', 'MVP']);

function pick(list, random) {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

function digits(random, short = false) {
  const max = short ? 100 : 1000;
  return String(Math.floor(random() * max)).padStart(short ? 2 : 1, '0');
}

export function randomNpcName(random = Math.random) {
  const style = random();
  let name;
  if (style < .44) {
    name = pick(CN_BASE, random);
    const extra = random();
    if (extra < .24) name += digits(random, true);
    else if (extra < .36) name = `${name}_${pick(['7', 'K', 'M', 'X'], random)}`;
  } else if (style < .76) {
    name = pick(EN_BASE, random);
    if (random() < .42) name += digits(random, true);
  } else {
    name = pick(HANDLE_LEFT, random) + pick(HANDLE_RIGHT, random);
    if (random() < .28) name += digits(random, true);
  }
  if (random() < .1) name = `[${pick(CLAN, random)}]${name}`;
  return name.slice(0, 16);
}

export function createNpcNamePool(count, random = Math.random, reserved = []) {
  const used = new Set(reserved.map(String));
  const result = [];
  const want = Math.max(0, count | 0);
  for (let i = 0; i < want; i++) {
    let candidate = '';
    for (let attempt = 0; attempt < 40; attempt++) {
      candidate = randomNpcName(random);
      if (!used.has(candidate)) break;
    }
    if (used.has(candidate)) {
      const stem = candidate.slice(0, 12) || 'Player';
      let suffix = 2;
      while (used.has(`${stem}${suffix}`)) suffix++;
      candidate = `${stem}${suffix}`.slice(0, 16);
    }
    used.add(candidate);
    result.push(candidate);
  }
  return result;
}
