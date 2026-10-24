import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { FINANCE_MODULE_MANIFEST } from "@mms/shared";
import { registerStandardExtendedRoutes } from "../../lib/crudStandardRoutes.js";
import { registerSingleRestoreRoute } from "../../lib/crudResourceRoutes.js";

import { financeUseCases } from "../../finance/use-cases/financeUseCases.js";
import { financeReportRoutes } from "./finance/financeReportRoutes.js";
import { financeSetupConfigRoutes } from "./finance/financeSetupConfigRoutes.js";
import { financeBillingRoutes } from "./finance/financeBillingRoutes.js";
import { financeCollectRoutes } from "./finance/financeCollectRoutes.js";
import { financeExportRoutes } from "./finance/financeExportRoutes.js";
import { financeContractRouter } from "./finance/financeContractRouter.js";

const FINANCE_COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;
const PAYMENT_COLLECTION = FINANCE_MODULE_MANIFEST.paymentCollectionKey;

/**
 * Finance module routes — invoices, payments, metrics, and column preferences.
 */
export default async function financeRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "finance");

  await fastify.register(financeReportRoutes, { prefix: "/api/finance" });
  await fastify.register(financeSetupConfigRoutes, { prefix: "/api/finance" });
  await fastify.register(financeBillingRoutes, { prefix: "/api/finance" });
  await fastify.register(financeCollectRoutes, { prefix: "/api/finance" });
  await fastify.register(financeExportRoutes, { prefix: "/api/finance" });

  await fastify.register(
    async (sub) => {
      // --- Invoices Extended Routes (Column Preferences, etc) ---
      registerStandardExtendedRoutes(sub, {
        prefix: "/invoices",
        collection: FINANCE_COLLECTION,
        errorMessagePrefix: "invoices",
        nameSingular: "invoice",
      });

      registerSingleRestoreRoute(sub, {
        prefix: "/invoices",
        collection: FINANCE_COLLECTION,
        nameSingular: "invoice",
        restoreFn: (id, userId) => financeUseCases.restoreInvoiceById(id, userId),
      });

      // --- Payments Extended Routes (Column Preferences, etc) ---
      registerStandardExtendedRoutes(sub, {
        prefix: "/payments",
        collection: PAYMENT_COLLECTION,
        errorMessagePrefix: "payments",
        nameSingular: "payment",
      });

      registerSingleRestoreRoute(sub, {
        prefix: "/payments",
        collection: PAYMENT_COLLECTION,
        nameSingular: "payment",
        restoreFn: (id, userId) => financeUseCases.restorePaymentById(id, userId),
      });
    },
    { prefix: "/api/finance" },
  );

  await fastify.register(financeContractRouter);
}
