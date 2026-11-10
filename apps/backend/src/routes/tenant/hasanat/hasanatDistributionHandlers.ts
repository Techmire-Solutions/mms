/**
 * HTTP handlers for Hasanat card routes.
 *
 * Controllers stay deliberately thin: authenticate/authorise, open the tenant transaction, call
 * one use case, map domain errors to status codes. No card rule is evaluated here.
 */

import type { User } from "@mms/shared";
import type { hasanatContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
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

export async function handleCreateDistribution({
  body,
  request,
}: ArgsOf<"createDistribution">): Promise<StatusOf<"createDistribution">> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const distribution = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.createDistribution(body),
      { readOnly: false },
    );
    return { status: 201 as const, body: { distribution } };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to issue the Hasanat card" },
    });
  }
}

export async function handleUpdateDistribution({
  params: { id },
  body,
  request,
}: ArgsOf<"updateDistribution">): Promise<StatusOf<"updateDistribution">> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const distribution = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.updateDistributionById(id, body),
      { readOnly: false },
    );
    return { status: 200 as const, body: { distribution } };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to update the Hasanat card" },
    });
  }
}

export async function handleChangeDistributionStatus({
  params: { id },
  body,
  request,
}: ArgsOf<"changeDistributionStatus">): Promise<StatusOf<"changeDistributionStatus">> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const distribution = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.changeDistributionStatus(id, body),
      { readOnly: false },
    );
    return { status: 200 as const, body: { distribution } };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to change the card status" },
    });
  }
}

export async function handleDeleteDistribution({
  params: { id },
  body,
  request,
}: ArgsOf<"deleteDistribution">): Promise<StatusOf<"deleteDistribution">> {
  const user = request.user as User;
  if (!canDeleteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const ok = await withTenant(
      String(request.tenant?.id),
      () =>
        body?.deletionReason
          ? hasanatUseCases.deleteDistributionById(String(id), String(user.id), body.deletionReason)
          : hasanatUseCases.deleteDistributionById(String(id), String(user.id)),
      { readOnly: false },
    );
    if (!ok) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Distribution not found" },
      };
    }
    return { status: 200 as const, body: { success: true as const } };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to delete the Hasanat card" },
    });
  }
}

export async function handleRestoreDistribution({
  params: { id },
  request,
}: ArgsOf<"restoreDistribution">): Promise<StatusOf<"restoreDistribution">> {
  const user = request.user as User;
  if (!canDeleteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const ok = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.restoreDistributionById(id, String(user.id)),
      { readOnly: false },
    );
    if (!ok) {
      return {
        status: 404 as const,
        body: { type: "not_found", message: "Distribution not found" },
      };
    }
    return { status: 200 as const, body: { success: true as const } };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to restore the Hasanat card" },
    });
  }
}

export async function handleBulkDeleteDistributions({
  body,
  request,
}: ArgsOf<"bulkDeleteDistributions">): Promise<StatusOf<"bulkDeleteDistributions">> {
  const user = request.user as User;
  if (!canDeleteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () =>
        hasanatUseCases.bulkSoftDeleteDistributions(
          body.ids.map(String),
          String(user.id),
          body.deletionReason,
        ),
      { readOnly: false },
    );
    return { status: 200 as const, body: { success: true as const, ...result } };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to bulk delete distributions" },
    });
  }
}

export async function handleBulkRestoreDistributions({
  body,
  request,
}: ArgsOf<"bulkRestoreDistributions">): Promise<StatusOf<"bulkRestoreDistributions">> {
  const user = request.user as User;
  if (!canDeleteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.bulkRestoreDistributions(body.ids.map(String), user?.id),
      { readOnly: false },
    );
    return { status: 200 as const, body: { success: true as const, ...result } };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to bulk restore distributions" },
    });
  }
}

export async function handleRedeemDistribution({
  params: { id },
  body,
  request,
}: ArgsOf<"redeemDistribution">): Promise<StatusOf<"redeemDistribution">> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.redeemCard(id, body),
      { readOnly: false },
    );
    return { status: 200 as const, body: result };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to redeem the Hasanat card" },
    });
  }
}

export async function handleReverseRedemption({
  params: { id },
  body,
  request,
}: ArgsOf<"reverseRedemption">): Promise<StatusOf<"reverseRedemption">> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) return forbidden;
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.voidRedemption(id, body),
      { readOnly: false },
    );
    return { status: 200 as const, body: result };
  } catch (error: unknown) {
    return handleContractError(request, error, {
      status: 500,
      body: { type: "database_error", message: "Failed to reverse the redemption" },
    });
  }
}
