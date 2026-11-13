import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountArchiveResponseSchema,
  accountListSchema,
  accountingBulkResultResponseSchema,
  accountRestoreResponseSchema,
  accountsBulkArchiveResponseSchema,
  accountsBulkUpsertResponseSchema,
  entriesBulkUpsertResponseSchema,
  fiscalYearListSchema,
  fiscalYearsBulkUpsertResponseSchema,
  journalEntryWriteListSchema,
  bulkIdsBodySchema,
  resourceIdParamsSchema,
  softDeleteBodySchema,
  type User,
} from "@mms/shared";
import { canDeleteCollection } from "../../services/rbacService.js";
import { sendForbidden, sendIfHttpDomainError, sendDatabaseError } from "../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendValidated } from "../../lib/validatedReply.js";
import {
  registerBulkRoutes,
  registerIncludableBulkRoutes,
  registerMetricsRoute,
  registerSoftDeletableBulkRoutes,
} from "../../lib/crudRouter.js";

import { accountingUseCases } from "../../accounting/use-cases/accountingUseCases.js";
import { assertEntriesPostable } from "../../accounting/use-cases/accountingPostingGuard.js";
import { accountingSetupConfigRoutes } from "./accountingSetupConfigRoutes.js";
import { accountingContractRouter } from "./accounting/accountingContractRouter.js";
import { accountingReportRoutes } from "./accounting/accountingReportRoutes.js";
import { accountingBankingRoutes } from "./accounting/accountingBankingRoutes.js";
import { accountingLedgerOpsRoutes } from "./accounting/accountingLedgerOpsRoutes.js";
import { accountingExchangeRateRoutes } from "./accounting/accountingExchangeRateRoutes.js";
import { accountingFxRevaluationRoutes } from "./accounting/accountingFxRevaluationRoutes.js";
import { accountingIas29Routes } from "./accounting/accountingIas29Routes.js";
import { accountingHedgeRoutes } from "./accounting/accountingHedgeRoutes.js";
import { accountingVoucherNumberingRoutes } from "./accounting/accountingVoucherNumberingRoutes.js";
import { accountingSpecializedEntryRoutes } from "./accounting/accountingSpecializedEntryRoutes.js";
import { accountingSeedChartRoutes } from "./accounting/accountingSeedChartRoutes.js";
import { accountingReversalRoutes } from "./accounting/accountingReversalRoutes.js";
import { accountingExportRoutes } from "./accounting/accountingExportRoutes.js";

const ACCOUNTING_ENTRIES_COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;
const ACCOUNTING_ACCOUNTS_COLLECTION = ACCOUNTING_MODULE_MANIFEST.accountCollectionKey;
const ACCOUNTING_FISCAL_YEARS_COLLECTION = ACCOUNTING_MODULE_MANIFEST.fiscalYearCollectionKey;

/**
 * Accounting module routes — bulk upsert collections + journal soft-delete.
 */
export default async function accountingRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "accounting");

  await fastify.register(
    async (sub) => {
      await sub.register(accountingSetupConfigRoutes);
      await sub.register(accountingExportRoutes);

      registerIncludableBulkRoutes(sub, {
        path: "/accounts",
        collection: ACCOUNTING_ACCOUNTS_COLLECTION,
        schema: accountListSchema,
        saveFn: accountingUseCases.upsertAccounts,
        responseKey: "accounts",
        errorMessagePrefix: "accounts",
        responseSchema: accountsBulkUpsertResponseSchema,

        customGetRoute: true,
      });

      /**
       * Archive / restore routes for the chart of accounts.
       *
       * `deleteAccountById` and `bulkSoftDeleteAccounts` carry the ledger guard
       * ("Cannot archive account with active ledger entries") but were reachable
       * from no HTTP route, so the only "delete" the UI had was an unguarded
       * `isActive: false` write through the bulk upsert. These routes make the
       * guard the thing the UI actually calls.
       */
      sub.delete("/accounts/:id", async (request, reply) => {
        const user = request.user as User;
        if (!canDeleteCollection(user, ACCOUNTING_ACCOUNTS_COLLECTION)) return sendForbidden(reply);
        const params = parseRequest(resourceIdParamsSchema, request.params);
        if (!params.ok) return replyValidationError(reply, params);
        const body = parseRequest(softDeleteBodySchema, request.body ?? {});
        if (!body.ok) return replyValidationError(reply, body);
        try {
          const archived = await accountingUseCases.deleteAccountById(
            params.data.id,
            String(user.id),
            body.data.deletionReason,
          );
          return sendValidated(reply, 200, accountArchiveResponseSchema, {
            success: true,
            archived,
          });
        } catch (error) {
          return (
            sendIfHttpDomainError(reply, error) ??
            sendDatabaseError(reply, "Failed to archive account", error)
          );
        }
      });

      sub.post("/accounts/:id/restore", async (request, reply) => {
        const user = request.user as User;
        if (!canDeleteCollection(user, ACCOUNTING_ACCOUNTS_COLLECTION)) return sendForbidden(reply);
        const params = parseRequest(resourceIdParamsSchema, request.params);
        if (!params.ok) return replyValidationError(reply, params);
        try {
          const restored = await accountingUseCases.restoreAccountById(
            params.data.id,
            String(user.id),
          );
          return sendValidated(reply, 200, accountRestoreResponseSchema, {
            success: true,
            restored,
          });
        } catch (error) {
          return (
            sendIfHttpDomainError(reply, error) ??
            sendDatabaseError(reply, "Failed to restore account", error)
          );
        }
      });

      sub.post("/accounts/bulk-delete", async (request, reply) => {
        const user = request.user as User;
        if (!canDeleteCollection(user, ACCOUNTING_ACCOUNTS_COLLECTION)) return sendForbidden(reply);
        const body = parseRequest(bulkIdsBodySchema, request.body);
        if (!body.ok) return replyValidationError(reply, body);
        try {
          const result = await accountingUseCases.bulkSoftDeleteAccounts(
            body.data.ids.map(String),
            String(user.id),
            body.data.deletionReason,
          );
          return sendValidated(reply, 200, accountsBulkArchiveResponseSchema, {
            success: true,
            ...result,
          });
        } catch (error) {
          return (
            sendIfHttpDomainError(reply, error) ??
            sendDatabaseError(reply, "Failed to archive accounts", error)
          );
        }
      });

      registerSoftDeletableBulkRoutes(sub, {
        path: "/entries",
        collection: ACCOUNTING_ENTRIES_COLLECTION,
        schema: journalEntryWriteListSchema,
        loadFn: accountingUseCases.loadEntries,
        saveFn: accountingUseCases.upsertEntries,
        deleteFn: accountingUseCases.deleteJournalEntryById,
        restoreFn: accountingUseCases.restoreJournalEntryById,
        bulkDeleteFn: accountingUseCases.bulkSoftDeleteJournalEntries,
        bulkRestoreFn: (ids, userId) => accountingUseCases.bulkRestoreJournalEntries(ids, userId),
        responseKey: "entries",
        errorMessagePrefix: "entries",
        nameSingular: "Journal entry",
        responseSchema: entriesBulkUpsertResponseSchema,
        bulkResponseSchema: accountingBulkResultResponseSchema,

        // Drafts need `accounting.write`; making a voucher final needs
        // `accounting.post` (Junior vs Senior Accountant).
        beforeSave: async (user, entries) => {
          await assertEntriesPostable(user, entries, (id) => accountingUseCases.loadEntryById(id));
          return entries;
        },

        // Posted-entry refusal is a domain 422 with `code: accounting.voucher.posted`
        // (see the delete use case); the old message-sniffing mapper turned it into
        // `400 { error }`, breaking the shared envelope.
        customGetRoute: true,
      });

      registerBulkRoutes(sub, {
        path: "/fiscal-years",
        collection: ACCOUNTING_FISCAL_YEARS_COLLECTION,
        schema: fiscalYearListSchema,
        saveFn: accountingUseCases.upsertFiscalYears,
        responseKey: "fiscalYears",
        errorMessagePrefix: "fiscal years",
        responseSchema: fiscalYearsBulkUpsertResponseSchema,
        customGetRoute: true,
      });

      registerMetricsRoute(sub, {
        collection: ACCOUNTING_ENTRIES_COLLECTION,
        loadMetricsFn: accountingUseCases.loadAccountingCommandMetrics,
        errorMessagePrefix: "accounting",
      });

      await sub.register(accountingReportRoutes);
      await sub.register(accountingLedgerOpsRoutes);
      await sub.register(accountingBankingRoutes);
      await sub.register(accountingExchangeRateRoutes);
      await sub.register(accountingFxRevaluationRoutes);
      await sub.register(accountingIas29Routes);
      await sub.register(accountingHedgeRoutes);
      await sub.register(accountingVoucherNumberingRoutes);
      await sub.register(accountingSpecializedEntryRoutes);
      await sub.register(accountingSeedChartRoutes);
      await sub.register(accountingReversalRoutes);
    },
    { prefix: "/api/accounting" },
  );

  await fastify.register(accountingContractRouter);
}
