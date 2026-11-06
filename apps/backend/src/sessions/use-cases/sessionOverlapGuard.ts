import { normalizeSessionModulePreferences, normalizeSessionStatus } from "@mms/shared";
import { ConflictError } from "../../lib/httpErrors.js";
import { toDbDate } from "../../lib/dbDate.js";
import type { SessionsRepository } from "../repository/sessionsRepository.js";

/**
 * Statuses the `sessions_no_overlap_excl` exclusion constraint covers (migration 0206). Keeping the
 * application guard on the same set means the friendly 409 and the database guarantee agree.
 */
const OVERLAP_STATUSES = new Set(["draft", "open", "in_progress"]);

/** Injectable so unit tests can exercise the use-cases without the preferences table. */
export interface OverlapGuardDependencies {
  loadSessionPreferences?: (
    tenant: string,
  ) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
}

/**
 * The Sessions `allowOverlap` preference was stored but never read (review finding P0-1). It is now
 * materialised per row as `overlap_exempt`, so the database constraint can honour it without
 * weakening the guarantee for every other tenant.
 */
export async function loadSessionOverlapExemption(
  tenant: string,
  deps?: OverlapGuardDependencies,
): Promise<boolean> {
  const load =
    deps?.loadSessionPreferences ??
    (await import("../../db/repositories/sessionModulePreferencesRepository.js"))
      .getSessionModulePreferencesByWorkspace;
  const raw = await load(tenant);
  return normalizeSessionModulePreferences(raw).allowOverlap;
}

/** The subset of a session the overlap guard reads (a create body may not have an id yet). */
export interface OverlapCandidate {
  id?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  overlapExempt?: boolean;
}

/**
 * Rejects a create/update whose inclusive date range intersects another live session of the same
 * tenant. The exclusion constraint remains the authority; this exists so users get an actionable
 * 409 instead of a `23P01` exclusion violation.
 */
export async function assertSessionOverlapFree(
  repo: Pick<SessionsRepository, "findOverlappingSessions">,
  tenant: string,
  session: OverlapCandidate,
  allowOverlap: boolean,
): Promise<void> {
  if (allowOverlap || session.overlapExempt) return;
  if (!OVERLAP_STATUSES.has(normalizeSessionStatus(session.status ?? "draft"))) return;
  const startDate = toDbDate(session.startDate);
  const endDate = toDbDate(session.endDate);
  // A dateless session has a NULL period in the database, so it cannot overlap anything.
  if (!startDate || !endDate) return;
  const conflicts = await repo.findOverlappingSessions(tenant, {
    startDate,
    endDate,
    excludeId: session.id ? String(session.id) : undefined,
  });
  if (conflicts.length === 0) return;
  const [first] = conflicts;
  const range = [first.startDate ?? "?", first.endDate ?? "?"].join(" – ");
  throw new ConflictError(
    `This session overlaps "${first.name}" (${range}). Close or archive that session first, or enable "Allow overlapping sessions" in Sessions → Setup → Preferences.`,
  );
}
