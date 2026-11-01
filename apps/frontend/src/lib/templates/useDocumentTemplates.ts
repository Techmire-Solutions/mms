/**
 * @file useDocumentTemplates.ts
 * @description Server-authoritative document template layouts.
 *
 * `/api/templates/:key` is the single source of truth. Reads are TanStack Query
 * queries seeded from the tenant-scoped local cache (`documentTemplateCache`) so a
 * print preview paints immediately, and every save/reset goes through a mutation
 * that updates the cache and the query cache together. The previous implementation
 * read `localStorage` only and fired a background server write, so a layout never
 * reached a second device and a rejected write was invisible.
 */

import { useEffect, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { documentTemplateSchema, type DocumentTemplate } from "@mms/shared";
import {
  deleteDocumentTemplateServer,
  fetchDocumentTemplateServer,
  saveDocumentTemplateServer,
} from "./documentTemplatesApi";
import {
  clearCachedDocumentTemplate,
  readCachedDocumentTemplate,
  writeCachedDocumentTemplate,
} from "./documentTemplateCache";

export const DOCUMENT_TEMPLATES_QUERY_KEY_ROOT = ["document_templates"] as const;

/** How long a fetched layout is considered fresh before a background refetch. */
const TEMPLATE_STALE_TIME_MS = 5 * 60 * 1000;

export function documentTemplateQueryKey(key: string) {
  return [...DOCUMENT_TEMPLATES_QUERY_KEY_ROOT, key] as const;
}

/** Invalidate cached templates (optionally scoped to a specific key). */
export function invalidateDocumentTemplatesQueries(queryClient: QueryClient, key?: string): void {
  if (key) {
    void queryClient.invalidateQueries({ queryKey: documentTemplateQueryKey(key) });
  } else {
    void queryClient.invalidateQueries({ queryKey: DOCUMENT_TEMPLATES_QUERY_KEY_ROOT });
  }
}

/**
 * Fetches a layout and validates it before it can reach the editor.
 *
 * A corrupted or hand-written `document_templates` row must not render as a broken
 * canvas: an invalid payload falls back to the factory layout exactly like an absent
 * row, and a later save repairs the stored value.
 */
export function fetchDocumentTemplateLayout<TPayload>(
  key: string,
  fallback: DocumentTemplate<TPayload>,
): Promise<DocumentTemplate<TPayload>> {
  return fetchDocumentTemplateServer<TPayload>(key).then((serverTemplate) => {
    if (!serverTemplate) return fallback;
    const parsed = documentTemplateSchema.safeParse(serverTemplate);
    return parsed.success ? (parsed.data as DocumentTemplate<TPayload>) : fallback;
  });
}

export interface UseDocumentTemplateResult<TPayload> {
  /** Last known layout: cache/default until the server responds, then the server value. */
  template: DocumentTemplate<TPayload>;
  /** True while a server read (initial or background) is in flight. */
  isFetching: boolean;
  /** True when the last read failed; the cached/default layout stays editable. */
  isError: boolean;
}

/**
 * Reads a template layout, seeded synchronously from the cache (or the factory
 * fallback) and refreshed from the server in the background.
 */
export function useDocumentTemplate<TPayload>(
  key: string,
  fallback: DocumentTemplate<TPayload>,
): UseDocumentTemplateResult<TPayload> {
  // The initial layout is captured once per key: a new fallback object on a later
  // render (branding/translation change) must not discard a layout that is already
  // on screen.
  const initialRef = useRef<{ key: string; template: DocumentTemplate<TPayload> } | null>(null);
  if (initialRef.current === null || initialRef.current.key !== key) {
    initialRef.current = { key, template: readCachedDocumentTemplate<TPayload>(key) ?? fallback };
  }
  const initialTemplate = initialRef.current.template;

  const query = useQuery({
    queryKey: documentTemplateQueryKey(key),
    queryFn: () => fetchDocumentTemplateLayout<TPayload>(key, fallback),
    initialData: initialTemplate,
    // Seed data is always treated as stale so the mount fetches the server copy.
    initialDataUpdatedAt: 0,
    staleTime: TEMPLATE_STALE_TIME_MS,
  });

  useEffect(() => {
    if (query.data) writeCachedDocumentTemplate(key, query.data);
  }, [key, query.data]);

  return {
    template: query.data ?? initialTemplate,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}

/** Saves a layout: server first, then the local cache and the query cache. */
export function useSaveDocumentTemplate<TPayload>(
  key: string,
): UseMutationResult<DocumentTemplate<TPayload>, Error, DocumentTemplate<TPayload>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: DocumentTemplate<TPayload>) =>
      saveDocumentTemplateServer<TPayload>(key, template),
    onSuccess: (saved) => {
      writeCachedDocumentTemplate(key, saved);
      queryClient.setQueryData(documentTemplateQueryKey(key), saved);
      void queryClient.invalidateQueries({ queryKey: documentTemplateQueryKey(key) });
    },
  });
}

/** Deletes the stored layout and reverts to the factory default. */
export function useResetDocumentTemplate(key: string): UseMutationResult<boolean, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteDocumentTemplateServer(key),
    onSuccess: () => {
      clearCachedDocumentTemplate(key);
      void queryClient.invalidateQueries({ queryKey: documentTemplateQueryKey(key) });
    },
  });
}
