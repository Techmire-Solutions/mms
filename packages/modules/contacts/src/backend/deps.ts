import type { Permission } from "@mms/contracts";

/**
 * App-supplied kernel dependencies for the contacts module.
 *
 * The module owns contacts domain logic; these callbacks are bound once by the
 * app composition root (`apps/api/src/modules/contacts/configure.ts`)
 * because they reach app-only kernel services: the auth user list, the BullMQ
 * job worker, storage/artifact writers, workspace branding, the tenant role
 * catalog and the CSV-export route factory. Keeping them behind this registry
 * lets the module stay free of `apps/**` imports (boundary ratchet).
 */
export interface ContactsKernelDeps {
  /** Contact id linked to a staff user (used by the contact edit guard). */
  getLinkedContactId(userId: string): Promise<string | number | null>;
  /** BullMQ enqueue (fully typed by the app implementation). */
  enqueueBackgroundJob(...args: any[]): Promise<any>;
  /** Fetch a background job row for the tray/polling. */
  getUserBackgroundJob(...args: any[]): Promise<any>;
  hasBackgroundJobRunner(key: string): boolean;
  registerBackgroundJobRunner(key: string, runner: any): void;
  resolveTenantExportKey(tenantId: string, filename: string): string;
  uploadStreamToStorage(...args: any[]): Promise<any>;
  saveStreamedExportArtifact(...args: any[]): Promise<any>;
  /** Current-role permission probe for queued import jobs (stale-role safe). */
  tenantUserHasPermission(tenant: string, userId: string, permission: Permission): Promise<boolean>;
  getWorkspaceBranding(tenant: string): Promise<{ country?: string } | null>;
  registerCsvExportRoutes(fastify: any, options: any): Promise<any> | any;
  /** Platform activity log append (platform contacts CRUD audit). */
  insertPlatformActivityLog(input: any): Promise<any>;
  /** Prepared contact-by-id statement (shared app prepared statements). */
  getPreparedContactById(client?: any): any;
  /** Legacy document-store object helpers used by the duplicate-scan cache. */
  getObject(key: string): Promise<unknown>;
  saveObject(key: string, data: unknown): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

const PORTS_KEY = Symbol.for("@mms/mod-contacts/ports");
type GlobalWithPorts = typeof globalThis & { [PORTS_KEY]?: ContactsKernelDeps | null };

export function configureContactsKernelDeps(next: ContactsKernelDeps): void {
  (globalThis as GlobalWithPorts)[PORTS_KEY] = next;
}

function deps(): ContactsKernelDeps {
  const configured = (globalThis as GlobalWithPorts)[PORTS_KEY];
  if (!configured) {
    throw new Error(
      "Contacts kernel deps are not configured (call configureContactsKernelDeps from the app composition root)",
    );
  }
  return configured;
}

export const getLinkedContactId = (userId: string) => deps().getLinkedContactId(userId);
export const enqueueBackgroundJob = (...args: any[]) => deps().enqueueBackgroundJob(...args);
export const getUserBackgroundJob = (...args: any[]) => deps().getUserBackgroundJob(...args);
export const hasBackgroundJobRunner = (key: string) => deps().hasBackgroundJobRunner(key);
export const registerBackgroundJobRunner = (key: string, runner: any) =>
  deps().registerBackgroundJobRunner(key, runner);
export const resolveTenantExportKey = (tenantId: string, filename: string) =>
  deps().resolveTenantExportKey(tenantId, filename);
export const uploadStreamToStorage = (...args: any[]) => deps().uploadStreamToStorage(...args);
export const saveStreamedExportArtifact = (...args: any[]) =>
  deps().saveStreamedExportArtifact(...args);
export const tenantUserHasPermission = (tenant: string, userId: string, permission: Permission) =>
  deps().tenantUserHasPermission(tenant, userId, permission);
export const getWorkspaceBranding = (tenant: string) => deps().getWorkspaceBranding(tenant);
export const registerCsvExportRoutes = (fastify: any, options: any) =>
  deps().registerCsvExportRoutes(fastify, options);
export const insertPlatformActivityLog = (input: any) => deps().insertPlatformActivityLog(input);
export const getPreparedContactById = (client?: any) => deps().getPreparedContactById(client);
export const getObject = (key: string) => deps().getObject(key);
export const saveObject = (key: string, data: unknown) => deps().saveObject(key, data);
export const deleteObject = (key: string) => deps().deleteObject(key);
