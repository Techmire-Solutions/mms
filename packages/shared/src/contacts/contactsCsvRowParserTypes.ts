import { generateClientEntityId } from "../core/clientEntityIdUtils.js";

export interface ParseContactsRowContext {
  getVal: (key: string) => string;
  /**
   * Whether the file carries this column at all. An absent column means "the
   * export omitted it", not "the value is empty": the row parser leaves that
   * collection `undefined` so a re-import cannot clear stored rows (R4-04).
   */
  hasColumn?: (key: string) => boolean;
  defaultPhoneLabel?: string;
  defaultEmailLabel?: string;
  defaultAddressLabel?: string;
}

/** Any of the given columns present ⇒ the collection was represented in the file. */
export function hasAnyColumn(ctx: ParseContactsRowContext, keys: readonly string[]): boolean {
  if (!ctx.hasColumn) return true;
  return keys.some((key) => ctx.hasColumn?.(key) === true);
}

export function splitList(val: string | undefined): string[] {
  if (!val) return [];
  return val.split(";").map((s) => s.trim());
}

export function parseBool(val: string | undefined): boolean {
  if (!val) return false;
  const s = val.trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

export function cleanCell(val: string): string {
  const trimmed = val.trim();
  if (trimmed.startsWith("'") && /^[=+\-@\t\r]/.test(trimmed.slice(1))) {
    return trimmed.slice(1).trim();
  }
  return trimmed;
}

export function generateId(): string {
  return generateClientEntityId("c", "_");
}
