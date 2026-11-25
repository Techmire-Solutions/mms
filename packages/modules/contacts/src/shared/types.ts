/**
 * Contact DTO types re-exported from the `@mms/contracts` SSOT. The contracts
 * package owns every Zod schema and pure domain helper for contacts; this module
 * only re-exports the shapes its backend/frontend audiences consume.
 */
export type {
  Contact,
  ContactLookupKind,
  ContactLookupsMap,
  ContactPreferences,
  FieldConfig,
  RelationshipPair,
  TabDefinition,
} from "@mms/contracts";
