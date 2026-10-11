import type { FastifyPluginAsync } from "fastify";
import type { Contact, User } from "@mms/shared";
import { CONTACTS_MODULE_MANIFEST } from "@mms/shared";
import { sendDatabaseError } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { countContactDuplicateMatches } from "../../../services/contactDuplicateScanService.js";
import { contactUseCases } from "../../../contacts/use-cases/contactUseCases.js";
import { prepareContactRecord } from "../../../services/contactService.js";
import {
  buildContactDuplicateCheckBodySchema,
  contactsDuplicatesQuerySchema,
  contactsDuplicateScanBodySchema,
} from "@mms/shared";
import { loadContactFieldConfig } from "../../../services/contactConfigService.js";
import { collectContactWriteExtraFieldKeys, sanitizeContactsForViewer } from "@mms/shared";
import {
  enqueueContactBackgroundJob,
  getContactFieldConfigViewerOptions,
  requireContactPermission,
} from "./contactRouteHelpers.js";

/** Contact duplicate check, pairs list, and background scan routes. */
export const contactDuplicateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/duplicate-check", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;
    const fieldConfig = await loadContactFieldConfig();
    const checkSchema = buildContactDuplicateCheckBodySchema(
      collectContactWriteExtraFieldKeys(fieldConfig),
    );
    const parsed = parseRequest(checkSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const prepared = await prepareContactRecord(parsed.data.contact as Contact);
      const matchCount = await countContactDuplicateMatches(prepared);
      return reply.send({ matchCount });
    } catch {
      return sendDatabaseError(reply, "Failed to check contact duplicates");
    }
  });

  fastify.get("/duplicates", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;
    const parsed = parseRequest(contactsDuplicatesQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const page = await contactUseCases.loadContactDuplicatePairsPage(parsed.data);
      const viewerOptions = await getContactFieldConfigViewerOptions();
      const pairs = viewerOptions
        ? page.pairs.map((pair) => ({
            ...pair,
            contacts: sanitizeContactsForViewer(pair.contacts, user.role, viewerOptions),
          }))
        : page.pairs;
      return reply.send({ ...page, pairs });
    } catch (err) {
      request.log.error(err, "Failed to load duplicate pairs");
      return sendDatabaseError(reply, "Failed to load duplicate pairs");
    }
  });

  fastify.post("/duplicates/scan", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "read")) return;

    const parsed = parseRequest(contactsDuplicateScanBodySchema, request.body ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const job = await enqueueContactBackgroundJob({
      moduleId: CONTACTS_MODULE_MANIFEST.moduleId,
      kind: "duplicate-scan",
      label: parsed.data.label?.trim() || "duplicate-scan",
      idempotencyKey: parsed.data.idempotencyKey,
      user,
    });
    return reply.status(202).send({ job });
  });
};
