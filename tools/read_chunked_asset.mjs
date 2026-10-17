import { readFileSync } from 'node:fs';

export function readJoinedAsset(base, parts) {
  if (!Array.isArray(parts) || parts.length === 0)
    throw new Error('asset part list is empty');
  return Buffer.concat(parts.map(name => readFileSync(new URL(name, base))));
}

export function readChunkedMap(base) {
  const manifest = JSON.parse(readFileSync(new URL('map.assets.json', base), 'utf8'));
  const json = readJoinedAsset(base, manifest.jsonParts);
  const binary = readJoinedAsset(base, manifest.binaryParts);
  return { map: JSON.parse(json.toString('utf8')), binary, manifest };
}
