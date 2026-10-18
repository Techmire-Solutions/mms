import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  academicCalendarContract,
  academicCalendarEventSchema,
  type AcademicCalendarEvent,
  type AcademicCalendarEventWrite,
} from '@mms/shared';
import { z } from 'zod';
import { apiJson } from '@/lib/apiClient';

/** Root key for Attendance-owned academic calendar queries. */
export const ACADEMIC_CALENDAR_QUERY_KEY = ['attendance', 'academic-calendar'] as const;

const itemsResponseSchema = z.object({ items: z.array(academicCalendarEventSchema) });
const itemResponseSchema = z.object({ item: academicCalendarEventSchema });
const BASE = academicCalendarContract.list.path;

function eventPath(id: string): string {
  return `${BASE}/${encodeURIComponent(id)}`;
}

export interface AcademicCalendarRangeQuery {
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

/** Events overlapping an inclusive `YYYY-MM-DD` range (Setup list, mark-attendance banner). */
export function academicCalendarQueryOptions(range: AcademicCalendarRangeQuery, enabled: boolean) {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  if (range.includeDeleted) params.set('includeDeleted', 'true');
  const search = params.toString();
  return queryOptions({
    queryKey: [...ACADEMIC_CALENDAR_QUERY_KEY, range.from ?? '', range.to ?? '', range.includeDeleted ? 'all' : 'live'] as const,
    queryFn: async ({ signal }): Promise<AcademicCalendarEvent[]> => {
      const body = await apiJson<unknown>(search ? `${BASE}?${search}` : BASE, { signal });
      return itemsResponseSchema.parse(body).items;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function saveAcademicCalendarEventMutationOptions() {
  return mutationOptions({
    mutationKey: [...ACADEMIC_CALENDAR_QUERY_KEY, 'save'] as const,
    mutationFn: async ({ id, body }: { id: string; body: AcademicCalendarEventWrite }): Promise<AcademicCalendarEvent> => {
      const response = await apiJson<unknown>(eventPath(id), { method: 'PUT', body: JSON.stringify(body) });
      return itemResponseSchema.parse(response).item;
    },
  });
}

export function deleteAcademicCalendarEventMutationOptions() {
  return mutationOptions({
    mutationKey: [...ACADEMIC_CALENDAR_QUERY_KEY, 'delete'] as const,
    mutationFn: async (id: string): Promise<void> => {
      await apiJson<unknown>(eventPath(id), { method: 'DELETE', body: JSON.stringify({}) });
    },
  });
}

export function restoreAcademicCalendarEventMutationOptions() {
  return mutationOptions({
    mutationKey: [...ACADEMIC_CALENDAR_QUERY_KEY, 'restore'] as const,
    mutationFn: async (id: string): Promise<AcademicCalendarEvent> => {
      const response = await apiJson<unknown>(`${eventPath(id)}/restore`, { method: 'POST', body: JSON.stringify({}) });
      return itemResponseSchema.parse(response).item;
    },
  });
}

export function invalidateAcademicCalendarQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ACADEMIC_CALENDAR_QUERY_KEY });
}
