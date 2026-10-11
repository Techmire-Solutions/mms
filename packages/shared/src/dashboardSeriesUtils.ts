/**
 * Pure helpers for shaping dashboard time-series chart points from a
 * `Map` keyed by bucket key (e.g. `YYYY-MM` month keys). Centralizes the
 * "map over buckets → look up in Map → fall back to zero" idiom shared by
 * the enrollment and revenue chart data builders.
 */

/**
 * Build chart points from a `Map` of accumulated values keyed by bucket key.
 *
 * @param buckets  Ordered bucket descriptors (`{ key, label }`) defining the
 *                 x-axis points (e.g. recent months).
 * @param values   Accumulated values keyed by `bucket.key`.
 * @param toPoint  Projects a bucket + its resolved value (or `undefined` when
 *                 the bucket has no records) into a chart point. Callers apply
 *                 their own `?? 0` fallbacks inside the projector.
 */
export function buildBucketedSeries<B extends { key: string }, V, P>(
  buckets: readonly B[],
  values: Map<string, V>,
  toPoint: (bucket: B, value: V | undefined) => P,
): P[] {
  return buckets.map((bucket) => toPoint(bucket, values.get(bucket.key)));
}
