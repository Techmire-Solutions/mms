/**
 * Handler for the atomic Hasanat redemption endpoint (`POST /api/hasanat/distributions/:id/redeem`).
 *
 * Extracted from `hasanatContractRouter` to keep that module inside the 300-line ceiling.
 */

import type { User } from "@mms/shared";
import type { hasanatContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canWriteCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { hasanatUseCases } from "../../../hasanat/use-cases/hasanatUseCases.js";
import { ConflictError, NotFoundError } from "../../../lib/httpErrors.js";

export async function handleRedeemDistribution({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof hasanatContract)["redeemDistribution"]>): Promise<
  ContractRouteResponse<(typeof hasanatContract)["redeemDistribution"]>
> {
  const user = request.user as User;
  if (!canWriteCollection(user, "hasanat_distributions")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }

  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => hasanatUseCases.redeemCard(id, body),
      { readOnly: false },
    );
    return { status: 200 as const, body: result };
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      return { status: 409 as const, body: { type: "conflict", message: error.message } };
    }
    if (error instanceof NotFoundError) {
      return { status: 404 as const, body: { type: "not_found", message: error.message } };
    }
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to redeem Hasanat card" },
    };
  }
}
