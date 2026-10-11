import type { FastifyPluginAsync } from "fastify";
import type { Contact, User } from "@mms/shared";
import { CONTACTS_MODULE_MANIFEST, getDisplayName } from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleSetupAuditRoute } from "../../../lib/registerModuleSetupAuditRoute.js";
import { sendDatabaseError, sendNotFound } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { canReadContacts, canDeleteContacts } from "../../../services/rbacService.js";
import { contactUseCases } from "../../../contacts/use-cases/contactUseCases.js";
import {
  buildContactMergeBodySchema,
  moduleSetupAuditBodySchema as contactSetupAuditSchema,
  contactsCsvExportBodySchema,
  contactsImportBodySchema,
  contactsVcfExportBodySchema,
} from "@mms/shared";
import {
  auditContact,
  enqueueContactBackgroundJob,
  handleContactWriteError,
  requireContactPermission,
  sanitizeOneForUser,
} from "./contactRouteHelpers.js";
import { contactIdentityMatchBodySchema, collectContactWriteExtraFieldKeys } from "@mms/shared";
import { loadContactFieldConfig } from "../../../services/contactConfigService.js";

/** Contact CSV export queue, merge, and audit logging routes. */
export const contactAuditExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: canReadContacts,
    canDeleteTrash: canDeleteContacts,
    bodySchema: contactsCsvExportBodySchema,
    moduleId: CONTACTS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting contacts…",
    entityNoun: "contact",
    exportAuditAction: "contact.export",
    queueAuditAction: "contact.export.queue",
  });

  /**
   * Queued vCard import. One job per batch (client chunks > `CONTACTS_IMPORT_MAX_BATCH`) so a
   * large import no longer costs one POST per contact; the worker upserts and audits.
   */
  fastify.post("/import", { bodyLimit: 2 * 1024 * 1024 }, async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;

    const parsed = parseRequest(contactsImportBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const label = parsed.data.label?.trim() || "Importing contacts…";
    const job = await enqueueContactBackgroundJob({
      moduleId: CONTACTS_MODULE_MANIFEST.moduleId,
      kind: "import",
      label,
      payload: {
        contacts: parsed.data.contacts,
        label,
        viewerRole: user.role,
        language: (request.headers?.["accept-language"] as string | undefined) || "en",
      },
      idempotencyKey: parsed.data.idempotencyKey,
      user,
    });
    await auditContact(
      user,
      "contact.import.queue",
      `Queued contact import "${label}" (${parsed.data.contacts.length} contacts)`,
      job.id,
    );
    return reply.status(202).send({ job });
  });

  fastify.post("/export/vcf", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;

    const parsed = parseRequest(contactsVcfExportBodySchema, request.body ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const label = parsed.data.label?.trim() || "Exporting Apple Contacts…";
    const filename = parsed.data.filename?.trim() || "contacts.vcf";
    const job = await enqueueContactBackgroundJob({
      moduleId: CONTACTS_MODULE_MANIFEST.moduleId,
      kind: "export-vcf",
      label,
      payload: { filename, label },
      idempotencyKey: parsed.data.idempotencyKey,
      user,
    });
    await auditContact(
      user,
      "contact.export.queue",
      `Queued contact VCF export "${label}"`,
      job.id,
    );
    return reply.status(202).send({ job });
  });

  fastify.post("/identity-match", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;

    const parsed = parseRequest(contactIdentityMatchBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    try {
      const match = await contactUseCases.matchContactIdentityIndex(parsed.data);
      return reply.send(match);
    } catch (error: unknown) {
      return sendDatabaseError(reply, "Failed to match contact identity index", error);
    }
  });

  fastify.post(
    "/merge",
    {
      bodyLimit: 1048576,
      schema: { body: buildContactMergeBodySchema() },
    },
    async (request, reply) => {
      const user = request.user as User;
      if (!requireContactPermission(reply, user, ["write", "delete"])) return;

      const fieldConfig = await loadContactFieldConfig();
      const mergeSchema = buildContactMergeBodySchema(
        collectContactWriteExtraFieldKeys(fieldConfig),
      );
      const parsed = parseRequest(mergeSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      const keepId = String(parsed.data.keepId);
      const deleteId = String(parsed.data.deleteId);
      try {
        const merged = await contactUseCases.mergeContactsById(
          keepId,
          deleteId,
          parsed.data.merged as Contact | undefined,
          String(user.id),
        );
        await auditContact(
          user,
          "contact.merge",
          `Merged contact ${deleteId} into ${keepId} → "${getDisplayName(merged)}"`,
          keepId,
        );
        return reply.send({
          success: true,
          contact: await sanitizeOneForUser(merged, user),
        });
      } catch (error: unknown) {
        if (error instanceof Error && /not found/i.test(error.message)) {
          return sendNotFound(reply, error.message);
        }
        return handleContactWriteError(reply, error, "Failed to merge contacts");
      }
    },
  );

  registerModuleSetupAuditRoute(fastify, {
    setupWritePermission: CONTACTS_MODULE_MANIFEST.permissions.setupWrite,
    auditAction: "contact.setup",
    bodySchema: contactSetupAuditSchema,
  });
};
