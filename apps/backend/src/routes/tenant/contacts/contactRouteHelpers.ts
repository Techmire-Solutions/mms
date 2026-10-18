import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import {
  type BackgroundJobRecord,
  type Contact,
  type ContactsSavedReportViewer,
  type User,
  CONTACTS_MODULE_MANIFEST,
  roleHasPermission,
  sanitizeContactForViewer,
  sanitizeContactsForViewer,
} from "@mms/shared";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";
import {
  canReadContacts,
  canWriteContacts,
  canDeleteContacts,
} from "../../../services/rbacService.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
} from "../../../services/backgroundJobWorkerService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendForbidden } from "../../../lib/httpErrors.js";
import { loadContactFieldConfig } from "../../../contacts/use-cases/contactConfigService.js";

import {
  type ParsedUniqueConstraintError,
  parsePostgresUniqueError,
  handleContactWriteError,
  formatContactWriteError,
} from "./contactRouteErrors.js";

export type ContactPermission = "read" | "write" | "delete";

export {
  type ParsedUniqueConstraintError,
  parsePostgresUniqueError,
  handleContactWriteError,
  formatContactWriteError,
};

/** Contacts permission gate: sends a 403 reply and returns false when not granted. */
export function requireContactPermission(
  reply: FastifyReply,
  user: User,
  permission: ContactPermission | ContactPermission[],
): boolean {
  const required = Array.isArray(permission) ? permission : [permission];
  const granted = required.every((entry) => {
    if (entry === "read") return canReadContacts(user);
    if (entry === "write") return canWriteContacts(user);
    return canDeleteContacts(user);
  });
  if (!granted) void sendForbidden(reply);
  return granted;
}

/**
 * Idempotent 202 background-job enqueue shared by the VCF export + duplicate scan:
 * returns the existing job for a repeated `idempotencyKey`, otherwise enqueues a fresh one.
 */
export async function enqueueContactBackgroundJob(options: {
  moduleId: string;
  kind: string;
  label: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  user: User;
}): Promise<BackgroundJobRecord> {
  const tenant = getRequestTenant();
  if (!tenant) {
    throw new Error("Tenant context is required to enqueue contact background job");
  }

  const userId = String(options.user.id);
  const jobId = options.idempotencyKey?.trim() || randomUUID();
  const existing = await getUserBackgroundJob(userId, jobId);
  if (existing) return existing;

  const runningJob: BackgroundJobRecord = {
    id: jobId,
    moduleId: options.moduleId,
    kind: options.kind,
    status: "running",
    label: options.label,
    createdAt: new Date().toISOString(),
  };
  return enqueueBackgroundJob(tenant, userId, runningJob, options.payload ?? {});
}

export function savedReportViewer(user: User): ContactsSavedReportViewer {
  return {
    id: String(user.id),
    role: user.role,
    isAdmin: roleHasPermission(user.role, CONTACTS_MODULE_MANIFEST.permissions.setupWrite),
  };
}

export async function getContactFieldConfigViewerOptions() {
  const fieldConfig = await loadContactFieldConfig();
  if (!fieldConfig) return null;
  return {
    fields: fieldConfig.fields,
    tabs: fieldConfig.formTabs ?? [],
  };
}

export async function sanitizeForUser(contacts: Contact[], user: User): Promise<Contact[]> {
  const options = await getContactFieldConfigViewerOptions();
  if (!options) return contacts;
  return sanitizeContactsForViewer(contacts, user.role, options);
}

export async function sanitizeOneForUser(contact: Contact, user: User): Promise<Contact> {
  const options = await getContactFieldConfigViewerOptions();
  if (!options) return contact;
  return sanitizeContactForViewer(contact, user.role, options);
}

/** Contacts audit helper — shared factory, same shape as Faculty/Students. */
export const auditContact = createCollectionAuditHelper("contacts");
