import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { FINANCE_MODULE_MANIFEST } from "@mms/contracts";
import { registerStandardExtendedRoutes } from "@mms/be-core/http/crud";
import { registerSingleRestoreRoute } from "@mms/be-core/http/crud";

import { financeUseCases } from "./use-cases/index.js";
import { financeReportRoutes } from "./routes/financeReportRoutes.js";
import { financeSetupConfigRoutes } from "./routes/financeSetupConfigRoutes.js";
import { financeBillingRoutes } from "./routes/financeBillingRoutes.js";
import { financeCollectRoutes } from "./routes/financeCollectRoutes.js";
import { financeExportRoutes } from "./routes/financeExportRoutes.js";
import { financeContractRouter } from "./routes/financeContractRouter.js";

const FINANCE_COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;
const PAYMENT_COLLECTION = FINANCE_MODULE_MANIFEST.paymentCollectionKey;

/**
 * Finance module routes — invoices, payments, metrics, and column preferences.
 */
export default async function financeRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
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
