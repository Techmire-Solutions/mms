import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  admissionsMetricsSchema,
  publicRegistrationViewSchema,
  registrationApplicationSchema,
  registrationLinkSchema,
  registrationReviewResultSchema,
  registrationSubmitResultSchema,
  type AdmissionsMetrics,
  type PublicRegistrationView,
  type RegistrationApplication,
  type RegistrationApplicationListQuery,
  type RegistrationLink,
  type RegistrationLinkWrite,
  type RegistrationReview,
  type RegistrationSubmit,
} from '@mms/shared';
import { z } from 'zod';
import { apiJson } from '@/lib/apiClient';

export const REGISTRATION_LINKS_QUERY_KEY = ['sessions', 'registration-links'] as const;
export const ADMISSIONS_QUERY_KEY = ['enrollments', 'admissions'] as const;
export const PUBLIC_REGISTRATION_QUERY_KEY = ['public', 'registrations'] as const;

const linksPath = (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}/registration-links`;
const publicPath = (slug?: string) => (slug ? `/api/public/registrations/${encodeURIComponent(slug)}` : '/api/public/registrations');
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export function registrationLinksQueryOptions(sessionId: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...REGISTRATION_LINKS_QUERY_KEY, sessionId] as const,
    queryFn: async ({ signal }): Promise<RegistrationLink[]> =>
      z.object({ items: z.array(registrationLinkSchema) }).parse(await apiJson<unknown>(linksPath(sessionId), { signal })).items,
    enabled: enabled && Boolean(sessionId),
    staleTime: 30_000,
  });
}

export function saveRegistrationLinkMutationOptions(sessionId: string) {
  return mutationOptions({
    mutationKey: [...REGISTRATION_LINKS_QUERY_KEY, sessionId, 'save'] as const,
    mutationFn: async ({ id, body }: { id: string; body: RegistrationLinkWrite }): Promise<RegistrationLink> =>
      z.object({ item: registrationLinkSchema }).parse(await apiJson<unknown>(`${linksPath(sessionId)}/${encodeURIComponent(id)}`, json('PUT', body))).item,
  });
}

export function deleteRegistrationLinkMutationOptions(sessionId: string) {
  return mutationOptions({
    mutationKey: [...REGISTRATION_LINKS_QUERY_KEY, sessionId, 'delete'] as const,
    mutationFn: async (id: string): Promise<void> => {
      await apiJson<unknown>(`${linksPath(sessionId)}/${encodeURIComponent(id)}`, json('DELETE', {}));
    },
  });
}

export function admissionsListQueryOptions(query: RegistrationApplicationListQuery, enabled: boolean) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value));
  return queryOptions({
    queryKey: [...ADMISSIONS_QUERY_KEY, 'list', query] as const,
    queryFn: async ({ signal }) => z.object({
      items: z.array(registrationApplicationSchema), total: z.number(), page: z.number(), limit: z.number(),
    }).parse(await apiJson<unknown>(`/api/enrollments/applications?${params.toString()}`, { signal })),
    enabled,
    staleTime: 15_000,
  });
}

export function admissionsMetricsQueryOptions(sessionId: string | undefined, enabled: boolean) {
  return queryOptions({
    queryKey: [...ADMISSIONS_QUERY_KEY, 'metrics', sessionId ?? ''] as const,
    queryFn: async ({ signal }): Promise<AdmissionsMetrics> => admissionsMetricsSchema.parse(
      await apiJson<unknown>(`/api/enrollments/applications/metrics${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`, { signal })),
    enabled,
    staleTime: 15_000,
  });
}

export function reviewApplicationsMutationOptions() {
  return mutationOptions({
    mutationKey: [...ADMISSIONS_QUERY_KEY, 'review'] as const,
    mutationFn: async (body: RegistrationReview) =>
      registrationReviewResultSchema.parse(await apiJson<unknown>('/api/enrollments/applications/review', json('POST', body))),
  });
}

export function publicRegistrationQueryOptions(slug: string) {
  return queryOptions({
    queryKey: [...PUBLIC_REGISTRATION_QUERY_KEY, slug] as const,
    queryFn: async ({ signal }): Promise<PublicRegistrationView> => publicRegistrationViewSchema.parse(await apiJson<unknown>(publicPath(slug), { signal })),
    enabled: Boolean(slug),
    retry: false,
  });
}

export function openRegistrationsQueryOptions() {
  return queryOptions({
    queryKey: [...PUBLIC_REGISTRATION_QUERY_KEY, 'open'] as const,
    queryFn: async ({ signal }): Promise<PublicRegistrationView[]> =>
      z.object({ items: z.array(publicRegistrationViewSchema) }).parse(await apiJson<unknown>(publicPath(), { signal })).items,
  });
}

export function submitRegistrationMutationOptions(slug: string) {
  return mutationOptions({
    mutationKey: [...PUBLIC_REGISTRATION_QUERY_KEY, slug, 'submit'] as const,
    mutationFn: async (body: RegistrationSubmit) => registrationSubmitResultSchema.parse(await apiJson<unknown>(publicPath(slug), json('POST', body))),
  });
}

export function invalidateRegistrationQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: REGISTRATION_LINKS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ADMISSIONS_QUERY_KEY });
}

export type { RegistrationApplication };
