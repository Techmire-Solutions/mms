import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { CONTACTS_MODULE_MANIFEST, roleHasPermission } from "@mms/shared";
import {
  createContactsSavedReport,
  deleteContactsSavedReport,
  listContactsSavedReports,
  touchContactsSavedReportRun,
} from "../../../services/contactSavedReportsService.js";
import { contactsSavedReportCreateSchema, resourceIdParamsSchema } from "@mms/shared";
import { sendDatabaseError, sendForbidden, sendNotFound } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import {
  auditContact,
  requireContactPermission,
  savedReportViewer,
} from "./contactRouteHelpers.js";

export const contactSavedReportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/saved-reports", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;
    try {
      const reports = await listContactsSavedReports(savedReportViewer(user));
      return reply.send({ reports });
    } catch {
      return sendDatabaseError(reply, "Failed to list saved reports");
    }
  });

  fastify.post("/saved-reports", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;
    const parsed = parseRequest(contactsSavedReportCreateSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const scope = parsed.data.shareScope ?? "private";
    if (
      scope === "global" &&
      !roleHasPermission(user.role, CONTACTS_MODULE_MANIFEST.permissions.setupWrite)
    ) {
      return sendForbidden(reply);
    }
    if (scope === "users" && !parsed.data.sharedWithUserIds?.length) {
      return replyValidationError(reply, "sharedWithUserIds required when shareScope is users");
    }
    try {
      const report = await createContactsSavedReport({
        name: parsed.data.name,
        drillDown: parsed.data.drillDown,
        createdBy: String(user.id),
        createdByName: user.name || user.email,
        shareScope: scope,
        sharedWithRoles: parsed.data.sharedWithRoles,
        sharedWithUserIds: parsed.data.sharedWithUserIds,
      });
      await auditContact(
        user,
        "contact.saved_report.create",
        `Saved report "${report.name}" (${scope})`,
      );
      return reply.status(201).send({ report });
    } catch {
      return sendDatabaseError(reply, "Failed to save report");
    }
  });

  fastify.delete("/saved-reports/:id", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const deleted = await deleteContactsSavedReport(params.data.id, savedReportViewer(user));
      if (!deleted) {
        return sendNotFound(reply, "Saved report not found");
      }
      await auditContact(
        user,
        "contact.saved_report.delete",
        `Deleted saved report ${params.data.id}`,
      );
      return reply.send({ success: true });
    } catch {
      return sendDatabaseError(reply, "Failed to delete saved report");
    }
  });

  fastify.post("/saved-reports/:id/run", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const report = await touchContactsSavedReportRun(params.data.id, savedReportViewer(user));
      if (!report) {
        return sendNotFound(reply, "Saved report not found");
      }
      await auditContact(user, "contact.saved_report.run", `Ran saved report "${report.name}"`);
      return reply.send({ report });
    } catch {
      return sendDatabaseError(reply, "Failed to run saved report");
    }
  });
};
