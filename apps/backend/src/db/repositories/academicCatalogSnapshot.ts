import type { AcademicCatalogKind } from '@mms/shared';
import type { TenantTransaction } from '../tenant-context.js';
import { findAcademicCatalogByNameTx, loadAcademicCatalogNamesTx } from './academicCatalogReferences.js';

export interface CatalogRef {
  id: string | null;
  name: string;
}

/**
 * Resolves catalog references for a batch of writes: a live id wins and refreshes the display
 * snapshot from the catalog; otherwise the legacy text is matched by name; unknown ids are dropped.
 */
export async function resolveCatalogRefsTx(
  tx: TenantTransaction,
  kind: AcademicCatalogKind,
  subdomain: string,
  refs: ReadonlyArray<{ id?: string | null; name?: string | null }>,
): Promise<CatalogRef[]> {
  const names = await loadAcademicCatalogNamesTx(tx, kind, subdomain, refs.map((ref) => ref.id?.trim() ?? ''));
  const byName = new Map<string, { id: string; name: string } | null>();
  const resolved: CatalogRef[] = [];
  for (const ref of refs) {
    const id = ref.id?.trim() ?? '';
    const text = ref.name?.trim() ?? '';
    const liveName = id ? names.get(id) : undefined;
    if (liveName !== undefined) {
      resolved.push({ id, name: liveName });
      continue;
    }
    const key = text.toLowerCase();
    if (key && !byName.has(key)) byName.set(key, await findAcademicCatalogByNameTx(tx, kind, subdomain, text));
    const match = key ? byName.get(key) ?? null : null;
    resolved.push(match ? { id: match.id, name: match.name } : { id: null, name: text });
  }
  return resolved;
}
