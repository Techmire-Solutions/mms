/**
 * @file contractQuery.ts
 * @description Shared helpers for ts-rest envelope-shaped Query results.
 *
 * The ts-rest fetcher only throws for 401/403, so every feature hook has to
 * inspect `{ status, body }` itself. Open-coding that check drifted between
 * modules (`status === 200` vs `status !== 200`) and left `isError`/`data`
 * inconsistent with TanStack's own `isSuccess`. These two helpers are the
 * single place that decision is made.
 */

import { isContractOk, type ContractResponse } from "@/lib/apiContractError";

/** Response body when the envelope succeeded; `undefined` for any non-2xx. */
export function contractBody<T>(response: ContractResponse | undefined): T | undefined {
  if (!response) return undefined;
  return isContractOk(response.status) ? (response.body as T | undefined) : undefined;
}

/** True when the query failed, or its envelope carries a non-2xx status. */
export function isContractQueryError(query: {
  isError: boolean;
  data?: { status: number } | undefined;
}): boolean {
  return query.isError || (query.data != null && !isContractOk(query.data.status));
}
