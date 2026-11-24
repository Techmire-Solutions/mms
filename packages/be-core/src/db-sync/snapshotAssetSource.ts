/**
 * Asset access for the streaming backup snapshot.
 *
 * Injected by the route (`services/backupAssetService`) so `db/` does not import a
 * service — half of the `db ↔ services` kernel cycle
 * (docs/monorepo-migration-plan.md §6.1, §8 P1a).
 */
export interface SnapshotAssetSource {
  /** Collect every `/uploads/...` URL referenced by a snapshot value. */
  collectAssetUrlsFromValue: (value: unknown, out: Set<string>) => void;
  /** Read one asset as base64 (null when missing on disk). */
  readAssetBase64: (url: string) => Promise<string | null>;
}

/** Yield `[url, base64]` for every referenced asset that exists on disk, one at a time. */
export async function* streamSnapshotAssets(
  urls: Iterable<string>,
  source: SnapshotAssetSource,
): AsyncGenerator<[string, string]> {
  for (const url of urls) {
    const base64 = await source.readAssetBase64(url);
    if (base64 != null) yield [url, base64];
  }
}
