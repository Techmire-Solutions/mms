/** Resolves points for a Hasanat denomination. */
export function getDenominationPoints(
  denominationId: string | null | undefined,
  denominationName?: string | null,
  denominations?: Array<{ id: string; points: number }> | null,
): number {
  if (!denominationId) return 0;

  const configured = denominations?.find((denomination) => denomination.id === denominationId);
  if (configured) return configured.points;

  const legacyPoints: Record<string, number> = {
    den1: 50,
    den2: 150,
    den3: 500,
    den4: 1000,
    den5: 2500,
  };
  if (legacyPoints[denominationId] !== undefined) {
    return legacyPoints[denominationId];
  }

  const normalizedName = denominationName?.toLowerCase() ?? "";
  if (normalizedName.includes("silver")) return 150;
  if (normalizedName.includes("gold")) return 500;
  if (normalizedName.includes("platinum")) return 1000;
  if (normalizedName.includes("diamond")) return 2500;
  return 50;
}
