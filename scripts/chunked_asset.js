export async function fetchJoinedAsset(parts, assetUrl, label = '资源') {
  if (!Array.isArray(parts) || parts.length === 0)
    throw new Error(`${label}分块清单为空`);
  const chunks = await Promise.all(parts.map(async name => {
    const response = await fetch(assetUrl(name));
    if (!response.ok) throw new Error(`${label}分块缺失: ${name}`);
    return new Uint8Array(await response.arrayBuffer());
  }));
  const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined.buffer;
}

export async function fetchChunkedMap(base, version, label) {
  const assetUrl = name => {
    const url = new URL(name, base);
    if (version) url.searchParams.set('v', version);
    return url;
  };
  const manifestResponse = await fetch(assetUrl('map.assets.json'));
  if (!manifestResponse.ok) throw new Error(`${label}资源清单缺失`);
  const manifest = await manifestResponse.json();
  const [jsonBytes, binary] = await Promise.all([
    fetchJoinedAsset(manifest.jsonParts, assetUrl, `${label}地图数据`),
    fetchJoinedAsset(manifest.binaryParts, assetUrl, `${label}地图网格`),
  ]);
  return { data: JSON.parse(new TextDecoder().decode(jsonBytes)), binary };
}
