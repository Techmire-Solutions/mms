import {
  WORKSPACES_COLLECTION,
  PLATFORM_SUPER_USERS_OBJECT_KEY,
  isServerOnlyObjectKey,
} from "@mms/shared";

/**
 * Streaming source for {@link generateSnapshotJsonFromSource}: the same three
 * tenants as `TenantDatabaseSnapshot` (`collections`, `objects`, `assets`) but
 * as async-iterables, so each collection/table/asset can be read, serialized,
 * and released without holding the whole tenant in memory at once.
 */
export interface SnapshotJsonSource {
  /** [collectionName, rows | asyncRows][] in deterministic order. */
  collections?: AsyncIterable<[string, unknown[] | AsyncIterable<unknown>]>;
  /** [logicalKey, value][] in deterministic order. */
  objects?: AsyncIterable<[string, unknown]>;
  /** [uploadUrl, base64][] in deterministic order. */
  assets?: AsyncIterable<[string, string]>;
}

/** Sanitization applied to object keys when building a client-facing stream. */
export function shouldIncludeObjectKey(key: string): boolean {
  return !isServerOnlyObjectKey(key) && key !== PLATFORM_SUPER_USERS_OBJECT_KEY;
}

/** Sanitization applied to collection keys when building a client-facing stream. */
export function shouldIncludeCollectionKey(key: string): boolean {
  return key !== WORKSPACES_COLLECTION;
}

/**
 * Serializes a snapshot from lazy async sources as JSON string chunks, identical
 * in structure to `generateSnapshotJsonChunks` over a materialized
 * `TenantDatabaseSnapshot`. Backpressure is natural: chunks are yielded one
 * collection/table at a time, so the writer never buffers more than the source
 * that is currently loaded.
 */
export async function* generateSnapshotJsonFromSource(
  source: SnapshotJsonSource,
): AsyncGenerator<string, void, unknown> {
  yield "{";

  let hasPreviousField = false;

  if (source.collections) {
    yield '"collections":{';
    let firstCollection = true;
    for await (const [colName, items] of source.collections) {
      if (!firstCollection) yield ",";
      firstCollection = false;
      yield `${JSON.stringify(colName)}:[`;
      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          if (i > 0) yield ",";
          yield JSON.stringify(items[i]);
        }
      } else if (
        items &&
        typeof (items as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function"
      ) {
        let firstItem = true;
        for await (const item of items as AsyncIterable<unknown>) {
          if (!firstItem) yield ",";
          firstItem = false;
          yield JSON.stringify(item);
        }
      }
      yield "]";
    }
    yield "}";
    hasPreviousField = true;
  }

  if (source.objects) {
    if (hasPreviousField) yield ",";
    yield '"objects":{';
    let firstObject = true;
    for await (const [objKey, objVal] of source.objects) {
      if (!firstObject) yield ",";
      firstObject = false;
      yield `${JSON.stringify(objKey)}:${JSON.stringify(objVal)}`;
    }
    yield "}";
    hasPreviousField = true;
  }

  if (source.assets) {
    // Peek the first asset so an empty assets source emits no `assets` section at
    // all (matching the materialized writer, which omits assets when none exist).
    // Only the first asset is buffered; the rest stream through.
    const assetsIter = source.assets[Symbol.asyncIterator]();
    const first = await assetsIter.next();
    if (!first.done) {
      if (hasPreviousField) yield ",";
      yield '"assets":{';
      const [firstUrl, firstBase64] = first.value;
      yield `${JSON.stringify(firstUrl)}:${JSON.stringify(firstBase64)}`;
      let next = await assetsIter.next();
      while (!next.done) {
        const [assetUrl, assetBase64] = next.value;
        yield `,${JSON.stringify(assetUrl)}:${JSON.stringify(assetBase64)}`;
        next = await assetsIter.next();
      }
      yield "}";
    }
  }

  yield "}";
}

/**
 * Consumes a streaming source and returns the parsed snapshot object. Useful for
 * tests and for callers (e.g. restore) that still need a materialized snapshot.
 */
export async function materializeSnapshotFromSource(source: SnapshotJsonSource): Promise<{
  collections?: Record<string, unknown[]>;
  objects?: Record<string, unknown>;
  assets?: Record<string, string>;
}> {
  const chunks: string[] = [];
  for await (const chunk of generateSnapshotJsonFromSource(source)) {
    chunks.push(chunk);
  }
  return JSON.parse(chunks.join(""));
}
