/**
 * @file usersExportUtils.ts
 * @description Users module export utilities covering all identity, security, role, and activity attributes.
 */
import type { WorkspaceUser } from "./userEntityTypes.js";
import { buildExportGrid } from "./dataTransfer/export/buildExportGrid.js";
import type { ExportColumn } from "./dataTransfer/core/exportTypes.js";

export interface UserExportColumn {
  id: string;
  label: string;
}

const USER_EXPORT_ALWAYS_VISIBLE = new Set([
  "name",
  "email",
  "role",
  "status",
  "phone",
  "lastLogin",
  "createdDate",
  "twoFactorEnabled",
]);

export const DEFAULT_USER_EXPORT_COLUMNS: readonly UserExportColumn[] = [
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "loginEmail", label: "Login Email" },
  { id: "role", label: "Role" },
  { id: "roleSource", label: "Role Source" },
  { id: "status", label: "Status" },
  { id: "phone", label: "Phone" },
  { id: "twoFactorEnabled", label: "2FA Enabled" },
  { id: "mustChangePassword", label: "Must Change Password" },
  { id: "lastLogin", label: "Last Login" },
  { id: "createdDate", label: "Created" },
  { id: "failedLoginAttempts", label: "Failed Login Attempts" },
  { id: "activeSessions", label: "Active Sessions" },
  { id: "emailVerifiedAt", label: "Email Verified At" },
  { id: "createdAt", label: "Created At" },
  { id: "updatedAt", label: "Updated At" },
] as const;

export const ALL_USER_EXPORT_COLUMNS = DEFAULT_USER_EXPORT_COLUMNS;

/** Resolves all user export columns. */
export function resolveAllUserExportColumns(): UserExportColumn[] {
  return [...ALL_USER_EXPORT_COLUMNS];
}

/** Merges custom columns into a user export column list. */
export function mergeCustomUserExportColumns(
  columns: UserExportColumn[],
  customColumns?: UserExportColumn[] | null,
): UserExportColumn[] {
  const seen = new Set(columns.map((c) => c.id));
  const result = [...columns];
  if (Array.isArray(customColumns)) {
    for (const col of customColumns) {
      if (col?.id && !seen.has(col.id)) {
        seen.add(col.id);
        result.push(col);
      }
    }
  }
  return result;
}

/** Users Work CSV uses simple always-visible core columns. */
export function filterUserExportColumnsForViewer(columns: UserExportColumn[]): UserExportColumn[] {
  if (columns.length === 0) {
    return resolveAllUserExportColumns();
  }
  return columns.filter(
    (column) =>
      USER_EXPORT_ALWAYS_VISIBLE.has(column.id) ||
      DEFAULT_USER_EXPORT_COLUMNS.some((c) => c.id === column.id) ||
      column.id.startsWith("custom:"),
  );
}

/** Pure cell extractor for WorkspaceUser entities. */
export function extractUserCell(user: WorkspaceUser, columnId: string): string | boolean | null {
  if (columnId === "name") return user.name || "";
  if (columnId === "email") return user.email || user.loginEmail || "";
  if (columnId === "loginEmail") return user.loginEmail || "";
  if (columnId === "role") return user.role || "";
  if (columnId === "roleSource") return user.roleSource || "manual";
  if (columnId === "status") return String(user.status || "active");
  if (columnId === "phone") return user.phone || "";
  if (columnId === "lastLogin") return user.lastLogin || "";
  if (columnId === "createdDate") return user.createdDate || "";
  if (columnId === "twoFactorEnabled") return user.twoFactorEnabled ? "yes" : "no";
  if (columnId === "mustChangePassword") return user.mustChangePassword ? "yes" : "no";
  if (columnId === "failedLoginAttempts") {
    return user.failedLoginAttempts != null ? String(user.failedLoginAttempts) : "0";
  }
  if (columnId === "activeSessions") {
    return user.activeSessions != null ? String(user.activeSessions) : "0";
  }
  if (columnId === "emailVerifiedAt") return user.emailVerifiedAt || "";
  if (columnId === "createdAt") return (user.createdAt as string) || "";
  if (columnId === "updatedAt") return (user.updatedAt as string) || "";

  const propKey = columnId.startsWith("custom:") ? columnId.slice("custom:".length) : columnId;
  const customObj = (user as { customFields?: Record<string, unknown> }).customFields;
  const cellVal =
    user[propKey as keyof WorkspaceUser] ?? customObj?.[propKey] ?? customObj?.[columnId];
  if (cellVal === undefined || cellVal === null) return "";
  if (typeof cellVal === "boolean") return cellVal ? "yes" : "no";
  if (typeof cellVal === "number") return String(cellVal);
  if (typeof cellVal === "string") return cellVal;
  if (Array.isArray(cellVal)) return cellVal.map(String).filter(Boolean).join("; ");
  if (typeof cellVal === "object") return JSON.stringify(cellVal);
  return String(cellVal);
}

/** Builds a 2D grid [header, ...rows] for the given users and columns. */
export function buildUsersExportRows(
  users: WorkspaceUser[],
  columns: UserExportColumn[],
): unknown[][] {
  return buildExportGrid(users, columns as ExportColumn[], extractUserCell);
}
