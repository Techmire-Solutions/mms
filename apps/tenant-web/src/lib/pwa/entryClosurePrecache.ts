/**
 * Workbox precache manifest composition — build-only.
 *
 * The service worker must precache enough to boot the app offline, but the
 * previous `globPatterns: ["**\/*.js", …]` precached every emitted chunk:
 * optional vendors (`elk`, `cytoscape`, `xlsx`, `jspdf`, `katex`), all four
 * locale packs, and unused static assets — 647 entries / ~16 MB for a shell
 * that needs ~30 modules.
 *
 * This module supplies a Workbox `manifestTransforms` function that re-adds
 * exactly the **entry closure** (the static import graph of `index.html`, plus
 * the CSS those chunks import). Everything else stays lazy: route chunks are
 * captured by the `/assets/` `CacheFirst` runtime rule once a user actually
 * visits them.
 *
 * The closure is derived from Vite's build manifest (`dist/.vite/manifest.json`,
 * `build.manifest: true`), so no hard-coded chunk names are involved.
 */

/** Subset of Vite's build manifest consumed here. */
export interface ViteManifestChunk {
  file: string;
  css?: readonly string[];
  imports?: readonly string[];
  isEntry?: boolean;
}

export type ViteManifest = Readonly<Record<string, ViteManifestChunk>>;

/** Subset of a Workbox precache manifest entry. */
export interface PrecacheManifestEntry {
  url: string;
  revision: string | null;
}

export interface ManifestTransformResult {
  manifest: PrecacheManifestEntry[];
  warnings?: string[];
}

/**
 * Files reachable from the app-shell entry through **static** imports only
 * (dynamic imports stay lazy). Sorted and de-duplicated; cycles are tolerated.
 */
export function collectEntryClosure(manifest: ViteManifest, entryKey?: string): string[] {
  const resolvedEntryKey =
    entryKey ?? Object.keys(manifest).find((key) => manifest[key]?.isEntry) ?? "index.html";

  const files = new Set<string>();
  const stack = new Set<string>();

  const visit = (key: string): void => {
    if (stack.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) return;
    stack.add(key);
    files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
    for (const dependency of chunk.imports ?? []) visit(dependency);
    stack.delete(key);
  };

  visit(resolvedEntryKey);
  return [...files].sort();
}

export interface EntryClosureTransformOptions {
  /** Reads the Vite build manifest; returns `null` when it is unavailable. */
  readManifest: () => ViteManifest | null;
}

/**
 * Builds a Workbox `manifestTransforms` function that appends the entry closure
 * to the glob-matched shell entries. When the manifest cannot be read the glob
 * result is returned untouched (the `check:pwa` gate then fails on the shell-only
 * precache rather than silently shipping a broken offline boot).
 */
export function createEntryClosureTransform(
  options: EntryClosureTransformOptions,
): (manifest: PrecacheManifestEntry[]) => ManifestTransformResult {
  return (entries) => {
    let closure: string[] = [];
    try {
      const manifest = options.readManifest();
      if (manifest) closure = collectEntryClosure(manifest);
    } catch {
      closure = [];
    }

    if (closure.length === 0) {
      return {
        manifest: entries,
        warnings: ["[pwa] Vite build manifest unavailable — precache left at shell entries only."],
      };
    }

    const existing = new Set(entries.map((entry) => entry.url));
    const additions: PrecacheManifestEntry[] = [];
    for (const file of closure) {
      const url = `/${file.replace(/^\/+/, "")}`;
      if (existing.has(url)) continue;
      existing.add(url);
      // Hashed asset names are immutable, so no `__WB_REVISION__` cache-buster.
      additions.push({ url, revision: null });
    }

    return { manifest: [...entries, ...additions] };
  };
}
