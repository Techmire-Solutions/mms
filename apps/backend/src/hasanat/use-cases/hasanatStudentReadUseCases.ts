/**
 * Student-facing Hasanat reads: the per-student summary and the report rows.
 *
 * Split from `hasanatTierUseCases` (reconcile/evidence) to keep both modules inside the 300-line
 * ceiling; the tier module re-exports these so the facade keeps one import surface.
 */

import {
  tierProgress,
  type HasanatStudentReportResponseDto,
  type HasanatStudentReportRowDto,
} from "@mms/shared";
import { loadHasanatStudentReport } from "../repository/hasanatRepositoryAdapter.js";
import { loadHasanatTierLadder } from "./hasanatTierUseCases.js";

/** Report row/response shapes are owned by the shared contract. */
export type HasanatStudentReportEntry = HasanatStudentReportRowDto;
export type HasanatStudentReport = HasanatStudentReportResponseDto;

/**
 * Per-student report rows with their derived tier — one read-model query plus the pure ladder,
 * so the report never aggregates a paginated collection and never needs a per-student request.
 */
export async function getHasanatStudentReport(
  tenant: string,
  filters: {
    sessionId?: string | null;
    classId?: string | null;
    from?: string | null;
    to?: string | null;
  } = {},
): Promise<HasanatStudentReport> {
  const subdomain = tenant.trim().toLowerCase();
  const [ladder, rows] = await Promise.all([
    loadHasanatTierLadder(subdomain),
    loadHasanatStudentReport(subdomain, filters),
  ]);

  return {
    tiers: ladder,
    rows: rows.map((row) => {
      const progress = tierProgress(row.earned, ladder);
      return {
        ...row,
        tierKey: progress.tier.key,
        tierName: progress.tier.name,
        pointsToNext: progress.pointsToNext,
        percentToNext: progress.percentToNext,
      };
    }),
  };
}
