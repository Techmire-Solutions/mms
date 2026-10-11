import type { AppTranslationKey } from "./appTranslations.js";

/** Named schema group shown as its own ERD (Attendance, Accounting, …). */
export const ERD_DOMAIN_IDS = [
  "accounting",
  "attendance",
  "charity",
  "contacts",
  "dashboard",
  "enrollments",
  "examinations",
  "faculty",
  "finance",
  "hasanat",
  "inventory",
  "messaging",
  "obligations",
  "outbox",
  "platform",
  "questionBank",
  "sessions",
  "students",
  "system",
  "tasks",
  "users",
  "workshops",
] as const;

/** Registered ERD domain identifier. */
export type ErdDomainId = (typeof ERD_DOMAIN_IDS)[number];

/** Column role shown on an ERD table card. */
export type ErdColumnKind = "pk" | "fk" | "unique" | "column";

/** One column on an ERD table card. */
export interface ErdColumn {
  name: string;
  type: string;
  kind: ErdColumnKind;
}

/** One table node in a domain ERD. */
export interface ErdTable {
  name: string;
  columns: readonly ErdColumn[];
}

/** Directed FK edge between two tables in a domain ERD. */
export interface ErdRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  cardinality: "1:1" | "1:N" | "N:1" | "N:M";
  onDelete?: "cascade" | "set null";
}

/** One separated ERD (Attendance, Accounting, …). */
export interface ErdDomain {
  id: ErdDomainId;
  labelKey: AppTranslationKey;
  tables: readonly ErdTable[];
  relationships: readonly ErdRelationship[];
}

/** Dynamic ERD response payload returned by the live backend schema introspection API. */
export interface PlatformErdResponse {
  success: boolean;
  domains: readonly ErdDomain[];
  totalTables: number;
  generatedAt: string;
}
