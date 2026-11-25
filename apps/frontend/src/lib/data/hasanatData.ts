import type { Denomination, StockBatch, Distribution, Redemption } from "@mms/contracts";
export type { Denomination, StockBatch, Distribution, Redemption };
/** A create payload that still carries the per-draft idempotency key the API must receive. */
export type DistributionWrite = Distribution & { clientRequestId?: string };
