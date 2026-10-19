import type { ColumnRegistryEntry } from "./contactFieldSchemaTypes.js";
import { CONTACT_PRIMARY_COLUMNS } from "./contactColumnRegistryPrimary.js";
import { CONTACT_EXTENDED_COLUMNS } from "./contactColumnRegistryExtended.js";

export { CONTACT_PRIMARY_COLUMNS, CONTACT_EXTENDED_COLUMNS };

export const DEFAULT_COLUMN_REGISTRY: ColumnRegistryEntry[] = [
  ...CONTACT_PRIMARY_COLUMNS,
  ...CONTACT_EXTENDED_COLUMNS,
];
