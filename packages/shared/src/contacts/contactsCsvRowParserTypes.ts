import { generateClientEntityId } from "../core/clientEntityIdUtils.js";

export interface ParseContactsRowContext {
  getVal: (key: string) => string;
  defaultPhoneLabel?: string;
  defaultEmailLabel?: string;
  defaultAddressLabel?: string;
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
