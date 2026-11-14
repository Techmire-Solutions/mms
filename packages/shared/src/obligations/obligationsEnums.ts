/**
 * @file obligationsEnums.ts
 * @description Canonical runtime tuples for every closed vocabulary in the module.
 *
 * The values used to exist twice: as zod literals in the schemas below, and as hand-written `as
 * const` tuples in `apps/frontend/src/lib/data/obligationsData.ts`. Nothing tied the two, so adding
 * a payment mode or a designation to the DTO left the UI's dropdown and validation stale (audit S2).
 * The tuples are now the single source, and the zod schemas are derived from them.
 *
 * Each tuple must also match its database CHECK constraint — `obligation_collections_payment_mode_chk`
 * and `obligation_distributions_type_chk` (migration 0258) — which `obligationsPersistenceDb` asserts.
 */
import { z } from "zod";

/** How a receipt was paid. `payment_mode` on `obligation_collections`. */
export const OBLIGATION_PAYMENT_MODES = ["Cash", "Online"] as const;
export const obligationPaymentModeSchema = z.enum(OBLIGATION_PAYMENT_MODES);
export type ObligationPaymentMode = z.infer<typeof obligationPaymentModeSchema>;

/** The accounting nature of a split rule. `type` on `obligation_distributions`. */
export const OBLIGATION_DISTRIBUTION_TYPES = ["Liability", "Income"] as const;
export const obligationDistributionTypeSchema = z.enum(OBLIGATION_DISTRIBUTION_TYPES);
export type ObligationDistributionType = z.infer<typeof obligationDistributionTypeSchema>;

/** Who may receive from an obligation type. `designated_for` on `obligation_types`. */
export const OBLIGATION_DESIGNATED_FOR = ["Syed", "Non-Syed", "Both", "None"] as const;
export const obligationDesignatedForSchema = z.enum(OBLIGATION_DESIGNATED_FOR);
export type ObligationDesignatedFor = z.infer<typeof obligationDesignatedForSchema>;
