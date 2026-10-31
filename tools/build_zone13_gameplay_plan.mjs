#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(root, 'assets/local/cf_bio_candidates/zone13');
const grayboxDir = path.join(local, 'graybox');
const sourceScript = fs.readFileSync(path.join(local, 'pak/scripts/vscripts/zone13zm.nut'), 'utf8');
const sourceBsp = fs.readFileSync(path.join(local, 'extracted/zm_zone13.bsp'));
const currentMode = fs.readFileSync(path.join(root, 'scripts/bio_mode.js'), 'utf8');
const currentRules = fs.readFileSync(path.join(root, 'scripts/bio_rules.js'), 'utf8');
const graybox = JSON.parse(fs.readFileSync(path.join(grayboxDir, 'zone13-graybox.json'), 'utf8'));
const nav = JSON.parse(fs.readFileSync(path.join(grayboxDir, 'zone13-navmesh.json'), 'utf8'));

function numberFrom(text, pattern, label) {
  const value = Number(text.match(pattern)?.[1]);
  if (!Number.isFinite(value)) throw new Error(`Missing numeric rule: ${label}`);
  return value;
}

function nearestArea(position) {
  let nearest = null;
  let distanceSq = Infinity;
  for (const area of nav.areas) {
    const dx = position[0] - area.center[0];
    const dy = position[1] - area.center[1];
    const dz = position[2] - area.center[2];
    const score = dx * dx + dz * dz + dy * dy * 2;
    if (score < distanceSq) { nearest = area; distanceSq = score; }
  }
  return { areaId: nearest?.id || 0, component: nearest?.component ?? -1, distance: Math.sqrt(distanceSq) };
}

const points = graybox.markers
  .filter((marker) => ['spawn', 'weapon', 'supply'].includes(marker.kind))
  .map((marker) => ({ ...marker, navigation: nearestArea(marker.position) }));
const sourceWeapons = [...sourceScript.matchAll(/\["(weapon_[^"]+)","([^"]+)"\]/g)]
  .map(([, id, label]) => ({ id, label }));
const uniqueWeapons = [...new Map(sourceWeapons.map((item) => [item.id, item])).values()];

const source = {
  preparationSeconds: numberFrom(sourceScript, /V_ROUNDSTART_CD\s*<-\s*([\d.]+)/, 'source preparation'),
  humanHealth: numberFrom(sourceScript, /V_HUMAN_HEALTH\s*<-\s*([\d.]+)/, 'source human health'),
  humanSpeedMultiplier: numberFrom(sourceScript, /V_HUMAN_SPEED\s*<-\s*([\d.]+)/, 'source human speed'),
  humanGravityMultiplier: numberFrom(sourceScript, /V_HUMAN_GRAVITY\s*<-\s*([\d.]+)/, 'source human gravity'),
  zombieHealthBasePerPlayer: numberFrom(sourceScript, /V_ZOMBIE_HEALTH_BASE\s*<-\s*([\d.]+)/, 'source zombie health base'),
  zombieHealthOffset: numberFrom(sourceScript, /V_ZOMBIE_HEALTH_OFFSET\s*<-\s*([\d.]+)/, 'source zombie health offset'),
  zombieSpeedMultiplier: numberFrom(sourceScript, /V_ZOMBIE_SPEED\s*<-\s*([\d.]+)/, 'source zombie speed'),
  zombieGravityMultiplier: numberFrom(sourceScript, /V_ZOMBIE_GRAVITY\s*<-\s*([\d.]+)/, 'source zombie gravity'),
  zombieRegenTicks: numberFrom(sourceScript, /V_ZOMBIE_REHAB_HEALTH_CD\s*<-\s*([\d.]+)/, 'source zombie regen delay'),
  zombieRegenAmount: numberFrom(sourceScript, /V_ZOMBIE_REHAB_HEALTH_AMT\s*<-\s*([\d.]+)/, 'source zombie regen amount'),
  secondMotherZombieAtPlayers: 6,
  weaponPool: uniqueWeapons,
  weaponPoolWeighted: sourceWeapons.slice(0, 7),
  weaponCrates: points.filter((point) => point.kind === 'weapon').length,
  airdropWaves: 2,
  airdropCandidatesPerWave: 5,
  airdropSeconds: (() => {
    const entityOffset = sourceBsp.readInt32LE(8), entityLength = sourceBsp.readInt32LE(12);
    const entities = sourceBsp.toString('utf8', entityOffset, entityOffset + entityLength);
    return ['Airdrop()', 'Airdrops()'].map((name) => Number(entities.match(new RegExp(`RunScriptCode[^\\n]*${name.replace(/[()]/g, '\\$&')}[^\\n]*?([0-9]+)(?:\\x1b|$)`))?.[1]) || 0);
  })(),
};
const current = {
  preparationSeconds: numberFrom(currentMode, /const PREP\s*=\s*([\d.]+)/, 'current preparation'),
  roundSeconds: numberFrom(currentMode, /const ROUND\s*=\s*([\d.]+)/, 'current round'),
  zombieHealth: numberFrom(currentMode, /const ZOMBIE_HEALTH\s*=\s*([\d.]+)/, 'current zombie health'),
  npcCount: numberFrom(currentRules, /BIO_NPC_COUNT\s*=\s*([\d.]+)/, 'current npc count'),
  initialZombies: numberFrom(currentRules, /BIO_INITIAL_ZOMBIES\s*=\s*([\d.]+)/, 'current initial zombies'),
  damageMilestone: numberFrom(currentRules, /BIO_DAMAGE_MILESTONE\s*=\s*([\d.]+)/, 'current damage milestone'),
};
const mainPoints = points.filter((point) => point.navigation.component === 0);
const payload = {
  format: 'zone13-local-gameplay-plan-v1',
  status: 'preview-only',
  source: 'zm_zone13 BSP entities, NAV v16 and zone13zm.nut',
  rules: { source, current },
  reachability: {
    navAreas: nav.stats.areas,
    mainComponentAreas: nav.stats.largestComponent,
    disconnectedAreas: nav.stats.areas - nav.stats.largestComponent,
    checkedPoints: points.length,
    pointsOnMainComponent: mainPoints.length,
    maxPointToNavDistance: Math.max(...points.map((point) => point.navigation.distance)),
  },
  points,
  decisions: [
    '保留当前项目的15秒预备和180秒回合，不直接覆盖为源脚本数值。',
    '初始感染者数量在正式接入时按实际玩家数量重新平衡。',
    '武器箱与两轮空投只作为地图交互方案，暂不改动正式背包和掉落物系统。',
  ],
};

const output = path.join(grayboxDir, 'zone13-gameplay-plan.json');
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ output, source, current, reachability: payload.reachability }, null, 2));
