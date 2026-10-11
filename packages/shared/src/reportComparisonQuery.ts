import { z } from "zod";

export const reportComparisonQuerySchema = z.object({
  sessionIds: z.string().max(200).optional(),
  rangeAFrom: z.string().max(32).optional(),
  rangeATo: z.string().max(32).optional(),
  rangeBFrom: z.string().max(32).optional(),
  rangeBTo: z.string().max(32).optional(),
});

export type ReportComparisonRawQuery = z.infer<typeof reportComparisonQuerySchema>;

/** Base shape for ComparisonMode query params. */
export type BaseReportComparisonQuery = {
  sessionIds?: string[];
  rangeAFrom?: string;
  rangeATo?: string;
  rangeBFrom?: string;
  rangeBTo?: string;
};

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes ComparisonMode query params (max 2 sessionIds; ISO date ranges).
 */
export function normalizeReportComparisonQuery<T extends BaseReportComparisonQuery>(
  input: T | undefined,
): T | undefined {
  if (!input) return undefined;
  const sessionIds = (input.sessionIds ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean)
    .slice(0, 2);
  const rangeAFrom = input.rangeAFrom?.trim();
  const rangeATo = input.rangeATo?.trim();
  const rangeBFrom = input.rangeBFrom?.trim();
  const rangeBTo = input.rangeBTo?.trim();

  const hasSessions = sessionIds.length > 0;
  const hasRangeA = Boolean(
    rangeAFrom && rangeATo && DATE_PARAM_RE.test(rangeAFrom) && DATE_PARAM_RE.test(rangeATo),
  );
  const hasRangeB = Boolean(
    rangeBFrom && rangeBTo && DATE_PARAM_RE.test(rangeBFrom) && DATE_PARAM_RE.test(rangeBTo),
  );

  if (!hasSessions && !hasRangeA && !hasRangeB) return undefined;

  const result: BaseReportComparisonQuery = {
    ...(hasSessions ? { sessionIds } : {}),
    ...(hasRangeA ? { rangeAFrom, rangeATo } : {}),
    ...(hasRangeB ? { rangeBFrom, rangeBTo } : {}),
  };
  return result as T;
}

/** True when any comparison SQL slice should run. */
export function reportComparisonQueryActive(query: BaseReportComparisonQuery | undefined): boolean {
  return Boolean(
    (query?.sessionIds && query.sessionIds.length > 0) ||
    (query?.rangeAFrom && query.rangeATo) ||
    (query?.rangeBFrom && query.rangeBTo),
  );
}

/** Parses raw HTTP query string parameters into typed BaseReportComparisonQuery. */
export function parseComparisonQueryParams(
  raw: ReportComparisonRawQuery,
): BaseReportComparisonQuery {
  return {
    sessionIds: raw.sessionIds
      ? raw.sessionIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined,
    rangeAFrom: raw.rangeAFrom,
    rangeATo: raw.rangeATo,
    rangeBFrom: raw.rangeBFrom,
    rangeBTo: raw.rangeBTo,
  };
}

/**
 * Ensures all requested session IDs are present in comparison results,
 * generating a default/fallback record for any session ID that had 0 matching rows.
 */
export function ensureAllSessionsInComparison<T extends { sessionId: string }>(
  items: T[],
  sessionIds: string[],
  fallbackFactory: (sessionId: string) => T,
): T[] {
  const presentIds = new Set(items.map((r) => r.sessionId));
  const result = [...items];
  for (const id of sessionIds) {
    if (!presentIds.has(id)) {
      presentIds.add(id);
      result.push(fallbackFactory(id));
    }
  }
  return result;
}
