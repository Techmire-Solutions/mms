/**
 * Vendor chunk grouping — the single source of truth shared by Vite's two
 * bundler configs.
 *
 * `vite.config.ts` produces these groups twice: once as a Rollup `manualChunks`
 * function and once as a Rolldown `codeSplitting.groups` array. Keeping the two
 * hand-written tables in sync was error-prone (ordering had already diverged),
 * so both are DERIVED from {@link VENDOR_CHUNK_GROUPS} here.
 *
 * Build-only: nothing in the runtime app imports this module, so it is not part
 * of the client bundle.
 */

export interface VendorChunkGroup {
  /** Output chunk name (e.g. `vendor-react`). */
  name: string;
  /** Matches resolved module ids on both POSIX and Windows separators. */
  test: RegExp;
  /** Higher wins when two groups could match (they are kept disjoint). */
  priority: number;
}

export const VENDOR_CHUNK_GROUPS: readonly VendorChunkGroup[] = [
  {
    name: "vendor-react",
    test: /node_modules[\\/](?:react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
    priority: 50,
  },
  {
    name: "vendor-query",
    test: /node_modules[\\/]@tanstack[\\/]react-query[\\/]/,
    priority: 45,
  },
  {
    name: "vendor-virtual",
    test: /node_modules[\\/]@tanstack[\\/]react-virtual[\\/]/,
    priority: 44,
  },
  {
    name: "vendor-crop",
    test: /node_modules[\\/]react-easy-crop[\\/]/,
    priority: 42,
  },
  {
    name: "vendor-ui",
    test: /node_modules[\\/](?:@radix-ui|@floating-ui|react-remove-scroll|aria-hidden|lucide-react|clsx|tailwind-merge|class-variance-authority)[\\/]/,
    priority: 40,
  },
  {
    name: "vendor-motion",
    test: /node_modules[\\/]framer-motion[\\/]/,
    priority: 35,
  },
  {
    // Recharts 3 dropped its internal Redux dependency.
    // @reduxjs/toolkit removed — add it back if the app adopts Redux directly.
    // d3-[^\\/]+ matches full package names (d3-scale) not just the prefix.
    name: "vendor-charts",
    test: /node_modules[\\/](?:recharts|victory-vendor|d3-[^\\/]+)[\\/]/,
    priority: 30,
  },
  {
    name: "vendor-validation",
    test: /node_modules[\\/](?:zod|@ts-rest)[\\/]/,
    priority: 20,
  },
  { name: "mms-i18n-en", test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsEn/, priority: 5 },
  { name: "mms-i18n-ar", test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsAr/, priority: 5 },
  { name: "mms-i18n-ur", test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsUr/, priority: 5 },
  { name: "mms-i18n-fa", test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsFa/, priority: 5 },
];

/** Groups in resolution precedence order (highest priority first). */
const PRIORITY_SORTED_GROUPS = [...VENDOR_CHUNK_GROUPS].sort((a, b) => b.priority - a.priority);

/**
 * Rollup `manualChunks(id)`: the highest-priority matching chunk, else
 * `undefined` (Vite then applies its default splitting).
 */
export function manualVendorChunk(id: string): string | undefined {
  for (const group of PRIORITY_SORTED_GROUPS) {
    if (group.test.test(id)) return group.name;
  }
  return undefined;
}

/** Rolldown `codeSplitting.groups` — same table, plain `{ name, test, priority }`. */
export function rolldownChunkGroups(): VendorChunkGroup[] {
  return VENDOR_CHUNK_GROUPS.map((group) => ({
    name: group.name,
    test: group.test,
    priority: group.priority,
  }));
}
