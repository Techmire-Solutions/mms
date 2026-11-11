import { and, eq, inArray } from "drizzle-orm";
import { exams } from "../schema.js";
import type { AppDb } from "../tenant-context.js";
import {
  examArchivedError,
  examCancelledError,
  examResultsFinalizedError,
} from "./examResultUpsert.js";

type Tx = AppDb;

/**
 * Locks the exam rows for the duration of the write and refuses the batch when any of them is
 * published or archived.
 *
 * `FOR SHARE` is what closes the finalize race: the publish path takes `FOR UPDATE` on the same
 * row, so one of the two waits and re-reads the committed state instead of both committing a
 * contradictory pair of writes.
 */
export async function assertMarksWritable(
  tx: Tx,
  subdomain: string,
  examIds: readonly string[],
): Promise<void> {
  if (examIds.length === 0) return;
  const rows = await tx
    .select({
      id: exams.id,
      resultsFinalizedAt: exams.resultsFinalizedAt,
      deletedAt: exams.deletedAt,
      status: exams.status,
    })
    .from(exams)
    .where(and(eq(exams.workspaceSubdomain, subdomain), inArray(exams.id, examIds)))
    .for("share");

  const published = rows.filter((row) => row.resultsFinalizedAt !== null).map((row) => row.id);
  if (published.length > 0) throw examResultsFinalizedError(published);

  const archived = rows.filter((row) => row.deletedAt !== null).map((row) => row.id);
  if (archived.length > 0) throw examArchivedError(archived);

  // A cancelled sitting is closed: no first entry, no correction, no grace.
  const cancelled = rows.filter((row) => row.status === "cancelled").map((row) => row.id);
  if (cancelled.length > 0) throw examCancelledError(cancelled);
}
