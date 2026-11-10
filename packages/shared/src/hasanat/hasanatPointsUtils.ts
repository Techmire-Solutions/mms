import type { Denomination } from "./hasanatModuleManifest.js";

/**
 * Resolves points for a Hasanat denomination from the configured list.
 *
 * Returns 0 when the denomination is unknown — the server has the same behaviour
 * (`COALESCE(den.points, 0)`), so the UI can never invent a value the backend did not compute.
 * The historical 50/150/500/1000/2500 guess by id or name is deliberately gone.
 */
export function getDenominationPoints(
  denominationId: string | null | undefined,
  _denominationName?: string | null,
  denominations?: Array<Pick<Denomination, "id" | "points">> | null,
): number {
  if (!denominationId) return 0;
  const configured = denominations?.find((denomination) => denomination.id === denominationId);
  return configured ? configured.points : 0;
}

/** Points for one issued card: the immutable snapshot when present, else the deed lookup. */
export function resolveDistributionPoints(
  record: {
    pointsSnapshot?: number | null;
    denominationId?: string | null;
    quantity?: number | null;
  },
  denominations?: Array<Pick<Denomination, "id" | "points">> | null,
): number {
  const snapshot = record.pointsSnapshot;
  if (typeof snapshot === "number" && Number.isFinite(snapshot)) return snapshot;
  const perUnit = getDenominationPoints(record.denominationId, null, denominations);
  const quantity = typeof record.quantity === "number" ? record.quantity : 1;
  return perUnit * quantity;
}
