import type { TenantDatabaseSnapshot } from "@mms/shared";

/**
 * Streams a tenant database snapshot as JSON string chunks without buffering
 * the entire multi-megabyte serialized string in V8 heap memory.
 */
export async function* generateSnapshotJsonChunks(
  snapshot: TenantDatabaseSnapshot,
): AsyncGenerator<string, void, unknown> {
  yield "{";

  let hasPreviousField = false;

  // Stream collections chunk-by-chunk
  if (snapshot.collections && typeof snapshot.collections === "object") {
    yield '"collections":{';
    let firstCollection = true;
    for (const [colName, items] of Object.entries(snapshot.collections)) {
      if (!firstCollection) yield ",";
      firstCollection = false;
      yield `${JSON.stringify(colName)}:[`;
      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          if (i > 0) yield ",";
          yield JSON.stringify(items[i]);
        }
      }
      yield "]";
    }
    yield "}";
    hasPreviousField = true;
  }

  // Stream objects chunk-by-chunk
  if (snapshot.objects && typeof snapshot.objects === "object") {
    if (hasPreviousField) yield ",";
    yield '"objects":{';
    let firstObject = true;
    for (const [objKey, objVal] of Object.entries(snapshot.objects)) {
      if (!firstObject) yield ",";
      firstObject = false;
      yield `${JSON.stringify(objKey)}:${JSON.stringify(objVal)}`;
    }
    yield "}";
    hasPreviousField = true;
  }

  // Stream assets chunk-by-chunk
  if (snapshot.assets && typeof snapshot.assets === "object") {
    if (hasPreviousField) yield ",";
    yield '"assets":{';
    let firstAsset = true;
    for (const [assetUrl, assetBase64] of Object.entries(snapshot.assets)) {
      if (!firstAsset) yield ",";
      firstAsset = false;
      yield `${JSON.stringify(assetUrl)}:${JSON.stringify(assetBase64)}`;
    }
    yield "}";
    hasPreviousField = true;
  }

  // Any other top-level metadata properties (e.g. version, exportedAt)
  for (const [key, value] of Object.entries(Object.assign({}, snapshot))) {
    if (key === "collections" || key === "objects" || key === "assets") continue;
    if (value === undefined) continue;
    if (hasPreviousField) yield ",";
    yield `${JSON.stringify(key)}:${JSON.stringify(value)}`;
    hasPreviousField = true;
  }

  yield "}";
}
