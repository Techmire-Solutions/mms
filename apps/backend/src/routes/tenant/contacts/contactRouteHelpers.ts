import { buildBackgroundJobId } from "../../../lib/backgroundJobIds.js";
import type { FastifyReply } from "fastify";
import {
  type BackgroundJobRecord,
  type Contact,
  type ContactsSavedReportViewer,
  type User,
  CONTACTS_MODULE_MANIFEST,
  OWN_CONTACT_PATCH_KEYS,
  ownContactPatchBodySchema,
  roleHasPermission,
  resolveContactFieldConfigSnapshot,
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
  const jobId = buildBackgroundJobId(tenant, userId, options.idempotencyKey);
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
  // Never disable sanitization because the tenant row is missing: fall back to
  // the seed snapshot, exactly like the export path (C-10).
  return resolveContactFieldConfigSnapshot(await loadContactFieldConfig());
}

export async function sanitizeForUser(contacts: Contact[], user: User): Promise<Contact[]> {
  const options = await getContactFieldConfigViewerOptions();
  return sanitizeContactsForViewer(contacts, user.role, options);
}

export async function sanitizeOneForUser(contact: Contact, user: User): Promise<Contact> {
  const options = await getContactFieldConfigViewerOptions();
  return sanitizeContactForViewer(contact, user.role, options);
}

/** Contacts audit helper — shared factory, same shape as Faculty/Students. */
export const auditContact = createCollectionAuditHelper("contacts", { subjectScoped: true });

/**
 * Self-service contact edits go through the profile whitelist
 * (`ownContactPatchBodySchema`); `id`/`updatedAt` are transport and concurrency
 * metadata, not person-model fields.
 */
export const OWN_PROFILE_WRITE_KEYS: ReadonlySet<string> = new Set([
  ...OWN_CONTACT_PATCH_KEYS,
  "id",
  "updatedAt",
]);

/**
 * Rejects fields a self-service editor may not change on their own contact, then
 * enforces the profile DTO's value rules. Without this, `PUT /api/contacts/:id`
 * bypasses the narrower profile contract for relationships, bank details,
 * attachments and classification fields.
 */
export function ownProfileFieldDenial(body: unknown): {
  status: 400;
  body: {
    type: "validation_error";
    message: string;
    errors: Array<{ fieldId: string; tabId: string; message: string }>;
  };
} | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const unsupported = Object.keys(record)
    .filter((key) => !OWN_PROFILE_WRITE_KEYS.has(key))
    .sort();
  if (unsupported.length > 0) {
    return {
      status: 400,
      body: {
        type: "validation_error",
        message: `Self-service profile updates cannot change: ${unsupported.join(", ")}`,
        errors: unsupported.map((fieldId) => ({
          fieldId,
          tabId: "basic",
          message: "Requires contacts.write",
        })),
      },
    };
  }

  const { id: _id, updatedAt: _updatedAt, ...profilePatch } = record;
  const parsed = ownContactPatchBodySchema.safeParse(profilePatch);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  const message = issue?.message ?? "Invalid profile update";
  return {
    status: 400,
    body: {
      type: "validation_error",
      message,
      errors: [{ fieldId: String(issue?.path?.[0] ?? "profile"), tabId: "basic", message }],
    },
  };
}

export const RESERVED_CONTACT_ROUTE_IDS = new Set([
  "column-preferences",
  "column-prefs",
  "count",
  "metrics",
  "widget-aggregates",
  "resolve",
  "saved-reports",
  "lookups",
  "setup-config",
  "preferences",
  "field-configs",
  "google-sync",
]);
