import { RELATIONAL_REPLACE_MAPPING_ACADEMIC } from "./relationalReplaceMappingAcademicEntries.js";
import { RELATIONAL_REPLACE_MAPPING_FINANCE_MESSAGING } from "./relationalReplaceMappingFinanceMessagingEntries.js";
import { RELATIONAL_REPLACE_MAPPING_PERSON } from "./relationalReplaceMappingPersonEntries.js";
import type { RelationalCollectionMapping } from "./relationalReplaceMappingTypes.js";

export type { RelationalCollectionMapping } from "./relationalReplaceMappingTypes.js";

export const RELATIONAL_REPLACE_MAPPING: Record<string, RelationalCollectionMapping> = {
  ...RELATIONAL_REPLACE_MAPPING_PERSON,
  ...RELATIONAL_REPLACE_MAPPING_ACADEMIC,
  ...RELATIONAL_REPLACE_MAPPING_FINANCE_MESSAGING,
};
