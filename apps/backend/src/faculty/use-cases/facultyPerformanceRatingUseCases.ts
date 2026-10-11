/**
 * @file facultyPerformanceRatingUseCases.ts
 * @description Recompute and persist faculty.performance_rating from evaluation scores.
 */
import { and, eq, isNull } from "drizzle-orm";
import { computeFacultyPerformanceRating, parseFacultyPerformanceRating } from "@mms/shared";
import { faculty } from "../../db/schema.js";
import { withTenant } from "../../db/tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/**
 * Recomputes and persists `faculty.performance_rating` from evaluation scores.
 * Call from evaluation write paths when an evaluations source exists; no-op when
 * `ratings` is empty (clears the stored rating to `null`).
 */
export async function recomputeFacultyPerformanceRating(
  tenant: string,
  facultyId: string,
  ratings: ReadonlyArray<number | null | undefined>,
  actorUserId?: string,
): Promise<number | null> {
  const subdomain = tenant.trim().toLowerCase();
  const next = computeFacultyPerformanceRating(ratings);
  const stored = next === null ? null : next.toFixed(1);
  await withTenant(subdomain, async (tx) => {
    const changed = await tx
      .update(faculty)
      .set({
        performanceRating: stored,
        updatedAt: new Date(),
        updatedBy: actorUserId ?? null,
      })
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(faculty.id, facultyId),
          isNull(faculty.deletedAt),
        ),
      )
      .returning({ id: faculty.id });
    if (changed.length === 0) return;
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "faculty",
      recordId: facultyId,
      actionType: "UPDATE",
      realUserId: actorUserId,
      newState: { performanceRating: stored },
    });
  });
  return parseFacultyPerformanceRating(stored);
}
