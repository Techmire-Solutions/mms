import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountingCurrencySettingsPutSchema,
  exchangeRateListQuerySchema,
  exchangeRateLookupQuerySchema,
  exchangeRatePutBodySchema,
  type User,
} from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sendForbidden, sendIfHttpDomainError, sendDatabaseError } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  getCurrencySettings,
  listExchangeRates,
  lookupExchangeRate,
  updateCurrencySettings,
  upsertExchangeRates,
} from "../../../accounting/use-cases/exchangeRateUseCases.js";
import { exchangeRateDeps as deps } from "../../../accounting/use-cases/exchangeRateDeps.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;
const SETUP_WRITE = { moduleAction: "setupWrite" } as const;

/**
 * IAS 21 currency settings and exchange rates (Accounting → Setup → Currencies & Rates).
 * Currency settings are setup data (`setupWrite`); entering daily rates is routine
 * accounting work, so it needs the ordinary module write action.
 */
export const accountingExchangeRateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/currency-settings", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const tenant = String(request.tenant?.id);
    try {
      // Not readOnly: the first read creates the tenant's settings row.
      const settings = await withTenant(tenant, () => getCurrencySettings(deps, tenant));
      return reply.send({ settings });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load currency settings", error)
      );
    }
  });

  fastify.put("/currency-settings", { config: SETUP_WRITE }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(accountingCurrencySettingsPutSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    try {
      const settings = await withTenant(tenant, () =>
        updateCurrencySettings(deps, { tenant, userId: String(user.id) }, parsed.data),
      );
      return reply.send({ settings });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save currency settings", error)
      );
    }
  });

  fastify.get("/exchange-rates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(exchangeRateListQuerySchema, request.query ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    try {
      const rates = await withTenant(tenant, () => listExchangeRates(deps, tenant, parsed.data), {
        readOnly: true,
      });
      return reply.send({ rates });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load exchange rates", error)
      );
    }
  });

  fastify.get("/exchange-rates/lookup", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(exchangeRateLookupQuerySchema, request.query ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    try {
      const rate = await withTenant(tenant, () => lookupExchangeRate(deps, tenant, parsed.data), {
        readOnly: true,
      });
      return reply.send({ rate });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to look up exchange rate", error)
      );
    }
  });

  fastify.put("/exchange-rates", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(exchangeRatePutBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    try {
      const rates = await withTenant(tenant, () =>
        upsertExchangeRates(deps, { tenant, userId: String(user.id) }, parsed.data.rates),
      );
      return reply.send({ rates });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save exchange rates", error)
      );
    }
  });
};
