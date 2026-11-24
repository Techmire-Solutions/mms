import type { ColumnRegistryEntry } from "./contactFieldSchemaTypes.js";
import { CONTACT_PRIMARY_COLUMNS } from "./contactColumnRegistryPrimary.js";
import { CONTACT_EXTENDED_COLUMNS } from "./contactColumnRegistryExtended.js";
import {
  resolveModuleColumnWidth,
  type ModuleColumnKind,
} from "../settings/moduleColumnWidthPresets.js";

export { CONTACT_PRIMARY_COLUMNS, CONTACT_EXTENDED_COLUMNS };

/** Content kind per Contacts Work column; drives default width and the stale-width floor. */
const CONTACT_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  name: "identity",
  gender: "boolean",
  phone: "phone",
  whatsapp: "status",
  email: "email",
  isSyed: "boolean",
  tag: "chips",
  dob: "date",
  lunarDob: "dualDate",
  cnic: "reference",
  line1: "longText",
  city: "shortText",
  state: "shortText",
  country: "shortText",
  relationship_contact: "person",
  notes: "longText",
  bank_account: "reference",
  bank_iban: "reference",
};

/** Content kind for a Contacts column key, or `undefined` for custom/unsized columns. */
export function getContactColumnKind(key: string): ModuleColumnKind | undefined {
  return Object.hasOwn(CONTACT_COLUMN_KINDS, key) ? CONTACT_COLUMN_KINDS[key] : undefined;
}

function withKind(column: ColumnRegistryEntry): ColumnRegistryEntry {
  const kind = getContactColumnKind(column.key);
  if (!kind) return column;
  return { ...column, kind, width: resolveModuleColumnWidth(undefined, kind) };
}

export const DEFAULT_COLUMN_REGISTRY: ColumnRegistryEntry[] = [
  ...CONTACT_PRIMARY_COLUMNS,
  ...CONTACT_EXTENDED_COLUMNS,
].map(withKind);
