// Used by the Lingyin team map at birth/respawn, never in the per-frame AI.
// Disperse spawn zones while keeping a useful distance from live opponents.
export function chooseDistributedSpawnIndex(points, opponents = [], previousZone = null,
    random = Math.random, safeDistance = 11) {
  if (!points?.length) return -1;
  const threats=opponents.filter(actor=>actor&&!actor.dead&&actor.alive!==false)
    .map(actor=>actor.group?.position||actor.pos||actor.position).filter(Boolean);
  const choices=points.map((point,index)=>({index,zone:point[3],distance:threats.reduce(
    (nearest,p)=>Math.min(nearest,Math.hypot(point[0]-p.x,point[2]-p.z)),Infinity)}));
  let eligible=choices.filter(choice=>choice.distance>=safeDistance);
  if (!eligible.length) {
    const farthest=Math.max(...choices.map(choice=>choice.distance));
    eligible=choices.filter(choice=>choice.distance>=farthest-1.5);
  }
  const otherZones=eligible.filter(choice=>choice.zone!==previousZone);
  if(otherZones.length)eligible=otherZones;
  return eligible[Math.min(eligible.length-1,
    Math.floor(Math.max(0,Math.min(.999999,random()))*eligible.length))].index;
}
