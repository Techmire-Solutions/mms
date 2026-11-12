import {
  WORKSHOPS_MODULE_MANIFEST,
  evaluateWorkshopTransition,
  InvalidWorkshopStatusError,
  normalizeWorkshopStatus,
  parseWorkshopStatus,
  type WorkshopEvent,
  type WorkshopTransitionBody,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { runAfterCommit } from "../../db/commitScope.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { isIsoUtcTimestamp } from "../../lib/occHeaders.js";
import {
  ConflictError,
  HttpDomainError,
  NotFoundError,
  ValidationError,
} from "../../lib/httpErrors.js";
import { emitOutboxEvents } from "../../services/outboxEventService.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { assertWorkshopTransitionAllowed } from "../domain/workshopWriteGuards.js";
import { buildCompletionRows } from "../domain/workshopCompletionRules.js";
import {
  archiveWorkshopRegistrationsTx,
  countActiveParticipantsByWorkshop,
  loadCompletionInputs,
  countCertificatesTx,
  countLiveParticipantsTx,
  lockWorkshopTx,
  saveCompletionOutcomesTx,
  updateWorkshopStatusIfTx,
  workshopRowToRecord,
  workshopToday,
} from "../repository/workshopLifecycleRepositoryAdapter.js";

const EVENTS = WORKSHOPS_MODULE_MANIFEST.collectionKey;

export interface WorkshopTransitionActor {
  id?: string | null;
  label?: string | null;
}

/**
 * The single write path for every workshop status change.
 *
 * One transaction: lock the event row, check the caller's OCC token, evaluate the shared lifecycle
 * guards against the counts read under that lock, compare-and-set the status, and — when the target
 * is `cancelled` — archive the live registrations with provenance. The audit row and the outbox CDC
 * events are written in the same transaction; live broadcasts are queued until the commit.
 */
export async function transitionWorkshop(
  tenant: string,
  id: string,
  body: WorkshopTransitionBody,
  actor: WorkshopTransitionActor,
  expectedUpdatedAt: string | null | undefined,
): Promise<WorkshopEvent> {
  const subdomain = tenant.trim().toLowerCase();
  let target: string;
  try {
    target = parseWorkshopStatus(body.to);
  } catch (error) {
    if (error instanceof InvalidWorkshopStatusError) {
      throw new ValidationError(`Unknown workshop status: ${String(body.to)}`);
    }
    throw error;
  }
  const token = (expectedUpdatedAt ?? "").trim();
  if (!token) {
    throw new HttpDomainError(
      428,
      "precondition_required",
      "Send x-expected-updated-at with the value you read before changing the workshop",
    );
  }
  if (!isIsoUtcTimestamp(token)) {
    throw new ValidationError(
      "x-expected-updated-at must be an ISO-8601 UTC timestamp (for example 2026-03-01T10:00:00.000Z)",
    );
  }
  const expected = new Date(token).toISOString();
  const reason = body.reason?.trim() || null;

  return withTenant(subdomain, async (tx) => {
    const workshop = await lockWorkshopTx(tx, subdomain, id);
    if (!workshop) throw new NotFoundError("Workshop not found");
    if (workshop.updatedAt.toISOString() !== expected) {
      throw new ConflictError(
        "This workshop was modified by another user — reload and try again",
        "stale_workshop",
      );
    }

    const today = await workshopToday(subdomain);
    const liveRegistrations = await countLiveParticipantsTx(tx, subdomain, id);
    const certificatesIssued = await countCertificatesTx(tx, subdomain, id);
    assertWorkshopTransitionAllowed(workshop, target, {
      today,
      liveRegistrations,
      certificatesIssued,
    });
    const evaluation = evaluateWorkshopTransition(workshop.status, target, {
      today,
      liveRegistrations,
      certificatesIssued,
      startDate: workshop.startDate,
      endDate: workshop.endDate,
    });

    const now = new Date();
    let updated = workshop;
    if (!evaluation.noop) {
      const moved = await updateWorkshopStatusIfTx(tx, subdomain, id, workshop.status, target, now);
      if (!moved) {
        throw new ConflictError(
          "This workshop was modified by another user — reload and try again",
          "stale_workshop",
        );
      }
      updated = moved;

      if (target === "completed") {
        // Closing the books finalizes every participant's standing in the same transaction; the
        // Reports tier reads stored statuses, so completing without this used to show 0 completed
        // until someone clicked Evaluate.
        const inputs = await loadCompletionInputs(subdomain, id, today);
        const rows = buildCompletionRows(inputs, today);
        await saveCompletionOutcomesTx(
          tx,
          subdomain,
          id,
          rows.map((row) => ({ participantId: row.participantId, status: row.status })),
        );
      }

      if (target === "cancelled") {
        const archived = await archiveWorkshopRegistrationsTx(tx, subdomain, id, {
          actorId: actor.id ?? null,
          reason: reason ?? "Workshop cancelled",
          at: now,
        });
        if (archived.length > 0) {
          await emitOutboxEvents(
            archived.map((registration) => ({
              type: "entity.soft_deleted" as const,
              payload: {
                entityType: "workshop_participants",
                entityId: registration.id,
                tenantId: subdomain,
                deletedAt: now.toISOString(),
                deletedBy: actor.id ?? "system",
                deletionReason: reason ?? "Workshop cancelled",
                version: now.getTime(),
              },
            })),
          );
        }
      }

      await recordModernAuditEvent({
        workspaceSubdomain: subdomain,
        tableName: "workshop_events",
        recordId: id,
        actionType: "UPDATE",
        subjectId: id,
        oldState: workshop,
        newState: {
          ...updated,
          operation: "transition",
          from: normalizeWorkshopStatus(workshop.status),
          to: normalizeWorkshopStatus(target),
          reason: reason ?? undefined,
          actor: actor.label ?? actor.id ?? undefined,
        },
      });
    }

    runAfterCommit(() => broadcastCollection(EVENTS));
    const counts = await countActiveParticipantsByWorkshop(tx, subdomain, [id]);
    return workshopRowToRecord(updated, counts.get(id) ?? 0, today);
  });
}
