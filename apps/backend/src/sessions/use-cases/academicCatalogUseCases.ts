import type { AcademicCatalogItem, AcademicCatalogKind, AcademicCatalogWrite } from '@mms/shared';
import { academicCatalogWriteSchema, activeAcademicCatalogItems } from '@mms/shared';
import {
  listAcademicCatalog,
  restoreAcademicCatalogItem,
  saveAcademicCatalogItem,
  softDeleteAcademicCatalogItem,
} from '../../db/repositories/academicCatalogRepository.js';
import { invalidateMultiTierCache } from '../../lib/cache/index.js';
import { broadcastCollection } from '../../lib/livePush.js';
import { ConflictError } from '../../lib/httpErrors.js';
import { isUniqueViolation } from '../../lib/pgErrors.js';

/** Live-push collection key for catalog changes (frontend invalidates catalog + sessions queries). */
export const ACADEMIC_CATALOG_BROADCAST_KEY = 'academic_catalogs';

async function afterWrite(tenant: string): Promise<void> {
  await invalidateMultiTierCache({ tenantId: tenant, domain: 'sessions' });
  await broadcastCollection(ACADEMIC_CATALOG_BROADCAST_KEY);
}

export function createAcademicCatalogUseCases() {
  return {
    list(tenant: string, kind: AcademicCatalogKind, includeDeleted = false): Promise<AcademicCatalogItem[]> {
      return listAcademicCatalog(tenant, kind, includeDeleted);
    },

    async listActive(tenant: string, kind: AcademicCatalogKind): Promise<AcademicCatalogItem[]> {
      return activeAcademicCatalogItems(await listAcademicCatalog(tenant, kind));
    },

    async save(tenant: string, kind: AcademicCatalogKind, id: string, body: AcademicCatalogWrite, actorUserId: string): Promise<AcademicCatalogItem> {
      const parsed = academicCatalogWriteSchema.parse(body);
      try {
        const item = await saveAcademicCatalogItem(tenant, kind, { id, ...parsed, actorUserId });
        await afterWrite(tenant);
        return item;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError(`"${parsed.name}" already exists`);
        throw error;
      }
    },

    async remove(tenant: string, kind: AcademicCatalogKind, id: string, actorUserId: string): Promise<boolean> {
      const removed = await softDeleteAcademicCatalogItem(tenant, kind, id, actorUserId);
      if (removed) await afterWrite(tenant);
      return removed;
    },

    async restore(tenant: string, kind: AcademicCatalogKind, id: string, actorUserId: string): Promise<AcademicCatalogItem | null> {
      try {
        const item = await restoreAcademicCatalogItem(tenant, kind, id, actorUserId);
        if (item) await afterWrite(tenant);
        return item;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError('An entry with this name already exists — rename it before restoring');
        throw error;
      }
    },
  };
}

export const academicCatalogUseCases = createAcademicCatalogUseCases();
