import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  questionBankFieldConfigPutBodySchema,
  questionBankPreferencesPutBodySchema,
  composeQuestionBankSettings,
  normalizeQuestionBankModulePreferences,
  normalizeQuestionBankFieldConfigOnly,
  roleHasPermission,
  type User,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";
import {
  getQuestionBankFieldConfig,
  updateQuestionBankFieldConfig,
} from "../../services/questionBankConfigService.js";
import {
  getQuestionBankPreferences,
  updateQuestionBankPreferences,
} from "../../services/questionBankPreferencesService.js";

const auditQuestionBank = createCollectionAuditHelper("questionBank");

export const questionBankSetupConfigRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.addHook("onRequest", authenticateTenant);

  const canViewSetup = (user: User | undefined) =>
    roleHasPermission(user?.role, QUESTION_BANK_MODULE_MANIFEST.permissions.setupView);
  const canWriteSetup = (user: User | undefined) =>
    roleHasPermission(user?.role, QUESTION_BANK_MODULE_MANIFEST.permissions.setupWrite);

  fastify.get("/config/fields", async (request, reply) => {
    if (!canViewSetup(request.user as User | undefined)) return sendForbidden(reply);
    const tenant = getRequestTenant();
    if (!tenant)
      return reply.status(401).send({ type: "auth_required", message: "Tenant required" });
    const raw = await getQuestionBankFieldConfig(tenant);
    const normalized = normalizeQuestionBankFieldConfigOnly(raw);
    return reply.send(normalized);
  });

  fastify.put("/config/fields", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteSetup(user)) return sendForbidden(reply);
    const tenant = getRequestTenant();
    if (!tenant)
      return reply.status(401).send({ type: "auth_required", message: "Tenant required" });

    const parsed = parseRequest(questionBankFieldConfigPutBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    await updateQuestionBankFieldConfig(tenant, parsed.data);
    await auditQuestionBank(
      user,
      "questionBank.field-config",
      "Updated question bank field configuration",
      "field-config",
    );

    const updatedFields = await getQuestionBankFieldConfig(tenant);
    const normalizedFields = normalizeQuestionBankFieldConfigOnly(updatedFields);
    return reply.send(normalizedFields);
  });

  fastify.get("/config/preferences", async (request, reply) => {
    if (!canViewSetup(request.user as User | undefined)) return sendForbidden(reply);
    const tenant = getRequestTenant();
    if (!tenant)
      return reply.status(401).send({ type: "auth_required", message: "Tenant required" });
    const raw = await getQuestionBankPreferences(tenant);
    const normalized = normalizeQuestionBankModulePreferences(raw);
    return reply.send(normalized);
  });

  fastify.put("/config/preferences", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteSetup(user)) return sendForbidden(reply);
    const tenant = getRequestTenant();
    if (!tenant)
      return reply.status(401).send({ type: "auth_required", message: "Tenant required" });

    const parsed = parseRequest(questionBankPreferencesPutBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    await updateQuestionBankPreferences(tenant, parsed.data);
    await auditQuestionBank(
      user,
      "questionBank.preferences",
      "Updated question bank module preferences",
      "preferences",
    );

    const updatedPrefs = await getQuestionBankPreferences(tenant);
    const normalizedPrefs = normalizeQuestionBankModulePreferences(updatedPrefs);
    return reply.send(normalizedPrefs);
  });

  fastify.get("/config/composed", async (request, reply) => {
    if (!canViewSetup(request.user as User | undefined)) return sendForbidden(reply);
    const tenant = getRequestTenant();
    if (!tenant)
      return reply.status(401).send({ type: "auth_required", message: "Tenant required" });
    const [rawFields, rawPrefs] = await Promise.all([
      getQuestionBankFieldConfig(tenant),
      getQuestionBankPreferences(tenant),
    ]);

    const fieldConfig = normalizeQuestionBankFieldConfigOnly(rawFields);
    const prefs = normalizeQuestionBankModulePreferences(rawPrefs);
    const composed = composeQuestionBankSettings(fieldConfig, prefs);
    return reply.send(composed);
  });
};
