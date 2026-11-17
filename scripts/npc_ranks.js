// CF NPC military ranks.
//
// The source artwork is the 5 x 3 rank chart supplied for this local game.
// Difficulty never changes NPC health through this module: it only selects one
// of three five-rank bands for presentation and roster identity.
export const NPC_RANKS = Object.freeze([
  { id: 'sergeant', name: '中士' },
  { id: 'staff-sergeant', name: '上士' },
  { id: 'sfc', name: '一级军士长' },
  { id: 'master-sergeant', name: '高级军士长' },
  { id: 'second-lieutenant', name: '少尉' },
  { id: 'first-lieutenant', name: '中尉' },
  { id: 'captain', name: '上尉' },
  { id: 'major', name: '少校' },
  { id: 'lieutenant-colonel', name: '中校' },
  { id: 'colonel', name: '上校' },
  { id: 'brigadier-general', name: '准将' },
  { id: 'major-general', name: '少将' },
  { id: 'lieutenant-general', name: '中将' },
  { id: 'general', name: '上将' },
  { id: 'marshal', name: '元帅' },
].map((rank, index) => Object.freeze({
  ...rank,
  index,
  icon: `./assets/ui/ranks/${rank.id}.png`,
})));

export const NPC_RANK_BANDS = Object.freeze({
  easy: Object.freeze([0, 4]),
  normal: Object.freeze([5, 9]),
  hard: Object.freeze([10, 14]),
});

function stableIdentityHash(identity) {
  let hash = 2166136261;
  for (const char of String(identity || 'NPC')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Pick one stable rank from the difficulty's five-rank band.
 * A name keeps the same rank while the lobby refreshes; the slot offset keeps
 * duplicate/fallback names from collapsing to one identical badge.
 */
export function npcRankForDifficulty(difficultyId, identity, slot = 0) {
  const band = NPC_RANK_BANDS[difficultyId] || NPC_RANK_BANDS.normal;
  const width = band[1] - band[0] + 1;
  const offset = (stableIdentityHash(identity) + Math.max(0, slot | 0) * 3) % width;
  return NPC_RANKS[band[0] + offset];
}

export function rankBandForDifficulty(difficultyId) {
  const band = NPC_RANK_BANDS[difficultyId] || NPC_RANK_BANDS.normal;
  return NPC_RANKS.slice(band[0], band[1] + 1);
}
