/**
 * Inferred Drizzle row types for the Hasanat module.
 */

import type { hasanatDenoms, hasanatBatches } from "./hasanatDenomsBatches.js";
import type { hasanatDistributions } from "./hasanatDistributions.js";
import type { hasanatRedemptions } from "./hasanatRedemptions.js";
import type { hasanatFieldConfigs, hasanatModulePreferences } from "./hasanatSetupConfig.js";

export type HasanatDenomRow = typeof hasanatDenoms.$inferSelect;
export type InsertHasanatDenomRow = typeof hasanatDenoms.$inferInsert;
export type HasanatBatchRow = typeof hasanatBatches.$inferSelect;
export type InsertHasanatBatchRow = typeof hasanatBatches.$inferInsert;
export type HasanatDistributionRow = typeof hasanatDistributions.$inferSelect;
export type InsertHasanatDistributionRow = typeof hasanatDistributions.$inferInsert;
export type HasanatRedemptionRow = typeof hasanatRedemptions.$inferSelect;
export type InsertHasanatRedemptionRow = typeof hasanatRedemptions.$inferInsert;
export type HasanatFieldConfigsRow = typeof hasanatFieldConfigs.$inferSelect;
export type InsertHasanatFieldConfigsRow = typeof hasanatFieldConfigs.$inferInsert;
export type HasanatModulePreferencesRow = typeof hasanatModulePreferences.$inferSelect;
export type InsertHasanatModulePreferencesRow = typeof hasanatModulePreferences.$inferInsert;
