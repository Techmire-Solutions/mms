/** Default contact field seed — SSOT for contactFieldsStore and DB seed. */
import type { FieldDefinition } from "./contactFieldSchemaTypes.js";
import { INITIAL_FIELD_SEED_IDENTITY } from "./contactFieldSeedIdentity.js";
import { INITIAL_FIELD_SEED_PROFILE } from "./contactFieldSeedProfile.js";
import { INITIAL_FIELD_SEED_AFFILIATIONS } from "./contactFieldSeedAffiliations.js";

export {
  INITIAL_FIELD_SEED_IDENTITY,
  INITIAL_FIELD_SEED_PROFILE,
  INITIAL_FIELD_SEED_AFFILIATIONS,
};

// ── Default seed constants ────────────────────────────────────────────────────
// Single source of truth for all default field, tab, and column definitions.
// Consumed by contactFieldsStore (frontend) and any future DB seed.
// Hardcoding these values anywhere else is banned per mms-fields.md.

export const INITIAL_FIELD_SEED: Record<string, FieldDefinition[]> = {
  ...INITIAL_FIELD_SEED_IDENTITY,
  ...INITIAL_FIELD_SEED_PROFILE,
  ...INITIAL_FIELD_SEED_AFFILIATIONS,
};
