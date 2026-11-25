/**
 * Capacity convention shared with the backend: a capacity of 0 (or a missing value) means
 * unlimited, not "full". UI cards used to coerce 0 to 30 and the section picker treated it
 * as full, so the same class could look full and open at once.
 */
export function effectiveCapacity(capacity: number | null | undefined): number {
  return typeof capacity === "number" && capacity > 0 ? capacity : Number.POSITIVE_INFINITY;
}

export function spotsLeft(
  enrolled: number | null | undefined,
  capacity: number | null | undefined,
): number {
  const cap = effectiveCapacity(capacity);
  return cap === Number.POSITIVE_INFINITY
    ? Number.POSITIVE_INFINITY
    : Math.max(0, cap - (enrolled ?? 0));
}

export function isCapacityFull(
  enrolled: number | null | undefined,
  capacity: number | null | undefined,
): boolean {
  return spotsLeft(enrolled, capacity) === 0;
}

/** Display helper: `∞` for unlimited capacities. */
export function capacityLabel(capacity: number | null | undefined): string {
  const cap = effectiveCapacity(capacity);
  return cap === Number.POSITIVE_INFINITY ? "∞" : String(cap);
}
