import type { SerializedEntityAuditFields, SoftDeleteFields } from "@mms/shared";

/**
 * Standard audit columns selected from Drizzle tables containing
 * timestamp mode: 'date' and softDeleteColumns mixin.
 */
export interface DrizzleAuditSelectRow extends SoftDeleteFields {
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type DbAuditRow = DrizzleAuditSelectRow;

export type ContractAuditFields = SerializedEntityAuditFields;

export function toIsoString(val: Date | string | null | undefined): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

/**
 * Maps raw Drizzle audit and soft-delete columns to contract-compliant ISO string representations.
 */
export function mapAuditTimestamps<T extends DrizzleAuditSelectRow>(row: T): ContractAuditFields {
  const fields: ContractAuditFields = {};
  if (row.createdAt) fields.createdAt = toIsoString(row.createdAt);
  if (row.updatedAt) fields.updatedAt = toIsoString(row.updatedAt);
  if (row.deletedAt) fields.deletedAt = toIsoString(row.deletedAt);
  if (row.deletedBy != null) fields.deletedBy = row.deletedBy;
  if (row.deletionReason != null) fields.deletionReason = row.deletionReason;
  if (row.restoredAt) fields.restoredAt = toIsoString(row.restoredAt);
  if (row.restoredBy != null) fields.restoredBy = row.restoredBy;
  if (row.deletedWithCascade != null) fields.deletedWithCascade = Boolean(row.deletedWithCascade);
  if (row.createdBy != null) fields.createdBy = row.createdBy;
  if (row.updatedBy != null) fields.updatedBy = row.updatedBy;
  return fields;
}

/**
 * Normalizes Drizzle SQL null column values to undefined for optional contract fields.
 */
export type NullToUndefined<T> = {
  [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | undefined : T[K];
};

export function nullsToUndefined<T extends Record<string, unknown>>(row: T): NullToUndefined<T> {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(row)) {
    result[key] = value === null ? undefined : value;
  }
  return result as NullToUndefined<T>;
}

/**
 * Safely parses Drizzle SQL numeric columns (returned as strings) to numbers.
 * Returns undefined if null, undefined, or empty/whitespace string.
 */
export function parseNumericColumn(val: string | number | null | undefined): number | undefined {
  if (val == null) return undefined;
  if (typeof val === "number") return Number.isFinite(val) ? val : undefined;
  const trimmed = val.trim();
  if (trimmed === "") return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

export interface DrizzleAuditInsertFields {
  createdAt?: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  deletionReason: string | null;
  restoredAt: Date | null;
  restoredBy: string | null;
  deletedWithCascade: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface ContractAuditInput extends SoftDeleteFields {
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

/**
 * Maps contract-compliant audit fields to Drizzle SQL insert/update values.
 */
export function mapAuditToInsert(contract: ContractAuditInput): DrizzleAuditInsertFields {
  const result: DrizzleAuditInsertFields = {
    updatedAt: new Date(),
    deletedAt: contract.deletedAt ? new Date(contract.deletedAt) : null,
    deletedBy: contract.deletedBy ?? null,
    deletionReason: contract.deletionReason ?? null,
    restoredAt: contract.restoredAt ? new Date(contract.restoredAt) : null,
    restoredBy: contract.restoredBy ?? null,
    deletedWithCascade: Boolean(contract.deletedWithCascade),
  };
  if (contract.createdAt) {
    result.createdAt = new Date(contract.createdAt);
  }
  if (contract.createdBy !== undefined) {
    result.createdBy = contract.createdBy;
  }
  if (contract.updatedBy !== undefined) {
    result.updatedBy = contract.updatedBy;
  }
  return result;
}
