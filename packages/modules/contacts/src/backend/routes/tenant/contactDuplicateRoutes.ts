import type { FastifyPluginAsync } from "fastify";
import type { Contact, User } from "@mms/contracts";
import { CONTACTS_MODULE_MANIFEST } from "@mms/contracts";
import { sendDatabaseError } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { countContactDuplicateMatches } from "../../use-cases/contactDuplicateScanUseCases.js";
import { contactUseCases } from "../../use-cases/contactUseCases.js";
import { prepareContactRecord } from "../../services/contactService.js";
import {
  buildContactDuplicateCheckBodySchema,
  contactsDuplicatesQuerySchema,
  contactsDuplicateScanBodySchema,
} from "@mms/contracts";
import { loadContactFieldConfig } from "../../use-cases/contactConfigService.js";
import { collectContactWriteExtraFieldKeys, sanitizeContactsForViewer } from "@mms/contracts";
import {
  enqueueContactBackgroundJob,
  getContactFieldConfigViewerOptions,
  requireContactPermission,
} from "./contactRouteHelpers.js";

/** Contact duplicate check, pairs list, and background scan routes. */
export const contactDuplicateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/duplicate-check", async (request, reply) => {
    const user = request.user as User;
    // Read-only existence probe (matches the module route action `read` and the
    // students duplicate-check analog): it counts matches, it never writes.
    if (!requireContactPermission(reply, user, "read")) return;
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
    } catch (error) {
      return sendDatabaseError(reply, "Failed to check contact duplicates", error);
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
      return sendDatabaseError(reply, "Failed to load duplicate pairs", err);
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
