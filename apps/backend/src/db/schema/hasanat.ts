/**
 * Hasanat module schema barrel.
 *
 * Exposed through `schema/index.ts` so every existing `../hasanat.js` import keeps working.
 * Decomposed into ≤300-line modules:
 * - `hasanatDenomsBatches.ts`: deeds and their stock batches.
 * - `hasanatDistributions.ts`: issued cards (soft-deletable, immutable value).
 * - `hasanatRedemptions.ts`: append-only redemption ledger.
 * - `hasanatSetupConfig.ts`: field config and module preferences.
 * - `hasanatSchemaTypes.ts`: inferred row types.
 */
export * from "./hasanatDenomsBatches.js";
export * from "./hasanatDistributions.js";
export * from "./hasanatRedemptions.js";
export * from "./hasanatSetupConfig.js";
export * from "./hasanatSchemaTypes.js";
