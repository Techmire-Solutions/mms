import { and, eq, isNull } from "drizzle-orm";
import { programs, subjects } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { ValidationError } from "../../lib/httpErrors.js";

/**
 * Active foreign-key guard for the workshop's catalog references (`mms-data-layer` §6.8).
 *
 * The `program_id` / `subject_id` foreign keys are `ON DELETE RESTRICT`, which protects against
 * physical deletion — but soft-delete of a catalog row is an `UPDATE`, so a workshop could keep
 * pointing at an archived program/subject and render an empty name forever. The lookup takes a
 * `FOR SHARE` lock, which conflicts with the `deleted_at` UPDATE of an archive happening at the
 * same time, so the reference cannot be validated against a row that is being archived concurrently.
 */
export async function requireActiveCatalogRefs(
  tx: TenantTransaction,
  subdomain: string,
  refs: { programId?: string | null; subjectId?: string | null },
): Promise<void> {
  if (refs.programId) {
    const [program] = await tx
      .select({ id: programs.id })
      .from(programs)
      .where(
        and(
          eq(programs.workspaceSubdomain, subdomain),
          eq(programs.id, refs.programId),
          isNull(programs.deletedAt),
        ),
      )
      .limit(1)
      .for("share");
    if (!program) {
      throw new ValidationError("The selected program is archived or does not exist");
    }
  }
  if (refs.subjectId) {
    const [subject] = await tx
      .select({ id: subjects.id })
      .from(subjects)
      .where(
        and(
          eq(subjects.workspaceSubdomain, subdomain),
          eq(subjects.id, refs.subjectId),
          isNull(subjects.deletedAt),
        ),
      )
      .limit(1)
      .for("share");
    if (!subject) {
      throw new ValidationError("The selected subject is archived or does not exist");
    }
  }
}
