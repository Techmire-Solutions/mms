/**
 * Batch-award and tier-progression HTTP handlers.
 *
 * Split from `hasanatDistributionHandlers` to keep every controller module inside the 300-line
 * ceiling; both are registered by the same ts-rest router.
 */

import type { User } from "@mms/shared";
import type { hasanatContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { hasanatUseCases } from "../../../hasanat/use-cases/hasanatUseCases.js";
import { handleContractError } from "../../../lib/contractError.js";

const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};

type StatusOf<K extends keyof typeof hasanatContract> = ContractRouteResponse<
  (typeof hasanatContract)[K]
>;
type ArgsOf<K extends keyof typeof hasanatContract> = ContractRouteArgs<
  (typeof hasanatContract)[K]
>;

export async function handleBatchAward({
  body,
  request,
}: ArgsOf<"batchAward">): Promise<StatusOf<"batchAward">> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () =>
        hasanatUseCases.batchAward(body, {
          bypassAwardScope: canDeleteCollection(user, "hasanat_distributions"),
        }),
      { readOnly: false },
    );
    if (result.queued) {
      return { status: 202 as const, body: result };
    }
    return { status: 200 as const, body: result };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to award the Hasanat batch" },
    });
  }
}

export async function handleBatchRecipients({
  query,
  request,
}: ArgsOf<"batchRecipients">): Promise<StatusOf<"batchRecipients">> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) return forbidden;

  const studentIds = (query?.studentIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const target =
    studentIds.length > 0
      ? ({ kind: "students", studentIds } as const)
      : query?.sessionId && query?.classId
        ? ({
            kind: "class",
            sessionId: query.sessionId,
            classId: query.classId,
            sectionId: query.sectionId ?? null,
          } as const)
        : null;

  if (!target) {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "Choose a class or a student list" },
    };
  }

  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () =>
        hasanatUseCases.batchRecipients(
          { target },
          { bypassAwardScope: canDeleteCollection(user, "hasanat_distributions") },
        ),
      { readOnly: true },
    );
    return { status: 200 as const, body: result };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load batch recipients" },
    });
  }
}

export async function handleStudentSummary({
  params: { id },
  query,
  request,
}: ArgsOf<"studentSummary">): Promise<StatusOf<"studentSummary">> {
  const user = request.user as User;
  if (!canReadCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const summary = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.getStudentSummary(id, query?.sessionId ?? null),
      { readOnly: true },
    );
    return { status: 200 as const, body: summary };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load the student summary" },
    });
  }
}

export async function handleReconcileTiers({
  request,
}: ArgsOf<"reconcileTiers">): Promise<StatusOf<"reconcileTiers">> {
  const user = request.user as User;
  // Tenant-wide award rebuild is an administrative repair, not a daily teaching action.
  if (!canDeleteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.reconcileTiers(),
      { readOnly: false },
    );
    return { status: 200 as const, body: result };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to reconcile tier awards" },
    });
  }
}

export async function handleStudentReport({
  query,
  request,
}: ArgsOf<"studentReport">): Promise<StatusOf<"studentReport">> {
  const user = request.user as User;
  if (!canReadCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const report = await withTenant(
      String(request.tenant?.id),
      () =>
        hasanatUseCases.getStudentReport({
          sessionId: query?.sessionId ?? null,
          classId: query?.classId && query.classId !== "all" ? query.classId : null,
          from: query?.from ?? null,
          to: query?.to ?? null,
        }),
      { readOnly: true },
    );
    return { status: 200 as const, body: report };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to load the Hasanat report" },
    });
  }
}
