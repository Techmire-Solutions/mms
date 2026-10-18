import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  academicCatalogItemSchema,
  examinationSubjectsContract,
  type AcademicCatalogItem,
  type AcademicCatalogKind,
  type AcademicCatalogWrite,
} from '@mms/shared';
import { z } from 'zod';
import { apiJson } from '@/lib/apiClient';

/** Root key for every academic catalog query (session categories, programs, subjects). */
export const ACADEMIC_CATALOG_QUERY_KEY = ['academic-catalogs'] as const;

const itemsResponseSchema = z.object({ items: z.array(academicCatalogItemSchema) });
const itemResponseSchema = z.object({ item: academicCatalogItemSchema });

function catalogPath(kind: AcademicCatalogKind, id?: string): string {
  const base = `/api/sessions/catalogs/${encodeURIComponent(kind)}`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

/** Sessions-owned catalog list (Setup managers and Sessions pickers). */
export function academicCatalogQueryOptions(kind: AcademicCatalogKind, options: { enabled: boolean; includeDeleted?: boolean }) {
  const includeDeleted = options.includeDeleted === true;
  return queryOptions({
    queryKey: [...ACADEMIC_CATALOG_QUERY_KEY, kind, includeDeleted ? 'all' : 'live'] as const,
    queryFn: async ({ signal }): Promise<AcademicCatalogItem[]> => {
      const query = includeDeleted ? '?includeDeleted=true' : '';
      const body = await apiJson<unknown>(`${catalogPath(kind)}${query}`, { signal });
      return itemsResponseSchema.parse(body).items;
    },
    enabled: options.enabled,
    staleTime: 60_000,
  });
}

/** Examinations-owned read of active subjects (no Sessions grant needed). */
export function examinationSubjectsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: [...ACADEMIC_CATALOG_QUERY_KEY, 'subjects', 'examinations'] as const,
    queryFn: async ({ signal }): Promise<AcademicCatalogItem[]> => {
      const body = await apiJson<unknown>(examinationSubjectsContract.list.path, { signal });
      return itemsResponseSchema.parse(body).items;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function saveAcademicCatalogItemMutationOptions(kind: AcademicCatalogKind) {
  return mutationOptions({
    mutationKey: [...ACADEMIC_CATALOG_QUERY_KEY, kind, 'save'] as const,
    mutationFn: async ({ id, body }: { id: string; body: AcademicCatalogWrite }): Promise<AcademicCatalogItem> => {
      const response = await apiJson<unknown>(catalogPath(kind, id), { method: 'PUT', body: JSON.stringify(body) });
      return itemResponseSchema.parse(response).item;
    },
  });
}

export function deleteAcademicCatalogItemMutationOptions(kind: AcademicCatalogKind) {
  return mutationOptions({
    mutationKey: [...ACADEMIC_CATALOG_QUERY_KEY, kind, 'delete'] as const,
    mutationFn: async (id: string): Promise<void> => {
      await apiJson<unknown>(catalogPath(kind, id), { method: 'DELETE', body: JSON.stringify({}) });
    },
  });
}

export function restoreAcademicCatalogItemMutationOptions(kind: AcademicCatalogKind) {
  return mutationOptions({
    mutationKey: [...ACADEMIC_CATALOG_QUERY_KEY, kind, 'restore'] as const,
    mutationFn: async (id: string): Promise<AcademicCatalogItem> => {
      const response = await apiJson<unknown>(`${catalogPath(kind, id)}/restore`, { method: 'POST', body: JSON.stringify({}) });
      return itemResponseSchema.parse(response).item;
    },
  });
}

/** Catalog edits rename display snapshots, so sessions and exams refetch too. */
export function invalidateAcademicCatalogQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ACADEMIC_CATALOG_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  void queryClient.invalidateQueries({ queryKey: ['examinations', 'exams'] });
}
