import { and, eq, isNull } from "drizzle-orm";
import { CONTACT_TAG_SOURCE_FACULTY } from "@mms/shared";
import { contactTags, facultyEmployments, workspaces } from "../db/schema.js";
import { withGlobalTenant, withTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";
import { LEADER_LOCK_CONTACT_ROLE_TAGS, tryAcquireLeaderLease } from "../lib/leaderElection.js";
import { reconcileContactSystemTags } from "../contacts/systemTags/contactSystemTagUseCases.js";

const SWEEP_BATCH_SIZE = 500;
const INTERVAL_MS = 60 * 60 * 1000;
let sweepTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Repairs date-triggered role ends (employment/assignment end dates) that no
 * request has touched yet. Only faculty-linked contacts can transition by date,
 * so the sweep never scans unrelated contacts.
 */
export async function runContactSystemTagSweep(): Promise<{
  contacts: number;
  changed: number;
}> {
  const tenants = await withGlobalTenant((tx) =>
    tx.select({ subdomain: workspaces.subdomain }).from(workspaces),
  );
  let contactsScanned = 0;
  let changedContacts = 0;

  for (const { subdomain } of tenants) {
    try {
      const candidateRows = await withTenant(subdomain, async (tx) => {
        const tagged = await tx
          .selectDistinct({ contactId: contactTags.contactId })
          .from(contactTags)
          .where(
            and(
              eq(contactTags.workspaceSubdomain, subdomain),
              eq(contactTags.source, CONTACT_TAG_SOURCE_FACULTY),
            ),
          );
        const employed = await tx
          .selectDistinct({ contactId: facultyEmployments.contactId })
          .from(facultyEmployments)
          .where(
            and(
              eq(facultyEmployments.workspaceSubdomain, subdomain),
              isNull(facultyEmployments.deletedAt),
            ),
          );
        return [...tagged, ...employed];
      });

      const ids = Array.from(new Set(candidateRows.map((row) => row.contactId).filter(Boolean)));
      contactsScanned += ids.length;
      for (let index = 0; index < ids.length; index += SWEEP_BATCH_SIZE) {
        changedContacts += await reconcileContactSystemTags(
          subdomain,
          ids.slice(index, index + SWEEP_BATCH_SIZE),
        );
      }
    } catch (error: unknown) {
      logger.error(
        { err: error instanceof Error ? error.message : String(error), tenant: subdomain },
        "[ContactSystemTags] Workspace sweep failed",
      );
    }
  }

  return { contacts: contactsScanned, changed: changedContacts };
}

export function clearContactSystemTagSweep(): void {
  if (sweepTimer !== null) {
    clearTimeout(sweepTimer);
    sweepTimer = null;
  }
}

/** Hourly leader-locked sweep, with an immediate first run after startup. */
export function scheduleContactSystemTagSweep(
  isWorkerRunning: () => boolean,
  delayMs = 60_000,
): void {
  if (!isWorkerRunning()) return;
  sweepTimer = setTimeout(() => {
    void (async () => {
      const lease = await tryAcquireLeaderLease(LEADER_LOCK_CONTACT_ROLE_TAGS);
      if (!lease) return;
      try {
        const result = await runContactSystemTagSweep();
        if (result.changed > 0) {
          logger.info(result, "[ContactSystemTags] Reconciled date-triggered role tags");
        }
      } catch (error: unknown) {
        logger.error(
          { err: error instanceof Error ? error.message : String(error) },
          "[ContactSystemTags] Sweep failed",
        );
      } finally {
        await lease.release();
      }
    })()
      .catch((error: unknown) => {
        logger.error({ err: error }, "[ContactSystemTags] Failed to acquire leader lease");
      })
      .finally(() => scheduleContactSystemTagSweep(isWorkerRunning, INTERVAL_MS));
  }, delayMs);
  sweepTimer.unref?.();
}
