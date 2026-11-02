/**
 * @file documentTemplateCache.ts
 * @description Tenant-scoped read-through cache for document template layouts.
 *
 * This is a *cache*, not a persistence path: `/api/templates/:key` is the source of
 * truth and the TanStack Query hooks own every read and write. The cache exists so a
 * print preview or an editor can paint the last known layout synchronously instead of
 * flashing a default while the query resolves.
 *
 * Entries carry the server `updatedAt` the client read, which is the value the next
 * save must send back for optimistic-concurrency checking.
 *
 * It deliberately writes `localStorage` directly instead of the legacy object-write
 * helper: that helper also POSTed the `/api/db/objects/:key` store, which rejected
 * most template keys and produced a second, divergent server copy.
 */

import { documentTemplateSchema, type DocumentTemplate } from "@mms/shared";
import { safeSetItem, scopedStorageKey } from "@/lib/dbStorageCore";

export interface CachedDocumentTemplate<TPayload = Record<string, unknown>> {
  template: DocumentTemplate<TPayload>;
  updatedAt: string | null;
}

function cacheKey(key: string): string {
  return scopedStorageKey(`document_template_cache:${key}`);
}

/** Last known valid layout + version for a template key, or `null` when absent/invalid. */
export function readCachedDocumentTemplate<TPayload = Record<string, unknown>>(
  key: string,
): CachedDocumentTemplate<TPayload> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { template, updatedAt } = parsed as {
      template?: unknown;
      updatedAt?: unknown;
    };
    const result = documentTemplateSchema.safeParse(template);
    if (!result.success) return null;
    return {
      template: result.data as DocumentTemplate<TPayload>,
      updatedAt: typeof updatedAt === "string" ? updatedAt : null,
    };
  } catch {
    return null;
  }
}

/** Stores a layout + version the server has already accepted. Best-effort. */
export function writeCachedDocumentTemplate<TPayload>(
  key: string,
  record: CachedDocumentTemplate<TPayload>,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    safeSetItem(cacheKey(key), JSON.stringify(record));
  } catch {
    // The cache is best-effort; a quota failure must never break a successful save.
  }
}

/** Drops the cache entry after a server-side reset. */
export function clearCachedDocumentTemplate(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(key));
  } catch {
    // Ignore storage failures — the query invalidation is what actually resets the UI.
  }
}
